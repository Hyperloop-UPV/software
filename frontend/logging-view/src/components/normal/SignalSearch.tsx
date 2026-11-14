// Quick search over every measurement in the session and the dashboard's
// formulas. Enter adds the highlighted one to the active plot, Shift+Enter
// gives it a plot of its own; the dialog stays open to add several.
import { useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from "@hyperloopupv/frontend-kit/components";
import { Search } from "@hyperloopupv/frontend-kit/icons";
import { getSignalName, getSignalUnits } from "../../lib/plotStudio/units";
import { getPanes } from "../../lib/normal/layout";
import { useStore } from "../../store/store";
import type { NormalDashboard } from "../../types/normal";

const MAX_RESULTS = 200;
const MAX_PANES = 8;

interface Entry {
  id: string;
  board: string;
  name: string;
  detail: string;
  haystack: string;
}

function SearchBody({
  dashboard,
  onClose,
}: {
  dashboard: NormalDashboard;
  onClose: () => void;
}) {
  const availableSeries = useStore((state) => state.availableSeries);
  const adjData = useStore((state) => state.adjData);
  const addToTarget = useStore((state) => state.addToTargetNormalPlot);
  const addPlot = useStore((state) => state.addNormalPlot);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const series = Object.entries(availableSeries).flatMap(([board, ids]) =>
      ids.map((measurement) => {
        const id = `${board}/${measurement}`;
        const name = getSignalName(adjData, id) ?? measurement;
        const units = getSignalUnits(adjData, id);
        return {
          id,
          board,
          name,
          detail: [measurement !== name ? measurement : null, units]
            .filter(Boolean)
            .join(" · "),
          haystack:
            `${board}/${name} ${measurement} ${units ?? ""}`.toLowerCase(),
        };
      }),
    );
    const formulas = dashboard.settings.formulas.map((formula) => ({
      id: formula.id,
      board: "Math",
      name: formula.name,
      detail: formula.expression,
      haystack:
        `math/${formula.name} ${formula.expression} ${formula.units ?? ""}`.toLowerCase(),
    }));
    return [...formulas, ...series].sort((a, b) =>
      `${a.board}/${a.name}`.localeCompare(`${b.board}/${b.name}`),
    );
  }, [availableSeries, adjData, dashboard.settings.formulas]);

  const results = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return entries
      .filter((entry) => words.every((word) => entry.haystack.includes(word)))
      .slice(0, MAX_RESULTS);
  }, [entries, query]);
  const current = Math.min(highlighted, Math.max(0, results.length - 1));
  const canAddPlot =
    getPanes(dashboard.settings.layoutState.tree).length < MAX_PANES;

  const add = (entry: Entry | undefined, newPlot: boolean) => {
    if (!entry) return;
    if (newPlot) {
      if (!canAddPlot) return;
      addPlot([entry.id]);
    } else addToTarget([entry.id]);
    setLastAdded(`${entry.board} / ${entry.name}`);
  };
  const move = (step: number) => {
    const next = Math.max(0, Math.min(results.length - 1, current + step));
    setHighlighted(next);
    listRef.current
      ?.querySelector(`[data-index="${next}"]`)
      ?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div className="grid min-w-0 gap-3">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Search className="size-4" />
          Add a measurement
        </DialogTitle>
        <DialogDescription>
          Enter adds it to the active plot · Shift+Enter puts it in a new plot
        </DialogDescription>
      </DialogHeader>
      <Input
        autoFocus
        value={query}
        placeholder="Search by board, name or unit…"
        aria-label="Search measurements"
        role="combobox"
        aria-expanded
        aria-controls="signal-search-results"
        aria-activedescendant={
          results[current] ? `signal-search-${current}` : undefined
        }
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlighted(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            move(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            move(-1);
          } else if (event.key === "Enter") {
            event.preventDefault();
            add(results[current], event.shiftKey);
          }
        }}
        className="h-9 text-sm"
      />
      <ul
        ref={listRef}
        id="signal-search-results"
        role="listbox"
        aria-label="Matching measurements"
        className="max-h-[50vh] overflow-y-auto rounded-md border"
      >
        {results.length === 0 ? (
          <li className="text-muted-foreground px-3 py-6 text-center text-xs">
            No measurement matches “{query.trim()}”.
          </li>
        ) : (
          results.map((entry, index) => (
            <li
              key={entry.id}
              id={`signal-search-${index}`}
              data-index={index}
              role="option"
              aria-selected={index === current}
              className={`flex cursor-pointer items-baseline gap-2 px-3 py-1.5 text-xs ${index === current ? "bg-accent text-accent-foreground" : ""}`}
              onPointerMove={() => setHighlighted(index)}
              onClick={(event) => add(entry, event.shiftKey)}
            >
              <span className="text-muted-foreground shrink-0">
                {entry.board} /
              </span>
              <span className="truncate font-medium">{entry.name}</span>
              {entry.detail && (
                <span className="text-muted-foreground ml-auto truncate pl-3 font-mono text-[10px]">
                  {entry.detail}
                </span>
              )}
            </li>
          ))
        )}
      </ul>
      <div className="text-muted-foreground flex items-center justify-between gap-3 text-[11px]">
        <span role="status" className="truncate">
          {lastAdded ? `Added ${lastAdded}` : `${entries.length} signals`}
        </span>
        <button
          type="button"
          className="hover:text-foreground shrink-0 underline-offset-2 hover:underline"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </div>
  );
}

export default function SignalSearch({
  dashboard,
}: {
  dashboard: NormalDashboard;
}) {
  const open = useStore((state) => state.normalSignalSearchOpen);
  const setOpen = useStore((state) => state.setNormalSignalSearchOpen);
  return (
    <Dialog open={open && !dashboard.locked} onOpenChange={setOpen}>
      <DialogContent className="top-[15vh] translate-y-0 sm:max-w-[36rem]">
        {open && (
          <SearchBody dashboard={dashboard} onClose={() => setOpen(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
