import { Button, Input } from "@workspace/ui/components";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import type { TimeRange, TimeUnit } from "../../types/normal";

export default function TimeWindowControls({
  duration,
  range,
  timeUnit,
  onChange,
}: {
  duration: number;
  range: TimeRange;
  timeUnit: TimeUnit;
  onChange: (range: TimeRange) => void;
}) {
  const errorId = useId();
  const [draft, setDraft] = useState<{ start: string; end: string } | null>(
    null,
  );
  const [error, setError] = useState("");
  const values = draft ?? {
    start: String(Number(((duration * range.start) / 100).toPrecision(12))),
    end: String(Number(((duration * range.end) / 100).toPrecision(12))),
  };
  const move = (direction: number) => {
    const span = range.end - range.start;
    const start = Math.max(
      0,
      Math.min(100 - span, range.start + direction * span),
    );
    onChange({ start, end: start + span });
  };

  return (
    <form
      className="border-border flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2"
      aria-label="Visible time window"
      onSubmit={(event) => {
        event.preventDefault();
        const start = Number(values.start);
        const end = Number(values.end);
        if (
          !values.start.trim() ||
          !values.end.trim() ||
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          start < 0 ||
          end > duration ||
          start >= end
        ) {
          setError(
            `Enter a start before the end, between 0 and ${duration} ${timeUnit}.`,
          );
          return;
        }
        setError("");
        setDraft(null);
        onChange({
          start: (start / duration) * 100,
          end: (end / duration) * 100,
        });
      }}
    >
      <span className="text-muted-foreground mr-1 text-[11px] font-medium">
        Time window
      </span>
      {(["start", "end"] as const).map((field) => (
        <label
          key={field}
          className="text-muted-foreground flex items-center gap-2 text-[11px]"
        >
          {field === "start" ? "From" : "To"}
          <Input
            type="number"
            step="any"
            min={0}
            max={duration}
            disabled={duration <= 0}
            value={values[field]}
            aria-label={`${field === "start" ? "Start" : "End"} time (${timeUnit})`}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setDraft({ ...values, [field]: event.target.value });
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setDraft(null);
                setError("");
              }
            }}
            className="h-7 w-28 text-xs tabular-nums"
          />
        </label>
      ))}
      <span className="text-muted-foreground text-xs">{timeUnit}</span>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        disabled={duration <= 0}
      >
        Apply
      </Button>
      <div className="ml-auto flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Previous time window"
          title="Previous time window"
          disabled={range.start <= 0 || duration <= 0}
          onClick={() => move(-1)}
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Next time window"
          title="Next time window"
          disabled={range.end >= 100 || duration <= 0}
          onClick={() => move(1)}
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-destructive w-full text-xs"
        >
          {error}
        </p>
      )}
    </form>
  );
}
