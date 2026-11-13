// Formula signals: an expression over session measurements, evaluated into a
// new series. The expression is parsed into an AST and evaluated a whole
// array at a time — nothing is handed to `eval`/`new Function`.
import type { DashboardSettings, FormulaSignal } from "../../types/normal";
import type { SeriesData } from "../../types/plotStudio";
import { lowerBound, upperBound } from "../plotStudio/range";
import { getPanes, updatePane } from "./layout";

type Node =
  | { kind: "number"; value: number }
  | { kind: "variable"; name: string }
  | { kind: "negate"; operand: Node }
  | {
      kind: "binary";
      operator: "+" | "-" | "*" | "/" | "^";
      left: Node;
      right: Node;
    }
  | { kind: "call"; name: string; args: Node[] };

export type FormulaAst = Node;

type Value = number | Float64Array;

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

// Evaluated per sample; arguments broadcast like a spreadsheet would.
const POINTWISE: Record<
  string,
  { arity: [number, number]; apply: (...args: number[]) => number }
> = {
  abs: { arity: [1, 1], apply: Math.abs },
  sqrt: { arity: [1, 1], apply: Math.sqrt },
  exp: { arity: [1, 1], apply: Math.exp },
  ln: { arity: [1, 1], apply: Math.log },
  log10: { arity: [1, 1], apply: Math.log10 },
  sin: { arity: [1, 1], apply: Math.sin },
  cos: { arity: [1, 1], apply: Math.cos },
  tan: { arity: [1, 1], apply: Math.tan },
  asin: { arity: [1, 1], apply: Math.asin },
  acos: { arity: [1, 1], apply: Math.acos },
  atan: { arity: [1, 1], apply: Math.atan },
  atan2: { arity: [2, 2], apply: Math.atan2 },
  sign: { arity: [1, 1], apply: Math.sign },
  round: { arity: [1, 1], apply: Math.round },
  floor: { arity: [1, 1], apply: Math.floor },
  ceil: { arity: [1, 1], apply: Math.ceil },
  pow: { arity: [2, 2], apply: Math.pow },
  min: { arity: [2, 8], apply: Math.min },
  max: { arity: [2, 8], apply: Math.max },
  clamp: {
    arity: [3, 3],
    apply: (value, low, high) => Math.min(high, Math.max(low, value)),
  },
};

// Need the neighbouring samples and the time axis, so they take whole series.
const SERIES_ARITY: Record<string, [number, number]> = {
  derivative: [1, 1],
  integral: [1, 1],
  smooth: [2, 2],
};

/** Shown in the editor as a cheat-sheet. */
export const FORMULA_REFERENCE: { label: string; items: string }[] = [
  { label: "Operators", items: "+  −  *  /  ^  ( )" },
  { label: "Constants", items: "pi, e, t (seconds since the first sample)" },
  {
    label: "Functions",
    items:
      "abs, sqrt, exp, ln, log10, sin, cos, tan, asin, acos, atan, atan2(y, x), sign, round, floor, ceil, pow(x, n), min(…), max(…), clamp(x, low, high)",
  },
  {
    label: "Over time",
    items:
      "derivative(x) per second, integral(x) cumulative ·s, smooth(x, n) moving average of n samples",
  },
];

const RESERVED = new Set([
  ...Object.keys(CONSTANTS),
  "t",
  ...Object.keys(POINTWISE),
  ...Object.keys(SERIES_ARITY),
]);

/** Why `name` cannot be a variable name, or null when it can. */
export function variableNameError(name: string): string | null {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
    return "Use letters, digits and _ only, starting with a letter";
  if (RESERVED.has(name)) return `"${name}" is a built-in name`;
  return null;
}

/** First free name from a, b, c… skipping built-ins such as e and t. */
export function nextVariableName(taken: Iterable<string>): string {
  const used = new Set(taken);
  for (const letter of "abcdfghijklmnopqrsuvwxyz")
    if (!used.has(letter)) return letter;
  for (let number = 1; ; number++)
    if (!used.has(`x${number}`)) return `x${number}`;
}

