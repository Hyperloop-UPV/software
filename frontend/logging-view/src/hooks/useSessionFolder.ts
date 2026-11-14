// Opening a session folder by path (Electron only) and recording it as recent.
// The folder picker and the empty state's recent list both go through here so
// a session is remembered no matter which one opened it.
import { useCallback, useState } from "react";
import {
  canOpenSessionPaths,
  sessionFilesFromPath,
} from "../lib/session/electronFolder";
import { useStore } from "../store/store";

export function useSessionFolder() {
  const openSession = useStore((state) => state.openSession);
  const rememberRecentSession = useStore(
    (state) => state.rememberRecentSession,
  );
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [failure, setFailure] = useState<{
    path: string;
    message: string;
  } | null>(null);

  const openPath = useCallback(
    async (dir: string) => {
      setBusyPath(dir);
      setFailure(null);
      try {
        const files = await sessionFilesFromPath(dir);
        await openSession(files);
        const { availableSeries, folderName } = useStore.getState();
        const boards = Object.keys(availableSeries);
        rememberRecentSession({
          path: dir,
          folderName:
            folderName ?? dir.split(/[\\/]/).filter(Boolean).pop() ?? "Session",
          openedAt: Date.now(),
          boards: boards.length,
          series: boards.reduce(
            (total, board) => total + availableSeries[board].length,
            0,
          ),
        });
        return true;
      } catch (error) {
        setFailure({
          path: dir,
          message: error instanceof Error ? error.message : String(error),
        });
        return false;
      } finally {
        setBusyPath(null);
      }
    },
    [openSession, rememberRecentSession],
  );

  // Native dialog: unlike <input webkitdirectory>, it hands back a real path.
  const pickFolder = useCallback(async () => {
    const dir = await window.electronAPI?.selectFolder?.();
    if (!dir) return false;
    return openPath(dir);
  }, [openPath]);

  return {
    canOpenPaths: canOpenSessionPaths(),
    openPath,
    pickFolder,
    busyPath,
    failure,
    dismissFailure: () => setFailure(null),
  };
}
