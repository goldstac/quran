import os, json, subprocess, re, threading
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
app.config["TEMPLATES_AUTO_RELOAD"] = True

DATA_DIR = os.path.expanduser("~/.local/share/quran-app")
OLD_DATA_DIR = os.path.expanduser("~/.local/share/nasheed-app")
if not os.path.exists(DATA_DIR) and os.path.exists(OLD_DATA_DIR):
    os.rename(OLD_DATA_DIR, DATA_DIR)
LIB_FILE = os.path.join(DATA_DIR, "library.json")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"

os.makedirs(DATA_DIR, exist_ok=True)

def load_lib():
    if os.path.exists(LIB_FILE):
        with open(LIB_FILE) as f:
            return json.load(f)
    return {"songs": [], "playlists": [{"name": "Favorites", "songs": []}]}

def save_lib(data):
    with open(LIB_FILE, "w") as f:
        json.dump(data, f, indent=2)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/search")
def api_search():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([])
    cmd = ["yt-dlp", f"ytsearch15:{q}", "--flat-playlist", "--dump-json",
           "--no-warnings", "--ignore-errors", "--no-playlist"]
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

@app.route("/api/stream/<video_id>")
def api_stream(video_id):
    cmd = ["yt-dlp", "-f", "bestaudio[ext=m4a]/bestaudio/best", "-g",
           "--no-warnings", "--no-playlist", "--user-agent", UA,
           f"https://www.youtube.com/watch?v={video_id}"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        url = r.stdout.strip().split("\n")[0]
        if url.startswith("http"):
            return jsonify({"url": url})
        return jsonify({"error": "no stream"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/library")
def api_library():
    return jsonify(load_lib())

@app.route("/api/library/add", methods=["POST"])
def api_add():
    song = request.json
    lib = load_lib()
    if not any(s["id"] == song["id"] for s in lib["songs"]):
        song.setdefault("favorite", False)
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

@app.route("/api/library/remove/<sid>", methods=["POST"])
def api_remove(sid):
    lib = load_lib()
    lib["songs"] = [s for s in lib["songs"] if s["id"] != sid]
    for pl in lib["playlists"]:
        pl["songs"] = [s for s in pl["songs"] if s["id"] != sid]
    save_lib(lib)
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
    song = request.json
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
        return _stream_cache[video_id]
    cmd = ["yt-dlp", "-f", "bestaudio[ext=m4a]/bestaudio/best", "-g",
           "--no-warnings", "--no-playlist", "--user-agent", UA,
           f"https://www.youtube.com/watch?v={video_id}"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    url = r.stdout.strip().split("\n")[0]
    if not url.startswith("http"):
        raise ValueError("No stream")
    _stream_cache[video_id] = url
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

def _quran_get(url, key, timeout=20):
    if key in _quran_cache:
        return _quran_cache[key]
    req = _urllib.Request(url, headers={"User-Agent": UA})
    with _urllib.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    _quran_cache[key] = data
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
        _quran_cache[key] = payload
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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
