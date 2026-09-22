import json
import os


class Library:
    def __init__(self):
        self._data_dir = os.path.expanduser("~/.local/share/nasheed-app")
        self._db_file = os.path.join(self._data_dir, "library.json")
        os.makedirs(self._data_dir, exist_ok=True)
        self.songs = []
        self.playlists = []
        self._load()

    def _load(self):
        if os.path.exists(self._db_file):
            with open(self._db_file, "r") as f:
                data = json.load(f)
                self.songs = data.get("songs", [])
                self.playlists = data.get("playlists", [])
        if not self.playlists:
            self.playlists = [{"name": "Favorites", "songs": []}]

    def _save(self):
        with open(self._db_file, "w") as f:
            json.dump({"songs": self.songs, "playlists": self.playlists}, f, indent=2)

    def add_song(self, song):
        if not any(s["id"] == song["id"] for s in self.songs):
            song.setdefault("downloaded", False)
            song.setdefault("filepath", "")
            song.setdefault("favorite", False)
            self.songs.append(song)
            self._save()
            return True
        return False

    def remove_song(self, song_id):
        self.songs = [s for s in self.songs if s["id"] != song_id]
        for pl in self.playlists:
            pl["songs"] = [s for s in pl["songs"] if s["id"] != song_id]
        self._save()

    def get_song(self, song_id):
        for s in self.songs:
            if s["id"] == song_id:
                return s
        return None

    def toggle_favorite(self, song_id):
        for s in self.songs:
            if s["id"] == song_id:
                s["favorite"] = not s.get("favorite", False)
                self._save()
                return s["favorite"]
        return False

    def mark_downloaded(self, song_id, filepath):
        for s in self.songs:
            if s["id"] == song_id:
                s["downloaded"] = True
                s["filepath"] = filepath
                self._save()
                return True
        return False

    def get_downloaded(self):
        return [s for s in self.songs if s.get("downloaded")]

    def get_favorites(self):
        return [s for s in self.songs if s.get("favorite")]

    def create_playlist(self, name):
        pl = {"name": name, "songs": []}
        self.playlists.append(pl)
        self._save()
        return pl

    def delete_playlist(self, name):
        self.playlists = [p for p in self.playlists if p["name"] != name]
        self._save()

    def add_to_playlist(self, playlist_name, song):
        for pl in self.playlists:
            if pl["name"] == playlist_name:
                if not any(s["id"] == song["id"] for s in pl["songs"]):
                    pl["songs"].append(song)
                    self._save()
                    return True
        return False

    def remove_from_playlist(self, playlist_name, song_id):
        for pl in self.playlists:
            if pl["name"] == playlist_name:
                pl["songs"] = [s for s in pl["songs"] if s["id"] != song_id]
                self._save()
                return True
        return False

    def get_playlist(self, name):
        for pl in self.playlists:
            if pl["name"] == name:
                return pl
        return None
