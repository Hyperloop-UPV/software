import { expect, test } from "../../fixtures/electron";

type TestConfig = {
  vehicle: { boards: string[] };
  server: Record<
    string,
    {
      address: string;
      endpoints: { pod_data: string; order_data: string; connections: string };
    }
  >;
};
type Bridge = {
  getConfig(): Promise<TestConfig>;
  getCurrentView(): Promise<string>;
  getAppVersion(): Promise<string>;
};

test("renderer IPC reads the current view, version and actual configuration", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const api = (window as unknown as { electronAPI: Bridge }).electronAPI;
    return {
      config: await api.getConfig(),
      view: await api.getCurrentView(),
      version: await api.getAppVersion(),
    };
  });
  expect(result.view).toBe("testing-view");
  expect(result.version).toMatch(/^\d+\.\d+\.\d+/);
  expect(result.config.vehicle.boards.length).toBeGreaterThan(0);
  expect(result.config.server["control-station"].address).toBeTruthy();
});

test("the real backend serves telemetry and command catalogs to the renderer", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const config = await (
      window as unknown as { electronAPI: Bridge }
    ).electronAPI.getConfig();
    const server = config.server["control-station"];
    const base = `http://${server.address}/backend`;
    const endpoints = [server.endpoints.pod_data, server.endpoints.order_data];
    const catalogs = await Promise.all(
      endpoints.map(async (endpoint) => {
        const response = await fetch(`${base}${endpoint}`);
        if (!response.ok)
          throw new Error(`Catalog ${endpoint}: HTTP ${response.status}`);
        return response.json() as Promise<{
          boards: { name: string; packets?: unknown[]; orders?: unknown[] }[];
        }>;
      }),
    );
    return {
      configured: config.vehicle.boards,
      telemetry: catalogs[0].boards,
      commands: catalogs[1].boards,
    };
  });
  expect(result.telemetry.length).toBeGreaterThan(0);
  expect(result.commands.length).toBeGreaterThan(0);
  // Catalogs describe the full ADJ, not only the boards enabled in vehicle.boards.
  for (const board of [...result.telemetry, ...result.commands]) {
    expect(typeof board.name).toBe("string");
    expect(board.name.length).toBeGreaterThan(0);
  }
  for (const configured of result.configured) {
    expect(result.telemetry.map((board) => board.name)).toContain(configured);
    expect(result.commands.map((board) => board.name)).toContain(configured);
  }
  expect(
    result.telemetry.some((board) => (board.packets?.length ?? 0) > 0),
  ).toBe(true);
  expect(result.commands.some((board) => (board.orders?.length ?? 0) > 0)).toBe(
    true,
  );
  await expect(page.getByTestId("mode-badge")).toHaveAttribute(
    "data-mode",
    "active",
  );
});

test("the renderer can subscribe to connection state over a real backend WebSocket", async ({
  page,
}) => {
  // Read-only subscription: no vehicle commands, network mocks or backend changes.
  const message = await page.evaluate(async () => {
    const config = await (
      window as unknown as { electronAPI: Bridge }
    ).electronAPI.getConfig();
    const server = config.server["control-station"];
    return new Promise<{
      topic: string;
      payload: Record<string, { name: string; isConnected: boolean }>;
    }>((resolve, reject) => {
      const socket = new WebSocket(
        `ws://${server.address}${server.endpoints.connections}`,
      );
      const timer = setTimeout(
        () => finish(new Error("Timed out waiting for connection state")),
        8000,
      );
      let finished = false;
      function finish(
        error?: Error,
        data?: {
          topic: string;
          payload: Record<string, { name: string; isConnected: boolean }>;
        },
      ) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        socket.close();
        if (error) reject(error);
        else resolve(data!);
      }
      socket.onopen = () =>
        socket.send(
          JSON.stringify({
            topic: "connection/update",
            payload: { subscribe: true },
          }),
        );
      socket.onmessage = (event) => {
        try {
          finish(undefined, JSON.parse(event.data));
        } catch {
          finish(new Error("Invalid backend WebSocket JSON"));
        }
      };
      socket.onerror = () => finish(new Error("Backend WebSocket failed"));
      socket.onclose = () =>
        finish(new Error("Backend WebSocket closed before a response"));
    });
  });
  expect(message.topic).toBe("connection/update");
  expect(message.payload).not.toBeNull();
  expect(Array.isArray(message.payload)).toBe(false);
  for (const connection of Object.values(message.payload)) {
    expect(typeof connection.name).toBe("string");
    expect(typeof connection.isConnected).toBe("boolean");
  }
});
