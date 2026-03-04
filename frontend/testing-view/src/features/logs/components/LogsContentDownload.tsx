import { Button } from "@workspace/ui";
import { Download } from "@workspace/ui/icons";

const LogsContentDownload = () => {
  return (
    <div className="mt-6 flex justify-end gap-4">
      <Button className="rounded-2xl text-sm shadow-lg">
        <Download className="size-4" /> Download
      </Button>
    </div>
  );
};

export default LogsContentDownload;