type Token =
  | { type: "number"; value: number; at: number }
  | { type: "name"; value: string; at: number }
  | { type: "symbol"; value: string; at: number };

class FormulaError extends Error {}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const pattern =
    /\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|([-+*/^(),]))/y;
  let position = 0;
  while (position < source.length) {
    if (/^\s*$/.test(source.slice(position))) break;
    pattern.lastIndex = position;
    const match = pattern.exec(source);
    if (!match) {
      const at = position + source.slice(position).search(/\S/);
      throw new FormulaError(
        `Unexpected "${source[at]}" at position ${at + 1}`,
      );
    }
    const at = pattern.lastIndex - (match[1] ?? match[2] ?? match[3]).length;
    if (match[1] !== undefined)
      tokens.push({ type: "number", value: Number(match[1]), at });
    else if (match[2] !== undefined)
      tokens.push({ type: "name", value: match[2], at });
    else tokens.push({ type: "symbol", value: match[3], at });
    position = pattern.lastIndex;
  }
  return tokens;
}

function parse(source: string): Node {
  const tokens = tokenize(source);
  let index = 0;
  const peek = () => tokens[index];
  const isSymbol = (value: string) => {
    const token = peek();
    return token?.type === "symbol" && token.value === value;
  };
  const fail = (): never => {
    const token = peek();
    throw new FormulaError(
      token
        ? `Unexpected "${token.value}" at position ${token.at + 1}`
        : "The expression ends too early",
    );
  };
  const expect = (value: string) => {
    if (!isSymbol(value)) fail();
    index++;
  };

  const primary = (): Node => {
    const token = peek();
    if (!token) return fail();
    if (token.type === "number") {
      index++;
      return { kind: "number", value: token.value };
    }
    if (token.type === "name") {
      index++;
      if (!isSymbol("(")) return { kind: "variable", name: token.value };
      index++;
      const args: Node[] = [];
      if (!isSymbol(")")) {
        args.push(additive());
        while (isSymbol(",")) {
          index++;
          args.push(additive());
        }
      }
      expect(")");
      const arity = POINTWISE[token.value]?.arity ?? SERIES_ARITY[token.value];
      if (!arity) throw new FormulaError(`Unknown function "${token.value}"`);
      if (args.length < arity[0] || args.length > arity[1])
        throw new FormulaError(
          `${token.value}() takes ${
            arity[0] === arity[1] ? arity[0] : `${arity[0]} to ${arity[1]}`
          } argument${arity[1] === 1 ? "" : "s"}`,
        );
      return { kind: "call", name: token.value, args };
    }
    if (token.value === "(") {
      index++;
      const inner = additive();
      expect(")");
      return inner;
    }
    return fail();
  };
  // -a^2 is -(a^2), and 2^-1 is allowed: the exponent is parsed as a unary.
  const power = (): Node => {
    const base = primary();
    if (!isSymbol("^")) return base;
    index++;
    return { kind: "binary", operator: "^", left: base, right: unary() };
  };
  const unary = (): Node => {
    if (isSymbol("-")) {
      index++;
      return { kind: "negate", operand: unary() };
    }
    if (isSymbol("+")) {
      index++;
      return unary();
    }
    return power();
  };
  const multiplicative = (): Node => {
    let left = unary();
    while (isSymbol("*") || isSymbol("/")) {
      const operator = (peek() as Token).value as "*" | "/";
      index++;
      left = { kind: "binary", operator, left, right: unary() };
    }
    return left;
  };
  const additive = (): Node => {
    let left = multiplicative();
    while (isSymbol("+") || isSymbol("-")) {
      const operator = (peek() as Token).value as "+" | "-";
      index++;
      left = { kind: "binary", operator, left, right: multiplicative() };
    }
    return left;
  };

  if (tokens.length === 0) throw new FormulaError("Type an expression");
  const ast = additive();
  if (index < tokens.length) fail();
  return ast;
}

