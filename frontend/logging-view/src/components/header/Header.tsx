// Top bar with the page title and a Normal / Simple mode segmented control.
// Mode switching navigates between routes (/normal, /simple) rather than
// store state, since each mode has a distinct UI.
import { Button, SegmentedControl } from "@hyperloopupv/frontend-kit/components";
import { X } from "@hyperloopupv/frontend-kit/icons";
import { useLocation, useNavigate } from "react-router";
import logo from "@hyperloopupv/frontend-kit/outreach/main/logo_icon.svg";
import { useStore } from "../../store/store";
import { useSeriesSelection } from "../../hooks/useSeriesSelection";

type ViewMode = "normal" | "simple";

const VIEW_OPTIONS: { label: string; value: ViewMode }[] = [
  { label: "Normal", value: "normal" },
  { label: "Simple", value: "simple" },
];

const Header = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeMode: ViewMode = pathname.startsWith("/simple") ? "simple" : "normal";
  const folderName = useStore((s) => s.folderName);
  const dashboardName = useStore(
    (s) =>
      s.normalDashboards.find((d) => d.id === s.activeNormalDashboardId)?.name,
  );
  const { selectedSeries, clearSelectedSeries, isSelectionLocked } = useSeriesSelection();
  const selectedCount = Object.values(selectedSeries).filter(Boolean).length;
  // The title always names the app; the session context lives in the subtitle,
  // led by the active dashboard so the top bar says which tab you are in.
  const hasNormalSession = activeMode === "normal" && !!folderName;
  const sessionLine = [dashboardName, folderName].filter(Boolean).join(" · ");

  return (
    <header className="h-(--header-height) flex shrink-0 items-center gap-2 overflow-x-hidden border-b px-4">
      <span className="size-9 shrink-0 overflow-hidden">
        <img src={logo} alt="Hyperloop UPV" className="size-full scale-[2.045] dark:invert" />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="text-foreground truncate text-xl font-bold">
          Logging View
        </h1>
        {hasNormalSession && (
          <p
            className="text-muted-foreground truncate text-xs"
            title={`${sessionLine} · ${selectedCount} selected`}
          >
            {sessionLine} · {selectedCount} selected · shared session time axis
          </p>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {hasNormalSession && selectedCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSelectedSeries}
            disabled={isSelectionLocked}
            className="text-muted-foreground gap-1.5 text-xs"
            aria-label="Clear selection"
          >
            <X className="size-3.5" />
            <span className="hidden sm:inline">Clear selection</span>
          </Button>
        )}
        <SegmentedControl
          options={VIEW_OPTIONS}
          value={activeMode}
          onChange={(mode) => navigate(`/${mode}`)}
        />
      </div>
    </header>
  );
};

export default Header;
