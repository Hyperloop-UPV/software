import { Separator } from "@hyperloop-upv/frontend-kit/components";
import { formatAxisValue } from "../../constants/chartConfig";
import { BOARDS, HVAL_THRESHOLD_V, HVBMS, VCU } from "../../constants/measurements";
import { useIsStale } from "../../hooks/useIsStale";
import useMeasurement from "../../hooks/useMeasurement";
import { STALE_BADGE_CLASS, STALE_TEXT_CLASS } from "../../lib/freshness";
import { stateBadgeClass } from "../../lib/stateColor";

/* ─── Shared vertical rhythm for the status blocks ───────────────────────── */

const VDivider = () => <Separator orientation="vertical" className="data-[orientation=vertical]:h-6" />;

const StatBlock = ({ heading, children }: { heading: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-muted-foreground text-xs leading-none font-medium uppercase tracking-widest">
      {heading}
    </span>
    {/* Fixed-height value row so a bare text value and a bordered badge line up identically. */}
    <div className="flex h-8 items-center">{children}</div>
  </div>
);

const StatValue = ({
  value,
  valueClass = "text-foreground",
  width,
}: {
  value: string;
  valueClass?: string;
  /** Fixed width so a longer/shorter value doesn't shift the elements after it. */
  width?: string;
}) => (
  <div className={`${width} overflow-hidden`}>
    <span className={`block w-fit max-w-full truncate text-base font-bold leading-tight ${valueClass}`}>{value}</span>
  </div>
);

/* ─── DashboardStatusBar ─────────────────────────────────────────────────── */

const DashboardStatusBar = () => {
  const state    = useMeasurement(BOARDS.VCU, VCU.state);
  const brakeRaw = useMeasurement(BOARDS.VCU, VCU.brakesStatus);
  const dcLinkV  = useMeasurement(BOARDS.HVBMS, HVBMS.voltageReading) as number | undefined;

  const stateStale  = useIsStale(BOARDS.VCU, VCU.state);
  const brakeStale  = useIsStale(BOARDS.VCU, VCU.brakesStatus);
  const dcLinkStale = useIsStale(BOARDS.HVBMS, HVBMS.voltageReading);

  const dcLinkActive = dcLinkV !== undefined && dcLinkV > HVAL_THRESHOLD_V;
  const dcLinkClass = dcLinkStale
    ? STALE_TEXT_CLASS
    : dcLinkV === undefined
      ? "text-muted-foreground"
      : dcLinkActive ? "text-red-500" : "text-green-500";

  const brakeLabel = brakeRaw === undefined ? "—" : String(brakeRaw);
  const brakeClass =
    brakeStale              ? STALE_TEXT_CLASS :
    brakeRaw === "BRAKED"   ? "text-red-500"  :
    brakeRaw === "UNBRAKED" ? "text-blue-500" :
    "text-muted-foreground";

  return (
    <div className="flex items-center gap-3">
      <StatBlock heading="DC Link">
        <StatValue value={dcLinkV !== undefined ? `${formatAxisValue(dcLinkV)} V` : "—"} valueClass={dcLinkClass} width="w-28" />
      </StatBlock>

      <VDivider />

      <StatBlock heading="Vehicle State">
        {/* Fixed-width slot so a longer/shorter state string doesn't shift the elements after it. */}
        <div className="w-44 overflow-hidden">
          <span className={`inline-block max-w-full truncate rounded-md border px-2.5 py-1 text-base font-bold leading-tight ${stateStale ? STALE_BADGE_CLASS : stateBadgeClass(state)}`}>
            {state !== undefined ? String(state) : "—"}
          </span>
        </div>
      </StatBlock>

      <VDivider />

      <StatBlock heading="Brake">
        <StatValue value={brakeLabel} valueClass={brakeClass} width="w-24" />
      </StatBlock>
    </div>
  );
};

export default DashboardStatusBar;
