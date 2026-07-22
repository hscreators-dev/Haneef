import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("❌", err.message);

  // Every route validates its body with `Schema.parse()` (zod), which throws a
  // ZodError — it has no `.status`, so without this check it fell through to
  // the generic 500 below and every validation failure across the whole API
  // (auth, orders, account, quotes, support) was reported as a server error
  // instead of the correct 400. Build a readable "field: message" summary
  // rather than exposing the raw issues array, so `error` stays a plain
  // string like every other error response in this API.
  if (err instanceof ZodError) {
    const message = err.issues
      .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
      .join("; ");
    res.status(400).json({ error: message });
    return;
  }

  const status = (err as any).status ?? 500;
  res.status(status).json({ error: err.message ?? "Internal server error" });
}

/** Helper: create an HTTP error with a status code */
export function httpError(message: string, status = 400): Error {
  const e: any = new Error(message);
  e.status = status;
  return e;
}
