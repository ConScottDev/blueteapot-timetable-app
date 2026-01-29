// electron-main.js
const { app, BrowserWindow } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

// Use Electron's own flag to detect dev vs prod
const isDev = !app.isPackaged;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const devURL = "http://127.0.0.1:3000";
  const prodPath = path.join(__dirname, "build", "index.html");

  if (isDev) {
    console.log("Electron starting in DEV, loading:", devURL);
    mainWindow.loadURL(devURL);
    mainWindow.webContents.openDevTools();
  } else {
    console.log("Electron starting in PROD, loading:", prodPath);
    mainWindow.loadFile(prodPath);
  }

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("Electron: did-finish-load");
  });

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    console.error("Electron: did-fail-load", {
      errorCode,
      errorDescription,
      validatedURL,
    });
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function initAutoUpdater() {
  if (isDev) {
    console.log("Auto-updater: skipping in development");
    return;
  }

  // Log to a file so you can debug update issues on user machines
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = "info";

  log.info("Auto-updater: app version", app.getVersion());

  autoUpdater.on("checking-for-update", () => {
    log.info("Checking for update...");
  });

  autoUpdater.on("update-available", (info) => {
    log.info("Update available:", info.version);
  });

  autoUpdater.on("update-not-available", (info) => {
    log.info("No update available.");
  });

  autoUpdater.on("error", (err) => {
    log.error("Error in auto-updater:", err);
  });

  autoUpdater.on("download-progress", (progressObj) => {
    log.info(
      `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent.toFixed(
        1
      )}% (${progressObj.transferred}/${progressObj.total})`
    );
  });

  autoUpdater.on("update-downloaded", (info) => {
    log.info("Update downloaded:", info.version);
    // Automatically quit and install on next restart:
    autoUpdater.quitAndInstall();
    // If you want a prompt instead, you can:
    // dialog.showMessageBox(...).then(() => autoUpdater.quitAndInstall());
  });

setTimeout(() => {
  autoUpdater.checkForUpdatesAndNotify();
}, 3000);

}

app.whenReady().then(() => {
  console.log("App ready, isDev =", isDev);
  createWindow();
  initAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
