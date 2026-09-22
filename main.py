import sys
import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
gi.require_version("Gst", "1.0")

from gi.repository import Gtk, Adw, Gst, Gio

Gst.init(None)

from ui.window import NasheedWindow
from ui.style import apply_css
from core.library import Library


class NasheedApp(Adw.Application):
    def __init__(self):
        super().__init__(
            application_id="com.nasheed.app",
            flags=Gio.ApplicationFlags.FLAGS_NONE,
        )
        self.library = Library()
        self.window = None
        self.style_manager = Adw.StyleManager.get_default()
        self.style_manager.set_color_scheme(Adw.ColorScheme.FORCE_DARK)

    def do_activate(self):
        apply_css()
        if not self.window:
            self.window = NasheedWindow(application=self)
        self.window.present()


def main():
    app = NasheedApp()
    return app.run(sys.argv)


if __name__ == "__main__":
    main()
