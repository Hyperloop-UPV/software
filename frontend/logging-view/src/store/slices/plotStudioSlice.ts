import type { StateCreator } from "zustand";
import type {
  FileSignal,
  Operation,
  PlotSignal,
  PlotState,
  Transform,
} from "../../types/plotStudio";

export interface PlotStudioSlice {
  studioFiles: Map<string, FileSignal>;
  studioOperations: Map<string, Operation>;
  studioTransforms: Map<string, Transform>;
  studioPlots: Map<string, PlotState>;
  studioPlotCounter: number;
  studioOpCounter: number;
  studioTrCounter: number;
  fftSampleRateOverride: number | null;
  // Transient warning shown after a signal assignment fails to load (e.g. a
  // multi-select drag where one CSV is missing/malformed) — not persisted,
  // cleared by the banner itself after a timeout or on dismiss.
  signalLoadWarning: string | null;
  // Transient confirmation toast, set to the new plot's name whenever
  // addStudioPlot runs (whichever of its several call sites triggered it) —
  // not persisted, cleared by the toast itself after a timeout or on dismiss.
  plotAddedToast: string | null;

  addStudioFiles: (files: FileSignal[]) => void;
  removeStudioFile: (name: string) => void;
  addStudioOperation: (op: Omit<Operation, "id">) => void;
  removeStudioOperation: (id: string) => void;
  addStudioTransform: (tr: Omit<Transform, "id">) => void;
  removeStudioTransform: (id: string) => void;
  addStudioPlot: () => string;
  removeStudioPlot: (id: string) => void;
  renameStudioPlot: (id: string, name: string) => void;
  toggleStudioPlotHidden: (id: string) => void;
  reorderStudioPlots: (orderedIds: string[]) => void;
  addSignalToStudioPlot: (plotId: string, signalId: string) => void;
  removeSignalFromStudioPlot: (plotId: string, signalId: string) => void;
  updateStudioSignalAxis: (plotId: string, signalId: string, axis: "left" | "right") => void;
  toggleStudioPlotFFT: (plotId: string) => void;
  toggleStudioPlotLocked: (plotId: string) => void;
  updateStudioSignalColor: (plotId: string, signalId: string, color: string) => void;
  toggleStudioPlotOrder: (plotId: string, orderId: string) => void;
  setStudioPlotOrdersVisible: (plotId: string, orderIds: string[], visible: boolean) => void;
  setStudioFFTSampleRate: (rate: number | null) => void;
  setSignalLoadWarning: (message: string | null) => void;
  setPlotAddedToast: (name: string | null) => void;
}

