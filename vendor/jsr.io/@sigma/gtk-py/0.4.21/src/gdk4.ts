import { Callback } from "../mod.ts";

export interface Gdk {
  Display: Display;
  DragAction: {
    COPY: DragAction;
  };
  KEY_v: {
    valueOf(): number;
  };
  ModifierType: {
    CONTROL_MASK: ModifierType;
  };
}

export interface Display {
  get_default(): Display;
  get_clipboard(): Clipboard;
}

export enum DragAction {
  COPY = 1,
  MOVE = 2,
  LINK = 4,
  ASK = 8,
}

export interface Clipboard {
  read_text_async: (cancellable: any, callback: Callback) => void;
  read_text_finish: (result: any) => { valueOf: () => string };
}

export enum ModifierType {
  CONTROL_MASK = 4,
}
