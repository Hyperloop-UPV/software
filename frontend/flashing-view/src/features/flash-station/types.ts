/** Whether a board is reachable on the network right now. */
export type BoardState = "connected" | "offline";

/** Outcome of a single board flash attempt. */
export type FlashState = "success" | "error";

/**
 * Represents one physical board (MCU) that can be flashed.
 *
 * The `mcu` field is used for firmware compatibility checks — e.g. a file
 * named "control-f405.bin" should only flash onto an STM32F405 board.
 */
export type Board = {
  id: string;
  name: string;
  mcu: string;
  port: string;
  host: string;
  state: BoardState;
};

/** One row in the results table after a flash finishes (or fails). */
export type FlashResult = {
  id: string;
  board: string;
  firmware: string;
  state: FlashState;
  time: string;
  message: string;
};

/**
 * Immutable snapshot of the entire flash station state.
 *
 * The adapter keeps this object internally and creates shallow copies on
 * every mutation, then calls `emit()` so React re-renders via
 * useSyncExternalStore.
 */
export type FlashStationSnapshot = {
  selectedFile: File | null;
  selectedFileName: string;
  selectedBoardIds: string[];
  boards: Board[];
  results: FlashResult[];
  log: string[];
  isFlashing: boolean;
  activeBoardId: string | null;
};

/**
 * Interface for anything that can drive the flash station UI.
 *
 * Both the mock and real BLCU adapters implement this so the React layer
 * doesn't care whether it's talking to hardware or thin air.
 */
export type FlashStationAdapter = {
  /** Returns the current state snapshot — used by useSyncExternalStore. */
  getSnapshot: () => FlashStationSnapshot;

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * This is the classic observer pattern that useSyncExternalStore expects.
   */
  subscribe: (listener: () => void) => () => void;

  /** Called when the user picks a file through the hidden HTML <input>. */
  setSelectedFile: (file: File | null) => void;

  /**
   * Called when the user clicks "Choose File".
   * In real mode this opens the Electron native dialog. In mock mode it
   * simply returns null and the UI falls back to the HTML input.
   */
  chooseFile: () => Promise<string | null>;

  /** Toggle a single board on/off. Only one board can be selected at a time. */
  toggleBoard: (boardId: string, checked: boolean) => void;

  /** Bulk-select boards (internally clamped to the first one). */
  selectBoards: (boardIds: string[]) => void;

  /** Abort everything, clear timers, and reset to factory defaults. */
  reset: () => void;

  /** Kick off the flash sequence for the currently selected board(s). */
  startFlash: () => void;

  /** Tear down timers and listeners when the component unmounts. */
  dispose: () => void;
};
