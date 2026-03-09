import { app, BrowserWindow, session } from "electron";
import path from "node:path";
import { registerIpcHandlers } from "./ipc/handlers.js";
import { resolveRuntimeAssets, AssetResolutionError } from "./runtime/asset-resolver.js";
import { runDataRetentionCleanup } from "./persistence/data-retention.js";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    show: false,
    titleBarStyle: "hiddenInset",
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  // Block all navigation away from the app
  mainWindow.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });

  // Block new windows
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  // Load renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  // CSP headers
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          process.env.ELECTRON_RENDERER_URL
            ? "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: http://localhost:*; font-src 'self'; object-src 'none'; base-uri 'self'"
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'self'",
        ],
      },
    });
  });

  // Verify runtime assets are available at startup
  try {
    const assets = resolveRuntimeAssets();
    console.log(`Runtime assets resolved: packaged=${assets.packaged}, version=${assets.sourceDistVersion}`);
  } catch (err) {
    if (err instanceof AssetResolutionError) {
      console.error(`Runtime asset resolution failed: ${err.message} (path: ${err.affectedPath})`);
    } else {
      console.error('Runtime asset resolution failed:', err);
    }
  }

  // Run data retention cleanup on startup
  try {
    const cleanup = runDataRetentionCleanup();
    if (cleanup.removedCount > 0) {
      console.log(`Data retention: removed ${cleanup.removedCount} items (reason: ${cleanup.reason})`);
    }
  } catch (err) {
    console.error('Data retention cleanup failed:', err);
  }

  registerIpcHandlers();
  createWindow();

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

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
