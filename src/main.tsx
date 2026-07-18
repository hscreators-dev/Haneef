import React from "react";
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

// ─── App-level error boundary ─────────────────────────────────────────────────
// One unhandled render error must NEVER blank the whole app (the white/black
// dead screen). Show a friendly recovery screen instead, keep the error in
// localStorage so it can be inspected later, and let the customer tap once to
// reload.
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep the last crash around for diagnostics — without this we're
    // debugging white screens blind.
    try {
      localStorage.setItem(
        "fl_last_crash",
        JSON.stringify({
          message: error.message,
          stack: (error.stack || "").slice(0, 4000),
          componentStack: (info.componentStack || "").slice(0, 4000),
          at: new Date().toISOString(),
        }),
      );
    } catch { /* ignore */ }
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center",
        padding: "0 32px", fontFamily: "DM Sans, system-ui, sans-serif",
        background: "#F8F7F5", color: "#0D0D0D",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 18, background: "#F0EFED",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 16, fontSize: 26,
        }}>⚠️</div>
        <p style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Something went wrong</p>
        <p style={{ fontSize: 13, color: "#888580", lineHeight: 1.55, margin: "8px 0 0", maxWidth: 280 }}>
          Sorry — this screen hit an error. Your orders and account are safe.
          Tap below to reload the app.
        </p>
        <button
          onClick={() => { window.location.reload(); }}
          style={{
            marginTop: 20, background: "#0D0D0D", color: "#fff", border: "none",
            borderRadius: 20, padding: "13px 28px", fontSize: 14, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit",
          }}>
          Reload Garm
        </button>
      </div>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>,
);
