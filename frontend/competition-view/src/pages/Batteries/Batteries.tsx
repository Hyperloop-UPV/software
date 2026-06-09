import { Separator } from "@workspace/ui/components";
import HvBatterySection from "./components/HvBatterySection";
import LvBatterySection from "./components/LvBatterySection";

/**
 * Batteries monitoring page.
 *
 * Layout:
 *   - High-voltage section (HVSCU summary + 18 pack cards)
 *   - Separator
 *   - Low-voltage section (BMSL summary + 6 cell cards)
 */
const Batteries = () => (
  <div className="flex h-full flex-col gap-6 overflow-auto p-4">
    <HvBatterySection />
    <Separator />
    <LvBatterySection />
  </div>
);

export default Batteries;
