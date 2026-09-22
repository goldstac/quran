import gi

gi.require_version("Gst", "1.0")
from gi.repository import Gst, GLib


class Player:
    def __init__(self):
        self.playbin = None
        self._state = "stopped"
        self._volume = 0.7
        self._callbacks = []

    def on(self, event, callback):
        self._callbacks.append((event, callback))

    def _emit(self, event, *args):
        for evt, cb in self._callbacks:
            if evt == event:
                cb(*args)

    def _ensure_pipeline(self):
        if not self.playbin:
            self.playbin = Gst.ElementFactory.make("playbin", "player")
            sink = Gst.ElementFactory.make("autoaudiosink", "sink")
            self.playbin.set_property("audio-sink", sink)
            self.playbin.set_property("volume", self._volume)
            bus = self.playbin.get_bus()
            bus.add_signal_watch()
            bus.connect("message::eos", self._on_eos)
            bus.connect("message::error", self._on_error)

    def play_url(self, url):
        self._ensure_pipeline()
        self.playbin.set_state(Gst.State.NULL)
        self.playbin.set_property("uri", url)
        self.playbin.set_state(Gst.State.PLAYING)
        self._state = "playing"
        self._emit("state-changed", self._state)

    def play_file(self, filepath):
        self._ensure_pipeline()
        self.playbin.set_state(Gst.State.NULL)
        self.playbin.set_property("uri", "file://" + filepath)
        self.playbin.set_state(Gst.State.PLAYING)
        self._state = "playing"
        self._emit("state-changed", self._state)

    def pause(self):
        if self.playbin:
            self.playbin.set_state(Gst.State.PAUSED)
            self._state = "paused"
            self._emit("state-changed", self._state)

    def resume(self):
        if self.playbin:
            self.playbin.set_state(Gst.State.PLAYING)
            self._state = "playing"
            self._emit("state-changed", self._state)

    def toggle(self):
        if self._state == "playing":
            self.pause()
        else:
            self.resume()

    def stop(self):
        if self.playbin:
            self.playbin.set_state(Gst.State.NULL)
            self._state = "stopped"
            self._emit("state-changed", self._state)

    def seek(self, position_ns):
        if self.playbin:
            self.playbin.seek_simple(
                Gst.Format.TIME,
                Gst.SeekFlags.FLUSH | Gst.SeekFlags.KEY_UNIT,
                position_ns,
            )

    def get_position(self):
        if self.playbin and self._state != "stopped":
            success, position = self.playbin.query_position(Gst.Format.TIME)
            return position if success else 0
        return 0

    def get_duration(self):
        if self.playbin and self._state != "stopped":
            success, duration = self.playbin.query_duration(Gst.Format.TIME)
            return duration if success else 0
        return 0

    @property
    def volume(self):
        return self._volume

    @volume.setter
    def volume(self, val):
        self._volume = max(0.0, min(1.0, val))
        if self.playbin:
            self.playbin.set_property("volume", self._volume)

    @property
    def state(self):
        return self._state

    def _on_eos(self, bus, msg):
        print("[DEBUG] GStreamer EOS received")
        self._state = "stopped"
        GLib.idle_add(self._emit, "eos")

    def _on_error(self, bus, msg):
        err, debug = msg.parse_error()
        self._state = "stopped"
        GLib.idle_add(self._emit, "error", err.message)

    def cleanup(self):
        if self.playbin:
            self.playbin.set_state(Gst.State.NULL)
            self.playbin = None
