import type { Archive } from "../types/Archive";
import type { LogsContentRow } from "../types/LogsContentRow";

export const getFileRows = (archive: Archive): LogsContentRow[] => [
  {
    label: "Internal ID",
    value: `#${archive.id}`,
  },
  {
    label: "Mime Type",
    value: archive.content_type,
  },
  {
    label: "File Size",
    value: `${archive.size_bytes.toLocaleString()} bytes`,
  },
];
