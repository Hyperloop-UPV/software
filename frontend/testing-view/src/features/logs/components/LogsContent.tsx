import { Card, CardContent } from "@workspace/ui";
import { getFileRows } from "../constants/fileRows";
import type { Archive } from "../types/Archive";
import LogsContentCardRow from "./LogsContentCardRow";
import LogsContentDownload from "./LogsContentDownload";
import LogsContentTitle from "./LogsContentTitle";
import LogsNotSelected from "./LogsNotSelected";

export const LogsContent = ({ archive }: { archive?: Archive }) => {
  if (!archive) {
    return <LogsNotSelected />;
  }

  const rows = getFileRows(archive);

  return (
    <div className="w-full max-w-4xl p-10">
      <LogsContentTitle title={archive.filename} />

      <Card className="rounded-4xl py-0 shadow-xl">
        <CardContent className="p-8">
          <div className="space-y-1">
            {rows.map((row, i) => (
              <LogsContentCardRow
                key={i}
                row={row}
                last={i === rows.length - 1}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <LogsContentDownload />
    </div>
  );
};