function collectVariables(node: Node, into: Set<string>) {
  if (node.kind === "variable") {
    if (!(node.name in CONSTANTS) && node.name !== "t") into.add(node.name);
  } else if (node.kind === "negate") collectVariables(node.operand, into);
  else if (node.kind === "binary") {
    collectVariables(node.left, into);
    collectVariables(node.right, into);
  } else if (node.kind === "call")
    for (const arg of node.args) collectVariables(arg, into);
}

export type ParsedFormula =
  | { ok: true; ast: FormulaAst; variables: string[] }
  | { ok: false; error: string };

/** Syntax check only: it does not know which variables are bound. */
export function parseFormula(expression: string): ParsedFormula {
  try {
    const ast = parse(expression);
    const variables = new Set<string>();
    collectVariables(ast, variables);
    return { ok: true, ast, variables: [...variables] };
  } catch (error) {
    if (error instanceof FormulaError)
      return { ok: false, error: error.message };
    throw error;
  }
}

export interface FormulaInput {
  data: SeriesData;
  /** Enum/bool sources hold their state between samples instead of ramping. */
  discrete: boolean;
}

/** Resample `input` at each `grid` time (grid lies inside the input's span). */
function resample(input: FormulaInput, grid: Float64Array): Float64Array {
  const { time, value } = input.data;
  const out = new Float64Array(grid.length);
  let index = 0;
  for (let i = 0; i < grid.length; i++) {
    const at = grid[i];
    while (index < time.length - 1 && time[index + 1] <= at) index++;
    const span = index < time.length - 1 ? time[index + 1] - time[index] : 0;
    out[i] =
      input.discrete || span <= 0 || at <= time[index]
        ? value[index]
        : value[index] +
          ((at - time[index]) / span) * (value[index + 1] - value[index]);
  }
  return out;
}

function broadcast(
  args: Value[],
  length: number,
  apply: (...values: number[]) => number,
): Value {
  if (args.every((arg) => typeof arg === "number"))
    return apply(...(args as number[]));
  const out = new Float64Array(length);
  const row = new Array<number>(args.length);
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < args.length; j++) {
      const arg = args[j];
      row[j] = typeof arg === "number" ? arg : arg[i];
    }
    out[i] = apply(...row);
  }
  return out;
}

function toSeries(value: Value, length: number): Float64Array {
  return typeof value === "number"
    ? new Float64Array(length).fill(value)
    : value;
}

function derivative(x: Float64Array, time: Float64Array): Float64Array {
  const n = x.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const before = Math.max(0, i - 1);
    const after = Math.min(n - 1, i + 1);
    // Time is in ms; a repeated timestamp gives NaN, dropped later.
    out[i] = ((x[after] - x[before]) / (time[after] - time[before])) * 1000;
  }
  return out;
}

function integral(x: Float64Array, time: Float64Array): Float64Array {
  const out = new Float64Array(x.length);
  for (let i = 1; i < x.length; i++)
    out[i] =
      out[i - 1] + ((x[i] + x[i - 1]) / 2) * ((time[i] - time[i - 1]) / 1000);
  return out;
}

function smooth(x: Float64Array, samples: number): Float64Array {
  const n = x.length;
  const window = Math.max(1, Math.round(samples));
  const before = Math.floor((window - 1) / 2);
  const after = window - 1 - before;
  const sums = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) sums[i + 1] = sums[i] + x[i];
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const from = Math.max(0, i - before);
    const to = Math.min(n, i + after + 1);
    out[i] = (sums[to] - sums[from]) / (to - from);
  }
  return out;
}

/**
 * Evaluate a parsed formula. Inputs are aligned first: the result lives on
 * the timestamps of the densest input, restricted to the span every input
 * covers, and the others are interpolated onto it. Samples whose result is
 * not finite (division by zero, sqrt of a negative…) are left out.
 * Throws an Error with a user-facing message.
 */
