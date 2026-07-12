import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
}

// ─── JWT secret strength gate ─────────────────────────────────────────────────
// Tokens are only as safe as the signing secret. A missing/short/placeholder
// secret means anyone can forge a session for any user. We refuse to run in
// production without a strong (>= 32 char, non-placeholder) secret, and warn
// loudly in dev. Fail fast at startup rather than silently issuing forgeable
// tokens.
function assertJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const weak = !secret
    || secret.length < 32
    || /^(changeme|secret|dev|test|your[-_]?secret|jwt[-_]?secret)$/i.test(secret);
  if (weak) {
    const msg = "JWT_SECRET is missing or weak — set a random 32+ character secret (e.g. `openssl rand -base64 48`).";
    if (process.env.NODE_ENV === "production") {
      // Crash on boot in production — never serve forgeable tokens.
      throw new Error(`[FATAL] ${msg}`);
    }
    console.warn(`[security] ${msg} (allowed in dev only)`);
  }
  return secret ?? "dev-insecure-secret-change-me";
}
const JWT_SECRET = assertJwtSecret();

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function signToken(userId: string): string {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? "30d" } as jwt.SignOptions
  );
}
