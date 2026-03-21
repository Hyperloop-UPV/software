import { Dialog } from "@base-ui/react";
import { socketService } from "@workspace/core";
import { Badge, Button } from "@workspace/ui";
import { AlertTriangle, CheckCircle2, Loader2, X } from "@workspace/ui/icons";
import { useEffect, useState, useTransition } from "react";
import { config } from "../../../config";
import { DEFAULT_CONFIG } from "../../constants/defaultConfig";
import { useStore } from "../../store/store";
import type { ConfigData } from "../../types/common/config";
import { SettingsForm } from "./SettingsForm";

export const SettingsDialog = () => {
  const isSettingsOpen = useStore((s) => s.isSettingsOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setRestarting = useStore((s) => s.setRestarting);
  const setConfig = useStore((s) => s.setConfig);
  const [localConfig, setLocalConfig] = useState<ConfigData | null>(null);
  const [isSynced, setIsSynced] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isBranchesLoading, startBranchesTransition] = useTransition();
  const [branches, setBranches] = useState<string[]>([]);

  const loadConfig = async () => {
    if (window.electronAPI) {
      try {
        const config = await window.electronAPI.getConfig();
        setLocalConfig(config);
        setConfig(config);
        setIsSynced(true);
      } catch (error) {
        console.error("Error loading config:", error);
        setLocalConfig(DEFAULT_CONFIG);
        setIsSynced(false);
      }
    } else {
      console.log("Electron API not available. Using default config.");
      setLocalConfig(DEFAULT_CONFIG);
      setIsSynced(false);
    }
  };

  const loadBranches = (signal: AbortSignal) => {
    startBranchesTransition(async () => {
      try {
        const res = await fetch(
          "https://api.github.com/repos/hyperloop-upv/adj/branches?per_page=100",
          { signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]) },
        );
        const data = await res.json();
        setBranches(data.map((b: { name: string }) => b.name));
      } catch (error) {
        if (
          error instanceof Error &&
          error.name !== "AbortError" &&
          error.name !== "TimeoutError"
        ) {
          console.error("Error loading branches:", error);
        }
      }
    });
  };

  useEffect(() => {
    if (isSettingsOpen) {
      const controller = new AbortController();
      loadConfig();
      loadBranches(controller.signal);
      return () => controller.abort();
    }
  }, [isSettingsOpen]);

  const handleSave = async () => {
    startSaving(async () => {
      if (window.electronAPI) {
        await window.electronAPI.saveConfig(localConfig);
      } else {
        console.log("Electron API not available. Using default config.");
      }

      setRestarting(true);

      setTimeout(() => {
        socketService.connect();
        setSettingsOpen(false);
        setRestarting(false);
      }, config.SETTINGS_RESPONSE_TIMEOUT);
    });
  };

  return (
    <Dialog.Root open={isSettingsOpen} onOpenChange={setSettingsOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Popup className="bg-background fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] min-w-[800px] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border p-6 shadow-lg">
          {/* Header */}
          <div className="flex flex-col gap-2 pr-5">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-lg font-semibold leading-none">
                System Configuration
              </Dialog.Title>

              <Badge className="gap-1 px-2 py-1">
                {isSynced ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> Synced with backend
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3" /> Not synced with real
                    configuration
                  </>
                )}
              </Badge>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-1">
            {localConfig && (
              <SettingsForm
                config={localConfig}
                onChange={setLocalConfig}
                branches={branches}
                branchesLoading={isBranchesLoading}
              />
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>

          {/* Close button */}
          <Dialog.Close className="rounded-xs absolute right-4 top-4 opacity-70 transition-opacity hover:opacity-100 disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none">
            <X />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
