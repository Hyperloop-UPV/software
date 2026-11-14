import type { ComparisonSignal } from "../../types/normal";

export function axisKey(signal: ComparisonSignal): string {
  return signal.discrete ? `state:${signal.id}` : signal.units || "Value";
}
