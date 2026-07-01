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

// ─── App ──────────────────────────────────────────────────────────────────────

const app  = express();
const PORT = process.env.PORT ?? 4000;

// ─── Security & parsing middleware ────────────────────────────────────────────

app.use(helmet());
app.use(cors({
  origin:      process.env.FRONTEND_URL ?? "http://localhost:5173",
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
// Try-on selfies are larger than normal payloads — parse them with a higher limit
// before the global 1mb parser runs.
app.use("/api/tryon", express.json({ limit: "12mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate limiting ────────────────────────────────────────────────────────────

// Strict limit on OTP endpoints to prevent abuse
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: "Too many OTP requests — please wait 15 minutes before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 120,
  message: { error: "Too many requests." },
});

app.use("/api/auth/send-otp",    otpLimiter);
app.use("/api/auth/verify-otp",  otpLimiter);
app.use("/api",                  apiLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api/auth",    authRouter);
app.use("/api/orders",  ordersRouter);
app.use("/api/account", accountRouter);
app.use("/api/quotes",  quotesRouter);
app.use("/api/track",   trackRouter);
app.use("/api/tryon",   tryonRouter);

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

start();
