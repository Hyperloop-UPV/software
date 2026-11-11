import {
  Button,
  Checkbox,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Popover,
  PopoverAnchor,
  PopoverContent,
  TabsList,
  TabsTrigger,
} from "@hyperloopupv/frontend-kit/components";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  LayoutDashboard,
  Lock,
  PanelTopClose,
  PanelTopOpen,
  Plus,
  Settings2,
  Unlock,
  X,
} from "@hyperloopupv/frontend-kit/icons";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useStore } from "../../store/store";
import { getPanes } from "../../lib/normal/layout";
import type { DashboardTabSettings, NormalDashboard } from "../../types/normal";

const TAB_COLORS = [
  { name: "Orange", value: "#f97316" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
  { name: "Red", value: "#ef4444" },
];

function TabEditor({
  dashboard,
  position,
  count,
  onSave,
}: {
  dashboard: NormalDashboard;
  position: number;
  count: number;
  onSave: (settings: DashboardTabSettings) => void;
}) {
  const nameId = useId();
  const [settings, setSettings] = useState<DashboardTabSettings>(() => ({
    name: dashboard.name,
    color: dashboard.color,
    locked: dashboard.locked,
    position,
  }));

  return (
    <form
      className="space-y-4"
      aria-label="Dashboard tab settings"
      onSubmit={(event) => {
        event.preventDefault();
        if (settings.name.trim()) onSave(settings);
      }}
    >
      <div>
        <h2 className="text-sm font-semibold">Tab settings</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Name, color, position and edit protection.
        </p>
      </div>
      <fieldset
        disabled={settings.locked}
        className="min-w-0 space-y-4 disabled:opacity-60"
      >
        <div className="space-y-1.5">
          <label htmlFor={nameId} className="text-xs font-medium">
            Name
          </label>
          <Input
            id={nameId}
            aria-label="Dashboard name"
            value={settings.name}
            maxLength={80}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) =>
              setSettings({ ...settings, name: event.target.value })
            }
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium">Tab color</p>
          <div
            className="flex items-center gap-2"
            role="group"
            aria-label="Tab color"
          >
            <button
              type="button"
              aria-label="Default tab color"
              title="Default"
              aria-pressed={settings.color === null}
              onClick={() => setSettings({ ...settings, color: null })}
              className="border-border bg-muted focus-visible:ring-ring aria-pressed:ring-offset-background size-6 rounded-full border focus-visible:ring-2 aria-pressed:ring-2 aria-pressed:ring-offset-2"
            />
            {TAB_COLORS.map((color) => (
              <button
                key={color.name}
                type="button"
                aria-label={`${color.name} tab color`}
                title={color.name}
                aria-pressed={settings.color === color.value}
                onClick={() => setSettings({ ...settings, color: color.value })}
                style={{ backgroundColor: color.value }}
                className="border-border/50 focus-visible:ring-ring aria-pressed:ring-offset-background size-6 rounded-full border focus-visible:ring-2 aria-pressed:ring-2 aria-pressed:ring-offset-2"
              />
            ))}
          </div>
          <label className="text-muted-foreground flex items-center gap-2 text-xs">
            Custom color
            <Input
              type="color"
              aria-label="Custom tab color"
              value={settings.color ?? "#f97316"}
              onChange={(event) =>
                setSettings({ ...settings, color: event.target.value })
              }
              className="h-7 w-12 cursor-pointer p-0.5"
            />
          </label>
        </div>
        <label className="flex items-center justify-between gap-3 text-xs font-medium">
          Tab position
          <select
            aria-label="Tab position"
            value={settings.position}
            onChange={(event) =>
              setSettings({ ...settings, position: Number(event.target.value) })
            }
            className="border-input bg-background h-8 rounded-md border px-2 text-xs"
          >
            {Array.from({ length: count }, (_, index) => (
              <option key={index} value={index}>
                {index + 1} of {count}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 flex-1 text-xs"
            disabled={settings.position === 0}
            onClick={() => setSettings({ ...settings, position: 0 })}
          >
            Move to first
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 flex-1 text-xs"
            disabled={settings.position === count - 1}
            onClick={() => setSettings({ ...settings, position: count - 1 })}
          >
            Move to last
          </Button>
        </div>
      </fieldset>
      <div className="border-border border-t pt-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
          <Checkbox
            checked={settings.locked}
            aria-label="Lock dashboard"
            onCheckedChange={(checked) =>
              setSettings({ ...settings, locked: checked === true })
            }
          />
          <Lock className="size-3.5" /> Lock dashboard
        </label>
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          Protect plots, layout, time settings and this tab. Unlock here to make
          changes.
        </p>
      </div>
      <Button
        type="submit"
        size="sm"
        className="w-full text-xs"
        disabled={!settings.name.trim()}
      >
        Save changes
      </Button>
    </form>
  );
}

export default function DashboardTabs({
  compact,
  controls,
  onToggleCompact,
}: {
  compact: boolean;
  controls?: ReactNode;
  onToggleCompact: () => void;
}) {
  const dashboards = useStore((state) => state.normalDashboards);
  const activeId = useStore((state) => state.activeNormalDashboardId);
  const addDashboard = useStore((state) => state.addNormalDashboard);
  const closeDashboard = useStore((state) => state.closeNormalDashboard);
  const configureDashboard = useStore(
    (state) => state.configureNormalDashboard,
  );
  const moveDashboard = useStore((state) => state.moveNormalDashboard);
  const duplicateDashboard = useStore(
    (state) => state.duplicateNormalDashboard,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  // A list, so "Close other tabs" can reuse the same confirmation dialog
  // instead of bypassing the four-chart guard.
  const [closingIds, setClosingIds] = useState<string[] | null>(null);
  const closing = closingIds
    ? dashboards.filter((dashboard) => closingIds.includes(dashboard.id))
    : [];
  const closingDashboard = closing.length === 1 ? closing[0] : undefined;
  const closingCharts = closing.reduce(
    (total, dashboard) =>
      total + getPanes(dashboard.settings.layoutState.tree).length,
    0,
  );
  // Which tab was right-clicked. Falls back to the active one so the keyboard
  // path (Shift+F10 / Menu key) and a click on empty strip still act on a tab.
  const [contextId, setContextId] = useState<string | null>(null);
  const cancelCloseRef = useRef<HTMLButtonElement>(null);
  const closeOriginRef = useRef<HTMLButtonElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const focusActive = useRef(false);
  const restoreEditorFocus = useRef(true);
  const order = dashboards.map((dashboard) => dashboard.id).join(":");

  useEffect(() => {
    const tab = tabRefs.current.get(activeId);
    tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (focusActive.current) {
      tab?.focus();
      focusActive.current = false;
    }
    const observer = new ResizeObserver(() =>
      tab?.scrollIntoView({ block: "nearest", inline: "nearest" }),
    );
    if (tabListRef.current) observer.observe(tabListRef.current);
    return () => observer.disconnect();
  }, [activeId, order]);

  const startEditing = (id: string) => {
    restoreEditorFocus.current = true;
    setEditingId(id);
  };
  // Shared by the close button, the context menu and "Close other tabs":
  // locked tabs are skipped, and four or more charts ask first.
  const requestClose = (ids: string[], origin?: HTMLButtonElement | null) => {
    const targets = dashboards.filter(
      (dashboard) => ids.includes(dashboard.id) && !dashboard.locked,
    );
    if (targets.length === 0) return;
    const charts = targets.reduce(
      (total, dashboard) =>
        total + getPanes(dashboard.settings.layoutState.tree).length,
      0,
    );
    if (charts >= 4) {
      closeOriginRef.current = origin ?? null;
      setClosingIds(targets.map((dashboard) => dashboard.id));
      return;
    }
    focusActive.current = true;
    for (const dashboard of targets) closeDashboard(dashboard.id);
  };
  const menuTarget =
    dashboards.find((dashboard) => dashboard.id === contextId) ??
    dashboards.find((dashboard) => dashboard.id === activeId);
  const menuIndex = menuTarget ? dashboards.indexOf(menuTarget) : -1;
  const menuOtherIds = dashboards
    .filter((dashboard) => dashboard.id !== menuTarget?.id && !dashboard.locked)
    .map((dashboard) => dashboard.id);
  const insertionAt = (clientX: number) => {
    const bar = tabListRef.current?.parentElement?.getBoundingClientRect();
    if (bar && clientX <= bar.left + 12) return 0;
    if (bar && clientX >= bar.right - 12) return dashboards.length;
    const index = dashboards.findIndex((dashboard) => {
      const rect = tabRefs.current.get(dashboard.id)?.getBoundingClientRect();
      return rect && clientX < rect.left + rect.width / 2;
    });
    return index < 0 ? dashboards.length : index;
  };

  return (
    <div
      className="border-border bg-muted/20 relative z-20 flex shrink-0 items-end gap-1 border-b px-3 pt-1.5"
      onDragOver={(event) => {
        if (!draggingId) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const list = tabListRef.current;
        if (list) {
          const rect = list.getBoundingClientRect();
          if (event.clientX < rect.left + 28) list.scrollLeft -= 24;
          else if (event.clientX > rect.right - 28) list.scrollLeft += 24;
        }
        setDropIndex(insertionAt(event.clientX));
      }}
      onDragLeave={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        )
          setDropIndex(null);
      }}
      onDrop={(event) => {
        const sourceId = event.dataTransfer.getData(
          "application/x-logging-dashboard",
        );
        const sourceIndex = dashboards.findIndex(
          (item) => item.id === sourceId,
        );
        if (sourceIndex < 0) return;
        event.preventDefault();
        event.stopPropagation();
        const insertion = insertionAt(event.clientX);
        moveDashboard(sourceId, insertion - (sourceIndex < insertion ? 1 : 0));
        setDraggingId(null);
        setDropIndex(null);
      }}
    >
      <ContextMenu
        onOpenChange={(open) => {
          if (!open) setContextId(null);
        }}
      >
        <ContextMenuTrigger asChild>
          <TabsList
            ref={tabListRef}
            aria-label="Dashboards"
            className="h-auto min-w-0 justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0"
          >
        {dashboards.map((dashboard, index) => (
          <Popover
            key={dashboard.id}
            open={editingId === dashboard.id}
            onOpenChange={(open) => {
              if (!open) setEditingId(null);
            }}
          >
            <PopoverAnchor asChild>
              <div
                className={`group relative shrink-0 ${draggingId === dashboard.id ? "opacity-50" : ""}`}
                onContextMenu={() => setContextId(dashboard.id)}
                draggable={!dashboard.locked && editingId !== dashboard.id}
                onDragStart={(event) => {
                  if (
                    dashboard.locked ||
                    (event.target as HTMLElement).closest("[data-tab-action]")
                  ) {
                    event.preventDefault();
                    return;
                  }
                  event.dataTransfer.setData(
                    "application/x-logging-dashboard",
                    dashboard.id,
                  );
                  event.dataTransfer.effectAllowed = "move";
                  setDraggingId(dashboard.id);
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDropIndex(null);
                }}
              >
                <TabsTrigger
                  ref={(element) => {
                    if (element) tabRefs.current.set(dashboard.id, element);
                    else tabRefs.current.delete(dashboard.id);
                  }}
                  value={dashboard.id}
                  aria-label={dashboard.name}
                  className="border-border bg-muted/60 text-muted-foreground hover:bg-muted data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground dark:data-[state=active]:border-border dark:data-[state=active]:bg-background relative h-9 max-w-64 min-w-44 justify-start gap-2 rounded-t-lg rounded-b-none border border-b-0 px-3 pr-16 text-xs data-[state=active]:font-semibold data-[state=active]:shadow-none"
                  style={{
                    boxShadow: `inset 0 2px 0 ${dashboard.color ?? "var(--muted-foreground)"}`,
                  }}
                  title={`${dashboard.name}${dashboard.locked ? " · locked" : " · drag to reorder"} · double-click or press F2 for settings`}
                  onDoubleClick={() => startEditing(dashboard.id)}
                  onKeyDown={(event) => {
                    if (event.key === "F2") {
                      event.preventDefault();
                      startEditing(dashboard.id);
                    }
                    if (
                      event.altKey &&
                      event.shiftKey &&
                      (event.key === "ArrowLeft" || event.key === "ArrowRight")
                    ) {
                      event.preventDefault();
                      event.stopPropagation();
                      focusActive.current = true;
                      moveDashboard(
                        dashboard.id,
                        index + (event.key === "ArrowLeft" ? -1 : 1),
                      );
                    }
                    if (
                      event.altKey &&
                      event.shiftKey &&
                      (event.key === "Home" || event.key === "End")
                    ) {
                      event.preventDefault();
                      event.stopPropagation();
                      focusActive.current = true;
                      moveDashboard(
                        dashboard.id,
                        event.key === "Home" ? 0 : dashboards.length - 1,
                      );
                    }
                  }}
                >
                  {dashboard.color ? (
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: dashboard.color }}
                    />
                  ) : (
                    <LayoutDashboard className="size-3.5" />
                  )}
                  <span className="truncate">{dashboard.name}</span>
                  {dashboard.locked && (
                    <Lock aria-hidden="true" className="size-3 shrink-0" />
                  )}
                  <span
                    aria-hidden="true"
                    className="text-muted-foreground ml-auto text-[10px] tabular-nums"
                  >
                    {dashboard.settings.layoutState.ids.length}
                  </span>
                </TabsTrigger>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  data-tab-action
                  className="text-muted-foreground absolute top-1.5 right-8 size-6"
                  aria-label={`Settings for ${dashboard.name}`}
                  title="Tab settings"
                  tabIndex={dashboard.id === activeId ? 0 : -1}
                  onClick={() => startEditing(dashboard.id)}
                >
                  <Settings2 className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  data-tab-action
                  className="text-muted-foreground absolute top-1.5 right-1.5 size-6"
                  aria-label={`Close ${dashboard.name}`}
                  title={
                    dashboard.locked
                      ? "Unlock this dashboard to close it"
                      : `Close ${dashboard.name}`
                  }
                  disabled={dashboard.locked}
                  tabIndex={dashboard.id === activeId ? 0 : -1}
                  onClick={(event) =>
                    requestClose([dashboard.id], event.currentTarget)
                  }
                >
                  <X className="size-3" />
                </Button>
                {(dropIndex === index ||
                  (dropIndex === dashboards.length &&
                    index === dashboards.length - 1)) && (
                  <span
                    aria-hidden="true"
                    className={`bg-primary pointer-events-none absolute inset-y-0 w-0.5 ${dropIndex === dashboards.length ? "right-0" : "left-0"}`}
                  />
                )}
              </div>
            </PopoverAnchor>
            <PopoverContent
              align="start"
              aria-label={`Settings for ${dashboard.name}`}
              className="w-80 max-w-[calc(100vw-2rem)]"
              onInteractOutside={() => {
                restoreEditorFocus.current = false;
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                if (restoreEditorFocus.current)
                  tabRefs.current.get(dashboard.id)?.focus();
              }}
            >
              <TabEditor
                dashboard={dashboard}
                position={index}
                count={dashboards.length}
                onSave={(settings) => {
                  configureDashboard(dashboard.id, settings);
                  setEditingId(null);
                }}
              />
            </PopoverContent>
          </Popover>
        ))}
          </TabsList>
        </ContextMenuTrigger>
        <ContextMenuContent aria-label="Dashboard tab actions">
          <ContextMenuItem
            onClick={() => {
              if (!menuTarget) return;
              focusActive.current = true;
              duplicateDashboard(menuTarget.id);
            }}
          >
            <Copy className="size-3.5" />
            Duplicate
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => menuTarget && startEditing(menuTarget.id)}
          >
            <Settings2 className="size-3.5" />
            Rename / settings
            <ContextMenuShortcut>F2</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() =>
              menuTarget &&
              configureDashboard(menuTarget.id, {
                name: menuTarget.name,
                color: menuTarget.color,
                locked: !menuTarget.locked,
                position: menuIndex,
              })
            }
          >
            {menuTarget?.locked ? (
              <Unlock className="size-3.5" />
            ) : (
              <Lock className="size-3.5" />
            )}
            {menuTarget?.locked ? "Unlock" : "Lock"}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            disabled={!menuTarget || menuTarget.locked || menuIndex === 0}
            onClick={() => {
              if (!menuTarget) return;
              focusActive.current = true;
              moveDashboard(menuTarget.id, 0);
            }}
          >
            <ChevronLeft className="size-3.5" />
            Move to first
          </ContextMenuItem>
          <ContextMenuItem
            disabled={
              !menuTarget ||
              menuTarget.locked ||
              menuIndex === dashboards.length - 1
            }
            onClick={() => {
              if (!menuTarget) return;
              focusActive.current = true;
              moveDashboard(menuTarget.id, dashboards.length - 1);
            }}
          >
            <ChevronRight className="size-3.5" />
            Move to last
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            disabled={!menuTarget || menuTarget.locked}
            onClick={() => menuTarget && requestClose([menuTarget.id])}
          >
            <X className="size-3.5" />
            Close
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            disabled={menuOtherIds.length === 0}
            onClick={() => requestClose(menuOtherIds)}
          >
            <X className="size-3.5" />
            Close other tabs
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <Button
        variant="ghost"
        size="icon-sm"
        className="mb-0.5 shrink-0"
        aria-label="New dashboard"
        title="New dashboard"
        onClick={() => {
          focusActive.current = true;
          addDashboard();
        }}
      >
        <Plus className="size-4" />
      </Button>
      <div
        className={`mb-1 ml-auto flex shrink-0 items-center gap-1 pl-2 ${controls ? "border-border border-l" : ""}`}
      >
        {controls}
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          aria-label={
            compact
              ? "Expand layout and time controls"
              : "Compact layout and time controls"
          }
          title={
            compact
              ? "Expand layout and time controls"
              : "Compact layout and time controls"
          }
          onClick={onToggleCompact}
        >
          {compact ? (
            <PanelTopOpen className="size-3.5" />
          ) : (
            <PanelTopClose className="size-3.5" />
          )}
        </Button>
      </div>
      <Dialog
        open={closing.length > 0}
        onOpenChange={(open) => {
          if (!open) setClosingIds(null);
        }}
      >
        <DialogContent
          role="alertdialog"
          showCloseButton={false}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancelCloseRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (closeOriginRef.current?.isConnected)
              closeOriginRef.current.focus();
            else
              tabRefs.current
                .get(useStore.getState().activeNormalDashboardId)
                ?.focus();
            closeOriginRef.current = null;
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {closingDashboard
                ? `Close ${closingDashboard.name}?`
                : `Close ${closing.length} tabs?`}
            </DialogTitle>
            <DialogDescription>
              {closingDashboard ? "This dashboard contains" : "These dashboards contain"}{" "}
              {closingCharts}{" "}
              {closingDashboard
                ? "charts. Closing it will discard its charts, layout, and time settings."
                : "charts. Closing them will discard their charts, layout, and time settings."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              ref={cancelCloseRef}
              variant="outline"
              onClick={() => setClosingIds(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                focusActive.current = true;
                for (const dashboard of closing) closeDashboard(dashboard.id);
                setClosingIds(null);
              }}
            >
              {closingDashboard ? "Close tab" : "Close tabs"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
