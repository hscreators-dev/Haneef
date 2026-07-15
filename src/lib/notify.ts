import { Capacitor } from "@capacitor/core";

// ─── Device notifications (Android / iOS / web) ───────────────────────────────
// Real system-tray notifications — like the iOS Notification Centre — for
// order events: confirmed, payment received, shipped, delivered.
//
// Native (Android/iOS builds): uses @capacitor/local-notifications, loaded
// dynamically so the web build never depends on it. One-time setup on your
// machine (sandbox npm is blocked here):
//     npm install @capacitor/local-notifications
//     npx cap sync
// Until the plugin is installed, native quietly falls back to the in-app
// popups that already exist — nothing breaks.
//
// Web (browser dev / PWA): uses the standard Notification API.
//
// NOTE: these are LOCAL notifications fired when the app detects a change
// (Track polls every 30s), so they appear while the app is open or recently
// backgrounded. True remote push with the app fully killed needs FCM/APNs
// (Firebase project + Apple push key) — see the plan in the repo notes.

let localNotifications: {
  requestPermissions: () => Promise<{ display: string }>;
  schedule: (opts: { notifications: unknown[] }) => Promise<unknown>;
} | null = null;
let nativeTried = false;
let nextId = Math.floor(Date.now() / 1000) % 100000;

async function loadNativePlugin() {
  if (nativeTried) return;
  nativeTried = true;
  if (!Capacitor.isNativePlatform()) return;
  try {
    // Dynamic specifier so bundlers don't require the package at build time.
    const pkg = "@capacitor/local-notifications";
    const mod = await import(/* @vite-ignore */ pkg);
    localNotifications = mod.LocalNotifications;
  } catch {
    // Plugin not installed yet — fall back silently.
    localNotifications = null;
  }
}

/** Ask for notification permission. Call once after login / on Track mount. */
export async function initNotifications(): Promise<void> {
  await loadNativePlugin();
  try {
    if (localNotifications) {
      await localNotifications.requestPermissions();
    } else if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  } catch { /* permission prompts must never break the app */ }
}

// ── Notification sound ────────────────────────────────────────────────────────
// A short two-tone chime via WebAudio — no audio file needed, works everywhere.
// Browsers only allow sound after the user has interacted with the page once,
// so failures are swallowed silently (the visual notification still shows).
let _audioCtx: AudioContext | null = null;
export function playChime(): void {
  try {
    type WK = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctx = window.AudioContext || (window as WK).webkitAudioContext;
    if (!Ctx) return;
    if (!_audioCtx) _audioCtx = new Ctx();
    if (_audioCtx.state === "suspended") void _audioCtx.resume();
    const now = _audioCtx.currentTime;
    [[880, 0], [1174.66, 0.12]].forEach(([freq, delay]) => {
      const osc = _audioCtx!.createOscillator();
      const gain = _audioCtx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.18, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.35);
      osc.connect(gain).connect(_audioCtx!.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.4);
    });
  } catch { /* sound must never break the app */ }
}

/** Show a system notification (native tray on device, browser notification on web). */
export async function notifyDevice(title: string, body: string): Promise<void> {
  playChime();
  await loadNativePlugin();
  try {
    if (localNotifications) {
      await localNotifications.schedule({
        notifications: [{
          id: nextId++,
          title,
          body,
          schedule: { at: new Date(Date.now() + 250) },
          smallIcon: "ic_stat_icon_config_sample", // Android: falls back to app icon
          sound: undefined,
        }],
      });
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico", tag: `garm-${nextId++}` });
    }
  } catch { /* never break the app over a notification */ }
}
