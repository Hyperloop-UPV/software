import { useStore } from "../../../../../store/store";
import type { TelemetryCatalogItem } from "../../../../../types/data/telemetryCatalogItem";
import { Tab } from "../tabs/Tab";
import { TelemetryItem } from "../tabs/telemetry/TelemetryItem";

export const TelemetrySection = () => {
  const boards = useStore((s) => s.boards);

  return (
    <Tab
      title="Telemetry"
      scope="telemetry"
      categories={boards}
      ItemComponent={(props) => (
        <TelemetryItem item={props.item as TelemetryCatalogItem} />
      )}
      virtualized
    />
  );
};
