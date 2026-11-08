/**
 * Mock backend for exercising Competition View without the pod.
 *
 * Stands in for the Go backend on port 4000. Its main job is to push messages
 * on the `message/update` topic so the Messages page can be checked against
 * every severity and payload variant the real backend can send. It also
 * publishes a fixed VCU state (so the state-gated order buttons are enabled)
 * and prints every `order/send` the GUI sends back, echoing the "order sent"
 * info message the real backend produces.
 *
 *   node scripts/mock-backend.mjs                 # one of every variant, then a random stream
 *   node scripts/mock-backend.mjs --interval 300  # faster stream
 *   node scripts/mock-backend.mjs --interval 0    # burst only, then stay quiet
 *   node scripts/mock-backend.mjs --state Idle    # change the gating vehicle state
 *
 * Then run the view against it: pnpm dev --filter competition-view
 */

import { createHash } from "node:crypto";
import { createServer } from "node:http";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const STATE_PACKET_ID = 210;

const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};

const PORT = Number(argValue("--port", "4000"));
const VEHICLE_STATE = argValue("--state", "Ready");
const INTERVAL = Number(argValue("--interval", "1500"));
const NO_BURST = args.includes("--no-burst");

// ------------------------------------------------------------------- messages

/** RTC fields as the backend sends them — no timezone, just wall clock. */
const timestamp = () => {
  const d = new Date();
  return {
    counter: 0,
    second: d.getSeconds(),
    minute: d.getMinutes(),
    hour: d.getHours(),
    day: d.getDate(),
    month: d.getMonth() + 1,
    year: d.getFullYear(),
  };
};

/**
 * One entry per `kind` × payload shape the frontend knows how to render
 * (see src/types/message.ts and src/lib/message.ts). Sent as a burst on
 * connect so every branch of the Messages UI is covered in one run.
 */
const MESSAGE_VARIANTS = [
  { kind: "info", board: "VCU", name: "Order sent", payload: "Brake order dispatched" },
  { kind: "ok", board: "VCU", name: "Brakes nominal", payload: { kind: "WARNING", data: "Brake pressure back in range" } },
  { kind: "warning", board: "PCU", name: "Motor temperature", payload: { kind: "UPPER_BOUND", data: { bound: 80, value: 84.31 } } },
  { kind: "warning", board: "HVBMS", name: "Cell voltage", payload: { kind: "LOWER_BOUND", data: { bound: 3.2, value: 3.07 } } },
  { kind: "warning", board: "LCU", name: "Levitation height", payload: { kind: "OUT_OF_BOUNDS", data: { bounds: [5, 25], value: 27.4 } } },
  { kind: "fault", board: "VCU", name: "SDC open", payload: { kind: "EQUALS", data: { value: 0 } } },
  { kind: "fault", board: "VCU", name: "Brakes status", payload: { kind: "NOT_EQUALS", data: { want: 1, value: 0 } } },
  { kind: "fault", board: "HVSCU-Cabinet", name: "Contactor current", payload: { kind: "TIME_ACCUMULATION", data: { value: 132.5, bound: 120, timelimit: 2.5 } } },
  { kind: "fault", board: "PCU", name: "Inverter error", payload: { kind: "ERROR_HANDLER", data: "Inverter reported fault code 0x2A" } },
  { kind: "warning", board: "PCU", name: "IMU drift", payload: { kind: "WARNING", data: "IMU position drifting from encoder estimate" } },
];

const randomMessage = () => {
  const base = MESSAGE_VARIANTS[Math.floor(Math.random() * MESSAGE_VARIANTS.length)];
  // Only the reading varies; bounds and expected values are fixed protection
  // limits, so jittering them would produce messages the pod can't produce.
  const data = base.payload?.data;
  const payload =
    typeof data === "object" && typeof data.value === "number"
      ? {
          ...base.payload,
          data: { ...data, value: Number((data.value * (0.9 + Math.random() * 0.2)).toFixed(2)) },
        }
      : base.payload;

  return { ...base, payload };
};

// --------------------------------------------------------------------- orders

const numeric = (id, name, min, max) => ({
  kind: "numeric",
  id,
  name,
  type: "float32",
  safeRange: [min, max],
  warningRange: [min, max],
});

