import os
import tempfile

import app as backend

SONG = {
    "id": "abc123",
    "title": "Test Nasheed",
    "channel": "Test Channel",
    "thumbnail": "https://example.com/a.jpg",
    "duration": 120,
    "duration_string": "2:00",
    "url": "https://www.youtube.com/watch?v=abc123",
}


def store_file(sid, name="nasheed.mp3"):
    backend.ensure_dirs()
    path = os.path.join(backend.DOWNLOAD_DIR, name)
    with open(path, "wb") as f:
        f.write(b"0123456789")
    song = dict(SONG, id=sid, filepath=path)
    lib = backend.load_lib()
    lib["songs"].append(song)
    backend.save_lib(lib)
    return path


def test_version(client):
    d = client.get("/api/version").get_json()
    assert d["name"] == "Quran"
    assert d["version"]


def test_cache_counts_and_clear(client):
    backend._stream_cache["abc"] = "https://x"
    backend._quran_cache["surah:1"] = {"ok": 1}
    backend._provided_cache["items"] = [{"id": "p1"}]
    backend._update_cache["releases"] = [{"tag": "v1"}]

    assert client.get("/api/cache").get_json() == {"entries": 4}

    r = client.post("/api/cache/clear")
    assert r.status_code == 200
    assert r.get_json() == {"ok": True, "entries": 0}
    assert client.get("/api/cache").get_json() == {"entries": 0}
    assert backend._stream_cache == {}
    assert backend._quran_cache == {}
    assert backend._provided_cache == {"expires": 0, "items": []}
    assert backend._update_cache == {"at": 0, "releases": None}


def test_cache_clear_when_empty(client):
    assert client.post("/api/cache/clear").get_json() == {"ok": True, "entries": 0}


def test_library_add_fav_remove(client):
    assert client.post("/api/library/add", json=SONG).get_json() == {"ok": True}
    lib = client.get("/api/library").get_json()
    assert [s["id"] for s in lib["songs"]] == ["abc123"]
    assert lib["songs"][0]["favorite"] is False

    client.post("/api/library/add", json=SONG)
    assert len(client.get("/api/library").get_json()["songs"]) == 1

    assert client.post("/api/library/add", json={"id": "bad id!"}).status_code == 400

    assert client.post("/api/library/fav/abc123").get_json() == {"favorite": True}
    assert client.post("/api/library/fav/abc123").get_json() == {"favorite": False}
    assert client.post("/api/library/fav/missing").status_code == 404

    assert client.post("/api/library/remove/abc123").get_json() == {"ok": True}
    assert client.get("/api/library").get_json()["songs"] == []


def test_library_remove_cleans_playlists(client):
    client.post("/api/library/add", json=SONG)
    client.post("/api/playlists/create", json={"name": "Chill"})
    client.post("/api/playlists/Chill/add", json=SONG)
    client.post("/api/library/remove/abc123")
    assert client.get("/api/playlists").get_json()[0]["songs"] == []


def test_library_remove_deletes_stored_file(client):
    path = store_file("abc123")
    assert os.path.isfile(path)
    client.post("/api/library/remove/abc123")
    assert not os.path.exists(path)


def test_library_remove_keeps_file_outside_data_dir(client):
    outside = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
    outside.write(b"x")
    outside.close()
    song = dict(SONG, filepath=outside.name)
    lib = backend.load_lib()
    lib["songs"].append(song)
    backend.save_lib(lib)
    client.post("/api/library/remove/abc123")
    assert os.path.isfile(outside.name)
    os.remove(outside.name)


def test_file_serves_plain_and_range(client):
    store_file("abc123")

    r = client.get("/api/file/abc123")
    assert r.status_code == 200
    assert r.data == b"0123456789"
    assert r.mimetype == "audio/mpeg"

    r = client.get("/api/file/abc123", headers={"Range": "bytes=0-3"})
    assert r.status_code == 206
    assert r.headers["Content-Range"] == "bytes 0-3/10"
    assert r.data == b"0123"

    assert client.get("/api/file/missing").status_code == 404


def test_file_without_stored_copy_is_404(client):
    client.post("/api/library/add", json=SONG)
    assert client.get("/api/file/abc123").status_code == 404


def test_playlists_roundtrip(client):
    assert client.post("/api/playlists/create", json={"name": "Chill"}).get_json() == {"ok": True}
    client.post("/api/playlists/create", json={"name": "Chill"})
    assert [p["name"] for p in client.get("/api/playlists").get_json()] == ["Chill"]

    client.post("/api/playlists/Chill/add", json=SONG)
    assert [s["id"] for s in client.get("/api/playlists").get_json()[0]["songs"]] == ["abc123"]

    client.post("/api/playlists/Chill/add", json=SONG)
    assert len(client.get("/api/playlists").get_json()[0]["songs"]) == 1

    client.post("/api/playlists/Chill/remove/abc123")
    assert client.get("/api/playlists").get_json()[0]["songs"] == []

    client.post("/api/playlists/Chill/add", json=SONG)
    client.post("/api/playlists/rename", json={"old": "Chill", "new": "Focus"})
    assert [p["name"] for p in client.get("/api/playlists").get_json()] == ["Focus"]

    client.post("/api/playlists/delete", json={"name": "Focus"})
    assert client.get("/api/playlists").get_json() == []


