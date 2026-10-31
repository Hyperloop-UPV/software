// Composed Series: signals derived from session data — math operations
// (A ∘ B) and expression transforms f(x) — managed in a single panel.
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@hyperloop-upv/frontend-kit/components";
import { Trash2 } from "@hyperloop-upv/frontend-kit/icons";
import { useState } from "react";
import { useStore } from "../../../store/store";
import OperationModal from "../modals/OperationModal";
import TransformModal from "../modals/TransformModal";

const OP_META: Record<string, { symbol: string; color: string; strip: string; badge: string }> = {
  subtract: { symbol: "−", color: "text-rose-500",    strip: "bg-rose-500",    badge: "bg-rose-500/10 border-rose-500/25" },
  add:      { symbol: "+", color: "text-emerald-500", strip: "bg-emerald-500", badge: "bg-emerald-500/10 border-emerald-500/25" },
  multiply: { symbol: "×", color: "text-blue-500",    strip: "bg-blue-500",    badge: "bg-blue-500/10 border-blue-500/25" },
  divide:   { symbol: "÷", color: "text-amber-500",   strip: "bg-amber-500",   badge: "bg-amber-500/10 border-amber-500/25" },
};

export default function ComposedSection() {
  const studioOperations = useStore((s) => s.studioOperations);
  const studioTransforms = useStore((s) => s.studioTransforms);
  const removeStudioOperation = useStore((s) => s.removeStudioOperation);
  const removeStudioTransform = useStore((s) => s.removeStudioTransform);

  const [opModalOpen, setOpModalOpen] = useState(false);
  const [trModalOpen, setTrModalOpen] = useState(false);

  // Resolve an operand/source id to a short display name
  const operandName = (id: string) => {
    if (id.includes("/")) return id.split("/").slice(1).join("/");
    return studioOperations.get(id)?.name ?? studioTransforms.get(id)?.name ?? id;
  };

  const ops = Array.from(studioOperations.values());
  const transforms = Array.from(studioTransforms.values());

  return (
    <div className="flex flex-col gap-2">
      {/* Create buttons */}
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="border-dashed hover:border-primary hover:text-primary transition-colors"
          onClick={() => setOpModalOpen(true)}
        >
          <span className="mr-1 font-bold">∑</span> Operation
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-dashed hover:border-primary hover:text-primary transition-colors"
          onClick={() => setTrModalOpen(true)}
        >
          <span className="mr-1 font-bold italic">𝑓</span> Transform
        </Button>
      </div>

      {ops.length === 0 && transforms.length === 0 && (
        <p className="text-muted-foreground py-2 text-center text-[11px]">
          Combine series (+, −, ×, ÷) or apply f(x) expressions to derive new ones
        </p>
      )}

      {/* Operations */}
      {ops.map((op) => {
        const meta = OP_META[op.type] ?? OP_META.subtract;
        return (
          <div key={op.id}
            className="bg-card group relative overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md">
            <div className={`absolute inset-y-0 left-0 w-[3px] ${meta.strip}`} />
            <div className="flex items-center gap-2 py-2.5 pl-4 pr-2">
              <span className={`flex size-5 shrink-0 items-center justify-center rounded border text-sm font-bold ${meta.badge} ${meta.color}`}>
                {meta.symbol}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-foreground text-xs font-semibold leading-tight">{op.name}</div>
                <div className="text-muted-foreground font-mono text-[10px]">
                  {operandName(op.signalA)}{" "}
                  <span className={`font-bold ${meta.color}`}>{meta.symbol}</span>{" "}
                  {operandName(op.signalB)}
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-xs"
                    onClick={() => removeStudioOperation(op.id)}
                    aria-label={`Remove operation ${op.name}`}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                    <Trash2 className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Remove</TooltipContent>
              </Tooltip>
            </div>
          </div>
        );
      })}

      {/* Transforms */}
      {transforms.map((tr) => (
        <div key={tr.id}
          className="bg-card group relative overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md">
          <div className="bg-primary absolute inset-y-0 left-0 w-[3px]" />
          <div className="flex items-center gap-2 py-2.5 pl-4 pr-2">
            <div className="bg-primary/10 border-primary/25 flex size-5 shrink-0 items-center justify-center rounded border">
              <span className="text-primary text-[11px] font-bold italic">𝑓</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-foreground text-xs font-semibold leading-tight">{tr.name}</div>
              <div className="mt-0.5 flex items-center gap-1">
                <span className="text-muted-foreground text-[10px]">{operandName(tr.sourceSignal)}</span>
                <span className="text-muted-foreground/50 text-[10px]">→</span>
                <code className="text-primary bg-primary/8 rounded px-1 text-[10px]">{tr.expression}</code>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-xs"
                  onClick={() => removeStudioTransform(tr.id)}
                  aria-label={`Remove transform ${tr.name}`}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Remove</TooltipContent>
            </Tooltip>
          </div>
        </div>
      ))}

      <OperationModal open={opModalOpen} onClose={() => setOpModalOpen(false)} />
      <TransformModal open={trModalOpen} onClose={() => setTrModalOpen(false)} />
    </div>
  );
}