/** Mirrors the ids in src/constants/vcuStateMachine.ts and orderColors.ts. */
const VCU_ORDERS = [
  { id: 0, name: "Fault", fields: {} },
  { id: 30, name: "Stop", fields: {} },
  { id: 40, name: "Maintenance", fields: {} },
  { id: 41, name: "Precharge", fields: {} },
  { id: 42, name: "Open Contactors", fields: {} },
  { id: 50, name: "Unbrake", fields: {} },
  { id: 51, name: "Brake", fields: {} },
  { id: 60, name: "Static Levitation", fields: {} },
  { id: 61, name: "Propulsion", fields: {} },
  { id: 62, name: "Dynamic Levitation", fields: {} },
  {
    id: 100,
    name: "Set Propulsion Current",
    fields: { propulsion_current_reference: numeric("propulsion_current_reference", "Current reference (A)", 0, 150) },
  },
  {
    id: 101,
    name: "Set Levitation Height",
    fields: { levitation_target_height: numeric("levitation_target_height", "Target height (mm)", 0, 30) },
  },
  {
    id: 102,
    name: "Set Propulsion And Levitation",
    fields: {
      propulsion_current_reference: numeric("propulsion_current_reference", "Current reference (A)", 0, 150),
      levitation_target_height: numeric("levitation_target_height", "Target height (mm)", 0, 30),
    },
  },
];

const ordersById = new Map(VCU_ORDERS.map((o) => [o.id, o]));

const ORDER_STRUCTURES = { boards: [{ name: "VCU", orders: VCU_ORDERS }] };
const POD_DATA_STRUCTURE = { boards: [{ name: "VCU", packets: [{ id: STATE_PACKET_ID }] }] };

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

let sentCount = 0;
const receivedOrders = [];

/** Prints a received order and the catalog problems it has, if any. */
const reportOrder = (payload) => {
  const spec = ordersById.get(payload?.id);
  const problems = [];

  if (typeof payload?.id !== "number") problems.push("missing numeric `id`");
  else if (!spec) problems.push(`id ${payload.id} is not in the catalog`);

  const fields = payload?.fields ?? {};
  if (spec) {
    for (const key of Object.keys(spec.fields)) {
      if (fields[key] === undefined) problems.push(`field \`${key}\` not sent`);
    }
    for (const key of Object.keys(fields)) {
      if (!(key in spec.fields)) problems.push(`unexpected field \`${key}\``);
    }
  }

  const fieldList = Object.entries(fields)
    .map(([k, v]) => `${k}=${JSON.stringify(v?.value)}`)
    .join(", ");

  const mark = problems.length === 0 ? c.green("ORDER OK  ") : c.red("ORDER FAIL");
  console.log(
    `${c.dim(new Date().toLocaleTimeString())} ${mark} ${c.bold(`#${payload?.id}`)} ` +
      `${spec ? spec.name : "unknown order"}${fieldList ? ` ${c.dim(`{ ${fieldList} }`)}` : ""}`,
  );
  for (const problem of problems) console.log(`          ${c.red("->")} ${problem}`);

  receivedOrders.push({ id: payload?.id, ok: problems.length === 0 });
  return spec;
};

// ------------------------------------------------------------- websocket frames

const encodeTextFrame = (text) => {
  const payload = Buffer.from(text);
  const len = payload.length;
  let header;

  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  return Buffer.concat([header, payload]);
};

/** Pulls every complete frame out of `buf`; returns the frames and the leftover bytes. */
const decodeFrames = (buf) => {
  const frames = [];
  let offset = 0;

  while (buf.length - offset >= 2) {
    const opcode = buf[offset] & 0x0f;
    const masked = (buf[offset + 1] & 0x80) !== 0;
    let len = buf[offset + 1] & 0x7f;
    let cursor = offset + 2;

    if (len === 126) {
      if (buf.length - cursor < 2) break;
      len = buf.readUInt16BE(cursor);
      cursor += 2;
    } else if (len === 127) {
      if (buf.length - cursor < 8) break;
      len = Number(buf.readBigUInt64BE(cursor));
      cursor += 8;
    }

    let mask;
    if (masked) {
      if (buf.length - cursor < 4) break;
      mask = buf.subarray(cursor, cursor + 4);
      cursor += 4;
    }

    if (buf.length - cursor < len) break;

    const payload = Buffer.from(buf.subarray(cursor, cursor + len));
    if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];

    frames.push({ opcode, payload });
    offset = cursor + len;
  }

  return { frames, rest: buf.subarray(offset) };
};

