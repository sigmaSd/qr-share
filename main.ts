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
} from "jsr:@sigma/gtk-py@0.4.18";

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
  #vbox: Gtk_.Box;
  #label: Gtk_.Label;
  #picture: Gtk_.Picture;
  #dropTarget: Gtk_.DropTarget;
  constructor(kwArg: NamedArgument) {
    super(kwArg);
    this.set_title("Demo");
    this.set_size_request(300, 300);
    this.connect("close-request", python.callback(this.#onCloseRequest));

    this.#vbox = Gtk.Box(kw`orientation=${Gtk.Orientation.VERTICAL}`);
    this.#label = Gtk.Label(kw`label=${"Drop a file here"}`);
    this.#picture = Gtk.Picture();
    this.#picture.set_filename("/tmp/qr.png");
    this.#vbox.append(this.#label);
    this.#vbox.append(this.#picture);
    this.set_child(this.#vbox);

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
        this.#label.set_text(filePath);
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
