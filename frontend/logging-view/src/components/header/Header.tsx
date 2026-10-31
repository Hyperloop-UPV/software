// Top bar with the page title and a Normal / Simple mode segmented control.
// Mode switching navigates between routes (/normal, /simple) rather than
// store state, since each mode has a distinct UI.
import { SegmentedControl } from "@hyperloop-upv/frontend-kit/components";
import { useLocation, useNavigate } from "react-router";
import logo from "@hyperloop-upv/frontend-kit/outreach/h11/h11-isotipo_black.svg";

type ViewMode = "normal" | "simple";

const VIEW_OPTIONS: { label: string; value: ViewMode }[] = [
  { label: "Normal", value: "normal" },
  { label: "Simple", value: "simple" },
];

const Header = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeMode: ViewMode = pathname.startsWith("/simple") ? "simple" : "normal";

  return (
    <header className="h-(--header-height) flex shrink-0 items-center gap-2 overflow-x-hidden border-b px-4">
      <img src={logo} alt="Hyperloop UPV" className="size-9 shrink-0 dark:invert" />
      <h1 className="text-foreground text-xl font-bold">Logging View</h1>

      <div className="ml-auto flex items-center gap-2">
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
