// Normal mode is the exploration workspace: sidebar selections become linked
// ECharts views. Simple mode keeps its separate plot studio and PDF workflow.
import { Button } from "@workspace/ui/components";
import { Activity, X } from "@workspace/ui/icons";
import { useEffect, useMemo, useState } from "react";
import AnalysisWorkspace from "../components/normal/AnalysisWorkspace";
import { parseCSVInWorker } from "../lib/plotStudio/csv";
import { traceColor } from "../lib/plotStudio/palette";
import {
  getEnumLabels,
  getSignalName,
  getSignalUnits,
  isDiscreteMeasurement,
} from "../lib/plotStudio/units";
import { useStore } from "../store/store";
import type { ComparisonSignal } from "../types/normal";
import type { SeriesData } from "../types/plotStudio";

function EmptyView({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[22rem] flex-1 items-center justify-center p-6">
      <div className="border-border bg-card/60 w-full max-w-[28rem] rounded-xl border px-8 py-9 text-center shadow-sm">
        <div className="bg-primary/10 text-primary mx-auto mb-4 flex size-11 items-center justify-center rounded-xl">
          <Activity className="size-5" />
        </div>
        <h2 className="text-foreground text-base font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

function SessionComparison() {
  const folderName = useStore((s) => s.folderName)!;
  const sessionFiles = useStore((s) => s.sessionFiles);
  const settings = useStore((s) => s.settings);
  const adjData = useStore((s) => s.adjData);
  const selectedSeries = useStore((s) => s.selectedSeries);
  const clearSelectedSeries = useStore((s) => s.clearSelectedSeries);
  const isDarkMode = useStore((s) => s.isDarkMode);
  const [, refresh] = useState(0);

  const selectedIds = useMemo(
    () => Object.keys(selectedSeries).filter((id) => selectedSeries[id]),
    [selectedSeries],
  );
  // Cache belongs to this exact session. Re-selecting a signal keeps its
  // parsed data; opening another session creates an empty cache.
  const cache = useMemo(
    () => ({
      files: sessionFiles,
      data: new Map<string, SeriesData>(),
      colors: new Map<string, string>(),
      errors: new Map<string, string>(),
    }),
    [sessionFiles],
  );

  useEffect(() => {
    let cancelled = false;
    const loadVisible = async () => {
      for (const id of selectedIds) {
        if (cancelled) return;
        if (!cache.colors.has(id))
          cache.colors.set(id, traceColor(cache.colors.size));
        if (cache.data.has(id) || cache.errors.has(id)) continue;
        try {
          const slash = id.indexOf("/");
          const file = cache.files.get(
            `${folderName}/data/${id.slice(0, slash)}/${id.slice(slash + 1)}.csv`,
          );
          if (!file) throw new Error("CSV file not found in this session");
          const data = await parseCSVInWorker(
            file,
            settings?.time_unit ?? "ms",
            getEnumLabels(adjData, id),
            false,
          );
          if (cancelled) return;
          if (data.time.length === 0)
            throw new Error("CSV contains no plottable samples");
          cache.data.set(id, data);
        } catch (error) {
          if (cancelled) return;
          cache.errors.set(
            id,
            error instanceof Error
              ? error.message
              : "Could not read this signal",
          );
        } finally {
          if (!cancelled) {
            refresh((value) => value + 1);
          }
        }
      }
    };
    void loadVisible();
    return () => {
      cancelled = true;
    };
  }, [selectedIds, cache, folderName, settings?.time_unit, adjData]);

  const signals: ComparisonSignal[] = selectedIds.flatMap((id) => {
    const data = cache.data.get(id);
    if (!data) return [];
    const measId = id.slice(id.indexOf("/") + 1);
    return [
      {
        id,
        name: getSignalName(adjData, id) ?? measId,
        board: id.slice(0, id.indexOf("/")),
        units: getSignalUnits(adjData, id),
        enumLabels: getEnumLabels(adjData, id),
        discrete: isDiscreteMeasurement(adjData, id),
        color: cache.colors.get(id)!,
        data,
      },
    ];
  });
  const errors = selectedIds.flatMap((id) =>
    cache.errors.has(id) ? [`${id}: ${cache.errors.get(id)}`] : [],
  );
  const pendingCount = selectedIds.length - signals.length - errors.length;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-border bg-background/95 flex shrink-0 flex-wrap items-center gap-3 border-b px-5 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-foreground text-base font-semibold">
            Signal workspace
          </h1>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {folderName} · {selectedIds.length} selected
            {pendingCount > 0
              ? ` · loading ${pendingCount}…`
              : " · shared session time axis"}
          </p>
        </div>
        {selectedIds.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSelectedSeries}
            className="text-muted-foreground gap-1.5 text-xs"
          >
            <X className="size-3.5" /> Clear selection
          </Button>
        )}
      </div>

      {selectedIds.length === 0 ? (
        <EmptyView
          title="Choose signals to compare"
          description="Check measurements in the left sidebar. Normal mode will display them here with linked time navigation."
        />
      ) : (
        <>
          {errors.length > 0 && (
            <div className="max-h-24 shrink-0 overflow-y-auto px-4 py-2">
              {errors.map((message) => (
                <p
                  key={message}
                  className="text-xs text-amber-600 dark:text-amber-400"
                >
                  {message}
                </p>
              ))}
            </div>
          )}
          {signals.length > 0 ? (
            <AnalysisWorkspace
              signals={signals}
              selectedIds={selectedIds}
              isDarkMode={isDarkMode}
            />
          ) : (
            <EmptyView
              title={
                pendingCount > 0 ? "Loading signals…" : "No samples available"
              }
              description={
                pendingCount > 0
                  ? "Preparing the selected measurements for comparison."
                  : "Choose another measurement from the left sidebar."
              }
            />
          )}
        </>
      )}
    </div>
  );
}

export default function NormalPage() {
  const folderName = useStore((s) => s.folderName);
  if (!folderName) {
    return (
      <EmptyView
        title="Open a logging session"
        description="Load a log folder from the left sidebar to start exploring and comparing its signals."
      />
    );
  }
  return <SessionComparison />;
}
