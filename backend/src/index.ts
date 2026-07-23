import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { connectDB }   from "./config/db";
import { errorHandler } from "./middleware/error";

import authRouter    from "./routes/auth";
import ordersRouter  from "./routes/orders";
import accountRouter from "./routes/account";
import quotesRouter  from "./routes/quotes";
import trackRouter   from "./routes/track";
import tryonRouter   from "./routes/tryon";
import supportRouter from "./routes/support";

// ─── App ──────────────────────────────────────────────────────────────────────

const app  = express();
const PORT = process.env.PORT ?? 4000;

// ─── Security & parsing middleware ────────────────────────────────────────────

// FRONTEND_URL may be a SINGLE url or a COMMA-SEPARATED list — so the app can be
// served from more than one web address (e.g. the Render site AND a GitHub Pages
// link, or a custom domain) without any of them being CORS-blocked. A blocked
// origin was one of the ways a second URL failed to reach this backend and fell
// back to a phantom local account, so every real front-end origin must be listed
// here (Render dashboard → garm-app-backend → Environment → FRONTEND_URL).
const frontendOrigins = (process.env.FRONTEND_URL ?? "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = [
  ...frontendOrigins,
  // Capacitor's native WebView origins for the Android/iOS app builds
  "capacitor://localhost",
  "https://localhost",
];

app.use(helmet());
app.use(cors({
  origin:      allowedOrigins,
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
// Try-on selfies are larger than normal payloads — parse them with a higher limit
// before the global 1mb parser runs. Orders can carry design/logo reference
// uploads (base64), so they get a higher limit too.
app.use("/api/tryon", express.json({ limit: "12mb" }));
app.use("/api/orders", express.json({ limit: "25mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate limiting ────────────────────────────────────────────────────────────

// Strict limit on OTP endpoints to prevent abuse. Relaxed outside production so local
// dev/testing (repeated resends, wrong-code retries) doesn't get locked out for 15
// minutes at a time — the real limit still applies wherever this actually matters.
// Sending codes is the expensive/abusable action — keep it capped, but not so
// tight that a couple of legit resends lock a real user out. 10 sends / 15 min.
const sendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 10 : 100,
  message: { error: "Too many code requests — please wait a few minutes before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Verifying is cheap and a user may fat-finger the code several times; sharing
// the send limit meant wrong-code retries burned the send budget and locked
// people out. Give verify its own, roomier budget.
const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 30 : 200,
  message: { error: "Too many attempts — please wait a few minutes before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 120,
  message: { error: "Too many requests." },
});

app.use("/api/auth/send-otp",    sendOtpLimiter);
app.use("/api/auth/verify-otp",  verifyOtpLimiter);
app.use("/api",                  apiLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api/auth",    authRouter);
app.use("/api/orders",  ordersRouter);
app.use("/api/account", accountRouter);
app.use("/api/quotes",  quotesRouter);
app.use("/api/track",   trackRouter);
app.use("/api/tryon",   tryonRouter);
app.use("/api/support", supportRouter);

// ─── Health check ─────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`\n🚀 Garm API running at http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health\n`);
  });
}

// ─── Keep-warm (Render free tier) ─────────────────────────────────────────────
// A free Render web service sleeps after ~15 min without inbound traffic, so the
// first request after idle is slow (and used to make orders/logins look broken
// until the server woke). Ping our own /health every 10 min so the service never
// idles. RENDER_EXTERNAL_URL is injected automatically by Render; skipped locally.
const selfUrl = process.env.RENDER_EXTERNAL_URL;
if (selfUrl && process.env.NODE_ENV === "production") {
  setInterval(() => {
    fetch(`${selfUrl.replace(/\/$/, "")}/health`).catch(() => {});
  }, 10 * 60 * 1000).unref?.();
  console.log(`   Keep-warm self-ping enabled → ${selfUrl}/health every 10 min`);
}

start();
