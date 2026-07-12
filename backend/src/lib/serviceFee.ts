// ─── Server-side service-fee recompute ────────────────────────────────────────
// The Garm App computes the order total + service fee on the client for display.
// Trusting those numbers blindly means a tampered/buggy client could submit any
// price (fee = 0, total = ₹1). This module recomputes the fee and total on the
// server from the submitted line items, using the SAME fee schedule the admin
// portal serves — so the payable amount is server-derived, not client-asserted.
//
// The fee schedule is fetched live from the admin backend (the source of truth
// the app already reads), cached briefly, and falls back to the seed defaults
// if the admin backend is unreachable — so order creation never hard-fails on a
// config blip.
//
// NOTE: line UNIT prices still originate from the client. Full price integrity
// (repricing each line from the catalog) needs the catalog in this backend and
// is a larger change; this closes the "arbitrary total/fee" gap today.

export interface FeeSchedule {
  b2cPercent: number;
  b2cPerPiece: number;
  b2bPercent: number;
  bulkQtyThreshold: number;
  bulkPercent: number;
  minFee: number;
}

const DEFAULT_FEE: FeeSchedule = {
  b2cPercent: 15, b2cPerPiece: 49, b2bPercent: 8, bulkQtyThreshold: 500, bulkPercent: 5, minFee: 99,
};

const ADMIN_BASE = process.env.ADMIN_API_URL ?? "http://localhost:5050/api/garm";
const TTL_MS = 60_000;
let cached: FeeSchedule = DEFAULT_FEE;
let cachedAt = 0;

export async function getFeeSchedule(): Promise<FeeSchedule> {
  if (Date.now() - cachedAt < TTL_MS) return cached;
  try {
    const r = await fetch(`${ADMIN_BASE}/order-config`);
    if (r.ok) {
      const d = (await r.json()) as { serviceFee?: Partial<FeeSchedule> };
      cached = { ...DEFAULT_FEE, ...(d.serviceFee ?? {}) };
      cachedAt = Date.now();
    }
  } catch {
    // Admin backend unreachable — keep the last good (or default) schedule.
    cachedAt = Date.now();
  }
  return cached;
}

/** Mirror of the app's calcServiceFee — must stay in sync with useOrderFormConfig.ts. */
export function computeServiceFee(base: number, qty: number, persona: "individual" | "organisation", fee: FeeSchedule): number {
  if (!base || base <= 0) return 0;
  if (persona === "individual") {
    const perPiece = (fee.b2cPerPiece ?? 0) * Math.max(1, qty);
    return Math.max(Math.round((base * fee.b2cPercent) / 100) + perPiece, fee.minFee);
  }
  const pct = qty >= fee.bulkQtyThreshold ? fee.bulkPercent : fee.b2bPercent;
  return Math.max(Math.round((base * pct) / 100), fee.minFee);
}

/** Subtotal of a line-item array (unit × qty). */
export function linesSubtotal(lines: { qty: number; unit: number }[] = []): number {
  return lines.reduce((s, l) => s + (Number(l.unit) || 0) * (Number(l.qty) || 0), 0);
}
