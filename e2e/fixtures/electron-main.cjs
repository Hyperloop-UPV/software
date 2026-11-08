// Test-only bootstrap: production startup and Go remain unchanged.
const { app } = require("electron");
const path = require("node:path");

const profile = process.env.CONTROL_STATION_E2E_PROFILE;
if (!profile || !path.isAbsolute(profile)) {
  throw new Error("E2E requires an absolute temporary profile path");
}
app.setPath("userData", profile);

import("../../electron-app/main.js").catch((error) => {
  console.error("E2E application startup failed:", error);
  app.exit(1);
});
