// Editor for a dashboard's formula signals. Mounted once per dashboard and
// opened through the store, because the toolbar and the plots that launch it
// are sibling trees.
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hyperloopupv/frontend-kit/components";
import { Plus, X } from "@hyperloopupv/frontend-kit/icons";
import { useMemo, useState } from "react";
import { useDashboardSetting } from "../../hooks/useDashboardSetting";
import {
  FORMULA_REFERENCE,
  nextVariableName,
  parseFormula,
  variableNameError,
} from "../../lib/normal/formula";
import { getPanes } from "../../lib/normal/layout";
import type { FormulaEditorRequest } from "../../store/slices/normalDashboardsSlice";
import { useStore } from "../../store/store";
import SignalSelect from "../simple/SignalSelect";
import {
  FORMULA_ID_PREFIX,
  type FormulaSignal,
  type NormalDashboard,
} from "../../types/normal";

const MAX_PANES = 8;
const MAX_VARIABLES = 5;
const NO_PLOT = "none";
const NEW_PLOT = "new";

interface VariableRow {
  key: string;
  name: string;
  source: string;
}

function FormulaForm({
  dashboard,
  request,
  onClose,
}: {
  dashboard: NormalDashboard;
  request: FormulaEditorRequest;
  onClose: () => void;
}) {
  const [formulas, setFormulas] = useDashboardSetting(dashboard, "formulas");
  const addPlot = useStore((state) => state.addNormalPlot);
  const assignSignals = useStore((state) => state.assignNormalSignalsToPlot);
  const editing = formulas.find((item) => item.id === request.formulaId);
  const panes = getPanes(dashboard.settings.layoutState.tree);

  const [name, setName] = useState(() => {
    if (editing) return editing.name;
    const taken = new Set(formulas.map((item) => item.name));
    let number = formulas.length + 1;
    while (taken.has(`Formula ${number}`)) number++;
    return `Formula ${number}`;
  });
  const [units, setUnits] = useState(editing?.units ?? "");
  const [rows, setRows] = useState<VariableRow[]>(() => {
    if (editing)
      return Object.entries(editing.variables).map(([variable, source]) => ({
        key: crypto.randomUUID(),
        name: variable,
        source,
      }));
    const sources = (request.sourceIds ?? []).slice(0, MAX_VARIABLES);
    const names: string[] = [];
    while (names.length < Math.max(1, sources.length))
      names.push(nextVariableName(names));
    return names.map((variable, index) => ({
      key: crypto.randomUUID(),
      name: variable,
      source: sources[index] ?? "",
    }));
  });
  const [expression, setExpression] = useState(
    editing?.expression ??
      (rows.length === 2 && rows.every((row) => row.source)
        ? `${rows[0].name} - ${rows[1].name}`
        : ""),
  );
  const [target, setTarget] = useState(
    request.paneId && panes.some((pane) => pane.id === request.paneId)
      ? request.paneId
      : (panes[0]?.id ?? NO_PLOT),
  );

  const rowErrors = rows.map((row, index) => {
    const invalid = variableNameError(row.name);
    if (invalid) return invalid;
    if (rows.findIndex((other) => other.name === row.name) !== index)
      return `"${row.name}" is used twice`;
    return null;
  });
  const parsed = useMemo(() => parseFormula(expression), [expression]);
  const bound = new Set(
    rows.filter((row) => row.source).map((row) => row.name),
  );
  const declared = new Set(rows.map((row) => row.name));
  let problem: string | null = null;
  if (!expression.trim()) problem = null;
  else if (!parsed.ok) problem = parsed.error;
  else if (parsed.variables.length === 0)
    problem = "Use at least one variable in the expression";
  else {
    const unknown = parsed.variables.find((item) => !declared.has(item));
    const unbound = parsed.variables.find((item) => !bound.has(item));
    if (unknown) problem = `"${unknown}" is not one of the variables above`;
    else if (unbound) problem = `Choose a measurement for "${unbound}"`;
  }
  const valid =
    !!name.trim() &&
    !!expression.trim() &&
    !problem &&
    rowErrors.every((error) => !error);

  const updateRow = (key: string, changes: Partial<VariableRow>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...changes } : row)),
    );

  const save = () => {
    if (!valid) return;
    const formula: FormulaSignal = {
      id: editing?.id ?? `${FORMULA_ID_PREFIX}${crypto.randomUUID()}`,
      name: name.trim().slice(0, 60),
      expression: expression.trim(),
      variables: Object.fromEntries(
        rows.filter((row) => row.source).map((row) => [row.name, row.source]),
      ),
      units: units.trim() || undefined,
    };
    if (editing) {
      setFormulas((current) =>
        current.map((item) => (item.id === formula.id ? formula : item)),
      );
    } else {
      setFormulas((current) => [...current, formula]);
      if (target === NEW_PLOT) addPlot([formula.id]);
      else if (target !== NO_PLOT) assignSignals(target, [formula.id]);
    }
    onClose();
  };

  return (
    <form
      className="grid min-w-0 gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <DialogHeader>
        <DialogTitle>{editing ? "Edit formula" : "New formula"}</DialogTitle>
        <DialogDescription>
          Combine measurements into a computed signal for this dashboard.
        </DialogDescription>
      </DialogHeader>

      <div className="flex gap-3">
        <label className="text-muted-foreground grid min-w-0 flex-1 gap-1 text-xs">
          Name
          <Input
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            className="text-foreground h-8 text-xs"
          />
        </label>
        <label className="text-muted-foreground grid w-[7rem] gap-1 text-xs">
          Unit (optional)
          <Input
            value={units}
            maxLength={24}
            placeholder="e.g. W"
            onChange={(event) => setUnits(event.target.value)}
            className="text-foreground h-8 text-xs"
          />
        </label>
      </div>

      <div className="grid gap-1.5">
        <p className="text-muted-foreground text-xs">Variables</p>
        {rows.map((row, index) => (
          <div key={row.key} className="grid gap-1">
            <div className="flex items-center gap-2">
              <Input
                value={row.name}
                maxLength={16}
                aria-label={`Name of variable ${index + 1}`}
                aria-invalid={!!rowErrors[index]}
                onChange={(event) =>
                  updateRow(row.key, { name: event.target.value.trim() })
                }
                className="h-8 w-[4.5rem] shrink-0 font-mono text-xs"
              />
              <span className="text-muted-foreground text-xs">=</span>
              <div className="min-w-0 flex-1">
                <SignalSelect
                  value={row.source}
                  onValueChange={(source) => updateRow(row.key, { source })}
                  placeholder="Choose a measurement…"
                  ariaLabel={`Measurement for ${row.name || `variable ${index + 1}`}`}
                  seriesOnly
                  size="sm"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={rows.length === 1}
                aria-label={`Remove variable ${row.name}`}
                onClick={() =>
                  setRows((current) =>
                    current.filter((item) => item.key !== row.key),
                  )
                }
              >
                <X className="size-3.5" />
              </Button>
            </div>
            {rowErrors[index] && (
              <p className="text-destructive text-[11px]">{rowErrors[index]}</p>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-fit gap-1 px-2 text-xs"
          disabled={rows.length >= MAX_VARIABLES}
          onClick={() =>
            setRows((current) => [
              ...current,
              {
                key: crypto.randomUUID(),
                name: nextVariableName(current.map((row) => row.name)),
                source: "",
              },
            ])
          }
        >
          <Plus className="size-3.5" />
          Add variable
        </Button>
      </div>

      <div className="grid gap-1">
        <label className="text-muted-foreground grid gap-1 text-xs">
          Expression
          <Input
            value={expression}
            onChange={(event) => setExpression(event.target.value)}
            placeholder="e.g. a - b, sqrt(a^2 + b^2), derivative(a)"
            aria-invalid={!!problem}
            spellCheck={false}
            autoComplete="off"
            className="text-foreground h-9 font-mono text-sm"
          />
        </label>
        <p
          role="status"
          className={`min-h-4 text-[11px] ${problem ? "text-destructive" : "text-muted-foreground"}`}
        >
          {problem ??
            "Measurements logged at different times are aligned by interpolation."}
        </p>
        <details className="text-muted-foreground text-[11px]">
          <summary className="cursor-pointer select-none">
            What can I write?
          </summary>
          <dl className="mt-1.5 grid gap-1">
            {FORMULA_REFERENCE.map((entry) => (
              <div key={entry.label} className="flex gap-2">
                <dt className="w-[4.5rem] shrink-0 font-medium">
                  {entry.label}
                </dt>
                <dd className="font-mono leading-relaxed">{entry.items}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>

      {!editing && (
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          Show in
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger
              size="sm"
              className="text-foreground min-w-[10rem] text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {panes.map((pane, index) => (
                <SelectItem key={pane.id} value={pane.id}>
                  {pane.title || `Plot ${index + 1}`}
                </SelectItem>
              ))}
              {panes.length < MAX_PANES && (
                <SelectItem value={NEW_PLOT}>A new plot</SelectItem>
              )}
              <SelectItem value={NO_PLOT}>No plot yet</SelectItem>
            </SelectContent>
          </Select>
        </label>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          {editing ? "Save" : "Create formula"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function FormulaDialog({
  dashboard,
}: {
  dashboard: NormalDashboard;
}) {
  const request = useStore((state) => state.normalFormulaEditor);
  const close = useStore((state) => state.closeNormalFormulaEditor);
  return (
    <Dialog
      open={!!request && !dashboard.locked}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="sm:max-w-[34rem]">
        {request && (
          <FormulaForm
            dashboard={dashboard}
            request={request}
            onClose={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
