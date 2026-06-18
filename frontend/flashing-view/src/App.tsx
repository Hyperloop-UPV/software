import { useEffect } from "react";
import { FlashStationView } from "./features/flash-station/flash-station-view";

/**
 * Root component for the flashing-view standalone app.
 *
 * Dark-mode state is persisted to localStorage under the key
 * "flashing-view-dark-mode" and applied to the document root so Tailwind's
 * `dark:` variants work correctly.
 */
export default function App() {
  useEffect(() => {
    const saved = localStorage.getItem("flashing-view-dark-mode");
    const isDark =
      saved !== null
        ? saved === "true"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;

    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  return (
    <div className="h-screen w-screen overflow-auto bg-background text-foreground">
      <FlashStationView />
    </div>
  );
}
