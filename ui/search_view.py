import gi
import threading

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")

from gi.repository import Gtk, GLib, Adw, Gdk


def esc(text):
    return GLib.markup_escape_text(str(text)) if text else ""


class SearchView(Gtk.Box):
    def __init__(self, window):
        super().__init__(orientation=Gtk.Orientation.VERTICAL, vexpand=True)
        self.window = window
        self._build_ui()

    def _build_ui(self):
        search_bar_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.append(search_bar_box)

        search_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        search_row.set_margin_start(24)
        search_row.set_margin_end(24)
        search_row.set_margin_top(16)
        search_row.set_margin_bottom(8)
        search_bar_box.append(search_row)

        self.search_entry = Gtk.SearchEntry()
        self.search_entry.set_placeholder_text("Search nasheeds on YouTube...")
        self.search_entry.set_hexpand(True)
        self.search_entry.connect("activate", self._on_search)
        self.search_entry.connect("stop-search", self._on_stop_search)
        search_row.append(self.search_entry)

        self.search_btn = Gtk.Button(label="Search")
        self.search_btn.add_css_class("suggested-action")
        self.search_btn.add_css_class("flat")
        self.search_btn.connect("clicked", self._on_search)
        search_row.append(self.search_btn)

        self.status_revealer = Gtk.Revealer()
        self.status_revealer.set_transition_type(Gtk.RevealerTransitionType.SLIDE_DOWN)
        self.status_revealer.set_reveal_child(False)
        search_bar_box.append(self.status_revealer)

        self.status_bar = Gtk.Label(label="")
        self.status_bar.set_xalign(0)
        self.status_bar.set_margin_start(24)
        self.status_bar.set_margin_end(24)
        self.status_bar.set_margin_bottom(8)
        self.status_bar.add_css_class("dim-label")
        self.status_bar.add_css_class("caption")
        self.status_revealer.set_child(self.status_bar)

        self.content_stack = Gtk.Stack()
        self.content_stack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
        self.content_stack.set_vexpand(True)
        self.append(self.content_stack)

        empty_page = Adw.StatusPage()
        empty_page.set_icon_name("system-search-symbolic")
        empty_page.set_title("Search for Nasheeds")
        empty_page.set_description("Type a nasheed name, artist, or keyword and press Enter")
        self.content_stack.add_named(empty_page, "empty")

        self.loading_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        self.loading_box.set_valign(Gtk.Align.CENTER)
        self.loading_box.set_halign(Gtk.Align.CENTER)
        spinner = Gtk.Spinner()
        spinner.set_size_request(48, 48)
        spinner.start()
        self.loading_box.append(spinner)
        load_label = Gtk.Label(label="Searching YouTube...")
        load_label.add_css_class("dim-label")
        self.loading_box.append(load_label)
        self.content_stack.add_named(self.loading_box, "loading")

        no_results = Adw.StatusPage()
        no_results.set_icon_name("edit-find-symbolic")
        no_results.set_title("No Results Found")
        no_results.set_description("Try different keywords")
        self.content_stack.add_named(no_results, "no-results")

        self.results_scrolled = Gtk.ScrolledWindow()
        self.results_scrolled.set_policy(
            Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC
        )
        self.results_scrolled.add_css_class("view")
        self.content_stack.add_named(self.results_scrolled, "results")

        self.results_list = Gtk.ListBox()
        self.results_list.set_selection_mode(Gtk.SelectionMode.NONE)
        self.results_list.add_css_class("boxed-list")
        self.results_list.set_margin_start(16)
        self.results_list.set_margin_end(16)
        self.results_list.set_margin_top(8)
        self.results_list.set_margin_bottom(16)
        self.results_scrolled.set_child(self.results_list)

        self.content_stack.set_visible_child_name("empty")

    def _on_search(self, *args):
        query = self.search_entry.get_text().strip()
        if query:
            self.window.search_nasheeds(query)

    def _on_stop_search(self, entry):
        entry.set_text("")

    def show_loading(self, show):
        if show:
            self.content_stack.set_visible_child_name("loading")

    def show_results(self, results):
        while self.results_list.get_first_child():
            child = self.results_list.get_first_child()
            self.results_list.remove(child)

        if not results:
            self.content_stack.set_visible_child_name("no-results")
            return

        for song in results:
            row = self._create_song_row(song)
            self.results_list.append(row)

        self.content_stack.set_visible_child_name("results")

    def _create_song_row(self, song_data):
        row = Adw.ActionRow()
        row.add_css_class("song-row")
        row._song_id = song_data["id"]

        if song_data.get("thumbnail"):
            thumb_box = Gtk.Box()
            thumb_box.set_size_request(64, 48)
            thumb_box.set_valign(Gtk.Align.CENTER)
            thumb_img = Gtk.Image()
            thumb_img.set_size_request(64, 48)
            thumb_box.append(thumb_img)
            row.add_prefix(thumb_box)
            self._load_thumbnail(thumb_img, song_data["thumbnail"])

        row.set_title(esc(song_data.get("title", "Unknown")))
        row.set_subtitle(esc(song_data.get("channel", "")))

        if song_data.get("duration_string"):
            dur_label = Gtk.Label(label=song_data["duration_string"])
            dur_label.add_css_class("dim-label")
            dur_label.add_css_class("caption")
            dur_label.set_valign(Gtk.Align.CENTER)
            row.add_suffix(dur_label)

        play_btn = Gtk.Button(icon_name="media-playback-start-symbolic")
        play_btn.add_css_class("flat")
        play_btn.add_css_class("circular")
        play_btn.set_valign(Gtk.Align.CENTER)
        play_btn.set_tooltip_text("Play")
        play_btn.connect("clicked", self._on_play, song_data)
        row.add_suffix(play_btn)

        dl_btn = Gtk.Button(icon_name="document-save-symbolic")
        dl_btn.add_css_class("flat")
        dl_btn.add_css_class("circular")
        dl_btn.set_valign(Gtk.Align.CENTER)
        dl_btn.set_tooltip_text("Download")
        dl_btn.connect("clicked", self._on_download, song_data)
        row.add_suffix(dl_btn)

        fav_btn = Gtk.Button()
        fav_btn.add_css_class("flat")
        fav_btn.add_css_class("circular")
        fav_btn.set_valign(Gtk.Align.CENTER)
        fav_btn.set_tooltip_text("Add to favorites")
        existing = self.window.library.get_song(song_data["id"])
        if existing and existing.get("favorite"):
            fav_btn.set_icon_name("emblem-favorite-symbolic")
            fav_btn.add_css_class("accent")
        else:
            fav_btn.set_icon_name("emblem-favorite-symbolic")
        fav_btn.connect("clicked", self._on_favorite, song_data, fav_btn)
        row.add_suffix(fav_btn)

        pl_btn = Gtk.Button(icon_name="list-add-symbolic")
        pl_btn.add_css_class("flat")
        pl_btn.add_css_class("circular")
        pl_btn.set_valign(Gtk.Align.CENTER)
        pl_btn.set_tooltip_text("Add to playlist")
        pl_btn.connect("clicked", self._on_add_to_playlist, song_data)
        row.add_suffix(pl_btn)

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
        self.window.play_from_youtube(song_data)

    def _on_download(self, btn, song_data):
        self.window.download_song(song_data)

    def _on_favorite(self, btn, song_data, fav_btn):
        self.window.library.add_song(song_data)
        is_fav = self.window.library.toggle_favorite(song_data["id"])
        if is_fav:
            fav_btn.set_icon_name("emblem-favorite-symbolic")
            fav_btn.add_css_class("accent")
        else:
            fav_btn.set_icon_name("emblem-favorite-symbolic")
            fav_btn.remove_css_class("accent")

    def _on_add_to_playlist(self, btn, song_data):
        dialog = Adw.AlertDialog(
            heading="Add to Playlist",
            body="Choose a playlist:",
        )
        dialog.add_response("cancel", "Cancel")
        self.window.library.add_song(song_data)

        for pl in self.window.library.playlists:
            resp_id = pl["name"].lower().replace(" ", "_")
            dialog.add_response(resp_id, pl["name"])

        def on_response(dialog, response):
            if response != "cancel":
                for pl in self.window.library.playlists:
                    if pl["name"].lower().replace(" ", "_") == response:
                        self.window.library.add_to_playlist(pl["name"], song_data)
                        break

        dialog.connect("response", on_response)
        dialog.present(self.window)

    def _on_row_activated(self, list_box, row, song_data):
        self.window.play_from_youtube(song_data)

    def set_playing(self, song_id):
        for row in self.results_list:
            if hasattr(row, "_song_id"):
                if row._song_id == song_id:
                    row.add_css_class("accent")
                else:
                    row.remove_css_class("accent")

    def set_status(self, message):
        self.status_bar.set_markup(str(message) if message else "")
        self.status_revealer.set_reveal_child(bool(message))
