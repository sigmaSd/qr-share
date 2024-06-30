export interface Gdk {
  Display: Display;
  DragAction: {
    COPY: DragAction;
  };
}

export interface Display {
  get_default(): Display;
}

export enum DragAction {
  COPY = 1,
  MOVE = 2,
  LINK = 4,
  ASK = 8,
}
