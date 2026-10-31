// Dialog for composing a new series by applying an f(x) expression to an
// existing signal. The source may be any session series — parsed on demand.
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@hyperloop-upv/frontend-kit/components";
import { useState } from "react";
import { applyTransform } from "../../../lib/plotStudio/transforms";
import { useStore } from "../../../store/store";
import { useAvailableSignals, useSignalLoader } from "../hooks/useStudioSignals";
import SignalSelect from "../SignalSelect";

const EXAMPLES = ["2*x", "abs(x)", "x*x", "sqrt(abs(x))", "sin(x)", "log(abs(x)+1)"];

export default function TransformModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addStudioTransform = useStore((s) => s.addStudioTransform);
  const signals = useAvailableSignals();
  const ensureLoaded = useSignalLoader();

  const [name, setName]           = useState("");
  const [sourceSignal, setSource] = useState("");
  const [expression, setExpr]     = useState("");
  const [error, setError]         = useState("");
  const [busy, setBusy]           = useState(false);

  const labelOf = (id: string) => signals.find((s) => s.id === id)?.label ?? id;

  const handleCreate = async () => {
    setError("");
    if (!name.trim() || !sourceSignal || !expression.trim()) { setError("Please fill all fields."); return; }
    setBusy(true);
    try {
      const sourceData = await ensureLoaded(sourceSignal);
      if (!sourceData) { setError("Failed to load source signal."); return; }
      const data = applyTransform(sourceData, expression.trim());
      if (data.value.length === 0) { setError("Expression produced no valid values. Check your syntax."); return; }
      addStudioTransform({ name: name.trim(), sourceSignal, expression: expression.trim(), data });
      setName(""); setSource(""); setExpr("");
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
              <span className="text-primary text-base font-bold italic">𝑓</span>
            </div>
            <DialogTitle>Compose Series — Transform</DialogTitle>
          </div>
          <p className="text-muted-foreground text-xs">
            Apply a math expression to every sample of a signal.
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          {signals.length === 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
              No series available — open a session first.
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Output Series Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Squared Signal" autoFocus />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Source Signal</Label>
            <SignalSelect value={sourceSignal} onValueChange={setSource}
              placeholder="Select signal…" triggerClassName="w-full" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Expression (use <code className="text-primary">x</code> for signal value)</Label>
            <Input
              value={expression}
              onChange={(e) => setExpr(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g., 2*x"
              className="font-mono"
            />
            {/* Example chips */}
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setExpr(ex)}
                  className="bg-muted hover:bg-primary/10 hover:text-primary rounded px-2 py-0.5 font-mono text-[11px] transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {sourceSignal && expression && (
            <div className="bg-primary/8 border-primary/20 flex items-center gap-2 rounded-lg border px-4 py-2.5 font-mono text-sm">
              <span className="text-primary font-bold italic">𝑓</span>
              <span className="text-muted-foreground text-xs">({labelOf(sourceSignal)}) =</span>
              <span className="text-primary text-xs">{expression}</span>
            </div>
          )}

          {error && (
            <p className="text-destructive bg-destructive/10 rounded-md px-3 py-2 text-xs">{error}</p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleCreate} disabled={busy || !name || !sourceSignal || !expression}>
            {busy ? "Loading…" : "Apply Transform"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
