import { createInitialFlashStationSnapshot } from "./initial-state";
import type {
  Board,
  FlashResult,
  FlashState,
  FlashStationAdapter,
} from "./types";
import { getSelectedFileLabel } from "./utils";

/** Formats a Date into a compact HH:mm or HH:mm:ss string (24-hour, en-GB). */
function formatClock(date: Date, withSeconds = false): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12: false,
  }).format(date);
}

/** Result returned by the chooseFile callback. */
type ChooseFileResult = { name: string; path: string | null } | null;

/**
 * Core flash station logic shared between all adapter implementations.
 *
 * The caller injects `chooseFile` and `flashBoard` so this factory works
 * identically for both the real BLCU backend and any mock/test replacement.
 * Everything else — snapshot management, timer cleanup, log rotation, and
 * staggered board flashing — lives here to avoid duplication.
 */
export function createFlashStationAdapter(options: {
  chooseFile: () => Promise<ChooseFileResult>;
  flashBoard: (
    board: Board,
    fileName: string,
    filePath: string | null,
  ) => Promise<{ state: FlashState; message: string }>;
}): FlashStationAdapter {
  const listeners = new Set<() => void>();
  let snapshot = createInitialFlashStationSnapshot();

  /**
   * When a file path is chosen via the Electron dialog we stash it here.
   * Browser File objects (from the hidden <input>) don't need this — they
   * live in snapshot.selectedFile and are read directly by the BLCU backend.
   */
  let selectedFilePath: string | null = null;

  /** All active setTimeout IDs so we can cancel them on reset or re-flash. */
  let timers: number[] = [];

  /** Notify every React component subscribed via useSyncExternalStore. */
  function emit(): void {
    listeners.forEach((listener) => listener());
  }

  /** Cancel every pending timer. */
  function clearTimers(): void {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers = [];
  }

  /**
   * Append a timestamped line to the station log.
   * Capped at 8 lines so the textarea stays scannable without scrolling.
   */
  function appendLog(message: string): void {
    snapshot = {
      ...snapshot,
      log: [
        ...snapshot.log,
        `[${formatClock(new Date(), true)}] ${message}`,
      ].slice(-8),
    };
    emit();
  }

  /**
   * Push a new flash result to the top of the results list.
   * Kept at 6 entries max so the table stays readable at a glance.
   */
  function pushResult(result: FlashResult): void {
    snapshot = {
      ...snapshot,
      results: [result, ...snapshot.results].slice(0, 6),
    };
    emit();
  }

  /**
   * Flash each selected board one-by-one with a 650 ms stagger.
   *
   * The stagger gives the UI time to animate the per-board "FLASHING" state
   * and prevents hammering the BLCU backend all at once.
   */
  function startFlash(): void {
    if (
      snapshot.isFlashing ||
      snapshot.selectedBoardIds.length === 0 ||
      !snapshot.selectedFileName
    ) {
      return;
    }

    clearTimers();
    snapshot = { ...snapshot, isFlashing: true, activeBoardId: null };
    emit();
    appendLog(
      `flash started for ${snapshot.selectedBoardIds.length} board(s) using ${snapshot.selectedFileName}`,
    );

    const selectedBoards = snapshot.boards.filter((board) =>
      snapshot.selectedBoardIds.includes(board.id),
    );

    selectedBoards.forEach((board, index) => {
      const timer = window.setTimeout(async () => {
        snapshot = { ...snapshot, activeBoardId: board.id };
        emit();

        try {
          const { state, message } = await options.flashBoard(
            board,
            snapshot.selectedFileName,
            selectedFilePath,
          );

          pushResult({
            id: `${board.id}-${Date.now()}`,
            board: board.name,
            firmware: getSelectedFileLabel(snapshot),
            state,
            time: formatClock(new Date()),
            message,
          });

          appendLog(
            state === "success"
              ? `${board.name} flashed successfully`
              : `${board.name} rejected incompatible image`,
          );
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : "Upload failed.";

          pushResult({
            id: `${board.id}-${Date.now()}`,
            board: board.name,
            firmware: getSelectedFileLabel(snapshot),
            state: "error",
            time: formatClock(new Date()),
            message,
          });
          appendLog(`${board.name} flash failed: ${message}`);
        }

        if (index === selectedBoards.length - 1) {
          const idleTimer = window.setTimeout(() => {
            snapshot = { ...snapshot, isFlashing: false, activeBoardId: null };
            emit();
            appendLog("station idle");
          }, 300);

          timers.push(idleTimer);
        }
      }, 650 * (index + 1));

      timers.push(timer);
    });
  }

  return {
    getSnapshot: () => snapshot,

    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    setSelectedFile: (selectedFile) => {
      selectedFilePath = null;
      snapshot = {
        ...snapshot,
        selectedFile,
        selectedFileName: selectedFile?.name ?? "",
      };
      emit();
    },

    chooseFile: async () => {
      const result = await options.chooseFile();
      if (!result) return null;

      selectedFilePath = result.path;
      snapshot = {
        ...snapshot,
        selectedFile: null,
        selectedFileName: result.name,
      };
      emit();
      return result.name;
    },

    toggleBoard: (boardId, checked) => {
      snapshot = {
        ...snapshot,
        selectedBoardIds: checked ? [boardId] : [],
      };
      emit();
    },

    selectBoards: (selectedBoardIds) => {
      // Clamp to single-selection — the UI is radio-style.
      snapshot = { ...snapshot, selectedBoardIds: selectedBoardIds.slice(0, 1) };
      emit();
    },

    reset: () => {
      clearTimers();
      selectedFilePath = null;
      snapshot = createInitialFlashStationSnapshot();
      emit();
    },

    startFlash,

    dispose: () => {
      clearTimers();
      listeners.clear();
    },
  };
}
