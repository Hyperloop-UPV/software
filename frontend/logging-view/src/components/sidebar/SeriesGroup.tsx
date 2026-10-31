// Sidebar group for selecting which measurement series to display.
// Visible only after a session folder is loaded.
// Boards are collapsible sections; each measurement shows name, type, units, and packet frequency.
// Series keys use the format "BOARD/measurementId". Rows are also draggable
// (dnd-kit) onto a plot card to assign them — see useSignalDnd.ts.
//
// Right-click menu is ONE shared <ContextMenu> per board (not one per row):
// boards can hold 100+ measurements, and mounting a full Radix ContextMenu
// tree per row froze the tab when expanding a large board. Each row instead
// fires a cheap native onContextMenu that records "which row" into local
// state; the single per-board menu reads that state to build its content.
//
// A board's measurement list is also virtualized (@tanstack/react-virtual —
// same library/pattern already used for large lists in the testing-view
// workspace): with 30-150+ measurements per board, mounting every row at once
// (each with its own useDraggable registration) still froze the tab on
// expand even after the ContextMenu fix above, since dnd-kit's registration
// cost multiplies with the number of simultaneously-mounted draggables. Only
// the rows actually scrolled into view (~10-15) are ever mounted.
import { useDraggable } from "@dnd-kit/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Badge,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@hyperloop-upv/frontend-kit/components";
import { ChevronRight, GripVertical, Layers, Plus } from "@hyperloop-upv/frontend-kit/icons";
import { cn, getTypeBadgeClass } from "@hyperloop-upv/frontend-kit/lib";
import { useMemo, useRef, useState } from "react";
import { useAssignSignalsToPlot } from "../simple/hooks/useStudioSignals";
import type { PlotState } from "../../types/plotStudio";
import type { AdjMeasurement, AdjPacket } from "../../types/session";
import { useStore } from "../../store/store";

// Converts a packet period+unit to a compact display string (e.g. "500 µs", "2 ms").
const formatPeriod = (period?: number, unit?: string): string | null => {
  if (!period || !unit) return null;
  const u = unit.toLowerCase();
  if (u === "us") return period >= 1000 ? `${period / 1000} ms` : `${period} µs`;
  if (u === "ms") return period >= 1000 ? `${period / 1000} s` : `${period} ms`;
  return `${period} ${unit}`;
};

/** What a right-click targets: the batch to act on (New Plot/Add to Plot —
 *  whole selection if this row is part of one) plus the specific clicked
 *  row's own key/checked state (for the "Selected" toggle, which must always
 *  reflect that one row, even when dragIds is the wider selection). */
export interface ContextTarget {
  dragIds: string[];
  key: string;
  checked: boolean;
}

interface SeriesRowProps {
  dragKey: string; // "BOARD/measId"
  measId: string;
  checked: boolean;
  meta?: AdjMeasurement;
  period: string | null;
  onToggle: () => void;
  /** Ids to drag when a drag starts from this row (whole selection, or just this row). */
  dragIds: string[];
  onContextTarget: (target: ContextTarget) => void;
  /** tanstack-virtual's remeasure ref — rows vary in height (badges/enum
   *  lists), so actual size is measured after mount rather than assumed. */
  measureRef?: (el: HTMLElement | null) => void;
}

// Own component (not inlined in the .map() below) because useDraggable is a
// hook — it must be called once per row, not once for the whole list.
function SeriesRow({ dragKey, measId, checked, meta, period, onToggle, dragIds, onContextTarget, measureRef }: SeriesRowProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragKey,
    data: { ids: dragIds },
  });

  const label = meta?.name ?? measId;
  const displayUnits = meta?.displayUnits;
  const isEnum = meta?.type === "enum";

  return (
    <SidebarMenuSubItem>
      {/* SidebarMenuSubButton/Item are plain function components (no ref
          forwarding) — the drag ref/listeners go on this wrapping div instead;
          it's a no-op for layout (Tailwind's group/peer selectors used by the
          sidebar primitives are descendant-based, unaffected by the extra nesting). */}
      <div
        ref={(el) => { setNodeRef(el); measureRef?.(el); }}
        {...attributes}
        {...listeners}
        onContextMenu={() => onContextTarget({ dragIds, key: dragKey, checked })}
        className={cn("pb-1", isDragging && "opacity-30")}
      >
      <SidebarMenuSubButton
        onClick={onToggle}
        className="group/row h-auto min-w-0 cursor-grab gap-2 py-1.5 active:cursor-grabbing"
      >
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          className="pointer-events-none size-3.5 shrink-0"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          {/* Measurement name, falls back to raw ID */}
          <span className="truncate text-xs">{label}</span>

          <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px]">
            {/* Data type */}
            {meta?.type && (
              <Badge
                variant="secondary"
                className={cn(
                  "shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase leading-none",
                  getTypeBadgeClass(meta.type),
                )}
              >
                {meta.type}
              </Badge>
            )}
            {/* Display units */}
            {displayUnits && (
              <span className="truncate">{displayUnits}</span>
            )}
            {/* Enum value count */}
            {isEnum && meta.enumValues && meta.enumValues.length > 0 && (
              <span className="opacity-60">{meta.enumValues.length} values</span>
            )}
            {/* Packet update period */}
            {period && (
              <span className="text-muted-foreground/60 font-mono">
                {period}
              </span>
            )}
          </div>

          {/* Enum value list for quick reference */}
          {isEnum && meta?.enumValues && meta.enumValues.length > 0 && (
            <span className="text-muted-foreground/50 truncate text-[9px]">
              {meta.enumValues.join(" · ")}
            </span>
          )}
        </div>

        <GripVertical className="text-muted-foreground/40 ml-auto size-3 shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100" />
      </SidebarMenuSubButton>
      </div>
    </SidebarMenuSubItem>
  );
}

