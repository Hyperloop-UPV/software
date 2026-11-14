// Saving Normal mode dashboards: per session in localStorage, so reopening a
// log brings its layout back, and as a file that can be loaded onto another
// log. Both go through `restoreDashboard`, which trusts nothing it reads.
import { getPanes, mapPanes, signalIdsInLayout } from "./layout";
import { safeFileName } from "../download";
import {
  FORMULA_ID_PREFIX,
  type ChartLayout,
  type DashboardSettings,
  type FormulaSignal,
  type NormalDashboard,
  type TimeRange,
} from "../../types/normal";

const VERSION = 1;
const FILE_KIND = "logging-view-dashboard";
const KEY_PREFIX = "logging-view:dashboards:";
const INDEX_KEY = "logging-view:dashboards-index";
// Sessions remembered; the least recently saved one is dropped past this.
const MAX_SESSIONS = 20;

export const DASHBOARD_FILE_EXTENSION = ".dashboard.json";

interface SavedSession {
  version: number;
  activeId: string;
  dashboards: unknown[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isRange = (value: unknown): value is TimeRange =>
  isRecord(value) &&
  typeof value.start === "number" &&
  typeof value.end === "number" &&
  value.start >= 0 &&
  value.end <= 100 &&
  value.start < value.end;

function isLayout(value: unknown, depth = 0): value is ChartLayout {
  if (!isRecord(value) || typeof value.id !== "string" || depth > 8)
    return false;
  if (value.type === "pane")
    return typeof value.title === "string" && isStringArray(value.signalIds);
  return (
    value.type === "split" &&
    (value.direction === "horizontal" || value.direction === "vertical") &&
    isLayout(value.first, depth + 1) &&
    isLayout(value.second, depth + 1)
  );
}

const isFormula = (value: unknown): value is FormulaSignal =>
  isRecord(value) &&
  typeof value.id === "string" &&
  value.id.startsWith(FORMULA_ID_PREFIX) &&
  typeof value.name === "string" &&
  typeof value.expression === "string" &&
  isRecord(value.variables) &&
  Object.values(value.variables).every((source) => typeof source === "string");

const cursorTime = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * Rebuilds a dashboard from saved data, or `null` when it is not one.
 *
 * Fields the saved copy lacks (it may predate them) come from `defaults`.
 * Measurements the open session does not have are taken off the plots and
 * counted in `dropped`; formulas are kept and report their own missing inputs.
 */
export function restoreDashboard(
  raw: unknown,
  defaults: NormalDashboard,
  hasSeries: (id: string) => boolean,
): { dashboard: NormalDashboard; dropped: number } | null {
  if (!isRecord(raw) || !isRecord(raw.settings)) return null;
  const saved = raw.settings;
  if (!isRecord(saved.layoutState) || !isLayout(saved.layoutState.tree))
    return null;

  const formulas = Array.isArray(saved.formulas)
    ? saved.formulas.filter(isFormula)
    : [];
  const formulaIds = new Set(formulas.map((formula) => formula.id));
  const known = (id: string) =>
    id.startsWith(FORMULA_ID_PREFIX) ? formulaIds.has(id) : hasSeries(id);

  const missing = new Set<string>();
  const tree = mapPanes(saved.layoutState.tree, (pane) => {
    const signalIds = pane.signalIds.filter((id) => {
      if (known(id)) return true;
      missing.add(id);
      return false;
    });
    const xSignalId =
      typeof pane.xSignalId === "string" && known(pane.xSignalId)
        ? pane.xSignalId
        : undefined;
    if (typeof pane.xSignalId === "string" && !xSignalId)
      missing.add(pane.xSignalId);
    return {
      ...pane,
      signalIds,
      xSignalId,
      normalized: pane.normalized === true,
      hiddenSignalIds: isStringArray(pane.hiddenSignalIds)
        ? pane.hiddenSignalIds.filter((id) => signalIds.includes(id))
        : [],
      markers: Array.isArray(pane.markers)
        ? pane.markers.filter(
            (marker) =>
              isRecord(marker) &&
              typeof marker.id === "string" &&
              typeof marker.label === "string" &&
              typeof marker.timeMs === "number",
          )
        : [],
      ...(isRange(pane.timeWindow)
        ? { timeWindow: pane.timeWindow }
        : { timeWindow: undefined }),
    };
  });
  const paneIds = new Set(getPanes(tree).map((pane) => pane.id));
  const base = defaults.settings;
  const flag = (key: keyof DashboardSettings) =>
    typeof saved[key] === "boolean" ? (saved[key] as boolean) : base[key];
  const savedCursors = isRecord(saved.cursors) ? saved.cursors : {};

  const settings: DashboardSettings = {
    ...base,
    layoutState: {
      ids: signalIdsInLayout(tree),
      tree,
      preset:
        (saved.layoutState
          .preset as DashboardSettings["layoutState"]["preset"]) ?? null,
    },
    showStatistics: flag("showStatistics") as boolean,
    statisticsColumns:
      isStringArray(saved.statisticsColumns) &&
      saved.statisticsColumns.length > 0
        ? (saved.statisticsColumns as DashboardSettings["statisticsColumns"])
        : base.statisticsColumns,
    showOrders: flag("showOrders") as boolean,
    enumAsBackground: flag("enumAsBackground") as boolean,
    focusedId:
      typeof saved.focusedId === "string" && paneIds.has(saved.focusedId)
        ? saved.focusedId
        : null,
    units: isRecord(saved.units)
      ? Object.fromEntries(
          Object.entries(saved.units).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {},
    timeUnit: ["us", "ms", "s", "min"].includes(saved.timeUnit as string)
      ? (saved.timeUnit as DashboardSettings["timeUnit"])
      : base.timeUnit,
    range: isRange(saved.range) ? saved.range : base.range,
    linkTimeAxis: flag("linkTimeAxis") as boolean,
    panelSizes: isRecord(saved.panelSizes)
      ? (saved.panelSizes as DashboardSettings["panelSizes"])
      : {},
    formulas,
    showCursors: flag("showCursors") as boolean,
    cursors: { a: cursorTime(savedCursors.a), b: cursorTime(savedCursors.b) },
  };

  return {
    dashboard: {
      id: typeof raw.id === "string" ? raw.id : defaults.id,
      name:
        typeof raw.name === "string" && raw.name.trim()
          ? raw.name.slice(0, 80)
          : defaults.name,
      color: typeof raw.color === "string" ? raw.color : null,
      locked: raw.locked === true,
      selectedSeries: isRecord(raw.selectedSeries)
        ? (Object.fromEntries(
            Object.entries(raw.selectedSeries).filter(
              ([id, selected]) => selected === true && hasSeries(id),
            ),
          ) as Record<string, boolean>)
        : {},
      settings,
    },
    dropped: missing.size,
  };
}

// ---- Per-session storage -------------------------------------------------

// localStorage can be unavailable or full; saving a layout is a convenience
// and must never break the app.
function readJson(key: string): unknown {
  try {
    const text = localStorage.getItem(key);
    return text === null ? null : JSON.parse(text);
  } catch {
    return null;
  }
}

export function saveSessionDashboards(
  folderName: string,
  dashboards: NormalDashboard[],
  activeId: string,
) {
  try {
    const saved: SavedSession = { version: VERSION, activeId, dashboards };
    localStorage.setItem(KEY_PREFIX + folderName, JSON.stringify(saved));
    const index = readJson(INDEX_KEY);
    const sessions = [
      folderName,
      ...(isStringArray(index) ? index : []).filter(
        (name) => name !== folderName,
      ),
    ];
    for (const evicted of sessions.slice(MAX_SESSIONS))
      localStorage.removeItem(KEY_PREFIX + evicted);
    localStorage.setItem(
      INDEX_KEY,
      JSON.stringify(sessions.slice(0, MAX_SESSIONS)),
    );
  } catch {
    // Not saved this time; the next change tries again.
  }
}

/** The raw dashboards saved for a session, still to be validated. */
export function loadSessionDashboards(
  folderName: string,
): { activeId: string; dashboards: unknown[] } | null {
  const saved = readJson(KEY_PREFIX + folderName);
  if (
    !isRecord(saved) ||
    saved.version !== VERSION ||
    !Array.isArray(saved.dashboards) ||
    saved.dashboards.length === 0
  )
    return null;
  return {
    activeId: typeof saved.activeId === "string" ? saved.activeId : "",
    dashboards: saved.dashboards,
  };
}

// ---- Files ---------------------------------------------------------------

export function serializeDashboard(dashboard: NormalDashboard): string {
  return JSON.stringify(
    {
      kind: FILE_KIND,
      version: VERSION,
      name: dashboard.name,
      color: dashboard.color,
      settings: dashboard.settings,
    },
    null,
    2,
  );
}

/** The dashboard inside an exported file, still to be validated. */
export function parseDashboardFile(text: string): unknown | null {
  try {
    const file: unknown = JSON.parse(text);
    return isRecord(file) && file.kind === FILE_KIND && file.version === VERSION
      ? file
      : null;
  } catch {
    return null;
  }
}

export function dashboardFileName(name: string): string {
  return `${safeFileName(name, "dashboard")}${DASHBOARD_FILE_EXTENSION}`;
}

// ---- Templates -----------------------------------------------------------

const TEMPLATES_KEY = "logging-view:dashboard-templates";
const MAX_TEMPLATES = 30;

export interface DashboardTemplate {
  id: string;
  name: string;
  savedAt: number;
  /** The same text an exported dashboard file holds. */
  file: string;
}

const isTemplate = (value: unknown): value is DashboardTemplate =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  typeof value.savedAt === "number" &&
  typeof value.file === "string";

// A stable snapshot for useSyncExternalStore: the same array until it changes.
let templates: DashboardTemplate[] | null = null;
const templateListeners = new Set<() => void>();

export function listTemplates(): DashboardTemplate[] {
  if (!templates) {
    const saved = readJson(TEMPLATES_KEY);
    templates = Array.isArray(saved) ? saved.filter(isTemplate) : [];
  }
  return templates;
}

export function subscribeTemplates(listener: () => void) {
  templateListeners.add(listener);
  return () => {
    templateListeners.delete(listener);
  };
}

function writeTemplates(next: DashboardTemplate[]): boolean {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  templates = next;
  templateListeners.forEach((listener) => listener());
  return true;
}

/** Saves under `name`, replacing a template of the same name. */
export function saveTemplate(
  name: string,
  dashboard: NormalDashboard,
): boolean {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) return false;
  const template: DashboardTemplate = {
    id: crypto.randomUUID(),
    name: trimmed,
    savedAt: Date.now(),
    file: serializeDashboard({ ...dashboard, name: trimmed }),
  };
  return writeTemplates(
    [
      template,
      ...listTemplates().filter((item) => item.name !== trimmed),
    ].slice(0, MAX_TEMPLATES),
  );
}

export function deleteTemplate(id: string) {
  writeTemplates(listTemplates().filter((item) => item.id !== id));
}
