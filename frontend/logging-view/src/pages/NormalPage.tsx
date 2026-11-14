// Normal mode is the exploration workspace: sidebar selections become linked
// ECharts views. Simple mode keeps its separate plot studio and PDF workflow.
import { Activity } from "@hyperloopupv/frontend-kit/icons";
import { Tabs, TabsContent } from "@hyperloopupv/frontend-kit/components";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import AnalysisWorkspace from "../components/normal/AnalysisWorkspace";
import DashboardTabs from "../components/normal/DashboardTabs";
import DashboardControls from "../components/normal/DashboardControls";
import FormulaDialog from "../components/normal/FormulaDialog";
import SignalSearch from "../components/normal/SignalSearch";
import {
  evaluateFormula,
  parseFormula,
  type FormulaInput,
} from "../lib/normal/formula";
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
import {
  FORMULA_ID_PREFIX,
  type ComparisonSignal,
  type FormulaSignal,
} from "../types/normal";
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

// One computed formula, kept while its definition and source arrays are the
// same objects, so zooming or editing another plot never re-evaluates it.
interface FormulaResult {
  formula: FormulaSignal;
  inputs: SeriesData[];
  data?: SeriesData;
  error?: string;
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
  const formulas = dashboard.settings.formulas;
  // CSVs to read: the plotted measurements plus whatever the plotted
  // formulas are computed from.
  const csvIds = useMemo(() => {
    const ids = new Set<string>();
    for (const id of assignedIds) {
      if (!id.startsWith(FORMULA_ID_PREFIX)) ids.add(id);
      else
        for (const source of Object.values(
          formulas.find((formula) => formula.id === id)?.variables ?? {},
        ))
          ids.add(source);
    }
    return [...ids];
  }, [assignedIds, formulas]);
  // Cache belongs to this exact session. Re-selecting a signal keeps its
  // parsed data; opening another session creates an empty cache.
  const cache = useMemo(
    () => ({
      files: sessionFiles,
      data: new Map<string, SeriesData>(),
      colors: new Map<string, string>(),
      errors: new Map<string, string>(),
      formulas: new Map<string, FormulaResult>(),
    }),
    [sessionFiles],
  );

  useEffect(() => {
    let cancelled = false;
    const loadVisible = async () => {
      for (const id of csvIds) {
        if (cancelled) return;
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
  }, [csvIds, cache, folderName, settings?.time_unit, adjData]);

  const { signals, formulaErrors } = useMemo(() => {
    const loaded =
      loadedCache?.files === cache.files ? loadedCache.data : undefined;
    // Colours are handed out in the order signals are first plotted and then
    // kept for the session.
    const colorOf = (id: string) => {
      if (!cache.colors.has(id))
        cache.colors.set(id, traceColor(cache.colors.size));
      return cache.colors.get(id)!;
    };
    const formulaErrors: string[] = [];
    const compute = (formula: FormulaSignal): SeriesData | undefined => {
      const parsed = parseFormula(formula.expression);
      if (!parsed.ok) {
        formulaErrors.push(`${formula.name}: ${parsed.error}`);
        return undefined;
      }
      const inputs: Record<string, FormulaInput> = {};
      for (const name of parsed.variables) {
        const source = formula.variables[name];
        if (!source) {
          formulaErrors.push(
            `${formula.name}: "${name}" is not bound to a measurement`,
          );
          return undefined;
        }
        if (cache.errors.has(source)) {
          formulaErrors.push(`${formula.name}: ${source} could not be read`);
          return undefined;
        }
        const data = loaded?.get(source);
        if (!data) return undefined; // still loading
        inputs[name] = {
          data,
          discrete: isDiscreteMeasurement(adjData, source),
        };
      }
      const arrays = parsed.variables.map((name) => inputs[name].data);
      const cached = cache.formulas.get(formula.id);
      if (
        !cached ||
        cached.formula !== formula ||
        cached.inputs.length !== arrays.length ||
        cached.inputs.some((data, index) => data !== arrays[index])
      ) {
        const result: FormulaResult = { formula, inputs: arrays };
        try {
          result.data = evaluateFormula(parsed.ast, inputs);
        } catch (error) {
          result.error =
            error instanceof Error ? error.message : "Could not be computed";
        }
        cache.formulas.set(formula.id, result);
      }
      const result = cache.formulas.get(formula.id)!;
      if (result.error) formulaErrors.push(`${formula.name}: ${result.error}`);
      return result.data;
    };

    const signals: ComparisonSignal[] = assignedIds.flatMap(
      (id): ComparisonSignal[] => {
        if (id.startsWith(FORMULA_ID_PREFIX)) {
          const formula = formulas.find((item) => item.id === id);
          const data = formula && compute(formula);
          if (!formula || !data) return [];
          return [
            {
              id,
              name: formula.name,
              board: "Math",
              units: formula.units,
              discrete: false,
              color: colorOf(id),
              data,
              formula,
            },
          ];
        }
        const data = loaded?.get(id);
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
            color: colorOf(id),
            data,
          },
        ];
      },
    );
    return { signals, formulaErrors };
  }, [assignedIds, formulas, cache, adjData, loadedCache]);
  const errors = [
    ...assignedIds.flatMap((id) =>
      cache.errors.has(id) ? [`${id}: ${cache.errors.get(id)}`] : [],
    ),
    ...formulaErrors,
  ];

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
      <FormulaDialog dashboard={dashboard} />
      <SignalSearch dashboard={dashboard} />
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
