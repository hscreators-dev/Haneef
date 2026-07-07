
  import { createRoot } from "react-dom/client";
  import { Capacitor } from "@capacitor/core";
  import { StatusBar, Style } from "@capacitor/status-bar";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  // On native iOS/Android, keep the status bar from drawing over the WebView —
  // relying on CSS env(safe-area-inset-*) alone isn't reliable for this — and
  // match its color to the app's background instead of the OS default black bar.
  if (Capacitor.isNativePlatform()) {
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    StatusBar.setBackgroundColor({ color: "#F8F7F5" }).catch(() => {});
    StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  }

  createRoot(document.getElementById("root")!).render(<App />);
