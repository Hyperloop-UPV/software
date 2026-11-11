// Runs CSV parsing off the main thread so assigning a large (100k+ row)
// signal to a plot doesn't freeze the tab. Invoked via parseCSVInWorker()
// in ./csv.ts — do not import this file directly elsewhere.
import { parseCSV } from "./csv";

self.onmessage = (e: MessageEvent<{ text: string; timeUnit: string; enumValues?: string[]; normalizeTime?: boolean }>) => {
  const { text, timeUnit, enumValues, normalizeTime = true } = e.data;
  const { time, value } = parseCSV(text, timeUnit, enumValues, normalizeTime);
  const timeBuffer = time.buffer;
  const valueBuffer = value.buffer;
  (self as unknown as Worker).postMessage(
    { timeBuffer, valueBuffer, count: time.length },
    [timeBuffer, valueBuffer],
  );
};
