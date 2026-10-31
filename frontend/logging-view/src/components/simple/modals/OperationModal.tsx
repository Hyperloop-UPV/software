// Dialog for composing a new series from two existing signals (A ∘ B).
// Operands may be any session series — their CSVs are parsed on demand.
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@hyperloop-upv/frontend-kit/components";
import { cn } from "@hyperloop-upv/frontend-kit/lib";
import { useState } from "react";
import { performOperation } from "../../../lib/plotStudio/operations";
import { useStore } from "../../../store/store";
import type { OperationType } from "../../../types/plotStudio";
import { useAvailableSignals, useSignalLoader } from "../hooks/useStudioSignals";
import SignalSelect from "../SignalSelect";

const OP_OPTIONS: { value: OperationType; symbol: string; label: string; color: string; bg: string }[] = [
  { value: "subtract", symbol: "−", label: "Subtraction",    color: "text-rose-500",    bg: "bg-rose-500/10 border-rose-500/25" },
  { value: "add",      symbol: "+", label: "Addition",       color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/25" },
  { value: "multiply", symbol: "×", label: "Multiplication", color: "text-blue-500",    bg: "bg-blue-500/10 border-blue-500/25" },
  { value: "divide",   symbol: "÷", label: "Division",       color: "text-amber-500",   bg: "bg-amber-500/10 border-amber-500/25" },
];

export default function OperationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addStudioOperation = useStore((s) => s.addStudioOperation);
  const signals = useAvailableSignals();
  const ensureLoaded = useSignalLoader();

  const [name, setName]       = useState("");
  const [type, setType]       = useState<OperationType>("subtract");
  const [signalA, setSignalA] = useState("");
  const [signalB, setSignalB] = useState("");
  const [error, setError]     = useState("");
  const [busy, setBusy]       = useState(false);

  const labelOf = (id: string) => signals.find((s) => s.id === id)?.label ?? id;
  const selectedOp = OP_OPTIONS.find((o) => o.value === type)!;

  const handleCreate = async () => {
    setError("");
    if (!name.trim() || !signalA || !signalB) { setError("Please fill all fields."); return; }
    if (signalA === signalB) { setError("Signals A and B must be different."); return; }
    setBusy(true);
    try {
      const dataA = await ensureLoaded(signalA);
      const dataB = await ensureLoaded(signalB);
      if (!dataA || !dataB) { setError("Failed to load signal data."); return; }
      if (dataA.time.length < 2 || dataB.time.length < 2) {
        setError("Selected signal has only one sample — cannot combine it with another.");
        return;
      }
      addStudioOperation({ name: name.trim(), type, signalA, signalB, data: performOperation(dataA, dataB, type) });
      setName(""); setSignalA(""); setSignalB(""); setType("subtract");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => { setError(""); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-[26rem]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="bg-primary/15 flex size-7 items-center justify-center rounded">
              <span className="text-primary text-base font-bold">∑</span>
            </div>
            <DialogTitle>Compose Series — Operation</DialogTitle>
          </div>
          <p className="text-muted-foreground text-xs">
            Derive a new series by combining two signals sample-by-sample.
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          {signals.length < 2 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
              You need at least two series — open a session first.
            </div>
          )}

          {/* Output name */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Output Series Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Position Error" autoFocus />
          </div>

          {/* Operation selector */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Operation</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {OP_OPTIONS.map((op) => (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setType(op.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs font-medium transition-all",
                    type === op.value
                      ? `${op.bg} ${op.color} ring-1 ring-current`
                      : "bg-muted/30 hover:bg-muted",
                  )}
                >
                  <span className="text-xl font-bold">{op.symbol}</span>
                  <span className="text-[10px]">{op.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Operands */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Signal A</Label>
              <SignalSelect value={signalA} onValueChange={setSignalA}
                placeholder="Select…" triggerClassName="w-full" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Signal B</Label>
              <SignalSelect value={signalB} onValueChange={setSignalB}
                placeholder="Select…" triggerClassName="w-full" />
            </div>
          </div>

          {/* Preview */}
          {signalA && signalB && (
            <div className={cn("flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium", selectedOp.bg)}>
              <span className="text-muted-foreground truncate text-xs">{labelOf(signalA)}</span>
              <span className={cn("text-xl font-bold", selectedOp.color)}>{selectedOp.symbol}</span>
              <span className="text-muted-foreground truncate text-xs">{labelOf(signalB)}</span>
            </div>
          )}

          {error && (
            <p className="text-destructive bg-destructive/10 rounded-md px-3 py-2 text-xs">{error}</p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleCreate} disabled={busy || !name || !signalA || !signalB}>
            {busy ? "Loading…" : "Create Series"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