export const createPlotStudioSlice: StateCreator<PlotStudioSlice> = (set) => ({
  studioFiles: new Map(),
  studioOperations: new Map(),
  studioTransforms: new Map(),
  studioPlots: new Map(),
  studioPlotCounter: 0,
  studioOpCounter: 0,
  studioTrCounter: 0,
  fftSampleRateOverride: null,
  signalLoadWarning: null,
  plotAddedToast: null,

  addStudioFiles: (files) =>
    set((s) => {
      const next = new Map(s.studioFiles);
      for (const f of files) next.set(f.name, f);
      return { studioFiles: next };
    }),

  removeStudioFile: (name) =>
    set((s) => {
      const nextFiles = new Map(s.studioFiles);
      nextFiles.delete(name);
      const nextPlots = new Map(s.studioPlots);
      nextPlots.forEach((plot, id) => {
        if (!plot.signals.some((sig) => sig.signalId === name)) return;
        nextPlots.set(id, {
          ...plot,
          signals: plot.signals.filter((sig) => sig.signalId !== name),
        });
      });
      return { studioFiles: nextFiles, studioPlots: nextPlots };
    }),

  addStudioOperation: (op) =>
    set((s) => {
      const id = `op_${s.studioOpCounter}`;
      const next = new Map(s.studioOperations);
      next.set(id, { ...op, id });
      return { studioOperations: next, studioOpCounter: s.studioOpCounter + 1 };
    }),

  removeStudioOperation: (id) =>
    set((s) => {
      const nextOps = new Map(s.studioOperations);
      nextOps.delete(id);
      const nextPlots = new Map(s.studioPlots);
      nextPlots.forEach((plot, plotId) => {
        if (!plot.signals.some((sig) => sig.signalId === id)) return;
        nextPlots.set(plotId, {
          ...plot,
          signals: plot.signals.filter((sig) => sig.signalId !== id),
        });
      });
      return { studioOperations: nextOps, studioPlots: nextPlots };
    }),

  addStudioTransform: (tr) =>
    set((s) => {
      const id = `tr_${s.studioTrCounter}`;
      const next = new Map(s.studioTransforms);
      next.set(id, { ...tr, id });
      return { studioTransforms: next, studioTrCounter: s.studioTrCounter + 1 };
    }),

  removeStudioTransform: (id) =>
    set((s) => {
      const nextTrs = new Map(s.studioTransforms);
      nextTrs.delete(id);
      const nextPlots = new Map(s.studioPlots);
      nextPlots.forEach((plot, plotId) => {
        if (!plot.signals.some((sig) => sig.signalId === id)) return;
        nextPlots.set(plotId, {
          ...plot,
          signals: plot.signals.filter((sig) => sig.signalId !== id),
        });
      });
      return { studioTransforms: nextTrs, studioPlots: nextPlots };
    }),

  addStudioPlot: () => {
    let newId = "";
    set((s) => {
      const id = `plot_${s.studioPlotCounter}`;
      newId = id;
      const name = `Plot ${s.studioPlots.size + 1}`;
      const next = new Map(s.studioPlots);
      next.set(id, { id, name, signals: [], showFFT: false, nextColorIndex: 0 });
      return { studioPlots: next, studioPlotCounter: s.studioPlotCounter + 1, plotAddedToast: name };
    });
    return newId;
  },

  removeStudioPlot: (id) =>
    set((s) => {
      const next = new Map(s.studioPlots);
      next.delete(id);
      return { studioPlots: next };
    }),

  renameStudioPlot: (id, name) =>
    set((s) => {
      const plot = s.studioPlots.get(id);
      const trimmed = name.trim();
      if (!plot || !trimmed) return {};
      const next = new Map(s.studioPlots);
      next.set(id, { ...plot, name: trimmed });
      return { studioPlots: next };
    }),

  toggleStudioPlotHidden: (id) =>
    set((s) => {
      const plot = s.studioPlots.get(id);
      if (!plot) return {};
      const next = new Map(s.studioPlots);
      next.set(id, { ...plot, hidden: !plot.hidden });
      return { studioPlots: next };
    }),

  // Rebuilds the Map in the given key order — Maps iterate in insertion
  // order, so this is how plot order (sidebar list + PlotsArea) is changed.
  reorderStudioPlots: (orderedIds) =>
    set((s) => {
      const next = new Map<string, PlotState>();
      for (const id of orderedIds) {
        const plot = s.studioPlots.get(id);
        if (plot) next.set(id, plot);
      }
      s.studioPlots.forEach((plot, id) => {
        if (!next.has(id)) next.set(id, plot);
      });
      return { studioPlots: next };
    }),

  addSignalToStudioPlot: (plotId, signalId) =>
    set((s) => {
      const plot = s.studioPlots.get(plotId);
      if (!plot) return {};
      if (plot.signals.some((sig) => sig.signalId === signalId)) return {};
      const newSignal: PlotSignal = { signalId, yAxis: "left", colorIndex: plot.nextColorIndex };
      const next = new Map(s.studioPlots);
      next.set(plotId, { ...plot, signals: [...plot.signals, newSignal], nextColorIndex: plot.nextColorIndex + 1 });
      return { studioPlots: next };
    }),

  removeSignalFromStudioPlot: (plotId, signalId) =>
    set((s) => {
      const plot = s.studioPlots.get(plotId);
      if (!plot) return {};
      const next = new Map(s.studioPlots);
      next.set(plotId, {
        ...plot,
        signals: plot.signals.filter((sig) => sig.signalId !== signalId),
      });
      return { studioPlots: next };
    }),

  updateStudioSignalAxis: (plotId, signalId, axis) =>
    set((s) => {
      const plot = s.studioPlots.get(plotId);
      if (!plot) return {};
      const next = new Map(s.studioPlots);
      next.set(plotId, {
        ...plot,
        signals: plot.signals.map((sig) =>
          sig.signalId === signalId ? { ...sig, yAxis: axis } : sig,
        ),
      });
      return { studioPlots: next };
    }),

  toggleStudioPlotFFT: (plotId) =>
    set((s) => {
      const plot = s.studioPlots.get(plotId);
      if (!plot) return {};
      const next = new Map(s.studioPlots);
      next.set(plotId, { ...plot, showFFT: !plot.showFFT });
      return { studioPlots: next };
    }),

  toggleStudioPlotLocked: (plotId) =>
    set((s) => {
      const plot = s.studioPlots.get(plotId);
      if (!plot) return {};
      const next = new Map(s.studioPlots);
      next.set(plotId, { ...plot, locked: !plot.locked });
      return { studioPlots: next };
    }),

  updateStudioSignalColor: (plotId, signalId, color) =>
    set((s) => {
      const plot = s.studioPlots.get(plotId);
      if (!plot) return {};
      const next = new Map(s.studioPlots);
      next.set(plotId, {
        ...plot,
        signals: plot.signals.map((sig) =>
          sig.signalId === signalId ? { ...sig, color } : sig,
        ),
      });
      return { studioPlots: next };
    }),

  toggleStudioPlotOrder: (plotId, orderId) =>
    set((s) => {
      const plot = s.studioPlots.get(plotId);
      if (!plot) return {};
      const hiddenOrderIds = { ...plot.hiddenOrderIds };
      if (hiddenOrderIds[orderId]) delete hiddenOrderIds[orderId];
      else hiddenOrderIds[orderId] = true;
      const next = new Map(s.studioPlots);
      next.set(plotId, { ...plot, hiddenOrderIds });
      return { studioPlots: next };
    }),

  setStudioPlotOrdersVisible: (plotId, orderIds, visible) =>
    set((s) => {
      const plot = s.studioPlots.get(plotId);
      if (!plot) return {};
      const hiddenOrderIds = { ...plot.hiddenOrderIds };
      for (const orderId of orderIds) {
        if (visible) delete hiddenOrderIds[orderId];
        else hiddenOrderIds[orderId] = true;
      }
      const next = new Map(s.studioPlots);
      next.set(plotId, { ...plot, hiddenOrderIds });
      return { studioPlots: next };
    }),

  setStudioFFTSampleRate: (rate) => set({ fftSampleRateOverride: rate }),

  setSignalLoadWarning: (message) => set({ signalLoadWarning: message }),

  setPlotAddedToast: (name) => set({ plotAddedToast: name }),
});

