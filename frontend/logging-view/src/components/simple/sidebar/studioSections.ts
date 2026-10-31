// Registry of the studio panel sections, VS Code-style: the activity bar
// shows one icon per section and the panel displays a single section at a time.
import { Activity, Layers, Timer } from "@hyperloop-upv/frontend-kit/icons";
import type { LucideIcon } from "@hyperloop-upv/frontend-kit/icons";
import ComposedSection from "./ComposedSection";
import FFTSection from "./FFTSection";
import PlotsSection from "./PlotsSection";

export interface StudioSection {
  id: string;
  icon: LucideIcon;
  title: string;
  Component: React.ComponentType;
}

export const STUDIO_SECTIONS: StudioSection[] = [
  { id: "studio-section-plots",    icon: Activity, title: "Plots",           Component: PlotsSection },
  { id: "studio-section-composed", icon: Layers,   title: "Composed Series", Component: ComposedSection },
  { id: "studio-section-fft",      icon: Timer,    title: "FFT Settings",    Component: FFTSection },
];
