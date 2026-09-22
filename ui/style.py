import gi

gi.require_version("Gtk", "4.0")
from gi.repository import Gtk


CSS = """
.play-btn {
    background-color: @accent_bg_color;
    color: @accent_fg_color;
    border-radius: 999px;
}

.play-btn:hover {
    background-color: shade(@accent_bg_color, 0.85);
}

.song-row {
    padding: 4px 0;
}

.badge-downloaded {
    background-color: alpha(@accent_bg_color, 0.2);
    color: @accent_fg_color;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 999px;
    font-weight: 600;
}

.badge-fav {
    color: @accent_bg_color;
    font-size: 14px;
}

.player-bar {
    border-top: 1px solid @borders;
    padding: 8px 16px;
}

.player-title {
    font-weight: 600;
    font-size: 14px;
}

.player-artist {
    font-size: 12px;
    opacity: 0.7;
}

.time-label {
    font-size: 11px;
    font-family: monospace;
    opacity: 0.7;
}
"""


def apply_css():
    from gi.repository import Gdk
    provider = Gtk.CssProvider()
    provider.load_from_string(CSS)
    display = Gdk.Display.get_default()
    if display:
        Gtk.StyleContext.add_provider_for_display(
            display,
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
        )
