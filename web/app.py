import os, json, subprocess, re, threading, sys, socket, argparse, time, uuid, shutil, webbrowser, urllib.request, urllib.parse, mimetypes
from pathlib import Path
from flask import Flask, render_template, jsonify, request, send_file

app = Flask(__name__)
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024 * 1024

_BIND = os.environ.get("QURAN_BIND", "127.0.0.1")
_ALLOWED_ORIGIN = re.compile(r"^(?:https?://(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?|tauri://localhost|http://tauri\.localhost)$")


@app.before_request
def _same_origin_guard():
    if _BIND != "127.0.0.1":
        return None
    hostname = request.host.split(":")[0].strip("[]")
    if hostname not in ("127.0.0.1", "localhost", "::1"):
        return jsonify({"error": "forbidden"}), 403
    origin = request.headers.get("Origin")
    if origin is not None and not _ALLOWED_ORIGIN.match(origin):
        return jsonify({"error": "forbidden"}), 403
    return None


_CSP = (
    "default-src 'self'; script-src 'self'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
    "img-src 'self' data: https://*.ytimg.com https://img.youtube.com https://*.ggpht.com; "
    "media-src 'self' http: https:; connect-src 'self'; object-src 'none'; "
    "base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
)


@app.after_request
def _set_csp(resp):
    if resp.mimetype == "text/html":
        resp.headers["Content-Security-Policy"] = _CSP
    return resp

# Determine data directory (cross-platform)
if sys.platform == "win32":
    base_data_dir = os.path.expanduser("~/AppData/Local/quran-app")
else:
    base_data_dir = os.path.expanduser("~/.local/share/quran-app")

DATA_DIR = base_data_dir
OLD_DATA_DIR = os.path.expanduser("~/.local/share/nasheed-app")

# Migrate from old location if needed
if not os.path.exists(DATA_DIR) and os.path.exists(OLD_DATA_DIR):
    os.makedirs(os.path.dirname(DATA_DIR), exist_ok=True)
    os.rename(OLD_DATA_DIR, DATA_DIR)

os.makedirs(DATA_DIR, exist_ok=True)
LIB_FILE = os.path.join(DATA_DIR, "library.json")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"

# Configure template and static folders for frozen app
if getattr(sys, "frozen", False):
    # Running as frozen executable (PyInstaller)
    base_path = sys._MEIPASS
    app.template_folder = os.path.join(base_path, "templates")
    app.static_folder = os.path.join(base_path, "static")
    if "SSL_CERT_FILE" not in os.environ:
        for _ca_file in (
            "/etc/ssl/certs/ca-certificates.crt",
            "/etc/pki/tls/certs/ca-bundle.crt",
            "/etc/ssl/ca-bundle.pem",
            "/etc/ssl/cert.pem",
        ):
            if os.path.isfile(_ca_file):
                os.environ["SSL_CERT_FILE"] = _ca_file
                break
else:
    # Running from source
    base_path = os.path.dirname(os.path.abspath(__file__))
    app.template_folder = os.path.join(base_path, "templates")
    app.static_folder = os.path.join(base_path, "static")


def find_free_port(start_port=5000, max_port=65535):
    """Find the first free port starting from start_port."""
    for port in range(start_port, max_port + 1):
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.bind(("127.0.0.1", port))
            sock.close()
            return port
        except OSError:
            continue
    raise RuntimeError(f"No free ports found between {start_port} and {max_port}")


def watch_parent_stdin():
    """Exit the backend when it is orphaned.

    The desktop app keeps our stdin pipe open for our whole lifetime. Reaching
    EOF on that pipe means the app is gone (PyInstaller onefile: the bootloader
    forwards the same pipe to us). Only active when QURAN_STDIN_WATCH=1 is set
    by the Tauri wrapper, so dev runs and CI smoke tests are unaffected.
    """
    if os.environ.get("QURAN_STDIN_WATCH") != "1":
        return
    try:
        fd = os.dup(0)
    except OSError:
        try:
            fd = sys.stdin.fileno()
        except Exception:
            return

    def _wait_eof():
        chunk = b"x"
        try:
            while chunk:
                chunk = os.read(fd, 65536)
        except OSError:
            pass
        os._exit(0)

    threading.Thread(target=_wait_eof, daemon=True).start()


def app_version():
    v = os.environ.get("QURAN_VERSION")
    if v:
        return v
    try:
        pkg = Path(__file__).resolve().parent.parent / "package.json"
        return json.loads(pkg.read_text())["version"]
    except Exception:
        return "unknown"


def find_ytdlp():
    """Find yt-dlp binary: YTDLP_PATH env var, sidecar, or PATH."""
    # Check YTDLP_PATH environment variable
    if "YTDLP_PATH" in os.environ:
        path = os.environ["YTDLP_PATH"]
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path

    # Check for sidecar binary next to executable
    if getattr(sys, "frozen", False):
        exe_dir = os.path.dirname(sys.executable)
        sidecar_name = "yt-dlp.exe" if sys.platform == "win32" else "yt-dlp"
        sidecar_path = os.path.join(exe_dir, sidecar_name)
        if os.path.isfile(sidecar_path) and os.access(sidecar_path, os.X_OK):
            return sidecar_path

    # Check PATH
    if sys.platform == "win32":
        result = subprocess.run(["where", "yt-dlp"], capture_output=True, text=True)
    else:
        result = subprocess.run(["which", "yt-dlp"], capture_output=True, text=True)
    if result.returncode == 0:
        return result.stdout.strip()

    return None


YTDLP_PATH = find_ytdlp()
_yt_sem = threading.Semaphore(4)


def load_lib():
    if os.path.exists(LIB_FILE):
        with open(LIB_FILE) as f:
            return json.load(f)
    return {"songs": [], "playlists": [{"name": "Favorites", "songs": []}]}


def save_lib(data):
    tmp = LIB_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, LIB_FILE)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/search")
