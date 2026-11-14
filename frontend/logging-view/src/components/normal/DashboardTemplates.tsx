// Dashboard templates: a layout saved by name that can start a dashboard on
// any log. Stored like an exported file, and applied through the same import,
// so measurements a log lacks are left out with a warning.
import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from "@hyperloopupv/frontend-kit/components";
import {
  ChevronDown,
  Plus,
  Trash2,
  Upload,
} from "@hyperloopupv/frontend-kit/icons";
import { useDashboardTemplates } from "../../hooks/useDashboardTemplates";
import {
  deleteTemplate,
  saveTemplate,
} from "../../lib/normal/dashboardStorage";
import { useStore } from "../../store/store";
import type { NormalDashboard } from "../../types/normal";

const formatDate = (time: number) =>
  new Date(time).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** The chevron next to "New dashboard": blank, from a template, or a file. */
export function NewDashboardMenu({
  onBlank,
  onImportFile,
  onCreated,
}: {
  onBlank: () => void;
  onImportFile: () => void;
  /** Called after a tab was added, so the bar can focus it. */
  onCreated: () => void;
}) {
  const templates = useDashboardTemplates();
  const importDashboard = useStore((state) => state.importNormalDashboard);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="mb-0.5 -ml-1 shrink-0"
          aria-label="New dashboard from a template"
          title="New dashboard from a template or a file"
        >
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[16rem]">
        <DropdownMenuItem onClick={onBlank}>
          <Plus className="size-3.5" />
          Blank dashboard
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground text-[11px] font-medium">
          Templates
        </DropdownMenuLabel>
        {templates.length === 0 ? (
          <p className="text-muted-foreground px-2 pb-2 text-[11px]">
            Right-click a tab and choose “Save as template…”.
          </p>
        ) : (
          templates.map((template) => (
            <DropdownMenuItem
              key={template.id}
              className="group/template gap-2 pr-1"
              onClick={() => {
                if (importDashboard(template.file)) onCreated();
              }}
            >
              <span className="grid min-w-0 flex-1">
                <span className="truncate text-xs">{template.name}</span>
                <span className="text-muted-foreground text-[10px]">
                  {formatDate(template.savedAt)}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="opacity-60 group-hover/template:opacity-100"
                aria-label={`Delete template ${template.name}`}
                title="Delete template"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  deleteTemplate(template.id);
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onImportFile}>
          <Upload className="size-3.5" />
          Import dashboard…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SaveTemplateDialog({
  dashboard,
  onClose,
}: {
  dashboard: NormalDashboard | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!dashboard}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[26rem]">
        {dashboard && (
          <SaveTemplateForm dashboard={dashboard} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SaveTemplateForm({
  dashboard,
  onClose,
}: {
  dashboard: NormalDashboard;
  onClose: () => void;
}) {
  const templates = useDashboardTemplates();
  const [name, setName] = useState(dashboard.name);
  const [failed, setFailed] = useState(false);
  const replaces = templates.some((item) => item.name === name.trim());
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        if (saveTemplate(name, dashboard)) onClose();
        else setFailed(true);
      }}
    >
      <DialogHeader>
        <DialogTitle>Save as template</DialogTitle>
        <DialogDescription>
          Plots, formulas, markers and settings, ready to start a dashboard on
          any log.
        </DialogDescription>
      </DialogHeader>
      <label className="text-muted-foreground grid gap-1 text-xs">
        Template name
        <Input
          autoFocus
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          className="text-foreground h-8 text-xs"
        />
      </label>
      <p
        role="status"
        className={`min-h-4 text-[11px] ${failed ? "text-destructive" : "text-muted-foreground"}`}
      >
        {failed
          ? "The template could not be saved: browser storage is full or blocked."
          : replaces
            ? "A template with this name exists and will be replaced."
            : ""}
      </p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          {replaces ? "Replace template" : "Save template"}
        </Button>
      </DialogFooter>
    </form>
  );
}