def test_playlist_errors(client):
    assert client.post("/api/playlists/create", json={"name": " "}).status_code == 400
    assert client.post("/api/playlists/Nope/add", json=SONG).status_code == 404
    assert client.post("/api/playlists/Nope/add", json={"id": "x y"}).status_code == 400
    assert client.post("/api/playlists/Nope/remove/x").status_code == 404
    assert client.post("/api/playlists/delete", json={"name": "Nope"}).status_code == 404
    assert client.post("/api/playlists/delete", json={}).status_code == 400
    assert client.post("/api/playlists/rename", json={"old": "Nope", "new": "X"}).status_code == 404
    assert client.post("/api/playlists/rename", json={"old": "", "new": ""}).status_code == 400


def test_library_clear_wipes_library_and_files(client):
    path = store_file("abc123")
    client.post("/api/playlists/create", json={"name": "Chill"})
    client.post("/api/playlists/Chill/add", json=SONG)
    backend.ensure_dirs()
    orphan = os.path.join(backend.LOCAL_DIR, "orphan.art.jpg")
    with open(orphan, "wb") as f:
        f.write(b"x")
    before = sum(
        len(os.listdir(d))
        for d in (backend.DOWNLOAD_DIR, backend.LOCAL_DIR)
        if os.path.isdir(d)
    )

    r = client.post("/api/library/clear")
    assert r.status_code == 200
    d = r.get_json()
    assert d["ok"] is True
    assert d["songs"] == 1
    assert d["files"] == before

    assert client.get("/api/library").get_json()["songs"] == []
    assert client.get("/api/playlists").get_json() == []
    assert not os.path.exists(path)
    assert not os.path.exists(orphan)
    for directory in (backend.DOWNLOAD_DIR, backend.LOCAL_DIR):
        if os.path.isdir(directory):
            assert os.listdir(directory) == []


def test_library_clear_keeps_files_outside_data_dir(client):
    outside = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
    outside.write(b"x")
    outside.close()
    lib = backend.load_lib()
    lib["songs"].append(dict(SONG, filepath=outside.name))
    backend.save_lib(lib)

    r = client.post("/api/library/clear")
    assert r.status_code == 200
    d = r.get_json()
    assert d["ok"] is True
    assert d["songs"] == 1
    assert client.get("/api/library").get_json()["songs"] == []
    assert os.path.isfile(outside.name)
    os.remove(outside.name)


def test_library_clear_keeps_local_when_excluded(client):
    path = store_file("abc123")
    backend.ensure_dirs()
    local_path = os.path.join(backend.LOCAL_DIR, "imported.mp3")
    with open(local_path, "wb") as f:
        f.write(b"x")
    lib = backend.load_lib()
    lib["songs"].append({"id": "loc1", "title": "Imported", "local": True, "filepath": local_path})
    lib["playlists"].append({"name": "Chill", "songs": []})
    backend.save_lib(lib)

    r = client.post("/api/library/clear", json={"local": False})
    d = r.get_json()
    assert d["ok"] is True
    assert d["songs"] == 1
    assert d["playlists"] == 1

    lib = client.get("/api/library").get_json()
    assert [s["id"] for s in lib["songs"]] == ["loc1"]
    assert lib["playlists"] == []
    assert not os.path.exists(path)
    assert os.path.isfile(local_path)


def test_library_clear_strips_downloads_but_keeps_nasheeds(client):
    path = store_file("abc123")
    client.post("/api/playlists/create", json={"name": "Chill"})

    r = client.post(
        "/api/library/clear",
        json={"nasheeds": False, "playlists": False, "downloads": True, "local": False},
    )
    d = r.get_json()
    assert d["ok"] is True
    assert d["songs"] == 0
    assert d["playlists"] == 0
    assert not os.path.exists(path)

    lib = client.get("/api/library").get_json()
    assert len(lib["songs"]) == 1
    assert "filepath" not in lib["songs"][0]
    assert not lib["songs"][0].get("downloaded")
    assert [p["name"] for p in lib["playlists"]] == ["Chill"]


def test_library_clear_rejects_bad_options(client):
    assert client.post("/api/library/clear", json={"local": "yes"}).status_code == 400
    assert client.post("/api/library/clear", json={"nasheeds": 1}).status_code == 400


def test_open_blocks_non_youtube(client):
    for url in (
        "https://evil.example.com/x",
        "http://www.youtube.com/watch?v=x",
        "javascript:alert(1)",
        "",
    ):
        r = client.post("/api/open", json={"url": url})
        assert r.status_code == 400, url
        assert r.get_json() == {"ok": False, "error": "blocked"}
