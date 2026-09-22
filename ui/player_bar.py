import gi
import threading

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
gi.require_version("Gst", "1.0")

from gi.repository import Gtk, GLib, Gst, Adw, Gdk


def esc(text):
    return GLib.markup_escape_text(str(text)) if text else ""


class PlayerBar(Gtk.Box):
    def __init__(self, window):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.window = window
        self._update_id = None
        self._loading = False
        self.add_css_class("player-bar")
        self._build_ui()

    def _build_ui(self):
        main_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=16)
        self.append(main_box)

        self.info_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        self.info_box.set_size_request(240, -1)
        main_box.append(self.info_box)

        self.thumb_image = Gtk.Image()
        self.thumb_image.set_size_request(52, 52)
        self.info_box.append(self.thumb_image)

        self.spinner = Gtk.Spinner()
        self.spinner.set_size_request(52, 52)
        self.spinner.set_visible(False)
        self.info_box.append(self.spinner)

        info_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        self.info_box.append(info_vbox)

        self.title_label = Gtk.Label(label="No track playing")
        self.title_label.set_xalign(0)
        self.title_label.add_css_class("player-title")
        self.title_label.set_ellipsize(3)
        self.title_label.set_max_width_chars(30)
        info_vbox.append(self.title_label)

        self.artist_label = Gtk.Label(label="")
        self.artist_label.set_xalign(0)
        self.artist_label.add_css_class("player-artist")
        self.artist_label.set_ellipsize(3)
        self.artist_label.set_max_width_chars(30)
        info_vbox.append(self.artist_label)

        self.state_label = Gtk.Label(label="")
        self.state_label.set_xalign(0)
        self.state_label.add_css_class("caption")
        self.state_label.add_css_class("dim-label")
        info_vbox.append(self.state_label)

        center_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, hexpand=True)
        center_box.set_valign(Gtk.Align.CENTER)
        main_box.append(center_box)

        controls_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=4)
        controls_box.set_halign(Gtk.Align.CENTER)
        center_box.append(controls_box)

        self.loop_btn = Gtk.Button(icon_name="media-playlist-repeat-symbolic")
        self.loop_btn.add_css_class("flat")
        self.loop_btn.add_css_class("circular")
        self.loop_btn.add_css_class("control-btn")
        self.loop_btn.set_tooltip_text("Loop: Off")
        self.loop_btn.connect("clicked", self._on_loop_toggle)
        controls_box.append(self.loop_btn)

        self.prev_btn = Gtk.Button(icon_name="media-skip-backward-symbolic")
        self.prev_btn.add_css_class("flat")
        self.prev_btn.add_css_class("circular")
        self.prev_btn.add_css_class("control-btn")
        self.prev_btn.set_tooltip_text("Previous")
        controls_box.append(self.prev_btn)

        self.play_btn = Gtk.Button(icon_name="media-playback-start-symbolic")
        self.play_btn.add_css_class("play-btn")
        self.play_btn.set_size_request(48, 48)
        self.play_btn.set_tooltip_text("Play")
        self.play_btn.connect("clicked", self._on_play_toggle)
        controls_box.append(self.play_btn)

        self.stop_btn = Gtk.Button(icon_name="media-playback-stop-symbolic")
        self.stop_btn.add_css_class("flat")
        self.stop_btn.add_css_class("circular")
        self.stop_btn.add_css_class("control-btn")
        self.stop_btn.set_tooltip_text("Stop")
        self.stop_btn.connect("clicked", self._on_stop)
        controls_box.append(self.stop_btn)

        self.next_btn = Gtk.Button(icon_name="media-skip-forward-symbolic")
        self.next_btn.add_css_class("flat")
        self.next_btn.add_css_class("circular")
        self.next_btn.add_css_class("control-btn")
        self.next_btn.set_tooltip_text("Next")
        controls_box.append(self.next_btn)

        slider_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        slider_box.set_halign(Gtk.Align.CENTER)
        center_box.append(slider_box)

        self.time_pos_label = Gtk.Label(label="0:00")
        self.time_pos_label.add_css_class("time-label")
        slider_box.append(self.time_pos_label)

        self.progress_scale = Gtk.Scale.new_with_range(
            Gtk.Orientation.HORIZONTAL, 0, 1000, 1
        )
        self.progress_scale.set_size_request(400, -1)
        self.progress_scale.set_draw_value(False)
        self.progress_scale.connect("value-changed", self._on_seek)
        slider_box.append(self.progress_scale)

        self.time_dur_label = Gtk.Label(label="0:00")
        self.time_dur_label.add_css_class("time-label")
        slider_box.append(self.time_dur_label)

        right_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        right_box.set_valign(Gtk.Align.CENTER)
        main_box.append(right_box)

        self.vol_icon = Gtk.Button(icon_name="audio-volume-high-symbolic")
        self.vol_icon.add_css_class("flat")
        self.vol_icon.add_css_class("circular")
        self.vol_icon.set_tooltip_text("Mute")
        self.vol_icon.connect("clicked", self._on_vol_mute)
        right_box.append(self.vol_icon)

        self.volume_scale = Gtk.Scale.new_with_range(
            Gtk.Orientation.HORIZONTAL, 0, 100, 1
        )
        self.volume_scale.set_size_request(120, -1)
        self.volume_scale.set_draw_value(False)
        self.volume_scale.set_value(70)
        self.volume_scale.connect("value-changed", self._on_volume_change)
        right_box.append(self.volume_scale)

    def update_info(self, song_data):
        title = esc(song_data.get("title", "Unknown"))
        artist = esc(song_data.get("channel", ""))
        self.title_label.set_markup(title)
        self.artist_label.set_markup(artist)
        self.state_label.set_text("Loading...")
        self._loading = True
        self.play_btn.set_icon_name("media-playback-start-symbolic")
        self.thumb_image.set_visible(True)
        self.spinner.set_visible(True)
        self.spinner.start()
        self._start_update_loop()
        if song_data.get("thumbnail"):
            self._load_thumb(song_data["thumbnail"])

    def set_playing_state(self):
        self._loading = False
        self.play_btn.set_icon_name("media-playback-pause-symbolic")
        self.play_btn.set_tooltip_text("Pause")
        self.state_label.set_text("Playing")
        self.spinner.set_visible(False)
        self.spinner.stop()
        self.thumb_image.set_visible(True)

    def set_paused_state(self):
        self.play_btn.set_icon_name("media-playback-start-symbolic")
        self.play_btn.set_tooltip_text("Play")
        self.state_label.set_text("Paused")

    def clear_info(self):
        self._loading = False
        self.title_label.set_text("No track playing")
        self.artist_label.set_text("")
        self.state_label.set_text("")
        self.play_btn.set_icon_name("media-playback-start-symbolic")
        self.play_btn.set_tooltip_text("Play")
        self.progress_scale.set_value(0)
        self.time_pos_label.set_text("0:00")
        self.time_dur_label.set_text("0:00")
        self.thumb_image.clear()
        self.spinner.set_visible(False)
        self.spinner.stop()
        self._stop_update_loop()

    def set_loop_state(self, mode):
        icons = {
            "off": "media-playlist-repeat-symbolic",
            "all": "media-playlist-repeat-symbolic",
            "one": "media-playlist-repeat-song-symbolic",
        }
        tooltips = {"off": "Loop: Off", "all": "Loop: All", "one": "Loop: One"}
        self.loop_btn.set_icon_name(icons.get(mode, "media-playlist-repeat-symbolic"))
        self.loop_btn.set_tooltip_text(tooltips.get(mode, "Loop"))
        if mode != "off":
            self.loop_btn.add_css_class("accent")
        else:
            self.loop_btn.remove_css_class("accent")

    def _load_thumb(self, url):
        def do_load():
            try:
                import urllib.request
                req = urllib.request.Request(
                    url, headers={"User-Agent": "Mozilla/5.0"}
                )
                response = urllib.request.urlopen(req, timeout=10)
                data = response.read()
                texture = Gdk.Texture.new_from_bytes(GLib.Bytes.new(data))
                GLib.idle_add(self.thumb_image.set_paintable, texture)
            except Exception:
                GLib.idle_add(
                    self.thumb_image.set_from_icon_name,
                    "audio-x-generic-symbolic",
                )

        thread = threading.Thread(target=do_load, daemon=True)
        thread.start()

    def _on_play_toggle(self, btn):
        if self._loading:
            return
        self.window.player.toggle()

    def _on_stop(self, btn):
        self.window.player.stop()
        self.clear_info()

    def _on_loop_toggle(self, btn):
        self.window.toggle_loop()

    def _on_vol_mute(self, btn):
        if self.volume_scale.get_value() > 0:
            self._prev_vol = self.volume_scale.get_value()
            self.volume_scale.set_value(0)
        else:
            self.volume_scale.set_value(getattr(self, "_prev_vol", 70))

    def _on_seek(self, scale):
        val = scale.get_value()
        dur = self.window.player.get_duration()
        if dur > 0:
            pos_ns = int(val / 1000.0 * dur)
            self.window.player.seek(pos_ns)

    def _on_volume_change(self, scale):
        vol = scale.get_value() / 100.0
        self.window.player.volume = vol
        if vol == 0:
            self.vol_icon.set_icon_name("audio-volume-muted-symbolic")
        elif vol < 0.3:
            self.vol_icon.set_icon_name("audio-volume-low-symbolic")
        elif vol < 0.7:
            self.vol_icon.set_icon_name("audio-volume-medium-symbolic")
        else:
            self.vol_icon.set_icon_name("audio-volume-high-symbolic")

    def _start_update_loop(self):
        self._stop_update_loop()
        self._update_id = GLib.timeout_add(250, self._update_progress)

    def _stop_update_loop(self):
        if self._update_id:
            GLib.source_remove(self._update_id)
            self._update_id = None

    def _update_progress(self):
        player = self.window.player
        pos = player.get_position()
        dur = player.get_duration()

        if dur > 0:
            self.progress_scale.handler_block_by_func(self._on_seek)
            self.progress_scale.set_value((pos / dur) * 1000)
            self.progress_scale.handler_unblock_by_func(self._on_seek)
            self.time_pos_label.set_text(self._format_time(pos))
            self.time_dur_label.set_text(self._format_time(dur))

        if self._loading and dur > 0:
            self.set_playing_state()

        return True

    @staticmethod
    def _format_time(ns):
        seconds = ns // Gst.SECOND
        minutes = seconds // 60
        seconds = seconds % 60
        return f"{minutes}:{seconds:02d}"
