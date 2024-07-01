#!/usr/bin/env -S deno run --allow-all --unstable-ffi
import {
  type Adw1_ as Adw_,
  type Gdk4_ as Gdk_,
  type Gio2_ as Gio_,
  type GLib2_ as GLib_,
  type Gtk4_ as Gtk_,
  kw,
  NamedArgument,
  python,
} from "jsr:@sigma/gtk-py@0.4.20";

const gi = python.import("gi");
gi.require_version("Gtk", "4.0");
gi.require_version("Adw", "1");
const Gtk: Gtk_.Gtk = python.import("gi.repository.Gtk");
const Adw: Adw_.Adw = python.import("gi.repository.Adw");
const Gdk: Gdk_.Gdk = python.import("gi.repository.Gdk");
const GLib: GLib_.GLib = python.import("gi.repository.GLib");
const Gio: Gio_.Gio = python.import("gi.repository.Gio");

const worker = new Worker(new URL("./main.worker.ts", import.meta.url).href, {
  type: "module",
});

class MainWindow extends Gtk.ApplicationWindow {
  #label: Gtk_.Label;
  #picture: Gtk_.Picture;
  #dropTarget: Gtk_.DropTarget;
  #contentBox: Gtk_.Box;

  constructor(kwArg: NamedArgument) {
    super(kwArg);
    this.set_title("QR Share");
    this.set_default_size(400, 400);
    this.connect("close-request", python.callback(this.#onCloseRequest));

    // Apply CSS to the window
    const cssProvider = Gtk.CssProvider();
    cssProvider.load_from_data(`\
.main-window {
  background-color: #f0f0f0;
}
.instruction-label {
  font-size: 18px;
  font-weight: bold;
  color: #333333;
  margin: 20px;
}
.content-box {
  background-color: #ffffff;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin: 10px;
  padding: 20px;
}`);
    Gtk.StyleContext.add_provider_for_display(
      Gdk.Display.get_default(),
      cssProvider,
      Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
    );

    // Add CSS class to the window
    this.get_style_context().add_class("main-window");

    this.#label = Gtk.Label(kw`label=${"Drop a file here"}`);
    this.#label.get_style_context().add_class("instruction-label");

    this.#picture = Gtk.Picture();
    this.#picture.set_filename("/tmp/qr.png");
    this.#picture.set_size_request(200, 200);
    this.#picture.set_keep_aspect_ratio(true);

    this.#contentBox = Gtk.Box(kw`orientation=${Gtk.Orientation.VERTICAL}`);
    this.#contentBox.get_style_context().add_class("content-box");
    this.#contentBox.append(this.#label);
    this.#contentBox.append(this.#picture);

    this.set_child(this.#contentBox);

    this.#dropTarget = Gtk.DropTarget.new(
      Gio.File,
      Gdk.DragAction.COPY,
    );
    this.#dropTarget.connect("drop", this.#onDrop);
    this.add_controller(this.#dropTarget);
  }

  #onDrop = python.callback(
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    (_a1: any, _dropTarget: Gtk_.DropTarget, file: Gio_.File) => {
      const filePath: string = file.get_path().valueOf();
      if (filePath) {
        const fileName = filePath.split("/").pop();
        if (!fileName) {
          console.warn("Could not detect filename from this path:", filePath);
          return false;
        }
        this.#label.set_text(fileName);
        worker.postMessage({ type: "file", path: filePath });
        return true;
      }
      return false;
    },
  );

  #onCloseRequest = () => {
    worker.terminate();
    return false;
  };
}

class App extends Adw.Application {
  #win: MainWindow | undefined;

  constructor(kwArg: NamedArgument) {
    super(kwArg);
    this.connect("activate", this.onActivate);
  }

  onActivate = python.callback((_kwarg, app: Gtk_.Application) => {
    this.#win = new MainWindow(new NamedArgument("application", app));
    this.#win.present();
  });
}

if (import.meta.main) {
  const app = new App(kw`application_id=${"io.github.sigmasd.share"}`);
  const signal = python.import("signal");
  GLib.unix_signal_add(
    GLib.PRIORITY_HIGH,
    signal.SIGINT,
    python.callback(() => {
      worker.terminate();
      app.quit();
    }),
  );
  app.run(Deno.args);
}
