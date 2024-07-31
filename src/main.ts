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
} from "jsr:@sigma/gtk-py@0.4.21";

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
const qrPath = Deno.makeTempFileSync();

class MainWindow extends Gtk.ApplicationWindow {
  #label: Gtk_.Label;
  #picture: Gtk_.Picture;
  #dropTarget: Gtk_.DropTarget;
  #contentBox: Gtk_.Box;
  #clipboard: Gdk_.Clipboard;

  constructor(kwArg: NamedArgument) {
    super(kwArg);
    this.set_title("Share");
    this.set_default_size(400, 400);
    this.connect("close-request", python.callback(this.#onCloseRequest));

    // Initialize clipboard
    this.#clipboard = Gdk.Display.get_default().get_clipboard();

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

    this.#label = Gtk.Label(
      kw`label=${"Drop a file here or press Ctrl+V to paste"}`,
    );
    this.#label.get_style_context().add_class("instruction-label");

    this.#picture = Gtk.Picture();
    this.#picture.set_filename(qrPath);
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

    // Add key event controller for Ctrl+V
    const keyController = Gtk.EventControllerKey.new();
    keyController.connect("key-pressed", this.#onKeyPressed);
    this.add_controller(keyController);
  }

  #onDrop = python.callback(
    (_a1: object, _dropTarget: Gtk_.DropTarget, file: Gio_.File) => {
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

  #onKeyPressed = python.callback(
    (
      // deno-lint-ignore no-explicit-any
      _: any,
      _controller: Gtk_.EventControllerKey,
      keyval: number,
      _keycode: number,
      state: Gdk_.ModifierType,
    ) => {
      if (
        keyval === Gdk.KEY_v.valueOf() &&
        //@ts-ignore: exists in pyobject
        state.__and__(Gdk.ModifierType.CONTROL_MASK)
          .__eq__(Gdk.ModifierType.CONTROL_MASK)
          .valueOf()
      ) {
        this.#handlePaste();
        return true;
      }
      return false;
    },
  );

  #handlePaste = () => {
    this.#clipboard.read_text_async(null, this.#onTextReceived);
  };

  #onTextReceived = python.callback(
    // deno-lint-ignore no-explicit-any
    (_: any, _clipboard: Gdk_.Clipboard, result: Gio_.AsyncResult) => {
      const text = this.#clipboard.read_text_finish(result).valueOf();

      if (text) {
        this.#label.set_text(text);
        worker.postMessage({ type: "text", content: text });
      } else {
        console.warn("No text found in clipboard");
      }
    },
  );

  #onCloseRequest = () => {
    worker.terminate();
    Deno.removeSync(qrPath);
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
  worker.postMessage({ type: "qrPath", path: qrPath });
  worker.onmessage = (event) => {
    console.log("[main] received msg:", event.data);
    switch (event.data.type) {
      case "start": {
        const app = new App(kw`application_id=${"io.github.sigmasd.share"}`);
        const signal = python.import("signal");
        GLib.unix_signal_add(
          GLib.PRIORITY_HIGH,
          signal.SIGINT,
          python.callback(() => {
            worker.terminate();
            Deno.removeSync(qrPath);
            app.quit();
          }),
        );
        app.run(Deno.args);
        break;
      }
    }
  };
}
