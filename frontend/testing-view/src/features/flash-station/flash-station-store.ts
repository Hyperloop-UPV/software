import { createInitialFlashStationSnapshot } from "./initial-state"
import type {
  Board,
  FlashResult,
  FlashState,
  FlashStationAdapter,
} from "./types"
import { getSelectedFileLabel } from "./utils"

/**
 * Formats a Date into a compact HH:mm (or HH:mm:ss) string.
 * We use en-GB so we get 24-hour clock without AM/PM noise.
 */
function formatClock(date: Date, withSeconds = false) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12: false,
  }).format(date)
}

/**
 * Result returned by the chooseFile callback.
 * `name` is what we show in the UI (basename).
 * `path` is the absolute filesystem path — only needed for real BLCU uploads.
 */
type ChooseFileResult = { name: string; path: string | null } | null

/**
 * Core flash station logic shared between mock and real BLCU modes.
 *
 * The only difference between demo and production is the `chooseFile` and
 * `flashBoard` callbacks injected via options. Everything else — snapshot
 * management, timer cleanup, log rotation, staggered board flashing — lives
 * here so we don't duplicate it in two giant files.
 */
export function createFlashStationAdapter(options: {
  chooseFile: () => Promise<ChooseFileResult>
  flashBoard: (
    board: Board,
    fileName: string,
    filePath: string | null
  ) => Promise<{ state: FlashState; message: string }>
}): FlashStationAdapter {
  const listeners = new Set<() => void>()
  let snapshot = createInitialFlashStationSnapshot()

  /**
   * When a real file path is chosen via the Electron dialog we stash it here.
   * Browser File objects (from the hidden <input>) don't need this — they live
   * in snapshot.selectedFile and are read directly by the BLCU backend.
   */
  let selectedFilePath: string | null = null

  /** All active setTimeout IDs so we can nuke them on reset or re-flash. */
  let timers: number[] = []

  /** Notify every React component subscribed via useSyncExternalStore. */
  function emit() {
    listeners.forEach((listener) => listener())
  }

  /** Kill every pending timer and wipe the list so nothing leaks. */
  function clearTimers() {
    timers.forEach((timer) => window.clearTimeout(timer))
    timers = []
  }

  /**
   * Append a line to the station log with a timestamp.
   * We cap the log at 8 lines so the textarea doesn't grow forever and
   * force the user to scroll through ancient history.
   */
  function appendLog(message: string) {
    snapshot = {
      ...snapshot,
      log: [
        ...snapshot.log,
        `[${formatClock(new Date(), true)}] ${message}`,
      ].slice(-8),
    }
    emit()
  }

  /**
   * Push a new flash result to the top of the list.
   * We keep only the latest 6 results so the table stays scannable.
   */
  function pushResult(result: FlashResult) {
    snapshot = {
      ...snapshot,
      results: [result, ...snapshot.results].slice(0, 6),
    }
    emit()
  }

  /**
   * The actual flash sequence.
   *
   * Boards are flashed one-by-one with a 650 ms stagger. This gives the UI
   * time to animate the "FLASHING" state per board and prevents hammering
   * the BLCU backend (or the mock timer loop) all at once.
   */
  function startFlash() {
    // Guard: can't flash if already flashing, nothing selected, or no file.
    if (
      snapshot.isFlashing ||
      snapshot.selectedBoardIds.length === 0 ||
      !snapshot.selectedFileName
    ) {
      return
    }

    clearTimers()

    snapshot = { ...snapshot, isFlashing: true, activeBoardId: null }
    emit()
    appendLog(
      `flash started for ${snapshot.selectedBoardIds.length} board(s) using ${snapshot.selectedFileName}`
    )

    const selectedBoards = snapshot.boards.filter((board) =>
      snapshot.selectedBoardIds.includes(board.id)
    )

    selectedBoards.forEach((board, index) => {
      const timer = window.setTimeout(async () => {
        snapshot = { ...snapshot, activeBoardId: board.id }
        emit()

        try {
          const { state, message } = await options.flashBoard(
            board,
            snapshot.selectedFileName,
            selectedFilePath
          )

          pushResult({
            id: `${board.id}-${Date.now()}`,
            board: board.name,
            firmware: getSelectedFileLabel(snapshot),
            state,
            time: formatClock(new Date()),
            message,
          })

          const logMessage =
            state === "success"
              ? `${board.name} flashed successfully`
              : `${board.name} rejected incompatible image`
          appendLog(logMessage)
        } catch (error: any) {
          // Network or BLCU errors surface here.
          pushResult({
            id: `${board.id}-${Date.now()}`,
            board: board.name,
            firmware: getSelectedFileLabel(snapshot),
            state: "error",
            time: formatClock(new Date()),
            message: error.message || "Upload failed.",
          })
          appendLog(
            `${board.name} flash failed: ${error.message || "Unknown error"}`
          )
        }

        // Last board finished — give the UI a brief moment then go idle.
        if (index === selectedBoards.length - 1) {
          const idleTimer = window.setTimeout(() => {
            snapshot = {
              ...snapshot,
              isFlashing: false,
              activeBoardId: null,
            }
            emit()
            appendLog("station idle")
          }, 300)

          timers.push(idleTimer)
        }
      }, 650 * (index + 1))

      timers.push(timer)
    })
  }

  return {
    getSnapshot: () => snapshot,

    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    setSelectedFile: (selectedFile) => {
      // Ditch any previously chosen Electron path — the user switched to a
      // browser File object instead.
      selectedFilePath = null
      snapshot = {
        ...snapshot,
        selectedFile,
        selectedFileName: selectedFile?.name ?? "",
      }
      emit()
    },

    chooseFile: async () => {
      const result = await options.chooseFile()
      if (!result) return null

      selectedFilePath = result.path
      snapshot = {
        ...snapshot,
        selectedFile: null,
        selectedFileName: result.name,
      }
      emit()
      return result.name
    },

    toggleBoard: (boardId: string, checked: boolean) => {
      // The UI is built around single-selection radio-style behaviour.
      const selectedBoardIds = checked ? [boardId] : []
      snapshot = { ...snapshot, selectedBoardIds }
      emit()
    },

    selectBoards: (selectedBoardIds: string[]) => {
      // slice(0, 1) enforces the single-board rule even if the caller passes
      // an array with multiple IDs.
      snapshot = { ...snapshot, selectedBoardIds: selectedBoardIds.slice(0, 1) }
      emit()
    },

    reset: () => {
      clearTimers()
      selectedFilePath = null
      snapshot = createInitialFlashStationSnapshot()
      emit()
    },

    startFlash,

    dispose: () => {
      clearTimers()
      listeners.clear()
    },
  }
}
