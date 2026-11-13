import { lowerBound } from "../plotStudio/range";
import type { SeriesData } from "../../types/plotStudio";

/**
 * Value of a signal at an instant: interpolated between the two neighbouring
 * samples, or the last sample held for discrete (enum / bool) signals.
 * `null` outside the stretch the signal was recorded for.
 */
export function valueAt(
  data: SeriesData,
  timeMs: number,
  discrete: boolean,
): number | null {
  const { time, value } = data;
  const count = time.length;
  if (count === 0 || timeMs < time[0] || timeMs > time[count - 1]) return null;
  const next = lowerBound(time, timeMs);
  if (time[next] === timeMs) return value[next];
  const previous = next - 1;
  if (discrete) return value[previous];
  const span = time[next] - time[previous];
  if (span <= 0) return value[previous];
  return (
    value[previous] +
    ((value[next] - value[previous]) * (timeMs - time[previous])) / span
  );
}
