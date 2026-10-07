import type { AdjArchive, AdjPacket, LoggedOrder } from "../types/session";

const TIME_UNIT_TO_MS: Record<string, number> = { ns: 1e-6, us: 1e-3, ms: 1, s: 1e3 };

function escapePlotlyText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Order parameters are JSON and can contain commas, so a plain split(",") is
// not sufficient for the backend's CSV rows.
function splitCsvRow(row: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      if (quoted && row[i + 1] === '"') { field += char; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      fields.push(field);
      field = "";
    } else field += char;
  }
  fields.push(field);
  return fields;
}

function orderName(adjData: AdjArchive | null, board: string, id: number): string {
  const group = adjData?.boards[board];
  for (const key of ["orders", "orders_old"]) {
    const orders = group?.[key];
    if (Array.isArray(orders)) {
      const order = (orders as AdjPacket[]).find((packet) => packet.id === id);
      if (order?.name) return order.name;
    }
  }
  return `Order ${id}`;
}

/** Parses the backend's order/order.csv file. Invalid rows are skipped so an
 * otherwise useful session remains viewable if one record is malformed. */
export function parseOrdersCsv(text: string, timeUnit: string, adjData: AdjArchive | null): LoggedOrder[] {
  const multiplier = TIME_UNIT_TO_MS[timeUnit] ?? 1;
  const records: Array<Omit<LoggedOrder, "time" | "id"> & { rawTime: number }> = [];

  for (const row of text.split(/\r?\n/)) {
    if (!row.trim()) continue;
    const [timestamp, from, to, orderId, rawParameters] = splitCsvRow(row);
    const rawTime = Number(timestamp);
    const numericOrderId = Number(orderId);
    if (!Number.isFinite(rawTime) || !Number.isInteger(numericOrderId)) continue;
    let parameters: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = JSON.parse(rawParameters);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) parameters = parsed as Record<string, unknown>;
    } catch { /* Older logs may have a non-JSON map representation. */ }
    records.push({ rawTime, from, to, orderId: numericOrderId, parameters, name: orderName(adjData, to, numericOrderId) });
  }

  const start = records[0]?.rawTime ?? 0;
  return records.map(({ rawTime, ...record }, index) => ({
    ...record,
    id: `${rawTime}-${record.to}-${record.orderId}-${index}`,
    time: (rawTime - start) * multiplier,
  }));
}

export function formatOrderParameters(parameters: Record<string, unknown> | null): string {
  if (!parameters || Object.keys(parameters).length === 0) return "No parameters";
  return Object.entries(parameters)
    .map(([key, value]) => `${escapePlotlyText(key)}: ${escapePlotlyText(typeof value === "string" ? value : JSON.stringify(value))}`)
    .join(" · ");
}

export function formatOrderAnnotation(name: string, parameters: Record<string, unknown> | null): string {
  return `<b>${escapePlotlyText(name)}</b><br>${formatOrderParameters(parameters)}`;
}
