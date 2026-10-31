import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Separator,
  SidebarMenuButton,
} from "@hyperloop-upv/frontend-kit/components";
import { Info } from "lucide-react";
import { useState } from "react";
import logo from "@hyperloop-upv/frontend-kit/outreach/h11/h11-isotipo_black.svg";

/**
 * Sidebar footer item that opens the About dialog with team credits.
 */
const AboutItem = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <SidebarMenuButton tooltip="About" onClick={() => setOpen(true)}>
        <Info className="size-4" />
        <span>About</span>
      </SidebarMenuButton>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="size-4" />
              About
            </DialogTitle>
          </DialogHeader>

          <Separator />

          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <img src={logo} alt="Hyperloop UPV" className="max-h-16 dark:invert" />
            <div>
              <p className="text-foreground text-base font-bold">Hyperloop UPV</p>
              <p className="text-muted-foreground text-sm">Competition View</p>
            </div>
            <p className="text-foreground text-sm">
              We are Hyperloop UPV, the hyperloop team of the Universitat
              Politècnica de València.
            </p>
            <a
              href="https://hyperloopupv.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary text-sm font-medium underline-offset-4 hover:underline"
            >
              hyperloopupv.com
            </a>
          </div>

          <Separator />

          <p className="text-muted-foreground text-center text-xs">
            Made by the Software Subsystem
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AboutItem;
