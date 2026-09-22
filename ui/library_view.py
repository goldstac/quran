import gi
import threading

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")

from gi.repository import Gtk, GLib, Adw, Gdk


def esc(text):
    return GLib.markup_escape_text(str(text)) if text else ""


class LibraryView(Gtk.Box):
    def __init__(self, window):
        super().__init__(orientation=Gtk.Orientation.VERTICAL, vexpand=True)
        self.window = window
        self.mode = "all"
        self.playlist_name = None
        self._build_ui()

    def _build_ui(self):
        header_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        header_box.set_margin_start(24)
        header_box.set_margin_end(24)
        header_box.set_margin_top(16)
        header_box.set_margin_bottom(4)
        self.append(header_box)

        self.title_label = Gtk.Label()
        self.title_label.set_xalign(0)
        self.title_label.add_css_class("title-2")
        self.title_label.set_hexpand(True)
        header_box.append(self.title_label)

        self.subtitle_label = Gtk.Label()
        self.subtitle_label.set_xalign(0)
        self.subtitle_label.add_css_class("dim-label")
        self.subtitle_label.add_css_class("caption")
        self.append(self.subtitle_label)

        self.content_stack = Gtk.Stack()
        self.content_stack.set_vexpand(True)
        self.content_stack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
        self.append(self.content_stack)

        empty_page = Adw.StatusPage()
        empty_page.set_icon_name("folder-music-symbolic")
        empty_page.set_title("Library Empty")
        empty_page.set_description("Search for nasheeds and add them here")
        self.content_stack.add_named(empty_page, "empty")

        self.scrolled = Gtk.ScrolledWindow()
        self.scrolled.set_policy(
            Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC
        )
        self.scrolled.add_css_class("view")
        self.content_stack.add_named(self.scrolled, "list")

        self.list_box = Gtk.ListBox()
        self.list_box.set_selection_mode(Gtk.SelectionMode.NONE)
        self.list_box.add_css_class("boxed-list")
        self.list_box.set_margin_start(16)
        self.list_box.set_margin_end(16)
        self.list_box.set_margin_top(8)
        self.list_box.set_margin_bottom(16)
        self.scrolled.set_child(self.list_box)

    def set_mode(self, mode, playlist_name=None):
        self.mode = mode
        self.playlist_name = playlist_name
        self._refresh()

    def _refresh(self):
        while self.list_box.get_first_child():
            child = self.list_box.get_first_child()
            self.list_box.remove(child)

        songs = []
        if self.mode == "all":
            songs = self.window.library.songs
            self.title_label.set_text("My Library")
            self.subtitle_label.set_text(
                f"{len(songs)} nasheed{'s' if len(songs) != 1 else ''} saved"
            )
        elif self.mode == "favorites":
            songs = self.window.library.get_favorites()
            self.title_label.set_text("Favorites")
            self.subtitle_label.set_text(
                f"{len(songs)} favorite nasheed{'s' if len(songs) != 1 else ''}"
            )
        elif self.mode == "downloads":
            songs = self.window.library.get_downloaded()
            self.title_label.set_text("Downloads")
            self.subtitle_label.set_text(
                f"{len(songs)} downloaded nasheed{'s' if len(songs) != 1 else ''}"
            )
        elif self.mode == "playlist" and self.playlist_name:
            pl = self.window.library.get_playlist(self.playlist_name)
            if pl:
                songs = pl["songs"]
            self.title_label.set_text(esc(self.playlist_name))
            self.subtitle_label.set_text(
                f"{len(songs)} nasheed{'s' if len(songs) != 1 else ''} in playlist"
            )

        if not songs:
            self.content_stack.set_visible_child_name("empty")
        else:
            for song in songs:
                row = self._create_row(song)
                self.list_box.append(row)
            self.content_stack.set_visible_child_name("list")

    def _create_row(self, song_data):
        row = Adw.ActionRow()
        row.add_css_class("song-row")
        row._song_data = song_data

        if song_data.get("thumbnail"):
            thumb_box = Gtk.Box()
            thumb_box.set_size_request(48, 48)
            thumb_box.set_valign(Gtk.Align.CENTER)
            thumb_img = Gtk.Image()
            thumb_img.set_size_request(48, 48)
            thumb_box.append(thumb_img)
            row.add_prefix(thumb_box)
            self._load_thumbnail(thumb_img, song_data["thumbnail"])

        row.set_title(esc(song_data.get("title", "Unknown")))
        row.set_subtitle(esc(song_data.get("channel", "")))

        badges = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        badges.set_valign(Gtk.Align.CENTER)
        row.add_suffix(badges)

        if song_data.get("favorite"):
            fav_icon = Gtk.Image(icon_name="emblem-favorite-symbolic")
            fav_icon.add_css_class("badge-fav")
            badges.append(fav_icon)

        if song_data.get("downloaded"):
            dl_badge = Gtk.Label(label="Downloaded")
            dl_badge.add_css_class("badge-downloaded")
            badges.append(dl_badge)

        play_btn = Gtk.Button(icon_name="media-playback-start-symbolic")
        play_btn.add_css_class("flat")
        play_btn.add_css_class("circular")
        play_btn.set_valign(Gtk.Align.CENTER)
        play_btn.set_tooltip_text("Play")
        play_btn.connect("clicked", self._on_play, song_data)
        row.add_suffix(play_btn)

        if song_data.get("downloaded"):
            file_btn = Gtk.Button(icon_name="drive-harddisk-symbolic")
            file_btn.add_css_class("flat")
            file_btn.add_css_class("circular")
            file_btn.set_valign(Gtk.Align.CENTER)
            file_btn.set_tooltip_text("Play from disk")
            file_btn.connect("clicked", self._on_play_file, song_data)
            row.add_suffix(file_btn)

        remove_btn = Gtk.Button(icon_name="user-trash-symbolic")
        remove_btn.add_css_class("flat")
        remove_btn.add_css_class("circular")
        remove_btn.set_valign(Gtk.Align.CENTER)
        remove_btn.set_tooltip_text("Remove")
        remove_btn.connect("clicked", self._on_remove, song_data)
        row.add_suffix(remove_btn)

        row.connect("activated", self._on_row_activated, song_data)
        return row

    def _load_thumbnail(self, image, url):
        def do_load():
            try:
                import urllib.request
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                response = urllib.request.urlopen(req, timeout=10)
                data = response.read()
                texture = Gdk.Texture.new_from_bytes(GLib.Bytes.new(data))
                GLib.idle_add(image.set_paintable, texture)
            except Exception:
                GLib.idle_add(image.set_from_icon_name, "audio-x-generic-symbolic")

        thread = threading.Thread(target=do_load, daemon=True)
        thread.start()

    def _on_play(self, btn, song_data):
        if song_data.get("downloaded") and song_data.get("filepath"):
            self.window.play_from_file(song_data)
        else:
            self.window.play_from_youtube(song_data)

    def _on_play_file(self, btn, song_data):
        self.window.play_from_file(song_data)

    def _on_remove(self, btn, song_data):
        self.window.library.remove_song(song_data["id"])
        self._refresh()

    def _on_row_activated(self, list_box, row, song_data):
        if song_data.get("downloaded") and song_data.get("filepath"):
            self.window.play_from_file(song_data)
        else:
            self.window.play_from_youtube(song_data)
