// Normal mode: full-featured log analysis view.
// Placeholder — UI to be implemented.
import swLogoBlack from "@hyperloop-upv/frontend-kit/outreach/main/software_black.png?inline";
import swLogoWhite from "@hyperloop-upv/frontend-kit/outreach/main/software_white.png?inline";
import { useStore } from "../store/store";

const NormalPage = () => {
  const isDarkMode = useStore((s) => s.isDarkMode);

  return (
    <div className="flex h-full flex-col items-center">
      <div className="flex flex-1 flex-col items-center justify-center gap-1">
        <p className="text-muted-foreground text-sm">Normal mode</p>
        <p className="text-muted-foreground text-xs">
          Still under development — use Simple mode for now.
        </p>
      </div>
      <div className="mb-6 flex items-center gap-3">
        <span className="text-3xl">;)</span>
        <img
          src={isDarkMode ? swLogoWhite : swLogoBlack}
          alt="sw logo"
          className="h-24 w-auto"
        />
      </div>
    </div>
  );
};

export default NormalPage;
