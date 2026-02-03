import { Badge, Button } from "@workspace/ui";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/shadcn/dialog";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
} from "../../../../frontend-kit/ui/src/icons/notifications";
import { DEFAULT_CONFIG } from "../../constants/defaultConfig";
import { useStore } from "../../store/store";
import { SettingsForm } from "./SettingsForm";

export const SettingsDialog = () => {
  const isSettingsOpen = useStore((s) => s.isSettingsOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const [localConfig, setLocalConfig] = useState<any>(null);
  const [isSynced, setIsSynced] = useState(false);

  const loadConfig = async () => {
    if (window.electronAPI) {
      try {
        // Load config from Electron API
        const config = await window.electronAPI.getConfig();
        setLocalConfig(config);
        setIsSynced(true);
      } catch (error) {
        // If loading config fails, use default config
        console.error("Error loading config:", error);
        setLocalConfig(DEFAULT_CONFIG);
        setIsSynced(false);
      }
    } else {
      // No Electron API (dev mode) - use default config
      console.log("Electron API not available. Using default config.");
      setLocalConfig(DEFAULT_CONFIG);
      setIsSynced(false);
    }
  };

  // Load from Electron on open
  useEffect(() => {
    if (isSettingsOpen) {
      loadConfig();
    }
  }, [isSettingsOpen]);

  const handleSave = async () => {
    if (window.electronAPI) {
      await window.electronAPI.saveConfig(localConfig);
    } else {
      console.log("Electron API not available. Using default config.");
    }
    setSettingsOpen(false);
  };

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="flex max-h-[85vh] min-w-[800px] max-w-2xl flex-col">
        <DialogHeader className="pr-5">
          <div className="flex items-center justify-between">
            <DialogTitle>System Configuration</DialogTitle>

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
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          {localConfig && (
            <SettingsForm config={localConfig} onChange={setLocalConfig} />
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={() => setSettingsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
