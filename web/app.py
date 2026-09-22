import os, json, subprocess, re, threading
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

SAVE_DIR = os.path.expanduser("~/Music/Nasheeds")
DATA_DIR = os.path.expanduser("~/.local/share/nasheed-app")
LIB_FILE = os.path.join(DATA_DIR, "library.json")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"

os.makedirs(SAVE_DIR, exist_ok=True)
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
        song.setdefault("downloaded", False)
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

@app.route("/api/download/<sid>", methods=["POST"])
def api_download(sid):
    lib = load_lib()
    song = next((s for s in lib["songs"] if s["id"] == sid), None)
    cmd = ["yt-dlp", "-f", "bestaudio[ext=m4a]/bestaudio/best",
           "--extract-audio", "--audio-format", "mp3", "--audio-quality", "192K",
           "-o", os.path.join(SAVE_DIR, "%(title)s.%(ext)s"),
           "--no-playlist", "--no-warnings", "--user-agent", UA,
           f"https://www.youtube.com/watch?v={sid}"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        fp = None
        m = re.search(r"\[ExtractAudio\] Destination: (.+)", r.stdout)
        if m:
            fp = m.group(1)
        else:
            m = re.search(r"\[download\] (.+\.mp3)", r.stdout)
            if m:
                fp = m.group(1)
        if fp:
            for s in lib["songs"]:
                if s["id"] == sid:
                    s["downloaded"] = True
                    s["filepath"] = fp
            save_lib(lib)
            return jsonify({"ok": True})
        return jsonify({"error": "failed"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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

import urllib.request as _urllib
from flask import request

_stream_cache = {}

@app.route("/api/proxy/<video_id>")
def api_proxy(video_id):
    if video_id not in _stream_cache:
        cmd = ["yt-dlp", "-f", "bestaudio[ext=m4a]/bestaudio/best", "-g",
               "--no-warnings", "--no-playlist", "--user-agent", UA,
               f"https://www.youtube.com/watch?v={video_id}"]
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            url = r.stdout.strip().split("\n")[0]
            if not url.startswith("http"):
                return "No stream", 404
            _stream_cache[video_id] = url
        except Exception as e:
            return str(e), 500

    url = _stream_cache[video_id]
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

        status = 206 if range_header else 200
        if resp.status == 206:
            status = 206

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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
