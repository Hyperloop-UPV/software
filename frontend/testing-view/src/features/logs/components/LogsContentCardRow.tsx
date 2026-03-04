import { Separator } from "@workspace/ui";
import type { LogsContentRow } from "../types/LogsContentRow";

interface LogsContentCardRowProps {
  row: LogsContentRow;
  last?: boolean;
}

const LogsContentCardRow = ({ row, last = false }: LogsContentCardRowProps) => {
  return (
    <div>
      <div className="flex items-center justify-between rounded-xl px-4 py-4 transition-colors">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em]">
          {row.label}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">{row.value}</span>
        </div>
      </div>
      {!last && <Separator />}
    </div>
  );
};

export default LogsContentCardRow;
