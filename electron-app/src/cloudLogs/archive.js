import archiver from "archiver";
import yauzl from "yauzl";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import path from "node:path";
import {
  inspectSession,
  isSessionFile,
  MAX_BYTES,
  MAX_FILES,
} from "./sessions.js";

export async function compressSession(dir, destination, onProgress) {
  const before = await inspectSession(dir);
  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.on("progress", ({ entries }) =>
    onProgress(entries.processed, before.fileCount),
  );
  // Missing/unreadable files must fail the upload, never silently omit data.
  archive.on("warning", (error) => archive.destroy(error));
  const output = pipeline(
    archive,
    createWriteStream(destination, { flags: "wx" }),
  );
  for (const file of before.files)
    archive.file(path.join(dir, file.name), { name: file.name });
  try {
    await Promise.all([archive.finalize(), output]);
  } catch (error) {
    archive.abort();
    throw error;
  }
  const after = await inspectSession(dir);
  if (JSON.stringify(before.files) !== JSON.stringify(after.files)) {
    throw new Error(
      "The recording changed during compression. Stop logging before uploading.",
    );
  }
  return before;
}

/** Extract only session files into a fresh private directory. No links or traversal. */
export async function extractSession(archivePath, destination, onProgress) {
  await mkdir(destination, { recursive: true });
  await new Promise((resolve, reject) => {
    yauzl.open(
      archivePath,
      { lazyEntries: true, autoClose: true },
      (error, zip) => {
        if (error) return reject(error);
        let entries = 0;
        let bytes = 0;
        let declaredBytes = 0;
        const seen = new Set();
        const fail = (err) => {
          zip.close();
          reject(err);
        };
        zip.on("error", fail);
        zip.on("end", resolve);
        zip.on("entry", (entry) => {
          void (async () => {
            const name = entry.fileName.replace(/\\/g, "/");
            const madeBy = entry.versionMadeBy >> 8;
            const mode =
              madeBy === 3
                ? (entry.externalFileAttributes >>> 16) & 0o170000
                : 0;
            if (
              ++entries > MAX_FILES ||
              name.startsWith("/") ||
              name.includes(":") ||
              name.split("/").some((p) => p === ".." || p === ".") ||
              (mode != 0 && mode !== 0o100000 && mode !== 0o040000) ||
              entry.generalPurposeBitFlag & 1
            ) {
              throw new Error(
                "Archive contains an unsafe or unsupported entry.",
              );
            }
            if (name.endsWith("/")) {
              zip.readEntry();
              return;
            }
            if (!isSessionFile(name))
              throw new Error(
                "Archive contains files outside a logging session.",
              );
            declaredBytes += entry.uncompressedSize;
            if (declaredBytes > MAX_BYTES)
              throw new Error("Extracted session exceeds 4 GiB.");
            const target = path.resolve(destination, name);
            const key =
              process.platform === "win32" ? target.toLowerCase() : target;
            if (seen.has(key))
              throw new Error("Archive contains duplicate file entries.");
            seen.add(key);
            if (!target.startsWith(path.resolve(destination) + path.sep))
              throw new Error("Unsafe archive path.");
            await mkdir(path.dirname(target), { recursive: true });
            const input = await new Promise((res, rej) =>
              zip.openReadStream(entry, (err, stream) =>
                err ? rej(err) : res(stream),
              ),
            );
            const limit = new Transform({
              transform(chunk, _encoding, done) {
                bytes += chunk.length;
                done(
                  bytes > MAX_BYTES
                    ? new Error("Extracted session exceeds 4 GiB.")
                    : null,
                  chunk,
                );
              },
            });
            const output = createWriteStream(target, { flags: "wx" });
            input.once("error", fail);
            limit.once("error", fail);
            output.once("error", fail);
            await pipeline(input, limit, output);
            onProgress(entries, zip.entryCount);
            zip.readEntry();
          })().catch(fail);
        });
        zip.readEntry();
      },
    );
  });
  return inspectSession(destination);
}