def api_search():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([])
    if not YTDLP_PATH:
        return jsonify({"error": "yt-dlp not found"}), 500
    cmd = [YTDLP_PATH, f"ytsearch15:{q}", "--flat-playlist", "--dump-json",
           "--no-warnings", "--ignore-errors", "--no-playlist"]
    if not _yt_sem.acquire(timeout=8):
        return jsonify({"error": "search busy, try again"}), 429
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        results = []
        for line in r.stdout.strip().split("\n"):
            if not line:
                continue
            try:
                d = json.loads(line)
                thumb = ""
                if d.get("thumbnails"):
                    thumb = d["thumbnails"][-1].get("url", "")
                results.append({
                    "id": d.get("id", ""),
                    "title": d.get("title", "Unknown"),
                    "channel": d.get("channel", d.get("uploader", "Unknown")),
                    "duration_string": d.get("duration_string", ""),
                    "thumbnail": thumb,
                })
            except json.JSONDecodeError:
                continue
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        _yt_sem.release()


@app.route("/api/stream/<video_id>")
def api_stream(video_id):
    if not YTDLP_PATH:
        return jsonify({"error": "yt-dlp not found"}), 500
    cmd = [YTDLP_PATH, "-f", "bestaudio[ext=m4a]/bestaudio/best", "-g",
           "--no-warnings", "--no-playlist", "--user-agent", UA,
           f"https://www.youtube.com/watch?v={video_id}"]
    if not _yt_sem.acquire(timeout=8):
        return jsonify({"error": "stream busy, try again"}), 429
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        url = r.stdout.strip().split("\n")[0]
        if url.startswith("http"):
            return jsonify({"url": url})
        return jsonify({"error": "no stream"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        _yt_sem.release()


@app.route("/api/library")
def api_library():
    return jsonify(load_lib())


@app.route("/api/version")
def api_version():
    return jsonify({"version": app_version(), "name": "Quran"})


@app.route("/api/open", methods=["POST"])
def api_open():
    url = (request.json or {}).get("url", "")
    parsed = urllib.parse.urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or host not in (
        "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be",
    ):
        return jsonify({"ok": False, "error": "blocked"}), 400
    try:
        webbrowser.open(url)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


def _clean_song(raw):
    if not isinstance(raw, dict):
        return None
    sid = str(raw.get("id") or "")
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", sid):
        return None

    def text(key, cap):
        v = raw.get(key)
        return v.strip()[:cap] if isinstance(v, str) else ""

    thumb = text("thumbnail", 1024)
    if thumb and not thumb.startswith(("/", "http://", "https://")):
        thumb = ""
    url = text("url", 512)
    if url and not url.startswith(("http://", "https://")):
        url = ""
    duration = raw.get("duration")
    if isinstance(duration, bool) or not isinstance(duration, (int, float)):
        duration = None
    return {
        "id": sid,
        "title": text("title", 300) or sid,
        "channel": text("channel", 200),
        "thumbnail": thumb,
        "duration": duration,
        "duration_string": text("duration_string", 32),
        "url": url,
        "favorite": raw.get("favorite") is True,
        "local": raw.get("local") is True,
        "downloaded": raw.get("downloaded") is True,
    }


@app.route("/api/library/add", methods=["POST"])
def api_add():
    song = _clean_song(request.json)
    if not song:
        return jsonify({"error": "invalid song"}), 400
    lib = load_lib()
    if not any(s["id"] == song["id"] for s in lib["songs"]):
        lib["songs"].append(song)
        save_lib(lib)
    return jsonify({"ok": True})


@app.route("/api/library/fav/<sid>", methods=["POST"])
def api_fav(sid):
    lib = load_lib()
    for s in lib["songs"]:
        if s["id"] == sid:
            s["favorite"] = not s.get("favorite", False)
            save_lib(lib)
            return jsonify({"favorite": s["favorite"]})
    return jsonify({"error": "not found"}), 404


DOWNLOAD_DIR = os.path.join(DATA_DIR, "downloads")
LOCAL_DIR = os.path.join(DATA_DIR, "local")


def ensure_dirs():
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    os.makedirs(LOCAL_DIR, exist_ok=True)


def in_dir(path, directory):
    try:
        return os.path.commonpath(
            [os.path.realpath(directory), os.path.realpath(path)]
        ) == os.path.realpath(directory)
    except ValueError:
        return False


def find_lib_song(sid):
    for s in load_lib().get("songs", []):
        if s.get("id") == sid:
            return s
    return None


def song_file_path(song):
    if not song:
        return None
    p = song.get("filepath") or ""
    if p and os.path.isfile(p) and (in_dir(p, DOWNLOAD_DIR) or in_dir(p, LOCAL_DIR)):
        return p
    return None


def delete_song_file(song):
    p = (song or {}).get("filepath") or ""
    if not p or not os.path.isfile(p) or not in_dir(p, DATA_DIR):
        return
    if in_dir(p, DOWNLOAD_DIR) or in_dir(p, LOCAL_DIR):
        try:
            os.remove(p)
        except OSError:
            pass


FILE_MIMES = {
    ".m4a": "audio/mp4",
    ".mp4": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".webm": "audio/webm",
    ".opus": "audio/opus",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".aac": "audio/aac",
}


def file_mime(path):
    ext = os.path.splitext(path)[1].lower()
    return FILE_MIMES.get(ext) or mimetypes.guess_type(path)[0] or "application/octet-stream"


def serve_song_file(path):
    return send_file(
        path,
        mimetype=file_mime(path),
        conditional=True,
        max_age=0,
    )


@app.route("/api/file/<sid>")
def api_file(sid):
    path = song_file_path(find_lib_song(sid))
    if not path:
        return jsonify({"error": "no file"}), 404
    return serve_song_file(path)


_dl_lock = threading.Lock()
_dl_sem = threading.Semaphore(2)
_downloads = {}
DL_FORMATS = "bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio"


def _run_download(sid):
    _dl_sem.acquire()
    try:
        _download_worker(sid)
    finally:
        _dl_sem.release()


def _download_worker(sid):
    if not YTDLP_PATH:
        _downloads[sid] = {"state": "error", "error": "yt-dlp not found"}
        return
    ensure_dirs()
    for f in os.listdir(DOWNLOAD_DIR):
        if f.startswith(sid + "."):
            try:
                os.remove(os.path.join(DOWNLOAD_DIR, f))
            except OSError:
                pass
    outtmpl = os.path.join(DOWNLOAD_DIR, sid + ".%(ext)s")
    cmd = [
        YTDLP_PATH, "-f", DL_FORMATS, "--no-playlist", "--no-warnings",
        "--newline", "-o", outtmpl,
        f"https://www.youtube.com/watch?v={sid}",
    ]
    err = None
    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            text=True,
        )
    except Exception as e:
        _downloads[sid] = {"state": "error", "error": str(e)}
        return
    _downloads[sid]["proc"] = proc
    assert proc.stdout is not None
    for line in proc.stdout:
        m = re.search(r"\[download\]\s+([\d.]+)%", line)
        if m:
            _downloads[sid]["progress"] = float(m.group(1))
        if "ERROR" in line:
            err = line.strip()
    proc.wait()
    if _downloads.get(sid, {}).get("state") != "downloading":
        return
    produced = None
    for f in os.listdir(DOWNLOAD_DIR):
        if f.startswith(sid + ".") and not f.endswith(".part"):
            produced = os.path.join(DOWNLOAD_DIR, f)
            break
    if proc.returncode == 0 and produced:
        lib = load_lib()
        for s in lib["songs"]:
            if s["id"] == sid:
                s["downloaded"] = True
                s["filepath"] = produced
                break
        save_lib(lib)
        _downloads[sid] = {"state": "done", "progress": 100}
    else:
        if produced:
            try:
                os.remove(produced)
            except OSError:
                pass
        _downloads[sid] = {"state": "error", "error": err or "download failed"}


@app.route("/api/download", methods=["POST"])
def api_download():
    sid = (request.json or {}).get("id", "")
    song = find_lib_song(sid)
    if not song:
        return jsonify({"error": "not found"}), 404
    if song.get("local"):
        return jsonify({"error": "already local"}), 400
    if song_file_path(song) and song.get("downloaded"):
        return jsonify({"ok": True, "already": True})
    with _dl_lock:
        st = _downloads.get(sid)
        if st and st.get("state") == "downloading":
            return jsonify({"ok": True, "already": True})
        _downloads[sid] = {"state": "downloading", "progress": 0}
    threading.Thread(target=_run_download, args=(sid,), daemon=True).start()
    return jsonify({"ok": True})


@app.route("/api/download/status")
def api_download_status():
    with _dl_lock:
        out = {
            sid: {
                "state": st.get("state"),
                "progress": st.get("progress", 0),
                "error": st.get("error"),
            }
            for sid, st in _downloads.items()
        }
    return jsonify({"downloads": out})


@app.route("/api/download/remove", methods=["POST"])
def api_download_remove():
    sid = (request.json or {}).get("id", "")
    with _dl_lock:
        st = _downloads.get(sid)
    if st and st.get("state") == "downloading":
        proc = st.get("proc")
        if proc:
            try:
                proc.kill()
            except OSError:
                pass
        with _dl_lock:
            _downloads.pop(sid, None)
        return jsonify({"ok": True, "canceled": True})
    lib = load_lib()
    for s in lib["songs"]:
        if s["id"] == sid:
            delete_song_file(s)
            s.pop("filepath", None)
            s.pop("downloaded", None)
            save_lib(lib)
            break
    with _dl_lock:
        _downloads.pop(sid, None)
    return jsonify({"ok": True})


LOCAL_EXTS = {".mp3", ".m4a", ".mp4", ".webm", ".ogg", ".oga", ".opus", ".wav", ".flac", ".aac"}


def file_duration(path):
    try:
        import mutagen
        f = mutagen.File(path)
        if f is not None and getattr(f, "info", None) is not None:
            length = getattr(f.info, "length", None)
            if length:
                return float(length)
    except Exception:
        pass
    return None


def fmt_duration(sec):
    sec = int(sec or 0)
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def embedded_art(path):
    try:
        import mutagen
        f = mutagen.File(path)
    except Exception:
        return None
    if f is None:
        return None
    data = None
    try:
        tags = f.tags
        if tags is not None:
            if hasattr(tags, "getall"):
                apics = tags.getall("APIC")
                if apics:
                    data = apics[0].data
            if data is None:
                pics = getattr(f, "pictures", None)
                if pics:
                    data = pics[0].data
            if data is None:
                try:
                    covr = tags.get("covr")
                except Exception:
                    covr = None
                if covr:
                    data = bytes(covr[0])
            if data is None:
                try:
                    import base64
                    from mutagen.flac import Picture
                    blk = tags.get("metadata_block_picture")
                    if blk:
                        data = Picture(base64.b64decode(blk[0])).data
                except Exception:
                    data = None
    except Exception:
        return None
    return data or None


def shrink_art(data):
    try:
        import io
        from PIL import Image
        im = Image.open(io.BytesIO(data))
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        im.thumbnail((512, 512))
        out = io.BytesIO()
        im.save(out, "JPEG", quality=85)
        return out.getvalue()
    except Exception:
        return None


def store_local_art(sid, raw):
    data = shrink_art(raw)
    if not data:
        return ""
    path = os.path.join(LOCAL_DIR, sid + ".art.jpg")
    try:
        with open(path, "wb") as h:
            h.write(data)
    except OSError:
        return ""
    return path


def attach_local_art(song):
    fp = song.get("filepath") or ""
    song["artfile"] = ""
    if not fp or not os.path.isfile(fp):
        return False
    raw = embedded_art(fp)
    if not raw:
        return False
    ap = store_local_art(song["id"], raw)
    if not ap:
        return False
    song["artfile"] = ap
    song["thumbnail"] = "/api/local-thumb/" + song["id"]
    return True


def backfill_local_art():
    lib = load_lib()
    changed = False
    for s in lib.get("songs", []):
        if not s.get("local") or "artfile" in s:
            continue
        attach_local_art(s)
        fp = s.get("filepath") or ""
        if fp and os.path.isfile(fp) and not s.get("duration"):
            d = file_duration(fp)
            if d:
                s["duration"] = d
                s["duration_string"] = fmt_duration(d)
        changed = True
    if changed:
        save_lib(lib)


backfill_local_art()


@app.route("/api/local", methods=["POST"])
def api_local():
    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify({"error": "file required"}), 400
    ext = os.path.splitext(f.filename)[1].lower()
    if ext not in LOCAL_EXTS:
        return jsonify({"error": "unsupported file type"}), 400
    ensure_dirs()
    sid = "local-" + uuid.uuid4().hex[:12]
    path = os.path.join(LOCAL_DIR, sid + ext)
    try:
        f.save(path)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    title = os.path.splitext(os.path.basename(f.filename))[0].strip() or "Local nasheed"
    dur = file_duration(path)
    song = {
        "id": sid,
        "title": title,
        "channel": "Local nasheeds",
        "thumbnail": "",
        "duration": dur,
        "duration_string": fmt_duration(dur) if dur else "",
        "url": "",
        "favorite": False,
        "local": True,
        "filepath": path,
    }
    attach_local_art(song)
    lib = load_lib()
    lib["songs"].append(song)
    save_lib(lib)
    return jsonify({"ok": True, "song": song})


@app.route("/api/local-thumb/<sid>")
def api_local_thumb(sid):
    s = find_lib_song(sid)
    p = (s or {}).get("artfile") or ""
    if not s or not s.get("local") or not p or not in_dir(p, LOCAL_DIR) or not os.path.isfile(p):
        return "", 404
    return send_file(p)


@app.route("/api/library/remove/<sid>", methods=["POST"])
def api_remove(sid):
    lib = load_lib()
    removed = [s for s in lib["songs"] if s["id"] == sid]
    lib["songs"] = [s for s in lib["songs"] if s["id"] != sid]
    for pl in lib["playlists"]:
        pl["songs"] = [s for s in pl["songs"] if s["id"] != sid]
    save_lib(lib)
    for s in removed:
        delete_song_file(s)
        ap = s.get("artfile") or ""
        if ap and in_dir(ap, LOCAL_DIR) and os.path.isfile(ap):
            try:
                os.remove(ap)
            except OSError:
                pass
    with _dl_lock:
        _downloads.pop(sid, None)
    return jsonify({"ok": True})


@app.route("/api/playlists")
def api_playlists():
    return jsonify(load_lib().get("playlists", []))


@app.route("/api/playlists/create", methods=["POST"])
def api_pl_create():
    name = request.json.get("name", "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    lib = load_lib()
    if not any(p["name"] == name for p in lib["playlists"]):
        lib["playlists"].append({"name": name, "songs": []})
        save_lib(lib)
    return jsonify({"ok": True})


@app.route("/api/playlists/<name>/add", methods=["POST"])
def api_pl_add(name):
    song = _clean_song(request.json)
    if not song:
        return jsonify({"error": "invalid song"}), 400
    lib = load_lib()
    for pl in lib["playlists"]:
        if pl["name"] == name:
            if not any(s["id"] == song["id"] for s in pl["songs"]):
                pl["songs"].append(song)
                save_lib(lib)
            return jsonify({"ok": True})
    return jsonify({"error": "not found"}), 404


@app.route("/api/playlists/<name>/remove/<sid>", methods=["POST"])
def api_pl_remove(name, sid):
    lib = load_lib()
    for pl in lib["playlists"]:
        if pl["name"] == name:
            pl["songs"] = [s for s in pl["songs"] if s["id"] != sid]
            save_lib(lib)
            return jsonify({"ok": True})
    return jsonify({"error": "not found"}), 404


@app.route("/api/playlists/delete", methods=["POST"])
def api_pl_delete():
    name = request.json.get("name", "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    lib = load_lib()
    before = len(lib["playlists"])
    lib["playlists"] = [p for p in lib["playlists"] if p["name"] != name]
    if len(lib["playlists"]) == before:
        return jsonify({"error": "not found"}), 404
    save_lib(lib)
    return jsonify({"ok": True})


@app.route("/api/playlists/rename", methods=["POST"])
def api_pl_rename():
    old = request.json.get("old", "").strip()
    new = request.json.get("new", "").strip()
    if not old or not new:
        return jsonify({"error": "name required"}), 400
    lib = load_lib()
    pl = next((p for p in lib["playlists"] if p["name"] == old), None)
    if pl is None:
        return jsonify({"error": "not found"}), 404
    if old == new:
        return jsonify({"ok": True})
    if any(p["name"] == new for p in lib["playlists"]):
        return jsonify({"error": "exists"}), 409
    pl["name"] = new
    save_lib(lib)
    return jsonify({"ok": True})


import urllib.request as _urllib
from flask import request

_stream_cache = {}


def resolve_stream(video_id):
    if video_id in _stream_cache:
        _stream_cache[video_id] = _stream_cache.pop(video_id)
        return _stream_cache[video_id]
    if not YTDLP_PATH:
        raise ValueError("yt-dlp not found")
    cmd = [YTDLP_PATH, "-f", "bestaudio[ext=m4a]/bestaudio/best", "-g",
           "--no-warnings", "--no-playlist", "--user-agent", UA,
           f"https://www.youtube.com/watch?v={video_id}"]
    if not _yt_sem.acquire(timeout=15):
        raise ValueError("Stream lookup busy, try again")
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    finally:
        _yt_sem.release()
    url = r.stdout.strip().split("\n")[0]
    if not url.startswith("http"):
        raise ValueError("No stream")
    _stream_cache[video_id] = url
    while len(_stream_cache) > 64:
        _stream_cache.pop(next(iter(_stream_cache)))
    return url


@app.route("/api/warm/<video_id>")
def api_warm(video_id):
    try:
        resolve_stream(video_id)
        return "", 204
    except Exception as e:
        return str(e), 500


@app.route("/api/proxy/<video_id>")
def api_proxy(video_id):
    local_path = song_file_path(find_lib_song(video_id))
    if local_path:
        return serve_song_file(local_path)
    try:
        url = resolve_stream(video_id)
    except Exception as e:
        return str(e), 500

    range_header = request.headers.get("Range")

    try:
        req_headers = {"User-Agent": UA}
        if range_header:
            req_headers["Range"] = range_header
        req = _urllib.Request(url, headers=req_headers)
        resp = _urllib.urlopen(req, timeout=30)

        resp_headers = {
            "Content-Type": resp.headers.get("Content-Type", "audio/mp4"),
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
        }
        cl = resp.headers.get("Content-Length")
        if cl:
            resp_headers["Content-Length"] = cl
        cr = resp.headers.get("Content-Range")
        if cr:
            resp_headers["Content-Range"] = cr

        status = resp.status if resp.status in (200, 206) else 200

        def generate():
            while True:
                chunk = resp.read(65536)
                if not chunk:
                    break
                yield chunk

        return app.response_class(generate(), status=status, headers=resp_headers)
    except Exception as e:
        _stream_cache.pop(video_id, None)
        return str(e), 500


_quran_cache = {}


def _cache_put(key, value):
    _quran_cache[key] = value
    while len(_quran_cache) > 96:
        _quran_cache.pop(next(iter(_quran_cache)))


def _quran_get(url, key, timeout=20):
    if key in _quran_cache:
        return _quran_cache[key]
    req = _urllib.Request(url, headers={"User-Agent": UA})
    with _urllib.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    _cache_put(key, data)
    return data


def _quran_style_score(name):
    n = (name or "").lower()
    if "hafs" in n and "murattal" in n:
        return 0
    if "hafs" in n:
        return 1
    if "murattal" in n:
        return 2
    if "mojawwad" in n or "mujawwad" in n:
        return 4
    return 3


@app.route("/api/quran/chapters")
def api_quran_chapters():
    try:
        return jsonify(_quran_get("https://api.quran.com/api/v4/chapters?language=en", "chapters"))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/quran/reciters")
def api_quran_reciters():
    try:
        data = _quran_get("https://mp3quran.net/api/v3/reciters?language=en", "mp3quran")
        raw = data.get("reciters") or []
        out = []
        seen = set()
        for rec in raw:
            full = []
            for m in rec.get("moshaf") or []:
                parts = {p.strip() for p in (m.get("surah_list") or "").split(",") if p.strip()}
                if m.get("surah_total") == 114 and len(parts) >= 114 and m.get("server"):
                    full.append(m)
            if not full:
                continue
            full.sort(key=lambda m: _quran_style_score(m.get("name")))
            m = full[0]
            name = rec.get("name") or "Reciter"
            label = name
            style = m.get("name") or ""
            if style and "Hafs A'n Assem" not in style and "Murattal" not in style:
                label = f"{name} · {style}"
            if label in seen:
                continue
            seen.add(label)
            out.append({
                "id": int(m.get("id") or rec.get("id")),
                "reciter_name": name,
                "style": style or None,
                "label": label,
                "server": m["server"],
            })
        out.sort(key=lambda r: r["reciter_name"].lower())
        return jsonify({"recitations": out, "source": "mp3quran"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/quran/chapter_audio/<int:moshaf_id>/<int:chapter_id>")
def api_quran_chapter_audio(moshaf_id, chapter_id):
    key = f"audio:{moshaf_id}:{chapter_id}"
    if key in _quran_cache:
        return jsonify(_quran_cache[key])
    try:
        data = _quran_get("https://mp3quran.net/api/v3/reciters?language=en", "mp3quran")
        server = None
        for rec in data.get("reciters") or []:
            for m in rec.get("moshaf") or []:
                if int(m.get("id") or -1) == moshaf_id:
                    server = m.get("server")
                    break
            if server:
                break
        if not server:
            return jsonify({"error": "reciter not found"}), 404
        url = f"{server}{chapter_id:03d}.mp3"
        payload = {"url": url, "format": "mp3"}
        _cache_put(key, payload)
        return jsonify(payload)
    except Exception as e:
        _quran_cache.pop(key, None)
        return jsonify({"error": str(e)}), 500


_QURAN_TRANS_IDS = {"en": 20, "ta": 133}
_QURAN_TRANS_NAMES = {"en": "Saheeh International", "ta": "Abdul Hameed Baqavi"}


def _strip_verse_html(text):
    text = re.sub(r"<sup[^>]*>.*?</sup>", "", text, flags=re.S)
    text = re.sub(r"<[^>]+>", "", text)
    return text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&#39;", "'").replace("&quot;", '"').strip()


@app.route("/api/quran/translation/<int:chapter_id>")
def api_quran_translation(chapter_id):
    if not 1 <= chapter_id <= 114:
        return jsonify({"error": "bad chapter"}), 400
    lang = (request.args.get("lang") or "en").lower()
    if lang not in _QURAN_TRANS_IDS:
        lang = "en"
    rid = _QURAN_TRANS_IDS[lang]
    try:
        data = _quran_get(
            f"https://api.quran.com/api/v4/verses/by_chapter/{chapter_id}"
            f"?fields=text_uthmani&translations={rid}&per_page=300",
            f"ayahs:{rid}:{chapter_id}",
        )
        verses = []
        for v in data.get("verses") or []:
            trs = v.get("translations") or []
            verses.append({
                "num": v.get("verse_number") or len(verses) + 1,
                "arabic": v.get("text_uthmani") or "",
                "text": _strip_verse_html(trs[0].get("text") if trs else ""),
            })
        return jsonify({"lang": lang, "name": _QURAN_TRANS_NAMES[lang], "verses": verses})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


_DISCORD_CLIENT_ID = "1558502162080858172"
_DISCORD_LOGO_URL = "https://raw.githubusercontent.com/goldstac/quran/main/app_logo.png"
_DISCORD_REPO_URL = "https://github.com/goldstac/quran"


def _discord_decorate(activity):
    a = dict(activity)
    a.setdefault("type", 2)
    a.setdefault("status_display_type", 2)
    a.setdefault("assets", {"large_image": _DISCORD_LOGO_URL, "large_text": "Quran"})
    a.setdefault("buttons", [{"label": "Get Quran", "url": _DISCORD_REPO_URL}])
    return a


def _discord_socket_paths():
    if sys.platform == "win32":
        return [rf"\\.\pipe\discord-ipc-{i}" for i in range(10)]
    if sys.platform == "darwin":
        return [os.path.join(os.environ.get("TMPDIR", "/tmp"), "discord-ipc-0")]
    runtime = os.environ.get("XDG_RUNTIME_DIR")
    return ([os.path.join(runtime, "discord-ipc-0")] if runtime else []) + ["/tmp/discord-ipc-0"]


class DiscordBridge:
    RETRY_INTERVAL = 5
    HEARTBEAT_TIMEOUT = 120
    CONNECT_TIMEOUT = 10

    def __init__(self):
        self._lock = threading.Lock()
        self._enabled = False
        self._activity = None
        self._sock = None
        self._connected = False
        self._last_sent = None
        self._last_seen = 0.0
        self._last_try = 0.0
        self._connect_at = 0.0
        threading.Thread(target=self._loop, daemon=True).start()

    def set(self, enabled=False, activity=None):
        with self._lock:
            self._enabled = bool(enabled)
            self._last_seen = time.time()
            self._activity = activity if enabled else None

    def touch(self):
        with self._lock:
            self._last_seen = time.time()

    def state(self):
        with self._lock:
            if not self._enabled:
                return "off"
            if self._connected:
                return "connected"
            if self._sock is not None:
                return "connecting"
            return "no-discord"

    def _loop(self):
        while True:
            try:
                self._step()
            except Exception:
                pass
            time.sleep(0.5)

    def _step(self):
        now = time.time()
        with self._lock:
            enabled = self._enabled
            sock = self._sock
            stale = now - self._last_seen > self.HEARTBEAT_TIMEOUT
            connecting_since = self._connect_at
        if not enabled or stale:
            if sock is not None:
                self._clear(sock)
            return
        if sock is None:
            if now - self._last_try < self.RETRY_INTERVAL:
                return
            self._last_try = now
            new = _discord_socket_connect()
            if new is None:
                return
            with self._lock:
                self._sock = new
                self._connected = False
                self._last_sent = None
                self._connect_at = now
            try:
                _discord_send_frame(new, 0, {"v": 1, "client_id": _DISCORD_CLIENT_ID})
            except OSError:
                self._drop(new)
                return
            threading.Thread(target=self._reader, args=(new,), daemon=True).start()
            return
        with self._lock:
            connected = self._connected
            activity = self._activity
            last_sent = self._last_sent
        if not connected and now - connecting_since > self.CONNECT_TIMEOUT:
            self._drop(sock)
            return
        if connected and activity is not last_sent:
            payload = None
            if isinstance(activity, dict):
                payload = _discord_decorate(activity)
            try:
                _discord_send_frame(
                    sock, 1,
                    {
                        "cmd": "SET_ACTIVITY",
                        "args": {
                            "pid": os.getpid(),
                            "activity": payload or {},
                        },
                        "nonce": uuid.uuid4().hex[:12],
                    },
                )
            except OSError:
                self._drop(sock)
                return
            with self._lock:
                self._last_sent = activity

    def _reader(self, sock):
        buf = b""
        try:
            while True:
                chunk = sock.recv(65536)
                if not chunk:
                    break
                buf += chunk
                while len(buf) >= 8:
                    length = int.from_bytes(buf[4:8], "little")
                    if len(buf) < 8 + length:
                        break
                    opcode = int.from_bytes(buf[0:4], "little")
                    payload = buf[8:8 + length]
                    buf = buf[8 + length:]
                    if opcode == 1:
                        try:
                            msg = json.loads(payload.decode("utf-8"))
                        except ValueError:
                            continue
                        if msg.get("evt") == "READY":
                            with self._lock:
                                self._connected = True
                                self._last_sent = None
        except OSError:
            pass
        self._drop(sock)

    def _clear(self, sock):
        try:
            _discord_send_frame(
                sock, 1,
                {
                    "cmd": "SET_ACTIVITY",
                    "args": {"pid": os.getpid(), "activity": {}},
                    "nonce": uuid.uuid4().hex[:12],
                },
            )
        except OSError:
            pass
        self._drop(sock)

    def _drop(self, sock):
        if sock is None:
            return
        with self._lock:
            if self._sock is sock:
                self._sock = None
                self._connected = False
                self._last_sent = None
        try:
            sock.close()
        except OSError:
            pass


def _discord_socket_connect():
    for path in _discord_socket_paths():
        try:
            s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            s.settimeout(3)
            s.connect(path)
            s.settimeout(None)
            return s
        except OSError:
            continue
    return None


def _discord_send_frame(sock, opcode, payload):
    data = json.dumps(payload).encode("utf-8")
    header = opcode.to_bytes(4, "little") + len(data).to_bytes(4, "little")
    sock.sendall(header + data)


_discord = DiscordBridge()
_DISCORD_PREF_FILE = os.path.join(DATA_DIR, "discord.json")


def _discord_pref_read():
    try:
        with open(_DISCORD_PREF_FILE) as f:
            return bool(json.load(f).get("enabled"))
    except Exception:
        return None


def _discord_pref_write(enabled):
    try:
        with open(_DISCORD_PREF_FILE, "w") as f:
            json.dump({"enabled": bool(enabled)}, f)
    except Exception:
        pass


@app.route("/api/discord", methods=["POST"])
def api_discord():
    data = request.json or {}
    _discord.set(bool(data.get("enabled")), data.get("activity"))
    if data.get("remember"):
        _discord_pref_write(bool(data.get("enabled")))
    return jsonify({"ok": True})


@app.route("/api/discord/status")
def api_discord_status():
    if request.args.get("alive") == "1":
        _discord.touch()
    return jsonify({"state": _discord.state(), "enabled": _discord_pref_read()})


# --- DISCORD BOT SYNC (drives su!track / su!fm on the user's own bot) ---
import urllib.error

_BOT_FILE = os.path.join(DATA_DIR, "bot.json")
_BOT_DEFAULT_URL = "http://127.0.0.1:3000"
_bot_last = {"at": 0, "ok": None, "error": ""}


def _bot_read():
    try:
        with open(_BOT_FILE) as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _bot_write(cfg):
    try:
        with open(_BOT_FILE, "w") as f:
            json.dump(cfg, f, indent=2)
    except Exception:
        pass


def _bot_url(cfg):
    return (cfg.get("url") or _BOT_DEFAULT_URL).rstrip("/")


def _bot_request(url, path, payload, token=None, timeout=8):
    headers = {"Content-Type": "application/json", "User-Agent": "quran-app"}
    if token:
        headers["Authorization"] = token
    req = urllib.request.Request(
        url + path, data=json.dumps(payload).encode(), headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read(65536).decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read(65536).decode() or "{}")
        except Exception:
            return e.code, {}


def _bot_post_event(url, token, payload):
    if _clean_bot_url(url) is None:
        return
    try:
        status, res = _bot_request(url, "/api/quran/event", payload, token=token)
        if status < 400:
            _bot_last.update({"at": time.time(), "ok": True, "error": ""})
        else:
            _bot_last.update({
                "at": time.time(),
                "ok": False,
                "error": res.get("error") or f"HTTP {status}",
            })
    except Exception as e:
        _bot_last.update({"at": time.time(), "ok": False, "error": str(e)})


@app.route("/api/bot")
def api_bot_get():
    cfg = _bot_read()
    return jsonify({
        "enabled": bool(cfg.get("enabled")),
        "url": _bot_url(cfg),
        "linked": bool(cfg.get("token")),
        "user": cfg.get("user"),
        "last": _bot_last,
    })


def _clean_bot_url(raw):
    u = str(raw or "").strip().rstrip("/")
    if not u or len(u) > 300:
        return None
    p = urllib.parse.urlparse(u)
    if p.scheme not in ("http", "https") or not p.hostname or p.username is not None:
        return None
    return u


@app.route("/api/bot", methods=["POST"])
def api_bot_set():
    data = request.json or {}
    cfg = _bot_read()
    if "enabled" in data:
        cfg["enabled"] = bool(data["enabled"])
    if "url" in data:
        cleaned = _clean_bot_url(data["url"])
        if cleaned is None and data["url"] not in ("", None):
            return jsonify({"error": "Enter an http address like http://127.0.0.1:3000"}), 400
        cfg["url"] = cleaned or _BOT_DEFAULT_URL
    _bot_write(cfg)
    return jsonify({"ok": True, "enabled": bool(cfg.get("enabled")), "url": _bot_url(cfg)})


@app.route("/api/bot/link", methods=["POST"])
def api_bot_link():
    data = request.json or {}
    code = str(data.get("code") or "").strip()
    if not code:
        return jsonify({"error": "Paste the code from su!track link"}), 400
    cfg = _bot_read()
    url = _clean_bot_url(data.get("url")) or _bot_url(cfg)
    if _clean_bot_url(url) is None:
        return jsonify({"error": "That does not look like an http(s) bot address"}), 400
    try:
        status, res = _bot_request(url, "/api/quran/link", {"code": code}, timeout=10)
    except Exception:
        return jsonify({"error": f"Could not reach your bot at {url}"}), 502
    if status >= 400 or not res.get("ok"):
        return jsonify({"error": str(res.get("error") or "That code did not work")[:300]}), 400
    cfg.update({"url": url, "token": res.get("token"), "user": res.get("user")})
    cfg.setdefault("enabled", True)
    _bot_write(cfg)
    return jsonify({"ok": True, "url": url, "user": res.get("user")})


@app.route("/api/bot/unlink", methods=["POST"])
def api_bot_unlink():
    cfg = _bot_read()
    cfg.pop("token", None)
    cfg.pop("user", None)
    _bot_write(cfg)
    return jsonify({"ok": True})


@app.route("/api/bot/test", methods=["POST"])
def api_bot_test():
    url = _clean_bot_url(_bot_url(_bot_read()))
    if url is None:
        return jsonify({"error": "Set an http(s) bot address first"}), 400
    try:
        req = urllib.request.Request(url + "/health", headers={"User-Agent": "quran-app"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            d = json.loads(resp.read(65536).decode() or "{}")
        return jsonify({"ok": True, "version": d.get("version"), "status": d.get("status")})
    except Exception:
        return jsonify({"ok": False, "error": f"No response from {url}"}), 502


@app.route("/api/report", methods=["POST"])
def api_report():
    data = request.json or {}
    cfg = _bot_read()
    if not cfg.get("enabled") or not cfg.get("token"):
        return jsonify({"ok": True, "skipped": True})
    payload = {
        "event": str(data.get("event") or ""),
        "position": data.get("position") or 0,
        "songId": str(data.get("songId") or ""),
        "song": data.get("song"),
    }
    threading.Thread(
        target=_bot_post_event, args=(_bot_url(cfg), cfg["token"], payload), daemon=True
    ).start()
    return jsonify({"ok": True})


_GH_RELEASES_URL = "https://api.github.com/repos/goldstac/quran/releases?per_page=60"
UPDATE_DIR = os.path.join(DATA_DIR, "updates")

_update_lock = threading.Lock()
_update_cache = {"at": 0, "releases": None}
_update_state = {
    "state": "idle",
    "tag": "",
    "asset": "",
    "downloaded": 0,
    "total": 0,
    "path": "",
    "error": "",
}


def _prune_update_downloads():
    for name in os.listdir(UPDATE_DIR) if os.path.isdir(UPDATE_DIR) else []:
        try:
            os.remove(os.path.join(UPDATE_DIR, name))
        except OSError:
            pass


_prune_update_downloads()


def _update_asset_matches(name):
    n = (name or "").lower()
    if sys.platform == "win32":
        return n.endswith(".exe") and "setup" in n
    if sys.platform == "darwin":
        return n.endswith(".dmg")
    return n.endswith(".appimage")


def _fetch_releases():
    req = urllib.request.Request(
        _GH_RELEASES_URL,
        headers={"Accept": "application/vnd.github+json", "User-Agent": "quran-app"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _releases(force=False):
    with _update_lock:
        cached = _update_cache["releases"]
        fresh = cached is not None and not force and (time.time() - _update_cache["at"]) < 300
    if fresh:
        return cached, None
    try:
        raw = _fetch_releases()
    except Exception as e:
        return (cached or []), ("stale cache" if cached else str(e))
    out = []
    for rel in raw:
        best = None
        for a in rel.get("assets", []):
            if _update_asset_matches(a.get("name")):
                if best is None or a.get("size", 0) > best.get("size", 0):
                    best = a
        out.append({
            "tag": rel.get("tag_name", ""),
            "name": rel.get("name") or rel.get("tag_name", ""),
            "prerelease": bool(rel.get("prerelease")),
            "published_at": rel.get("published_at"),
            "asset": None if best is None else {
                "name": best.get("name", ""),
                "size": best.get("size", 0),
                "url": best.get("browser_download_url", ""),
            },
        })
    with _update_lock:
        _update_cache["releases"] = out
        _update_cache["at"] = time.time()
    return out, None


@app.route("/api/updates")
def api_updates():
    force = request.args.get("refresh") == "1"
    releases, error = _releases(force=force)
    return jsonify({
        "current": app_version(),
        "platform": sys.platform,
        "releases": releases,
        "error": error,
    })


@app.route("/api/update", methods=["POST"])
def api_update():
    data = request.json or {}
    tag = (data.get("tag") or "").strip()
    if not tag:
        return jsonify({"ok": False, "error": "No version selected"}), 400
    if not tag.startswith("v"):
        tag = "v" + tag
    with _update_lock:
        if _update_state["state"] == "downloading":
            return jsonify({"ok": False, "error": "An update is already downloading"}), 409
    releases, _ = _releases()
    rel = next((r for r in releases if r.get("tag") == tag), None)
    if rel is None:
        return jsonify({"ok": False, "error": f"Release {tag} was not found"}), 404
    asset = rel.get("asset")
    if not asset:
        return jsonify({"ok": False, "error": f"{tag} has no installer for this platform"}), 400
    threading.Thread(
        target=_run_update,
        args=(rel["tag"], asset["url"], asset["name"], asset["size"]),
        daemon=True,
    ).start()
    return jsonify({"ok": True, "tag": tag, "asset": asset["name"]})


def _run_update(tag, url, name, size):
    with _update_lock:
        _update_state.update(
            state="downloading", tag=tag, asset=name, downloaded=0,
            total=size or 0, path="", error="",
        )
    os.makedirs(UPDATE_DIR, exist_ok=True)
    dest = os.path.join(UPDATE_DIR, name)
    tmp = dest + ".part"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "quran-app"})
        with urllib.request.urlopen(req, timeout=60) as resp, open(tmp, "wb") as f:
            total = size or int(resp.headers.get("Content-Length") or 0)
            with _update_lock:
                _update_state["total"] = total
            got = 0
            while True:
                chunk = resp.read(262144)
                if not chunk:
                    break
                f.write(chunk)
                got += len(chunk)
                with _update_lock:
                    _update_state["downloaded"] = got
        os.replace(tmp, dest)
    except Exception as e:
        try:
            os.remove(tmp)
        except OSError:
            pass
        with _update_lock:
            _update_state.update(state="error", error=str(e))
        return
    try:
        _apply_update(dest, tag)
    except Exception as e:
        with _update_lock:
            _update_state.update(state="error", error=str(e))


def _apply_update(path, tag):
    if sys.platform == "win32":
        subprocess.Popen([path])
        with _update_lock:
            _update_state.update(state="launched", path=path)
        return
    if sys.platform == "darwin":
        subprocess.Popen(["open", path])
        with _update_lock:
            _update_state.update(state="launched", path=path)
        return
    os.chmod(path, 0o755)
    running = os.environ.get("APPIMAGE")
    if running and os.path.isfile(running):
        shutil.copy2(path, running)
        os.chmod(running, 0o755)
        try:
            os.remove(path)
        except OSError:
            pass
        with _update_lock:
            _update_state.update(state="installed", path=running)
    else:
        with _update_lock:
            _update_state.update(state="downloaded", path=path)


@app.route("/api/update/status")
def api_update_status():
    with _update_lock:
        return jsonify(dict(_update_state))


@app.route("/api/update/run", methods=["POST"])
def api_update_run():
    with _update_lock:
        path = _update_state["path"]
        state = _update_state["state"]
    if state not in ("downloaded", "installed") or not path or not os.path.isfile(path):
        return jsonify({"ok": False, "error": "Nothing to run"}), 400
    if sys.platform == "darwin":
        subprocess.Popen(["open", path])
    elif sys.platform == "win32":
        os.startfile(path)  # type: ignore[attr-defined]
    else:
        subprocess.Popen([path])
    return jsonify({"ok": True})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=None, help="Port to run on. Default: auto-find from 5000")
    args = parser.parse_args()

    port = args.port if args.port else find_free_port()
    host = _BIND
    print(f"PORT={port}")
    sys.stdout.flush()

    ensure_dirs()
    try:
        for name in os.listdir(DOWNLOAD_DIR):
            if name.endswith(".part"):
                os.remove(os.path.join(DOWNLOAD_DIR, name))
    except OSError:
        pass

    watch_parent_stdin()

    app.run(host=host, port=port, debug=False)
