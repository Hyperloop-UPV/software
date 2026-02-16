import { BOARD_NAMES } from "../../../../../constants/boards";
import type { TelemetryCatalogItem } from "../../../../../types/data/telemetryCatalogItem";
import { Tab } from "../tabs/Tab";
import { TelemetryItem } from "../tabs/telemetry/TelemetryItem";

export const TelemetrySection = () => (
  <Tab
    title="Telemetry"
    scope="telemetry"
    categories={BOARD_NAMES}
    ItemComponent={(props) => (
      <TelemetryItem item={props.item as TelemetryCatalogItem} />
    )}
    virtualized
  />
);
