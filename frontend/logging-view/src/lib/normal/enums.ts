// How a pane's visible signals are drawn once enums are in play.
//
// Three shapes, decided by composition rather than by a mode switch:
//   - every signal discrete           -> a Gantt-style state timeline
//   - exactly one discrete + numerics -> the enum as a background band
//   - anything else                   -> plain lines (a discrete signal then
//                                        draws as a step line on its own axis)
//
// Mixing two enums with numeric series is refused, the way testing-view's
// canAddSeriesToChart refuses it: the band can only express one state at a
// time, and stacking several washes is unreadable.
import type { ComparisonSignal } from "../../types/normal";

export type EnumDisplay = "background" | "series";

export interface PaneRender {
  mode: "timeline" | "lines";
  /** Signals drawn as lines (or as timeline rows when mode is "timeline"). */
  plotted: ComparisonSignal[];
  /** The enum drawn as a background band, if any. */
  band: ComparisonSignal | null;
}

export function classifyPaneSignals(
  visible: ComparisonSignal[],
  enumDisplay: EnumDisplay,
): PaneRender {
  if (visible.length === 0) return { mode: "lines", plotted: [], band: null };

  const discrete = visible.filter((signal) => signal.discrete);
  if (discrete.length === visible.length)
    return { mode: "timeline", plotted: visible, band: null };

  if (discrete.length === 1 && enumDisplay === "background")
    return {
      mode: "lines",
      plotted: visible.filter((signal) => !signal.discrete),
      band: discrete[0],
    };

  return { mode: "lines", plotted: visible, band: null };
}

/**
 * Whether `incoming` may join a pane that already holds `current`. Keeps the
 * band's "one enum at a time" rule enforceable at the point signals enter.
 */
export function canMixSignals(
  current: ComparisonSignal[],
  incoming: ComparisonSignal[],
): boolean {
  const all = [...current, ...incoming];
  const discrete = all.filter((signal) => signal.discrete).length;
  if (discrete === 0 || discrete === all.length) return true;
  return discrete === 1;
}

export const MIXED_ENUM_MESSAGE =
  "A plot can hold one enum alongside numeric signals, or several enums on their own.";