// ------------------------------------------------------------------- http + ws

const server = createServer((req, res) => {
  const body =
    req.url === "/backend/orderStructures"
      ? ORDER_STRUCTURES
      : req.url === "/backend/podDataStructure"
        ? POD_DATA_STRUCTURE
        : null;

  if (!body) {
    res.writeHead(404, { "Access-Control-Allow-Origin": "*" }).end();
    return;
  }

  console.log(c.dim(`      GET ${req.url}`));
  res
    .writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
    .end(JSON.stringify(body));
});

server.on("upgrade", (req, socket) => {
  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${createHash("sha1").update(key + WS_GUID).digest("base64")}\r\n\r\n`,
  );

  console.log(c.green("      GUI connected"));
  const send = (topic, payload) => socket.write(encodeTextFrame(JSON.stringify({ topic, payload })));

  const sendMessage = (message) => {
    const packet = { ...message, timestamp: timestamp() };
    send("message/update", packet);
    sentCount++;
    const label = { info: c.cyan, ok: c.green, warning: c.yellow, fault: c.red }[packet.kind] ?? c.dim;
    console.log(
      `${c.dim(new Date().toLocaleTimeString())} ${label(packet.kind.toUpperCase().padEnd(10))} ` +
        `${c.bold(packet.board)} ${packet.name}`,
    );
  };

  send("connection/update", { VCU: { name: "VCU", isConnected: true } });

  // Keep publishing the vehicle state so state-gated order buttons stay enabled.
  const telemetry = setInterval(() => {
    send("podData/update", {
      [STATE_PACKET_ID]: {
        id: STATE_PACKET_ID,
        count: 0,
        cycleTime: 0,
        hexValue: "",
        measurementUpdates: { state: VEHICLE_STATE },
      },
    });
  }, 250);

  // One of every variant up front, so each Messages branch gets exercised.
  const timers = [telemetry];
  if (!NO_BURST) {
    MESSAGE_VARIANTS.forEach((variant, i) => {
      timers.push(setTimeout(() => sendMessage(variant), 300 + i * 150));
    });
  }
  if (INTERVAL > 0) {
    const after = NO_BURST ? 0 : 300 + MESSAGE_VARIANTS.length * 150;
    timers.push(
      setTimeout(() => {
        const stream = setInterval(() => sendMessage(randomMessage()), INTERVAL);
        timers.push(stream);
      }, after),
    );
  }

  let buf = Buffer.alloc(0);

  socket.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    const { frames, rest } = decodeFrames(buf);
    buf = rest;

    for (const { opcode, payload } of frames) {
      if (opcode === 0x8) {
        socket.end();
        return;
      }
      if (opcode !== 0x1) continue;

      let message;
      try {
        message = JSON.parse(payload.toString());
      } catch {
        console.log(c.yellow(`      unparseable frame: ${payload.toString().slice(0, 120)}`));
        continue;
      }

      if (message.topic === "connection/heartbeat") continue;

      if (message.topic === "order/send") {
        const spec = reportOrder(message.payload);
        // The real backend reports dispatched orders back as info messages.
        sendMessage({
          kind: "info",
          board: "VCU",
          name: "Order sent",
          payload: `${spec ? spec.name : `Order ${message.payload?.id}`} dispatched`,
        });
      } else {
        console.log(c.dim(`      ${message.topic}`));
      }
    }
  });

  const close = () => {
    for (const t of timers) {
      clearInterval(t);
      clearTimeout(t);
    }
    console.log(c.yellow("      GUI disconnected"));
  };
  socket.on("close", close);
  socket.on("error", close);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(c.bold(`Mock backend on ws://127.0.0.1:${PORT}/backend`));
  console.log(
    c.dim(
      `messages: ${NO_BURST ? "no burst" : `${MESSAGE_VARIANTS.length}-variant burst`}` +
        `${INTERVAL > 0 ? ` then one every ${INTERVAL}ms` : ", stream off"}  |  state: ${VEHICLE_STATE}\n`,
    ),
  );
});

process.on("SIGINT", () => {
  const failed = receivedOrders.filter((o) => !o.ok).length;
  console.log(
    `\n${sentCount} message(s) sent, ${receivedOrders.length} order(s) received ` +
      `(${receivedOrders.length - failed} ok, ${failed} failed).`,
  );
  process.exit(failed > 0 ? 1 : 0);
});
