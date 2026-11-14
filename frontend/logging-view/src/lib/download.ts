// Getting things out of the app: a file download or the clipboard. Both work
// in a plain browser and inside the Electron shell.

export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Revoked on the next tick: some browsers read the URL after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadText(name: string, text: string, type: string) {
  downloadBlob(name, new Blob([text], { type }));
}

/** Resolves false when the clipboard is unavailable or permission is denied. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const canCopyImages = () =>
  typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;

export async function copyImage(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

/** A name safe on every file system, keeping letters in any script. */
export function safeFileName(name: string, fallback = "export") {
  return name.trim().replace(/[^\p{L}\p{N} ._-]+/gu, "_") || fallback;
}
