// ── Pending-order queue + rich-summary store ─────────────────────────────────
// If the backend is unreachable (or the session expired) when an order is
// submitted, the payload is queued here and retried automatically from the
// Track tab — the order is never silently lost, and Track shows a visible
// "waiting to sync" notice until it lands in the admin portal.
//
// fl_order_summaries keeps the rich in-app display summary keyed by the
// server-assigned orderRef, so Track can show every configured detail
// alongside the live status.

import type { Order as ApiOrder } from "./api";
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
