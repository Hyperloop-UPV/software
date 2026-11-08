// Top bar with the page title and a Normal / Simple mode segmented control.
// Mode switching navigates between routes (/normal, /simple) rather than
// store state, since each mode has a distinct UI.
import { Button, SegmentedControl } from "@hyperloopupv/frontend-kit/components";
import { X } from "@hyperloopupv/frontend-kit/icons";
import { useLocation, useNavigate } from "react-router";
import logo from "@hyperloopupv/frontend-kit/outreach/h11/h11-isotipo_black.svg";
import { useStore } from "../../store/store";

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
  const selectedCount = useStore((s) => Object.values(s.selectedSeries).filter(Boolean).length);
  const clearSelectedSeries = useStore((s) => s.clearSelectedSeries);
  const showWorkspace = activeMode === "normal" && !!folderName;

  return (
    <header className="h-(--header-height) flex shrink-0 items-center gap-2 overflow-x-hidden border-b px-4">
      <img src={logo} alt="Hyperloop UPV" className="size-9 shrink-0 dark:invert" />
      <div className="min-w-0 flex-1">
        <h1 className="text-foreground truncate text-xl font-bold">
          {showWorkspace ? "Signal workspace" : "Logging View"}
        </h1>
        {showWorkspace && (
          <p className="text-muted-foreground truncate text-xs" title={folderName}>
            {folderName} · {selectedCount} selected · shared session time axis
          </p>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {showWorkspace && selectedCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSelectedSeries}
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
