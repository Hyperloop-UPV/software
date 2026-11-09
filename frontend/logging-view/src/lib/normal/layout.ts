import type { ChartLayout, ChartPane, LayoutPreset } from "../../types/normal";

export function createPane(
  signalIds: string[] = [],
  title = "Plot",
): ChartPane {
  return {
    type: "pane",
    id: crypto.randomUUID(),
    title,
    signalIds,
    normalized: false,
  };
}

function split(
  first: ChartLayout,
  second: ChartLayout,
  direction: "horizontal" | "vertical",
): ChartLayout {
  return { type: "split", id: crypto.randomUUID(), direction, first, second };
}

export function getPanes(layout: ChartLayout): ChartPane[] {
  return layout.type === "pane"
    ? [layout]
    : [...getPanes(layout.first), ...getPanes(layout.second)];
}

export function createLayout(ids: string[], preset: LayoutPreset): ChartLayout {
  const count =
    preset === "single"
      ? 1
      : Math.min(preset === "grid" ? 4 : 2, Math.max(1, ids.length));
  const panes = Array.from({ length: count }, (_, index) =>
    createPane(
      ids.filter((_, i) => i % count === index),
      count === 1 ? "Plot" : `Plot ${index + 1}`,
    ),
  );
  if (count === 1) return panes[0];
  if (preset !== "grid" || count === 2)
    return split(
      panes[0],
      panes[1],
      preset === "rows" ? "vertical" : "horizontal",
    );
  return split(
    split(panes[0], panes[1], "horizontal"),
    count === 3 ? panes[2] : split(panes[2], panes[3], "horizontal"),
    "vertical",
  );
}

function combine(
  nodes: ChartLayout[],
  direction: "horizontal" | "vertical",
): ChartLayout {
  return nodes.slice(1).reduce(
    (layout, node) => split(layout, node, direction),
    nodes[0],
  );
}

/** Rearrange complete plots while preserving their titles and measurements. */
export function arrangePanes(
  panes: ChartPane[],
  preset: LayoutPreset,
): ChartLayout {
  if (panes.length === 0) return createPane();
  if (panes.length === 1 || preset === "single") return panes[0];
  if (preset === "columns") return combine(panes, "horizontal");
  if (preset === "rows") return combine(panes, "vertical");

  const rows: ChartLayout[] = [];
  for (let index = 0; index < panes.length; index += 2) {
    rows.push(
      index + 1 < panes.length
        ? split(panes[index], panes[index + 1], "horizontal")
        : panes[index],
    );
  }
  return rows.length === 1 ? rows[0] : combine(rows, "vertical");
}

export function signalIdsInLayout(layout: ChartLayout): string[] {
  return [
    ...new Set(getPanes(layout).flatMap((current) => current.signalIds)),
  ];
}

export function nextPaneTitle(layout: ChartLayout): string {
  const titles = new Set(getPanes(layout).map((current) => current.title));
  if (!titles.has("Plot")) return "Plot";
  let number = 2;
  while (titles.has(`Plot ${number}`)) number += 1;
  return `Plot ${number}`;
}

export function appendPane(
  layout: ChartLayout,
  next: ChartPane,
  preset: LayoutPreset | null,
): ChartLayout {
  const arrangement =
    preset === "columns" || preset === "rows" ? preset : "grid";
  return arrangePanes([...getPanes(layout), next], arrangement);
}

export function updatePane(
  layout: ChartLayout,
  id: string,
  update: (pane: ChartPane) => ChartLayout,
): ChartLayout {
  if (layout.type === "pane") return layout.id === id ? update(layout) : layout;
  return {
    ...layout,
    first: updatePane(layout.first, id, update),
    second: updatePane(layout.second, id, update),
  };
}

export function splitPane(
  layout: ChartLayout,
  id: string,
  direction: "horizontal" | "vertical",
): ChartLayout {
  return updatePane(layout, id, (current) => {
    return split(current, createPane([], nextPaneTitle(layout)), direction);
  });
}

export function removePane(
  layout: ChartLayout,
  id: string,
): ChartLayout | null {
  if (layout.type === "pane") return layout.id === id ? null : layout;
  const first = removePane(layout.first, id);
  const second = removePane(layout.second, id);
  return first && second ? { ...layout, first, second } : (first ?? second);
}

export function reconcileLayout(
  layout: ChartLayout,
  previousIds: string[],
  selectedIds: string[],
): ChartLayout {
  let next = layout;
  for (const current of getPanes(next)) {
    next = updatePane(next, current.id, (node) => ({
      ...node,
      signalIds: node.signalIds.filter((id) => selectedIds.includes(id)),
    }));
  }
  for (const id of selectedIds.filter((id) => !previousIds.includes(id))) {
    const target = getPanes(next).reduce((least, current) =>
      current.signalIds.length < least.signalIds.length ? current : least,
    );
    next = updatePane(next, target.id, (node) => ({
      ...node,
      signalIds: [...node.signalIds, id],
    }));
  }
  return next;
}

export function minimumLayoutSize(layout: ChartLayout): {
  width: number;
  height: number;
} {
  if (layout.type === "pane") return { width: 320, height: 270 };
  const first = minimumLayoutSize(layout.first);
  const second = minimumLayoutSize(layout.second);
  return layout.direction === "horizontal"
    ? {
        width: first.width + second.width + 10,
        height: Math.max(first.height, second.height),
      }
    : {
        width: Math.max(first.width, second.width),
        height: first.height + second.height + 10,
      };
}
