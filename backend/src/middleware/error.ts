import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("❌", err.message);
  const status = (err as any).status ?? 500;
  res.status(status).json({ error: err.message ?? "Internal server error" });
}

/** Helper: create an HTTP error with a status code */
export function httpError(message: string, status = 400): Error {
  const e: any = new Error(message);
  e.status = status;
  return e;
}
