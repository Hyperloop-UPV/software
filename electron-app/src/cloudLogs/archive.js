/**
 * @module cloudLogs
 * @description Archive compression and safe extraction utilities for recording sessions.
 * Handles ZIP archive creation and extraction with protection against zip slips, zip bombs, and traversal attacks.
 */

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

/**
 * Compresses a completed recording session folder into a ZIP archive.
 * @param {string} dir - Directory path of the recording session to compress.
 * @param {string} destination - Destination file path for the ZIP archive.
 * @param {function(number, number): void} onProgress - Callback invoked with processed entry count and total file count.
 * @returns {Promise<Object>} Session metadata of the compressed archive.
 * @throws {Error} If destination file already exists, compression fails, or files change during compression.
 */
export async function compressSession(dir, destination, onProgress) {
  const before = await inspectSession(dir);
  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.on("progress", ({ entries }) =>
    onProgress(entries.processed, before.fileCount),
  );
  archive.on("warning", (error) => archive.destroy(error));

  // Flag 'wx' ensures failure if the destination already exists
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

  // Verify files did not change while compressing (e.g. logger was still running)
  const after = await inspectSession(dir);
  if (JSON.stringify(before.files) !== JSON.stringify(after.files)) {
    throw new Error(
      "The recording changed during compression. Stop logging before uploading.",
    );
  }
  return before;
}

/**
 * Extracts session files into a private directory, rejecting traversal, symlinks, and zip bombs.
 * @param {string} archivePath - Path to the ZIP archive file.
 * @param {string} destination - Destination directory path for extracted files.
 * @param {function(number, number): void} onProgress - Callback invoked with processed entry count and total entry count.
 * @returns {Promise<Object>} Inspected session metadata of the extracted files.
 * @throws {Error} If archive contains unsafe entries, exceeds limits, or extraction fails.
 */
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
            // Normalize path separators to POSIX slashes for consistent validation
            const name = entry.fileName.replace(/\\/g, "/");

            // Extract host OS and POSIX mode from entry attributes
            const madeBy = entry.versionMadeBy >> 8;
            const mode =
              madeBy === 3
                ? (entry.externalFileAttributes >>> 16) & 0o170000
                : 0;

            // Reject zip bombs, absolute paths, traversal, symlinks, and encryption
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

            // Skip directory entries since directories are created on demand
            if (name.endsWith("/")) {
              zip.readEntry();
              return;
            }

            if (!isSessionFile(name))
              throw new Error(
                "Archive contains files outside a logging session.",
              );

            // Validate total declared uncompressed size from headers
            declaredBytes += entry.uncompressedSize;
            if (declaredBytes > MAX_BYTES)
              throw new Error("Extracted session exceeds 4 GiB.");

            const target = path.resolve(destination, name);

            // Lowercase paths on Windows to prevent case-collision attacks
            const key =
              process.platform === "win32" ? target.toLowerCase() : target;
            if (seen.has(key))
              throw new Error("Archive contains duplicate file entries.");
            seen.add(key);

            // Ensure the target path is strictly contained within destination
            if (!target.startsWith(path.resolve(destination) + path.sep))
              throw new Error("Unsafe archive path.");

            await mkdir(path.dirname(target), { recursive: true });

            const input = await new Promise((res, rej) =>
              zip.openReadStream(entry, (err, stream) =>
                err ? rej(err) : res(stream),
              ),
            );

            // Track decompressed bytes in real-time to guard against forged headers
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

            // Prevent overwriting existing files and symlink race conditions
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
