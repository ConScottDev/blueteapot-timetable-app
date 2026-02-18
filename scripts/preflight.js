const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`OK: ${message}`);
}

const repoRoot = process.cwd();
const packageJsonPath = path.join(repoRoot, "package.json");

if (!exists(packageJsonPath)) {
  fail("package.json not found.");
  process.exit(1);
}

const pkg = readJson(packageJsonPath);
const nodeMajor = Number((process.versions.node || "0").split(".")[0]);
if (nodeMajor >= 20) {
  pass(`Node version ${process.version}`);
} else {
  fail(`Node version ${process.version} is below 20.`);
}

const macConfig = (pkg.build && pkg.build.mac) || {};
if (macConfig.hardenedRuntime === true) {
  pass("electron-builder mac.hardenedRuntime is true");
} else {
  fail("electron-builder mac.hardenedRuntime is not true");
}

const entitlements = macConfig.entitlements;
const entitlementsInherit = macConfig.entitlementsInherit;
if (entitlements && entitlementsInherit) {
  pass("electron-builder mac entitlements are configured");
} else {
  fail("electron-builder mac entitlements are missing");
}

const capConfigJson = path.join(repoRoot, "capacitor.config.json");
const capConfigTs = path.join(repoRoot, "capacitor.config.ts");
if (exists(capConfigJson)) {
  const capConfig = readJson(capConfigJson);
  if (capConfig.webDir === "build") {
    pass("capacitor.config.json webDir is build");
  } else {
    fail("capacitor.config.json webDir is not build");
  }
} else if (exists(capConfigTs)) {
  const capConfigText = fs.readFileSync(capConfigTs, "utf8");
  if (/webDir\s*:\s*["']build["']/.test(capConfigText)) {
    pass("capacitor.config.ts webDir appears to be build");
  } else {
    fail("capacitor.config.ts webDir does not appear to be build");
  }
} else {
  fail("No capacitor.config.json or capacitor.config.ts found");
}

const deps = pkg.dependencies || {};
const devDeps = pkg.devDependencies || {};
const pushInDeps = Object.prototype.hasOwnProperty.call(deps, "@capacitor/push-notifications");
const pushInDevDeps = Object.prototype.hasOwnProperty.call(devDeps, "@capacitor/push-notifications");
if (pushInDeps && pushInDevDeps) {
  fail("@capacitor/push-notifications is duplicated in dependencies and devDependencies");
} else {
  pass("@capacitor/push-notifications has no duplicate entry");
}

if (process.exitCode === 1) {
  console.error("Preflight checks failed.");
} else {
  console.log("Preflight checks passed.");
}
