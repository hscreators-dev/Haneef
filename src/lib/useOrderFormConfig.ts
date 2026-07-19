import { useEffect, useState } from "react";
import { orderConfig, type OrderFormConfig, type ServiceFeeConfig, type HomeContentConfig } from "./api";

// Which sections of the custom order flow are shown + the service-fee
// schedule — both controlled live from the Garm Admin Portal (Settings →
// Order Form). Fails OPEN: until the admin config loads (or if the backend is
// unreachable), every section shows and the default fee schedule applies.
const ALL_ON: OrderFormConfig = {
  style: true, materials: true, sizes: true, referenceUpload: true, livePreview: true,
};
// Mirrors the admin portal's default schedule — standard profitable margins
// for made-to-order work (only used until the live config loads).
const DEFAULT_FEE: ServiceFeeConfig = {
  b2cPercent: 15, b2cPerPiece: 49, b2bPercent: 8, bulkQtyThreshold: 500, bulkPercent: 5, minFee: 99,
  surplusDiscountPercent: 15, orgAdvancePercent: 30,
};

export type OrderFormSettings = OrderFormConfig & { fee: ServiceFeeConfig; features: Record<string, boolean>; homeContent?: HomeContentConfig | null };

// ₹ service fee for an order. Individuals: % of value PLUS ₹/piece — every
// piece carries its own handling/production-setup cost, so a 3 pc order pays
// more than 1 pc. Organisations: % only (volume absorbs the fixed cost), with
// a lower slab for bulk. The ₹ floor keeps single-piece orders viable.
// Used identically by the app's price panels and the order payload.
export function calcServiceFee(base: number, qty: number, audience: "B2C" | "B2B", fee: ServiceFeeConfig): number {
  if (!base || base <= 0) return 0;
  if (audience === "B2C") {
    const perPiece = (fee.b2cPerPiece ?? 0) * Math.max(1, qty);
    return Math.max(Math.round((base * fee.b2cPercent) / 100) + perPiece, fee.minFee);
  }
  const pct = qty >= fee.bulkQtyThreshold ? fee.bulkPercent : fee.b2bPercent;
  return Math.max(Math.round((base * pct) / 100), fee.minFee);
}

// Module-level cache — several components in the (large) order flow call this
// hook; they share one cached value. Unlike a permanent cache, it's refreshed
// on a TTL so admin changes to fees / order-form sections / coordinator take
// effect for a live app session (previously they needed a full reload).
let cached: OrderFormSettings | null = null;
let cachedAt = 0;
let inflight: Promise<OrderFormSettings> | null = null;
const CONFIG_TTL_MS = 45000; // revalidate at most this often
// Fails open: every feature defaults ON until the admin config says otherwise.
const DEFAULT_FEATURES: Record<string, boolean> = {
  b2c_orders: true, b2b_orders: true, qc_workflow: true,
};
const FALLBACK: OrderFormSettings = { ...ALL_ON, fee: DEFAULT_FEE, features: DEFAULT_FEATURES };

function fetchConfig(): Promise<OrderFormSettings> {
  if (inflight) return inflight;
  inflight = orderConfig.get().then((d) => {
    cached = {
      ...ALL_ON, ...d.orderForm,
      fee: { ...DEFAULT_FEE, ...(d.serviceFee ?? {}) },
      features: { ...DEFAULT_FEATURES, ...(d.features ?? {}) },
      homeContent: d.homeContent ?? null,
    };
    cachedAt = Date.now();
    inflight = null;
    return cached;
  }).catch(() => { inflight = null; return cached ?? FALLBACK; });
  return inflight;
}

// Is a given customer type allowed to order right now? Controlled by the admin
// Feature Toggles (B2C Orders / B2B Orders). Fails open (true) until config loads.
export function isOrderingEnabled(audience: "individual" | "organisation"): boolean {
  const f = (cached ?? FALLBACK).features;
  return audience === "organisation" ? f.b2b_orders !== false : f.b2c_orders !== false;
}

// Surplus (mill leftover) fabric discount — % off the garment rate, set in the
// admin portal (Settings → Order Form → Service Fee). Module getter so the
// order flow's PURE pricing functions can read it; defaults apply until the
// live config loads (fails open, like everything else here).
export function surplusDiscountPct(): number {
  const v = (cached ?? FALLBACK).fee.surplusDiscountPercent;
  return typeof v === "number" && v >= 0 && v <= 90 ? v : DEFAULT_FEE.surplusDiscountPercent!;
}

// % advance organisations pay before production (balance due after QC). Set in
// the admin portal (Settings → Order Form → Service Fee). Defaults to 30 until
// the live config loads (fails open).
export function orgAdvancePct(): number {
  const v = (cached ?? FALLBACK).fee.orgAdvancePercent;
  return typeof v === "number" && v >= 1 && v <= 99 ? v : DEFAULT_FEE.orgAdvancePercent!;
}

export function useOrderFormConfig(): OrderFormSettings {
  const [cfg, setCfg] = useState<OrderFormSettings>(cached ?? FALLBACK);

  useEffect(() => {
    let alive = true;
    const revalidate = () => {
      if (cached && Date.now() - cachedAt < CONFIG_TTL_MS) { setCfg(cached); return; }
      fetchConfig().then((c) => { if (alive) setCfg(c); });
    };
    revalidate();
    // Poll so fee / order-form / coordinator changes in the admin portal reach
    // a live app session. Fails open — a failed fetch keeps the last good config.
    const t = setInterval(revalidate, CONFIG_TTL_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return cfg;
}