export function evaluateFormula(
  ast: FormulaAst,
  inputs: Record<string, FormulaInput>,
): SeriesData {
  const names = new Set<string>();
  collectVariables(ast, names);
  if (names.size === 0)
    throw new Error("The expression must use at least one measurement");
  let start = -Infinity;
  let end = Infinity;
  for (const name of names) {
    const input = inputs[name];
    if (!input) throw new Error(`"${name}" is not bound to a measurement`);
    const { time } = input.data;
    if (time.length === 0) throw new Error(`"${name}" has no samples`);
    start = Math.max(start, time[0]);
    end = Math.min(end, time[time.length - 1]);
  }
  let grid: Float64Array = new Float64Array(0);
  for (const name of names) {
    const { time } = inputs[name].data;
    const candidate = time.subarray(
      lowerBound(time, start),
      upperBound(time, end),
    );
    if (candidate.length > grid.length) grid = candidate;
  }
  if (grid.length === 0)
    throw new Error("The measurements do not overlap in time");

  const length = grid.length;
  const series: Record<string, Float64Array> = {};
  for (const name of names) series[name] = resample(inputs[name], grid);
  let seconds: Float64Array | null = null;

  const run = (node: Node): Value => {
    switch (node.kind) {
      case "number":
        return node.value;
      case "variable":
        if (node.name in CONSTANTS) return CONSTANTS[node.name];
        if (node.name === "t") {
          seconds ??= grid.map((time) => (time - grid[0]) / 1000);
          return seconds;
        }
        return series[node.name];
      case "negate":
        return broadcast([run(node.operand)], length, (value) => -value);
      case "binary": {
        const operator = node.operator;
        return broadcast(
          [run(node.left), run(node.right)],
          length,
          operator === "+"
            ? (a, b) => a + b
            : operator === "-"
              ? (a, b) => a - b
              : operator === "*"
                ? (a, b) => a * b
                : operator === "/"
                  ? (a, b) => a / b
                  : Math.pow,
        );
      }
      case "call": {
        const args = node.args.map(run);
        if (node.name === "derivative")
          return derivative(toSeries(args[0], length), grid);
        if (node.name === "integral")
          return integral(toSeries(args[0], length), grid);
        if (node.name === "smooth") {
          if (typeof args[1] !== "number" || !(args[1] >= 1))
            throw new Error(
              "smooth(x, n) needs a constant number of samples, 1 or more",
            );
          return smooth(toSeries(args[0], length), args[1]);
        }
        return broadcast(args, length, POINTWISE[node.name].apply);
      }
    }
  };

  const result = toSeries(run(ast), length);
  const time = new Float64Array(length);
  const value = new Float64Array(length);
  let count = 0;
  for (let i = 0; i < length; i++) {
    if (!Number.isFinite(result[i])) continue;
    time[count] = grid[i];
    value[count] = result[i];
    count++;
  }
  if (count === 0) throw new Error("The result has no finite values");
  return { time: time.subarray(0, count), value: value.subarray(0, count) };
}

/** Drop a formula and take it out of every plot that showed it. */
export function removeFormula(
  settings: DashboardSettings,
  id: string,
): DashboardSettings {
  let tree = settings.layoutState.tree;
  for (const pane of getPanes(tree))
    if (pane.signalIds.includes(id))
      tree = updatePane(tree, pane.id, (current) => ({
        ...current,
        signalIds: current.signalIds.filter((item) => item !== id),
        hiddenSignalIds: current.hiddenSignalIds?.filter((item) => item !== id),
      }));
  const units = { ...settings.units };
  delete units[id];
  return {
    ...settings,
    units,
    formulas: settings.formulas.filter((formula) => formula.id !== id),
    layoutState: { ...settings.layoutState, tree },
  };
}

export function formulaLabel(formula: FormulaSignal): string {
  return `${formula.name} = ${formula.expression}`;
}
