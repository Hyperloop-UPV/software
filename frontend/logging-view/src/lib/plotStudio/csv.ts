import type { SeriesData } from "../../types/plotStudio";
import type { DroppedFile } from "../../types/session";

// Multipliers to convert raw timestamp units → milliseconds.
const TIME_UNIT_TO_MS: Record<string, number> = {
  ns: 1e-6,
  us: 1e-3,
  ms: 1,
  s: 1e3,
};

// Converts a non-numeric value-column cell (enum state name, or "true"/
// "false") to its numeric code. `enumValues` — the ADJ measurement's known
// state names, when available — is matched first so codes line up with
// getEnumLabels() elsewhere (stateLabel() in lib/plotStudio/timeline.ts
// looks the code back up in that same array). Falls back to a first-seen
// sequential mapping (via `seen`) for plain CSVs with no ADJ metadata, so
// the signal still parses — just without meaningful state labels.
function encodeTextValue(raw: string, enumValues: string[] | undefined, seen: Map<string, number>): number {
  const lower = raw.toLowerCase();
  if (lower === "true") return 1;
  if (lower === "false") return 0;
  if (enumValues) {
    const idx = enumValues.findIndex((e) => e.toLowerCase() === lower);
    if (idx !== -1) return idx;
  }
  let code = seen.get(raw);
  if (code === undefined) {
    code = seen.size;
    seen.set(raw, code);
  }
  return code;
}

/**
 * Parse a 4-column CSV produced by the backend logger.
 * Expected column order: timestamp, board, backend, value.
 * Time is converted to ms using `timeUnit`; by default each signal starts at
 * zero, while comparison views can preserve the original session timestamps.
 * `enumValues` — the ADJ measurement's state names, when known — lets an
 * enum/bool signal logged as text ("Idle", "true") be recovered as the
 * matching numeric code instead of being silently dropped by parseFloat.
 */
export function parseCSV(text: string, timeUnit = "ms", enumValues?: string[], normalizeTime = true): SeriesData {
  const toMs = TIME_UNIT_TO_MS[timeUnit] ?? 1;
  const lines = text.trim().split("\n");
  const time = new Float64Array(lines.length);
  const value = new Float64Array(lines.length);
  const seenTextValues = new Map<string, number>();
  let count = 0;

  for (const line of lines) {
    const parts = line.split(",");
    if (parts.length >= 4) {
      const timestamp = parseFloat(parts[0]);
      const raw = parts[3].trim();
      let v = parseFloat(raw);
      if (isNaN(v) && raw !== "") v = encodeTextValue(raw, enumValues, seenTextValues);
      if (!isNaN(timestamp) && !isNaN(v)) {
        time[count] = timestamp * toMs;
        value[count] = v;
        count++;
      }
    }
  }

  const t = time.subarray(0, count);
  const val = value.subarray(0, count);
  if (normalizeTime && count > 0) {
    const startTime = t[0];
    for (let i = 0; i < count; i++) t[i] -= startTime;
  }

  return { time: t, value: val };
}

/**
 * Parses a CSV file entirely off the main thread — session CSVs can reach
 * hundreds of thousands of rows, and reading + parsing that synchronously
 * (as parseCSV does) would freeze the tab for the whole duration.
 */
export async function parseCSVInWorker(file: DroppedFile, timeUnit = "ms", enumValues?: string[], normalizeTime = true): Promise<SeriesData> {
  // Read the text on the main thread and hand the worker a plain string —
  // directory-drop sessions store synthetic DroppedFile objects (a closure
  // over the real File, not the File itself), and a function property like
  // `.text` can't survive postMessage's structured clone (throws
  // DataCloneError). The heavy work (CSV parsing) still happens off-thread.
  const text = await file.text();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./csv.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ timeBuffer: ArrayBuffer; valueBuffer: ArrayBuffer; count: number }>) => {
      const { timeBuffer, valueBuffer, count } = e.data;
      worker.terminate();
      resolve({ time: new Float64Array(timeBuffer, 0, count), value: new Float64Array(valueBuffer, 0, count) });
    };
    worker.onerror = (err) => { worker.terminate(); reject(err); };
    worker.postMessage({ text, timeUnit, enumValues, normalizeTime });
  });
}
