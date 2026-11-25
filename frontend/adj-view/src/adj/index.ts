// Version dispatch for ADJ archives. Each ADJ format version lives in its own
// `vN/` folder; this module is the only place that knows which versions exist.
import { summarizeV2 } from "./v2/summary";
import type { AdjArchiveV2 } from "./v2/types";

// Archives published before versioning was introduced carry no `version` key.
const DEFAULT_ADJ_VERSION = 2;

// Keep in sync with the `case`s in parseAdj — shown to the user when an
// archive's version isn't one of these.
export const SUPPORTED_ADJ_VERSIONS: readonly number[] = [2];

export type LoadedAdj = { version: 2; data: AdjArchiveV2 };

// An archive with a well-formed but unknown version is a normal outcome (the
// ADJ format moved on before the viewer did), not a load error.
export type ParsedAdj =
  | { supported: true; adj: LoadedAdj }
  | { supported: false; version: number };

export interface AdjSummary {
  boards: number;
  measurements: number;
  packets: number;
}

// Compile-time exhaustiveness check: adding a member to LoadedAdj makes every
// switch that forgets to handle it fail to type-check here.
export function assertNever(version: never): never {
  throw new Error(`Unhandled ADJ version: ${JSON.stringify(version)}`);
}

export function detectAdjVersion(raw: unknown): number {
  const version = (raw as { version?: unknown } | null)?.version;
  if (version === undefined || version === null) return DEFAULT_ADJ_VERSION;
  const parsed = typeof version === "number" ? version : Number(version);
  if (typeof version === "boolean" || version === "" || !Number.isInteger(parsed)) {
    throw new Error(`Invalid ADJ version: ${JSON.stringify(version)}`);
  }
  return parsed;
}

export function parseAdj(raw: unknown): ParsedAdj {
  const version = detectAdjVersion(raw);
  switch (version) {
    case 2:
      return { supported: true, adj: { version: 2, data: raw as AdjArchiveV2 } };
    default:
      return { supported: false, version };
  }
}

export function summarizeAdj(adj: LoadedAdj): AdjSummary {
  switch (adj.version) {
    case 2:
      return summarizeV2(adj.data);
    default:
      return assertNever(adj.version);
  }
}
