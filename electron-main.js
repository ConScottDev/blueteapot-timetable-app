// electron-main.js
const { app, BrowserWindow } = require("electron");
const path = require("path");
const isDev = process.env.NODE_ENV === "development";
const { autoUpdater } = require("electron-updater");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Adjust if you’re using preload scripts; this is the "simple" mode
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    // Point this to your dev server URL
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    // Load the React build output
    mainWindow.loadFile(path.join(__dirname, "build", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function setupAutoUpdater() {
  if (isDev) return; // don’t check for updates in dev

  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on("checking-for-update", () => {
    console.log("Checking for update...");
  });

  autoUpdater.on("update-available", (info) => {
    console.log("Update available:", info.version);
  });

  autoUpdater.on("update-not-available", () => {
    console.log("No update available.");
  });

  autoUpdater.on("error", (err) => {
    console.error("Error in auto-updater:", err);
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log("Update downloaded:", info.version);
    // You can call autoUpdater.quitAndInstall() here or show a dialog.
  });
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // Close app on Windows/Linux, keep open on macOS
  if (process.platform !== "darwin") {
    app.quit();
  }
});
