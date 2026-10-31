// FFT sample-rate control. Shows the rate auto-detected from the loaded data
// (median Δt of the first signal) and lets the user override it manually.
import { Button, Input, Label } from "@hyperloop-upv/frontend-kit/components";
import { RefreshCw, Timer } from "@hyperloop-upv/frontend-kit/icons";
import { useMemo, useState } from "react";
import { useStore } from "../../../store/store";

// Estimate the sampling rate (Hz) from the median Δt of the first loaded
// signal. Time is stored in ms, so rate = 1000 / Δt. Sampling up to 512
// consecutive pairs keeps this O(1) regardless of signal length.
function useDetectedRate(): number | null {
  const studioFiles = useStore((s) => s.studioFiles);
  return useMemo(() => {
    const first = studioFiles.values().next().value;
    if (!first || first.data.time.length < 8) return null;
    const time = first.data.time;
    const n = Math.min(time.length - 1, 512);
    const dts: number[] = [];
    for (let i = 1; i <= n; i++) {
      const dt = time[i] - time[i - 1];
      if (dt > 0) dts.push(dt);
    }
    if (dts.length === 0) return null;
    dts.sort((a, b) => a - b);
    const median = dts[Math.floor(dts.length / 2)];
    return median > 0 ? 1000 / median : null;
  }, [studioFiles]);
}

const fmtRate = (hz: number) =>
  hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`;

export default function FFTSection() {
  const fftSampleRateOverride = useStore((s) => s.fftSampleRateOverride);
  const setStudioFFTSampleRate = useStore((s) => s.setStudioFFTSampleRate);
  const [inputValue, setInputValue] = useState(fftSampleRateOverride?.toString() ?? "");
  const detected = useDetectedRate();

  const apply = () => {
    const v = parseFloat(inputValue);
    if (v > 0) setStudioFFTSampleRate(v);
  };

  const reset = () => {
    setInputValue("");
    setStudioFFTSampleRate(null);
  };

  const isActive = fftSampleRateOverride !== null;

  return (
    <div className="flex flex-col gap-3">
      {/* Status banner */}
      {isActive ? (
        <div className="border-primary/25 bg-primary/8 flex items-center gap-2 rounded-md border px-3 py-2">
          <span className="bg-primary relative flex size-2 shrink-0">
            <span className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-75" />
            <span className="bg-primary relative inline-flex size-2 rounded-full" />
          </span>
          <span className="text-primary text-[11px] font-medium">
            Override active: {fmtRate(fftSampleRateOverride)}
          </span>
        </div>
      ) : (
        <div className="border-muted bg-muted/30 flex items-center gap-2 rounded-md border px-3 py-2">
          <Timer className="text-muted-foreground size-3.5 shrink-0" />
          <span className="text-muted-foreground text-[11px]">
            {detected
              ? <>Auto: ≈ <span className="text-foreground font-medium">{fmtRate(detected)}</span> detected</>
              : "Auto — load a signal to estimate"}
          </span>
        </div>
      )}

      {/* Manual override */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px]">Override Sample Rate (Hz)</Label>
        <div className="flex gap-1.5">
          <Input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            placeholder={detected ? `e.g. ${Math.round(detected)}` : "e.g. 1000"}
            min={1}
            className="h-8 flex-1 text-xs shadow-none focus-visible:ring-0"
          />
          <Button variant="default" size="sm" onClick={apply} className="shrink-0">
            Set
          </Button>
          {isActive && (
            <Button variant="ghost" size="icon" onClick={reset} aria-label="Reset to auto" title="Reset to auto">
              <RefreshCw className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      <p className="text-muted-foreground text-[10px]">
        Leave blank to estimate from signal timestamps. The override applies to every FFT trace.
      </p>
    </div>
  );
}
