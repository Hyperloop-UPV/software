// Normal mode is the exploration workspace: sidebar selections become linked
// ECharts views. Simple mode keeps its separate plot studio and PDF workflow.
import { Activity } from "@hyperloopupv/frontend-kit/icons";
import { Tabs, TabsContent } from "@hyperloopupv/frontend-kit/components";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import AnalysisWorkspace from "../components/normal/AnalysisWorkspace";
import DashboardTabs from "../components/normal/DashboardTabs";
import DashboardControls from "../components/normal/DashboardControls";
import { parseCSVInWorker } from "../lib/plotStudio/csv";
import { traceColor } from "../lib/plotStudio/palette";
import {
  getEnumLabels,
  getSignalName,
  getSignalUnits,
  isDiscreteMeasurement,
} from "../lib/plotStudio/units";
import RecentSessions from "../components/sidebar/RecentSessions";
import { useStore } from "../store/store";
import type { ComparisonSignal } from "../types/normal";
import type { SeriesData } from "../types/plotStudio";

function EmptyView({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
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
        {children}
      </div>
    </div>
  );
}

function SessionComparison() {
  const folderName = useStore((s) => s.folderName)!;
  const sessionFiles = useStore((s) => s.sessionFiles);
  const settings = useStore((s) => s.settings);
  const adjData = useStore((s) => s.adjData);
  const dashboard = useStore(
    (s) =>
      s.normalDashboards.find((item) => item.id === s.activeNormalDashboardId)!,
  );
  const selectDashboard = useStore((s) => s.selectNormalDashboard);
  const isDarkMode = useStore((s) => s.isDarkMode);
  const [compactControls, setCompactControls] = useState(true);
  const [loadedCache, setLoadedCache] = useState<{
    files: typeof sessionFiles;
    data: Map<string, SeriesData>;
  } | null>(null);

  const assignedIds = dashboard.settings.layoutState.ids;
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
      for (const id of assignedIds) {
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
            setLoadedCache({ files: cache.files, data: new Map(cache.data) });
          }
        }
      }
    };
    void loadVisible();
    return () => {
      cancelled = true;
    };
  }, [assignedIds, cache, folderName, settings?.time_unit, adjData]);

  const signals: ComparisonSignal[] = useMemo(
    () =>
      assignedIds.flatMap((id) => {
        const data =
          loadedCache?.files === cache.files
            ? loadedCache.data.get(id)
            : undefined;
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
      }),
    [assignedIds, cache, adjData, loadedCache],
  );
  const errors = assignedIds.flatMap((id) =>
    cache.errors.has(id) ? [`${id}: ${cache.errors.get(id)}`] : [],
  );

  return (
    <Tabs
      value={dashboard.id}
      onValueChange={selectDashboard}
      className="h-full min-h-0 gap-0 overflow-hidden"
    >
      <DashboardTabs
        compact={compactControls}
        onToggleCompact={() => setCompactControls((current) => !current)}
        controls={
          compactControls ? (
            <DashboardControls
              key={dashboard.id}
              dashboard={dashboard}
              signals={signals}
              compact
            />
          ) : undefined
        }
      />
      {!compactControls && (
        <DashboardControls
          key={`controls-${dashboard.id}`}
          dashboard={dashboard}
          signals={signals}
          compact={false}
        />
      )}
      <TabsContent
        value={dashboard.id}
        key={dashboard.id}
        className="flex min-h-0 flex-col overflow-hidden"
      >
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
        <AnalysisWorkspace
          dashboard={dashboard}
          signals={signals}
          isDarkMode={isDarkMode}
        />
      </TabsContent>
    </Tabs>
  );
}

export default function NormalPage() {
  const folderName = useStore((s) => s.folderName);
  if (!folderName) {
    return (
      <EmptyView
        title="Open a logging session"
        description="Load a log folder from the left sidebar to start exploring and comparing its signals."
      >
        <RecentSessions />
      </EmptyView>
    );
  }
  return <SessionComparison />;
}
