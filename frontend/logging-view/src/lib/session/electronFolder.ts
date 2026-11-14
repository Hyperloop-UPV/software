// Reopening a session from a stored path, for the "recent sessions" list.
//
// openSession only needs `{ name, webkitRelativePath, text() }` (DroppedFile)
// and reads each CSV lazily, the first time a signal is drawn — so a file-like
// object whose text() is an IPC call behaves exactly like a browser File, and
// nothing downstream has to know the difference.
import type { DroppedFile } from "../../types/session";

/** True when the Electron bridge can list and read a folder by path. */
export function canOpenSessionPaths(): boolean {
  return !!(
    window.electronAPI?.listSessionFiles && window.electronAPI?.readSessionFile
  );
}

export async function sessionFilesFromPath(
  dir: string,
): Promise<DroppedFile[]> {
  const api = window.electronAPI;
  if (!api?.listSessionFiles || !api.readSessionFile)
    throw new Error("Opening a session by path needs the desktop app");
  const { folderName, entries } = await api.listSessionFiles(dir);
  if (entries.length === 0)
    throw new Error("No session files found in that folder");
  return entries.map((relative) => ({
    name: relative.split("/").pop() ?? relative,
    // openSession derives the session name from the first segment, and
    // sessionFiles is keyed by this exact string.
    webkitRelativePath: `${folderName}/${relative}`,
    text: () => api.readSessionFile!(dir, relative),
  }));
}
