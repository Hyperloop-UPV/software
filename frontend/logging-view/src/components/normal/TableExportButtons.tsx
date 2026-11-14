import { useEffect, useState } from "react";
import { Button } from "@hyperloopupv/frontend-kit/components";
import {
  Check,
  Clipboard,
  FileSpreadsheet,
} from "@hyperloopupv/frontend-kit/icons";
import { copyText, downloadText, safeFileName } from "../../lib/download";
import { exportTimestamp } from "../../lib/plotStudio/format";
import { toCsv, toTsv, type Cell } from "../../lib/normal/tableExport";

/** "Copy" and "CSV" for a panel's table; `rows()` includes the header row. */
export default function TableExportButtons({
  name,
  label,
  rows,
  disabled,
}: {
  /** Base of the downloaded file name. */
  name: string;
  /** What is exported, for the accessible names: "statistics", "cursors". */
  label: string;
  rows: () => Cell[][];
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 gap-1 px-2 text-[11px]"
        disabled={disabled}
        aria-label={`Copy ${label} as a table`}
        title="Copy as a table (pastes into a spreadsheet)"
        onClick={async () =>
          setCopied((await copyText(toTsv(rows()))) ? "ok" : "failed")
        }
      >
        {copied === "ok" ? (
          <Check className="size-3.5" />
        ) : (
          <Clipboard className="size-3.5" />
        )}
        {copied === "failed" ? "Not allowed" : copied ? "Copied" : "Copy"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 gap-1 px-2 text-[11px]"
        disabled={disabled}
        aria-label={`Download ${label} as CSV`}
        title="Download as CSV"
        onClick={() =>
          downloadText(
            `${safeFileName(name)}__${exportTimestamp()}.csv`,
            toCsv(rows()),
            "text/csv",
          )
        }
      >
        <FileSpreadsheet className="size-3.5" />
        CSV
      </Button>
    </>
  );
}
