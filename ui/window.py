import gi
import threading

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")

from gi.repository import Gtk, Adw, Gio, GLib

from core.ytdl import YTDL
from core.player import Player
from ui.search_view import SearchView
from ui.library_view import LibraryView
from ui.player_bar import PlayerBar


def esc(text):
    return GLib.markup_escape_text(str(text)) if text else ""


class NasheedWindow(Adw.ApplicationWindow):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.set_title("Nasheed Player")
        self.set_default_size(1100, 720)

        self.player = Player()
        self.app = kwargs.get("application")
        self.library = self.app.library
        self.current_results = []
        self.playing_id = None
        self.current_song_data = None
        self.loop_mode = "off"
        self.play_queue = []
        self.queue_index = -1

        self._build_ui()
        self._connect_signals()

    def _build_ui(self):
        toolbar_view = Adw.ToolbarView()
        self.set_content(toolbar_view)

        header = Adw.HeaderBar()
        toolbar_view.add_top_bar(header)

        self.search_view = SearchView(self)
        self.library_view = LibraryView(self)

        self.split = Adw.NavigationSplitView()
        self.split.set_min_sidebar_width(200)
        self.split.set_max_sidebar_width(300)
        toolbar_view.set_content(self.split)

        self.sidebar_page = Adw.NavigationPage()
        self.sidebar_page.set_tag("sidebar")
        self.sidebar_page.set_title("Nasheed")
        self.split.set_sidebar(self.sidebar_page)

        sidebar_content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.sidebar_page.set_child(sidebar_content)

        sidebar_header = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        sidebar_header.set_margin_start(16)
        sidebar_header.set_margin_end(16)
        sidebar_header.set_margin_top(20)
        sidebar_header.set_margin_bottom(12)
        sidebar_content.append(sidebar_header)

        app_title = Gtk.Label(label="Nasheed Player")
        app_title.set_xalign(0)
        app_title.add_css_class("title-1")
        sidebar_header.append(app_title)

        app_sub = Gtk.Label(label="Islamic Audio Player")
        app_sub.set_xalign(0)
        app_sub.add_css_class("caption")
        app_sub.add_css_class("dim-label")
        sidebar_header.append(app_sub)

        nav_list = Gtk.ListBox()
        nav_list.set_selection_mode(Gtk.SelectionMode.SINGLE)
        nav_list.add_css_class("boxed-list")
        nav_list.set_margin_start(8)
        nav_list.set_margin_end(8)
        sidebar_content.append(nav_list)

        self.nav_rows = {}
        nav_items = [
            ("search", "system-search-symbolic", "Search"),
            ("library", "folder-music-symbolic", "My Library"),
            ("favorites", "emblem-favorite-symbolic", "Favorites"),
            ("downloads", "document-save-symbolic", "Downloads"),
        ]

        for nav_id, icon, label in nav_items:
            row = Adw.ActionRow()
            row.set_icon_name(icon)
            row.set_title(label)
            row.set_activatable(True)
            row.add_css_class("sidebar-row")
            row._nav_id = nav_id
            nav_list.append(row)
            self.nav_rows[nav_id] = row

        nav_list.connect("row-selected", self._on_nav_selected)

        sep = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        sep.set_margin_start(16)
        sep.set_margin_end(16)
        sep.set_margin_top(8)
        sep.set_margin_bottom(8)
        sidebar_content.append(sep)

        pl_header_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        pl_header_box.set_margin_start(16)
        pl_header_box.set_margin_end(8)
        pl_header_box.set_margin_bottom(4)
        sidebar_content.append(pl_header_box)

        pl_label = Gtk.Label(label="Playlists")
        pl_label.set_xalign(0)
        pl_label.add_css_class("caption")
        pl_label.add_css_class("dim-label")
        pl_label.set_hexpand(True)
        pl_header_box.append(pl_label)

        add_pl_btn = Gtk.Button(icon_name="list-add-symbolic")
        add_pl_btn.add_css_class("flat")
        add_pl_btn.add_css_class("circular")
        add_pl_btn.set_size_request(32, 32)
        add_pl_btn.connect("clicked", self._on_add_playlist)
        pl_header_box.append(add_pl_btn)

        self.playlist_list = Gtk.ListBox()
        self.playlist_list.set_selection_mode(Gtk.SelectionMode.SINGLE)
        self.playlist_list.add_css_class("boxed-list")
        self.playlist_list.set_margin_start(8)
        self.playlist_list.set_margin_end(8)
        sidebar_content.append(self.playlist_list)

        self._refresh_playlists()

        self.content_stack = Gtk.Stack()
        self.content_stack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
        self.content_stack.set_transition_duration(150)
        self.content_stack.add_named(self.search_view, "search")
        self.content_stack.add_named(self.library_view, "library")

        self.content_page = Adw.NavigationPage()
        self.content_page.set_tag("content")
        self.content_page.set_title("Search")
        self.content_page.set_child(self.content_stack)
        self.split.set_content(self.content_page)

        self.player_bar = PlayerBar(self)
        toolbar_view.add_bottom_bar(self.player_bar)

        nav_list.select_row(self.nav_rows["search"])

    def _refresh_playlists(self):
        while self.playlist_list.get_first_child():
            self.playlist_list.remove(self.playlist_list.get_first_child())
        for pl in self.library.playlists:
            row = Adw.ActionRow()
            row.set_icon_name("playlist-symbolic")
            row.set_title(pl["name"])
            row.set_activatable(True)
            row._playlist_name = pl["name"]
            row.connect("activated", self._on_playlist_activated)
            self.playlist_list.append(row)

    def _on_nav_selected(self, list_box, row):
        if not row:
            return
        nav_id = row._nav_id
        if nav_id == "search":
            self.content_stack.set_visible_child_name("search")
            self.content_page.set_title("Search")
        elif nav_id == "library":
            self.library_view.set_mode("all")
            self.content_stack.set_visible_child_name("library")
            self.content_page.set_title("My Library")
        elif nav_id == "favorites":
            self.library_view.set_mode("favorites")
            self.content_stack.set_visible_child_name("library")
            self.content_page.set_title("Favorites")
        elif nav_id == "downloads":
            self.library_view.set_mode("downloads")
            self.content_stack.set_visible_child_name("library")
            self.content_page.set_title("Downloads")

    def _on_playlist_activated(self, row):
        name = row._playlist_name
        self.library_view.set_mode("playlist", name)
        self.content_stack.set_visible_child_name("library")

    def _on_add_playlist(self, btn):
        dialog = Adw.AlertDialog(heading="New Playlist", body="Enter a name:")
        dialog.add_response("cancel", "Cancel")
        dialog.add_response("create", "Create")
        dialog.set_response_appearance("create", Adw.ResponseAppearance.SUGGESTED)
        entry = Gtk.Entry()
        entry.set_placeholder_text("Playlist name...")
        entry.set_hexpand(True)
        entry.connect("activate", lambda e: dialog.response("create"))
        content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        content.set_margin_top(12)
        content.append(entry)
        dialog.set_extra_child(content)

        def on_response(dialog, response):
            if response == "create":
                name = entry.get_text().strip()
                if name:
                    self.library.create_playlist(name)
                    self._refresh_playlists()

        dialog.connect("response", on_response)
        dialog.present(self)

    def toggle_loop(self):
        modes = ["off", "all", "one"]
        idx = modes.index(self.loop_mode)
        self.loop_mode = modes[(idx + 1) % len(modes)]
        self.player_bar.set_loop_state(self.loop_mode)

    def search_nasheeds(self, query):
        if not query.strip():
            return
        self.search_view.show_loading(True)

        def do_search():
            results = YTDL.search(query, max_results=20)
            GLib.idle_add(self._on_search_results, results)

        thread = threading.Thread(target=do_search, daemon=True)
        thread.start()

    def _on_search_results(self, results):
        self.current_results = results
        self.search_view.show_loading(False)
        self.search_view.show_results(results)

    def play_from_youtube(self, song_data):
        self.search_view.set_status("Loading: " + esc(song_data["title"]) + "...")

        if self.current_results:
            self.play_queue = list(self.current_results)
            for i, s in enumerate(self.play_queue):
                if s["id"] == song_data["id"]:
                    self.queue_index = i
                    break

        def do_load():
            url = YTDL.get_stream_url(song_data["id"])
            if url:
                GLib.idle_add(self._start_playback, song_data, url)
            else:
                GLib.idle_add(self.search_view.set_status, "Failed to load stream")

        thread = threading.Thread(target=do_load, daemon=True)
        thread.start()

    def _start_playback(self, song_data, stream_url):
        self.playing_id = song_data["id"]
        self.current_song_data = song_data
        self.player.play_url(stream_url)
        self.library.add_song(song_data)
        self.player_bar.update_info(song_data)
        self.search_view.set_playing(song_data["id"])
        self.search_view.set_status("Playing: " + esc(song_data["title"]))

    def play_from_file(self, song_data):
        if song_data.get("filepath"):
            self.playing_id = song_data["id"]
            self.current_song_data = song_data
            self.player.play_file(song_data["filepath"])
            self.player_bar.update_info(song_data)

    def download_song(self, song_data):
        self.search_view.set_status("Downloading: " + esc(song_data["title"]) + "...")

        def do_download():
            filepath = YTDL.download(song_data["id"], song_data.get("title"))
            if filepath:
                self.library.mark_downloaded(song_data["id"], filepath)
                GLib.idle_add(
                    self.search_view.set_status,
                    "Downloaded: " + esc(song_data["title"]),
                )
            else:
                GLib.idle_add(self.search_view.set_status, "Download failed")

        thread = threading.Thread(target=do_download, daemon=True)
        thread.start()

    def _connect_signals(self):
        self.player.on("eos", self._on_track_finished)
        self.player.on("error", self._on_playback_error)

    def _on_track_finished(self):
        print(f"[DEBUG] EOS fired: loop_mode={self.loop_mode}, queue_len={len(self.play_queue)}, idx={self.queue_index}, song={self.current_song_data.get('title') if self.current_song_data else 'None'}")
        if self.loop_mode == "one" and self.current_song_data:
            print("[DEBUG] -> looping one")
            self.play_from_youtube(self.current_song_data)
        elif self.loop_mode == "all" and self.play_queue:
            self.queue_index = (self.queue_index + 1) % len(self.play_queue)
            print(f"[DEBUG] -> looping all, next idx={self.queue_index}")
            self.play_from_youtube(self.play_queue[self.queue_index])
        else:
            print("[DEBUG] -> stopping")
            self.playing_id = None
            self.current_song_data = None
            self.player_bar.clear_info()
            self.search_view.set_playing(None)

    def _on_playback_error(self, message):
        self.search_view.set_status("Error: " + esc(message))
