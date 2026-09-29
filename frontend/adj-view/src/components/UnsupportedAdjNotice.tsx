import { AlertTriangle } from "@workspace/ui/icons";
import { SUPPORTED_ADJ_VERSIONS } from "../adj";

export function UnsupportedAdjNotice({ version }: { version: number }) {
  const supported = SUPPORTED_ADJ_VERSIONS.map((v) => `ADJ v${v}`).join(", ");
  const isNewer = version > Math.max(...SUPPORTED_ADJ_VERSIONS);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-[34rem] rounded-lg border border-amber-500/40 bg-amber-500/10 p-5 text-sm">
        <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-4 shrink-0" />
          {isNewer ? `New ADJ version detected: v${version}` : `Unsupported ADJ version: v${version}`}
        </div>
        <p className="text-muted-foreground mt-2">
          {isNewer
            ? `This archive uses ADJ v${version}, a newer format than this viewer understands.`
            : `This archive uses ADJ v${version}, which this viewer doesn't understand.`}{" "}
          {`The ADJ Viewer currently supports ${supported} only, so this archive's contents can't be displayed.`}
        </p>
        <p className="text-muted-foreground mt-2">
          To browse it, use a version of the ADJ Viewer with ADJ v{version} support, or load a commit that uses {supported}.
        </p>
      </div>
    </div>
  );
}
