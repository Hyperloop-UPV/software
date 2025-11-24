const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let backendProcess = null;
let packetSenderProcess = null;
let mainWindow = null;
let currentView = "ethernet-view";

function getBinaryPath(name) {
  const platform = process.platform;
  const arch = process.arch;
  const ext = platform === "win32" ? ".exe" : "";

  // Map Node.js platform names to Go GOOS names
  const goosMap = {
    win32: "windows",
    darwin: "darwin",
    linux: "linux",
  };

  // Map Node.js arch names to Go GOARCH names
  const goarchMap = {
    x64: "amd64",
    arm64: "arm64",
  };

  const goos = goosMap[platform] || platform;
  const goarch = goarchMap[arch] || arch;

  // In development
  if (!app.isPackaged) {
    return path.join(__dirname, "binaries", `${name}-${goos}-${goarch}${ext}`);
  }

  // In production (packaged)
  return path.join(
    process.resourcesPath,
    "binaries",
    `${name}-${goos}-${goarch}${ext}`
  );
}

function getConfigPath() {
  if (!app.isPackaged) {
    // Development: use dev-config.toml directly
    return path.join(__dirname, "..", "backend", "cmd", "dev-config.toml");
  }

  // Production: use user config directory (writable, cross-platform)
  const userConfigDir = app.getPath("userData"); // Returns platform-specific path
  const configsDir = path.join(userConfigDir, "configs");
  const configPath = path.join(configsDir, "config.toml");

  console.log("Config path exists:", fs.existsSync(configPath));

  // If config doesn't exist, copy from resources (first run)
  if (!fs.existsSync(configPath)) {
    const defaultConfigPath = path.join(process.resourcesPath, "config.toml");
    if (fs.existsSync(defaultConfigPath)) {
      // Ensure user config directory exists (works on all platforms)
      fs.mkdirSync(configsDir, { recursive: true });
      // Copy default config to user config directory
      fs.copyFileSync(defaultConfigPath, configPath);
      console.log(`Created config file at: ${configPath}`);
    }
  }

  return configPath;
}

function startBackend() {
  const backendBin = getBinaryPath("backend");
  const configPath = getConfigPath();

  if (!fs.existsSync(backendBin)) {
    console.error(`Backend binary not found: ${backendBin}`);
    dialog.showErrorBox("Error", `Backend binary not found at: ${backendBin}`);
    return;
  }

  console.log(`Starting backend: ${backendBin}, config: ${configPath}}`);

  // Set working directory to backend/cmd in development, or resources in production
  const workingDir = !app.isPackaged
    ? path.join(__dirname, "..", "backend", "cmd")
    : path.dirname(configPath);

  backendProcess = spawn(backendBin, ["--config", configPath], {
    cwd: workingDir,
  });

  backendProcess.stdout.on("data", (data) => {
    console.log(`[Backend] ${data.toString().trim()}`);
  });

  // backendProcess.stderr.on("data", (data) => {
  //   console.error(`[Backend Error] ${data.toString().trim()}`);
  // });

  backendProcess.on("error", (error) => {
    console.error(`Failed to start backend: ${error.message}`);
    dialog.showErrorBox(
      "Backend Error",
      `Failed to start backend: ${error.message}`
    );
  });

  backendProcess.on("close", (code) => {
    console.log(`Backend process exited with code ${code}`);
    if (code !== 0 && code !== null) {
      dialog.showErrorBox(
        "Backend Crashed",
        `Backend exited with code ${code}`
      );
    }
  });
}

function startPacketSender(args = []) {
  const packetSenderBin = getBinaryPath("packet-sender");

  if (!fs.existsSync(packetSenderBin)) {
    console.error(`Packet sender binary not found: ${packetSenderBin}`);
    return null;
  }

  console.log(`Starting packet sender: ${packetSenderBin} ${args.join(" ")}`);

  const process = spawn(packetSenderBin, args);

  process.stdout.on("data", (data) => {
    console.log(`[Packet Sender] ${data.toString().trim()}`);
  });

  process.stderr.on("data", (data) => {
    console.error(`[Packet Sender Error] ${data.toString().trim()}`);
  });

  return process;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "Hyperloop Control Station",
    backgroundColor: "#1a1a1a",
  });

  // Load ethernet view by default
  loadView("ethernet-view");

  // Create menu
  createMenu();

  // Open DevTools in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function loadView(view) {
  currentView = view;
  const viewPath = path.join(__dirname, "renderer", view, "index.html");

  if (fs.existsSync(viewPath)) {
    mainWindow.loadFile(viewPath);
    mainWindow.setTitle(
      `Hyperloop Control Station - ${
        view === "control-station" ? "Competition View" : "Testing View"
      }`
    );
  } else {
    console.error(`View not found: ${viewPath}`);
    dialog.showErrorBox("Error", `View not found: ${view}`);
  }
}

function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => mainWindow.reload(),
        },
        { type: "separator" },
        {
          label: "Exit",
          accelerator: "CmdOrCtrl+Q",
          click: () => app.quit(),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Control Station",
          accelerator: "CmdOrCtrl+1",
          click: () => loadView("control-station"),
        },
        {
          label: "Ethernet View",
          accelerator: "CmdOrCtrl+2",
          click: () => loadView("ethernet-view"),
        },
        { type: "separator" },
        {
          label: "Toggle DevTools",
          accelerator: "F12",
          click: () => mainWindow.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: "Tools",
      submenu: [
        {
          label: "Start Packet Sender",
          click: () => {
            const packetSenderBin = getBinaryPath("packet-sender");
            if (!fs.existsSync(packetSenderBin)) {
              dialog.showMessageBox(mainWindow, {
                type: "warning",
                title: "Packet Sender Not Available",
                message: "Packet sender binary not found",
                detail: "This optional tool was not included in the build.",
              });
              return;
            }
            if (!packetSenderProcess || packetSenderProcess.killed) {
              packetSenderProcess = startPacketSender(["--help"]);
            }
          },
        },
        {
          label: "Stop Packet Sender",
          click: () => {
            if (packetSenderProcess && !packetSenderProcess.killed) {
              packetSenderProcess.kill();
            }
          },
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About",
              message: "Hyperloop UPV Control Station",
              detail:
                "Version 1.0.0\n\nControl and monitoring software for Hyperloop pod.",
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers
ipcMain.handle("get-current-view", () => currentView);
ipcMain.handle("switch-view", (event, view) => {
  loadView(view);
  return view;
});

// App lifecycle
app.whenReady().then(() => {
  // Wait a bit for backend to start before opening window
  startBackend();
  setTimeout(() => {
    createWindow();
  }, 2000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  console.log("Shutting down processes...");

  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill("SIGTERM");
  }

  if (packetSenderProcess && !packetSenderProcess.killed) {
    packetSenderProcess.kill("SIGTERM");
  }
});

// Handle crashes
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  dialog.showErrorBox("Error", error.message);
});
