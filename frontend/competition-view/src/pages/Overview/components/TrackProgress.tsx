import { Card, CardContent } from "@hyperloop-upv/frontend-kit/components";
import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import podIconDark from "../../../assets/pod-dark.svg";
import podIconLight from "../../../assets/pod-light.svg";
import { formatAxisValue } from "../../../constants/chartConfig";
import { BOARDS, PCU } from "../../../constants/measurements";
import { TRACK_LENGTH_M } from "../../../constants/track";
import { useIsStale } from "../../../hooks/useIsStale";
import useMeasurement from "../../../hooks/useMeasurement";
import { STALE_TEXT_CLASS } from "../../../lib/freshness";
import { useStore } from "../../../store/store";

/** Number of gaps between distance labels below the track (5 labels total). */
const TICK_COUNT = 4;
const TICKS = Array.from({ length: TICK_COUNT + 1 }, (_, i) => (TRACK_LENGTH_M / TICK_COUNT) * i);

/** Rendered pod icon width in px (h-12 = 48px tall, at the SVG's ~1.76:1 aspect ratio). */
const ICON_WIDTH_PX = 85;

/** Track-position visualizer: the pod icon slides along an empty bordered track. */
const TrackProgress = () => {
  const isDarkMode = useStore((s) => s.isDarkMode);
  const podIcon    = isDarkMode ? podIconDark : podIconLight;

  const position = useMeasurement(BOARDS.PCU, PCU.position) as number | undefined;
  const stale    = useIsStale(BOARDS.PCU, PCU.position);
  const clamped  = typeof position === "number" ? Math.min(TRACK_LENGTH_M, Math.max(0, position)) : 0;
  const pct      = (clamped / TRACK_LENGTH_M) * 100;

  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    if (!trackRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setTrackWidth(entry.contentRect.width);
    });
    observer.observe(trackRef.current);
    return () => observer.disconnect();
  }, []);

  // Keep the icon's own edges within the track by only sliding its center
  // across the range [iconWidth/2, trackWidth - iconWidth/2].
  const availableWidth = Math.max(trackWidth - ICON_WIDTH_PX, 0);
  const podCenterPx = ICON_WIDTH_PX / 2 + (pct / 100) * availableWidth;

  return (
    <Card className="shrink-0 gap-1 py-2">
      {/* Single-row layout: label · track · value, to keep the banner short. */}
      <CardContent className="flex items-center gap-4 px-4">
        <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs font-medium uppercase tracking-widest">
          <MapPin className="size-3.5" />
          Track Position
        </span>

        <div ref={trackRef} className="relative my-1 h-8 min-w-0 flex-1 rounded-lg border-2">
          {/* Distance-covered fill behind the pod (icon overflows the track, so no overflow clipping) */}
          <div
            className="bg-primary/10 absolute inset-y-0 left-0 rounded-md transition-[width] duration-200 ease-linear"
            style={{ width: `${podCenterPx}px` }}
          />

          {/* Distance ticks live inside the track so they cost no extra height */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-1.5">
            {TICKS.map((t) => (
              <span key={t} className="text-muted-foreground text-[9px] leading-tight tabular-nums">
                {t.toFixed(0)} m
              </span>
            ))}
          </div>

          <img
            src={podIcon}
            alt="Pod"
            className="absolute top-1/2 h-12 w-auto -translate-x-1/2 -translate-y-1/2 transition-[left] duration-200 ease-linear"
            style={{ left: `${podCenterPx}px` }}
          />
        </div>

        <span className={`shrink-0 text-base font-bold tabular-nums ${stale ? STALE_TEXT_CLASS : "text-foreground"}`}>
          {typeof position === "number" && Number.isFinite(position)
            ? Math.abs(position) >= 1e6
              ? formatAxisValue(position)
              : position.toFixed(1)
            : "—"}
          <span className="text-muted-foreground ml-0.5 text-sm font-normal">/ {TRACK_LENGTH_M} m</span>
        </span>
      </CardContent>
    </Card>
  );
};

export default TrackProgress;
