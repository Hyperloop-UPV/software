import { useCallback, useEffect, useState } from "react";
import { FlashStationView } from "./features/flash-station/flash-station-view";

export default function App() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("flashing-view-dark-mode");
    return saved !== null
      ? saved === "true"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("flashing-view-dark-mode", String(isDark));
  }, [isDark]);

  const toggleTheme = useCallback(() => setIsDark((d) => !d), []);

  return (
    <div className="h-screen w-screen overflow-auto bg-background text-foreground">
      <FlashStationView isDark={isDark} onToggleTheme={toggleTheme} />
    </div>
  );
}