interface BoardSectionProps {
  boardName: string;
  measIds: string[];
  selectedSeries: Record<string, boolean>;
  totalSelectedCount: number;
  measurementMeta: Record<string, AdjMeasurement>;
  measPacket: Record<string, AdjPacket>;
  toggleSeries: (key: string) => void;
  plots: PlotState[];
  addStudioPlot: () => string;
  assignSignalsToPlot: (plotId: string, signalIds: string[]) => Promise<void>;
}

// One board's collapsible section, with ONE shared ContextMenu covering all
// its rows (see file header comment for why not one per row).
function BoardSection({
  boardName, measIds, selectedSeries, totalSelectedCount, measurementMeta, measPacket,
  toggleSeries, plots, addStudioPlot, assignSignalsToPlot,
}: BoardSectionProps) {
  const [contextTarget, setContextTarget] = useState<ContextTarget | null>(null);
  // Controlled (not defaultOpen) so opening re-renders BoardSection itself —
  // otherwise useVirtualizer's first call captures scrollRef.current as null
  // (CollapsibleContent's children aren't mounted yet) and never gets a
  // reason to re-check it, since Radix manages open/closed internally and
  // an uncontrolled Collapsible's own state change doesn't re-render its
  // parent. Result: rows silently fail to appear until something unrelated
  // (e.g. a theme toggle) forces this component to render again.
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedCount = measIds.filter((id) => selectedSeries[`${boardName}/${id}`]).length;

  const sortedMeasIds = useMemo(
    () => [...measIds].sort((a, b) => (measurementMeta[a]?.name ?? a).localeCompare(measurementMeta[b]?.name ?? b)),
    [measIds, measurementMeta],
  );

  const virtualizer = useVirtualizer({
    count: sortedMeasIds.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 8,
    getItemKey: (index) => sortedMeasIds[index],
  });

  const handleNewPlot = () => {
    if (!contextTarget) return;
    const plotId = addStudioPlot();
    void assignSignalsToPlot(plotId, contextTarget.dragIds);
  };
  const handleAddToPlot = (plotId: string) => {
    if (!contextTarget) return;
    void assignSignalsToPlot(plotId, contextTarget.dragIds);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={boardName}>
            <ChevronRight className="size-4 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90" />
            <span className="font-medium">{boardName}</span>
            {selectedCount > 0 && (
              <span className="bg-primary text-primary-foreground ml-auto rounded-full px-1.5 py-0.5 text-xs leading-none">
                {selectedCount}
              </span>
            )}
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <ContextMenu onOpenChange={(open) => { if (!open) setContextTarget(null); }}>
            <ContextMenuTrigger asChild>
              {/* Fixed-height scroll viewport — only the rows scrolled into
                  view are ever mounted (see file header comment). pr-2 keeps
                  the scrollbar off the row content; the mask fades rows at
                  the top/bottom edge instead of clipping them hard. */}
              <div
                ref={scrollRef}
                className={cn(
                  "max-h-72 overflow-y-auto pr-2",
                  "[-webkit-mask-image:linear-gradient(to_bottom,transparent,black_8px,black_calc(100%-8px),transparent)]",
                  "[mask-image:linear-gradient(to_bottom,transparent,black_8px,black_calc(100%-8px),transparent)]",
                )}
              >
                <SidebarMenuSub
                  className="relative block"
                  style={{ height: virtualizer.getTotalSize() }}
                >
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const measId = sortedMeasIds[virtualRow.index];
                    const key = `${boardName}/${measId}`;
                    const checked = !!selectedSeries[key];
                    const meta = measurementMeta[measId];
                    const pkt = measPacket[key];
                    const period = formatPeriod(pkt?.period, pkt?.period_type);
                    // Acting on a checked row while others are also checked
                    // acts on the whole selection (Explorer/Finder-style
                    // multi-select); otherwise just this row.
                    const dragIds = checked && totalSelectedCount > 1
                      ? Object.keys(selectedSeries).filter((k) => selectedSeries[k])
                      : [key];

                    return (
                      <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        style={{
                          position: "absolute", top: 0, left: 0, width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <SeriesRow
                          dragKey={key}
                          measId={measId}
                          checked={checked}
                          meta={meta}
                          period={period}
                          onToggle={() => toggleSeries(key)}
                          dragIds={dragIds}
                          onContextTarget={setContextTarget}
                        />
                      </div>
                    );
                  })}
                </SidebarMenuSub>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={handleNewPlot}>
                <Plus className="size-3.5" />
                New Plot
              </ContextMenuItem>
              <ContextMenuSub>
                <ContextMenuSubTrigger disabled={plots.length === 0}>
                  <Layers className="size-3.5" />
                  Add to Plot
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  {plots.map((p) => (
                    <ContextMenuItem key={p.id} onClick={() => handleAddToPlot(p.id)}>
                      {p.name}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuSeparator />
              <ContextMenuCheckboxItem
                checked={!!contextTarget?.checked}
                onCheckedChange={() => contextTarget && toggleSeries(contextTarget.key)}
              >
                Selected
              </ContextMenuCheckboxItem>
            </ContextMenuContent>
          </ContextMenu>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

const SeriesGroup = () => {
  const availableSeries = useStore((s) => s.availableSeries);
  const adjData = useStore((s) => s.adjData);
  const selectedSeries = useStore((s) => s.selectedSeries);
  const toggleSeries = useStore((s) => s.toggleSeries);
  const studioPlots = useStore((s) => s.studioPlots);
  const addStudioPlot = useStore((s) => s.addStudioPlot);
  const assignSignalsToPlot = useAssignSignalsToPlot();

  // Computed once for the whole list (not per row).
  const plots = useMemo(() => Array.from(studioPlots.values()), [studioPlots]);

  // Build measurement metadata and packet-frequency lookups from the ADJ
  // archive. Memoized on adjData alone — previously rebuilt on every render
  // (e.g. every checkbox toggle), which is wasted work for a large archive.
  // Archive structure: boards[boardName][`${boardName}_measurements`] = AdjMeasurement[]
  //                    boards[boardName]["packets"] = AdjPacket[]
  const { measurementMeta, measPacket } = useMemo(() => {
    const measurementMeta: Record<string, AdjMeasurement> = {};
    // Key: "BOARD/measId" → packet for that measurement
    const measPacket: Record<string, AdjPacket> = {};

    if (adjData) {
      for (const [boardName, boardGroup] of Object.entries(adjData.boards)) {
        const group = boardGroup as Record<string, unknown>;

        const measurements = group[`${boardName}_measurements`];
        if (Array.isArray(measurements)) {
          for (const meas of measurements) {
            if (typeof meas === "object" && meas !== null && "id" in meas) {
              measurementMeta[(meas as AdjMeasurement).id] = meas as AdjMeasurement;
            }
          }
        }

        const packets = group["packets"];
        if (Array.isArray(packets)) {
          for (const pkt of packets as AdjPacket[]) {
            for (const varId of pkt.variables ?? []) {
              measPacket[`${boardName}/${varId}`] = pkt;
            }
          }
        }
      }
    }
    return { measurementMeta, measPacket };
  }, [adjData]);

  const boards = Object.keys(availableSeries);
  if (boards.length === 0) return null;

  const totalSelectedCount = Object.values(selectedSeries).filter(Boolean).length;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Series</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {boards.map((boardName) => (
            <BoardSection
              key={boardName}
              boardName={boardName}
              measIds={availableSeries[boardName]}
              selectedSeries={selectedSeries}
              totalSelectedCount={totalSelectedCount}
              measurementMeta={measurementMeta}
              measPacket={measPacket}
              toggleSeries={toggleSeries}
              plots={plots}
              addStudioPlot={addStudioPlot}
              assignSignalsToPlot={assignSignalsToPlot}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

export default SeriesGroup;
