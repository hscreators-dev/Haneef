import { orders as ordersApi, support as supportApi, type Order } from "./api";

// ─── Notification centre — one source of truth ────────────────────────────────
// Derives the in-app notification list from the user's REAL orders (no mock
// data) and tracks read state in localStorage. Used by NotificationsScreen
// (the full list) AND App's bell badge (live unread count). Fails open: any
// fetch/storage error just means an empty list — never a crash.

export type NType = "placed" | "quote" | "confirmed" | "payment" | "production" | "quality" | "shipping" | "delivered" | "support";

export interface Notif {
  key: string;       // stable identity — read state is stored against this
  type: NType;
  title: string;
  body: string;
  at: number;        // epoch ms (0 = unknown)
  orderId?: string;  // "#FL-2047" — tap to open in Track
  ticketId?: string; // support ticket _id — tap to open the ticket thread
}

const READ_KEY = "fl_notif_read_v1";
export function readSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]")); } catch { return new Set(); }
}
export function saveReadSet(set: Set<string>) {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...set].slice(-500))); } catch { /* full/blocked storage never breaks the app */ }
}

function ts(v?: string): number { const t = v ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : 0; }
function inr(n: number): string { return `₹${Math.round(n).toLocaleString("en-IN")}`; }

function orderSummary(o: Order): string {
  if (o.isAccessoryOrder && o.accessoryItems?.length) {
    const first = o.accessoryItems[0];
    const more = o.accessoryItems.length - 1;
    return `${first.itemName}${more > 0 ? ` +${more} more` : ""} · ${o.qty} pcs`;
  }
  return `${o.garmentType || "Custom garments"} · ${o.qty} pcs`;
}

const STATUS_RANK: Record<string, number> = {
  "Order placed": 1, "Quote pending": 1, "Order confirmed": 2,
  "In production": 3, "Quality check": 4, "Shipped": 5, "Delivered": 6,
};

export function notifsForOrder(o: Order): Notif[] {
  const ref = o.orderRef ? `#${o.orderRef}` : undefined;
  const id = o.orderRef || o._id || "?";
  const isOrg = o.persona === "organisation";
  const created = ts(o.createdAt);
  const updated = ts(o.updatedAt) || created;
  const rank = STATUS_RANK[o.status] ?? 1;
  const out: Notif[] = [];

  out.push({
    key: `${id}:placed`, type: "placed",
    title: `${isOrg ? "Order received" : "Order submitted"} — ${ref ?? "your order"}`,
    body: `${orderSummary(o)}. ${isOrg ? "We're preparing your quote." : "Garm will review and confirm shortly."}`,
    at: created, orderId: ref,
  });

  if (isOrg && (o.quoteAmount ?? 0) > 0) {
    out.push({
      key: `${id}:quote`, type: "quote",
      title: `Quote ready — ${ref ?? ""}`.trim(),
      body: `${inr(o.quoteAmount!)} for ${orderSummary(o)}. Review & pay the advance to start production.`,
      at: ts(o.confirmedAt) || updated, orderId: ref,
    });
  }

  if (!isOrg && o.confirmedAt) {
    const paid = o.paymentStatus === "paid";
    out.push({
      key: `${id}:confirmed`, type: "confirmed",
      title: `Order confirmed — ${ref ?? ""}`.trim(),
      body: paid ? "Garm accepted your order." : "Garm accepted your order. Complete the payment in Track to start production.",
      at: ts(o.confirmedAt), orderId: ref,
    });
  }

  if (o.paymentStatus === "partial") {
    out.push({
      key: `${id}:advance`, type: "payment",
      title: `Advance received — ${ref ?? ""}`.trim(),
      body: "Thanks! Your advance is in — production can begin.",
      at: ts(o.paymentDate) || updated, orderId: ref,
    });
  }
  if (o.paymentStatus === "paid") {
    out.push({
      key: `${id}:paid`, type: "payment",
      title: `Payment received — ${ref ?? ""}`.trim(),
      body: isOrg ? "Balance settled — thank you! Dispatch is next." : "Payment received — thank you! We're getting started.",
      at: ts(o.paymentDate) || updated, orderId: ref,
    });
  }

  // Progress milestones actually reached. Only the order's CURRENT stage has a
  // reliable timestamp (updatedAt); earlier stages inherit it so ordering stays sane.
  const milestones: { minRank: number; type: NType; title: string; body: string }[] = [
    { minRank: 3, type: "production", title: "In production", body: `Your garments are being made.${o.etaDate ? ` On track for ${o.etaDate}.` : ""}` },
    { minRank: 4, type: "quality",    title: "Quality check", body: "Your batch is in quality inspection. Report will be shared once done." },
    { minRank: 5, type: "shipping",   title: "Shipped",       body: "Your order is on the way! Track it for delivery updates." },
    { minRank: 6, type: "delivered",  title: "Delivered",     body: "Delivered successfully. Enjoy — and tell us how we did!" },
  ];
  for (const m of milestones) {
    if (rank >= m.minRank && (m.type !== "quality" || isOrg)) {
      out.push({
        key: `${id}:${m.type}`, type: m.type,
        title: `${m.title} — ${ref ?? ""}`.trim(),
        body: m.body, at: updated, orderId: ref,
      });
    }
  }

  if (o.status === "Cancelled") {
    out.push({
      key: `${id}:cancelled`, type: "quote",
      title: `Order cancelled — ${ref ?? ""}`.trim(),
      body: "This order was cancelled. Contact your procurement manager if this is unexpected.",
      at: updated, orderId: ref,
    });
  }
  return out;
}

/** All notifications for the signed-in user, newest first. [] on any failure. */
export async function fetchNotifs(): Promise<Notif[]> {
  try {
    const [orderRes, ticketRes] = await Promise.allSettled([ordersApi.list(), supportApi.list()]);
    const out: Notif[] = [];
    if (orderRes.status === "fulfilled") {
      out.push(...orderRes.value.orders.filter((o) => o.status !== "Draft").flatMap(notifsForOrder));
    }
    // Support tickets: notify the customer of the latest ADMIN reply on each
    // ticket (that's "Garm replied to your ticket"). Key includes the message
    // count so a NEW reply is a new (unread) notification.
    if (ticketRes.status === "fulfilled") {
      for (const t of ticketRes.value.tickets) {
        const adminMsgs = t.messages.filter((m) => m.from === "admin");
        const last = adminMsgs[adminMsgs.length - 1];
        if (!last) continue;
        out.push({
          key: `ticket:${t._id}:${t.messages.length}`,
          type: "support",
          title: `Garm replied — ${t.ref}`,
          body: last.body,
          at: Date.parse(last.at) || 0,
          ticketId: t._id,
        });
      }
    }
    return out.sort((a, b) => b.at - a.at);
  } catch {
    return []; // offline / not signed in → no notifications, never a crash
  }
}

/** Live unread count for the bell badge. */
export async function fetchUnreadCount(): Promise<number> {
  const all = await fetchNotifs();
  const read = readSet();
  return all.filter((n) => !read.has(n.key)).length;
}
