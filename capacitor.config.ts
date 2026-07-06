import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.sgpisp",
  appName: "SGP-ISP",
  webDir: ".output/public",
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1e3a8a",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1e3a8a",
    },
  },
};

export default config;
