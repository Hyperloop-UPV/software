import type { SeriesData } from "../../types/plotStudio";
import { lowerBound, upperBound } from "../plotStudio/range";

/** Summarize recorded samples within an inclusive window, without interpolation. */
export function summarizeWindow(
  data: SeriesData,
  startMs: number,
  endMs: number,
) {
  const first = lowerBound(data.time, startMs);
  const end = upperBound(data.time, endMs);
  let count = 0;
  let min = Infinity;
  let max = -Infinity;
  let mean = 0;
  let m2 = 0;
  let firstValue = 0;
  let lastValue = 0;
  let changes = 0;

  for (let i = first; i < end; i++) {
    const value = data.value[i];
    if (!Number.isFinite(value)) continue;
    if (count === 0) firstValue = value;
    else if (value !== lastValue) changes++;
    lastValue = value;
    count++;
    min = Math.min(min, value);
    max = Math.max(max, value);
    // Welford's method avoids cancellation for signals with large offsets.
    const delta = value - mean;
    mean += delta / count;
    m2 += delta * (value - mean);
  }

  return count === 0
    ? null
    : {
        count,
        min,
        max,
        mean,
        std: Math.sqrt(Math.max(0, m2 / count)),
        first: firstValue,
        last: lastValue,
        changes,
      };
}
