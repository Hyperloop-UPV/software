import { assertNever, type LoadedAdj } from ".";
import { AdjViewerTabs } from "./v2/AdjViewerTabs";

export function AdjViewer({ adj }: { adj: LoadedAdj }) {
  switch (adj.version) {
    case 2:
      return <AdjViewerTabs adjData={adj.data} />;
    default:
      return assertNever(adj.version);
  }
}
