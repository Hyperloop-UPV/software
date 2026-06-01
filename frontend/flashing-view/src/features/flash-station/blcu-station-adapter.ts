import { createFlashStationAdapter } from "./flash-station-store";
import type { FlashStationAdapter } from "./types";

/** Grab the Electron API injected by preload.js, if present. */
function getElectronAPI() {
  return (typeof window !== "undefined" && window.electronAPI) || null;
}

/**
 * Real BLCU adapter that talks to the hardware through the Electron main process.
 *
 * File selection and upload are proxied through Electron IPC (blcuSelectFile /
 * blcuUpload) so the renderer never touches the filesystem or network directly.
 */
export function createBlcuFlashStationAdapter(): FlashStationAdapter {
  return createFlashStationAdapter({
    chooseFile: async () => {
      const api = getElectronAPI();
      if (!api?.blcuSelectFile) return null;

      try {
        const path = await api.blcuSelectFile();
        if (!path) return null;

        return {
          name: path.split(/[/\\]/).pop() ?? "",
          path,
        };
      } catch {
        return null;
      }
    },

    flashBoard: async (board, fileName, filePath) => {
      const api = getElectronAPI();

      const result = await api?.blcuUpload?.({
        host: board.host,
        port: 69,
        remote_filename: fileName,
        local_path: filePath ?? "",
      });

      return {
        state: "success",
        message: result?.message ?? "Flash completed.",
      };
    },
  });
}
