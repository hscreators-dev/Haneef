// ── Pending-order queue + rich-summary store ─────────────────────────────────
// If the backend is unreachable (or the session expired) when an order is
// submitted, the payload is queued here and retried automatically from the
// Track tab — the order is never silently lost, and Track shows a visible
// "waiting to sync" notice until it lands in the admin portal.
//
// fl_order_summaries keeps the rich in-app display summary keyed by the
// server-assigned orderRef, so Track can show every configured detail
// alongside the live status.

import { orders as ordersApi, token as authToken, type Order as ApiOrder } from "./api";
import type { SubmittedOrderSummary } from "../app/components/NewOrderTab";

export interface PendingOrder {
  payload: Partial<ApiOrder>;
  summary: SubmittedOrderSummary;
  queuedAt: number;
}

const PENDING_KEY = "fl_pending_orders";
const SUMMARIES_KEY = "fl_order_summaries";

export function readPendingOrders(): PendingOrder[] {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); } catch { return []; }
}

export function writePendingOrders(list: PendingOrder[]) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export function rememberOrderSummary(orderRef: string, summary: SubmittedOrderSummary) {
  try {
    const map = JSON.parse(localStorage.getItem(SUMMARIES_KEY) || "{}");
    map[orderRef] = summary;
    localStorage.setItem(SUMMARIES_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

export function readOrderSummaries(): Record<string, SubmittedOrderSummary> {
  try { return JSON.parse(localStorage.getItem(SUMMARIES_KEY) || "{}"); } catch { return {}; }
}

// ── Shared pending-order flush ───────────────────────────────────────────────
// Retries every queued order against the backend and returns how many are still
// unsynced. A module-level lock means concurrent callers (the Track tab AND the
// app-level poller) can't double-submit the same queued order. Previously the
// flush lived only inside the Track tab, so an order queued at submit (e.g. the
// backend was cold/waking on Render's free tier) didn't reach the admin portal
// until the customer happened to open Track — this makes it sync from anywhere.
let flushing: Promise<number> | null = null;

export async function flushPendingOrders(): Promise<number> {
  if (flushing) return flushing;
  if (!authToken.get()) return readPendingOrders().length; // not signed in — nothing to do
  flushing = (async () => {
    const queue = readPendingOrders();
    if (queue.length === 0) return 0;
    const remaining: PendingOrder[] = [];
    for (const item of queue) {
      try {
        const { order } = await ordersApi.create(item.payload);
        if (order.orderRef) rememberOrderSummary(order.orderRef, item.summary);
      } catch {
        remaining.push(item); // still unreachable — keep it for the next attempt
      }
    }
    writePendingOrders(remaining);
    return remaining.length;
  })();
  try { return await flushing; }
  finally { flushing = null; }
}

// Submit an order with retry/backoff so it lands at SUBMIT time even if the
// backend is briefly cold/slow/mid-deploy. Returns the created order's ref on
// success; on repeated failure the caller should queue it (Track + the app
// poller will keep retrying). `attempts` spans ~1+2+3+4 = 10s of backoff, and
// each attempt also waits out a cold-start response.
export async function createOrderWithRetry(
  payload: Partial<ApiOrder>, attempts = 5,
): Promise<ApiOrder | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const { order } = await ordersApi.create(payload);
      return order;
    } catch {
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  return null;
}