// Helper: resolve a signal (file/operation/transform) from store state
export function getSignal(
  id: string,
  state: Pick<PlotStudioSlice, "studioFiles" | "studioOperations" | "studioTransforms">,
): FileSignal | Operation | Transform | undefined {
  return state.studioFiles.get(id) ?? state.studioOperations.get(id) ?? state.studioTransforms.get(id);
}

// Helper: get signal data from store state
export function getSignalData(
  id: string,
  state: Pick<PlotStudioSlice, "studioFiles" | "studioOperations" | "studioTransforms">,
) {
  return getSignal(id, state)?.data ?? null;
}

// Helper: all signals unified
export function getAllSignals(
  state: Pick<PlotStudioSlice, "studioFiles" | "studioOperations" | "studioTransforms">,
) {
  const signals: { id: string; name: string; type: "file" | "operation" | "transform" }[] = [];
  state.studioFiles.forEach((f, id) => signals.push({ id, name: f.name, type: "file" }));
  state.studioOperations.forEach((op) => signals.push({ id: op.id, name: op.name, type: "operation" }));
  state.studioTransforms.forEach((tr) => signals.push({ id: tr.id, name: tr.name, type: "transform" }));
  return signals;
}

// Helper: display name for a signal.
// Session signals are stored as "BOARD/measId" — show just measId for brevity.
// Standalone CSV signals keep their name minus the .csv extension.
export function displayName(name: string): string {
  if (name.endsWith(".csv")) return name.slice(0, -4);
  const slashIdx = name.indexOf("/");
  if (slashIdx !== -1) return name.slice(slashIdx + 1);
  return name;
}
