import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ie.blueteapot.schedule",
  appName: "Blue Teapot",
  webDir: "build",
  server: {
    // Use https://localhost origin to satisfy Firebase/Auth + Google scripts in WKWebView.
    iosScheme: "https",
    hostname: "localhost",
  },
};

export default config;
