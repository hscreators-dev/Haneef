import React, { useState, useEffect } from "react";
import {
  ChevronDown, ChevronUp, Check, Scissors, Microscope, Truck, Package, MessageSquare,
  RotateCcw, Star, Wallet, ReceiptText, ClipboardCheck, Phone, Mail, Palette, FileText, User,
} from "lucide-react";
import type { SubmittedOrderSummary, OrderPrice, DraftPayload, OrderGarmentLine } from "./NewOrderTab";
import { UpiLogo, upiProviderDefs, type UpiProvider } from "./AccountTab";
import { StageAnimation, stageFromLabel, type OrderStage } from "./StageAnimation";
import { orders as ordersApi, coordinator as coordinatorApi, support as supportApi, token as authToken, type Order as ApiOrder, type Coordinator, type OrderDocument as ApiOrderDocument } from "../../lib/api";
import { readPendingOrders, readOrderSummaries, flushPendingOrders as flushPendingOrdersShared } from "../../lib/orderSync";
import { initNotifications, notifyDevice } from "../../lib/notify";
import { orgAdvancePct } from "../../lib/useOrderFormConfig";

// ─── Design tokens ────────────────────────────────────────────────────────────
const ACCENT      = "#C8A97E";
const ACCENT_BG   = "rgba(200,169,126,0.12)";
const ACCENT_TEXT = "#7C5419";
const DARK        = "#0D0D0D";
const fnt: React.CSSProperties = { fontFamily: "DM Sans, sans-serif" };

// ─── Shared style helpers ─────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16,
  boxShadow: "0 1px 2px rgba(13,13,13,0.03), 0 4px 14px rgba(13,13,13,0.04)",
};
const btnPrimary: React.CSSProperties = {
  width: "100%", background: DARK, color: "#fff",
  borderRadius: 20, padding: "14px 20px", fontSize: 14,
  fontWeight: 500, border: "none", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
};

const btnSecondary: React.CSSProperties = {
  width: "100%", background: "var(--muted)", color: "var(--foreground)",
  borderRadius: 20, padding: "14px 20px", fontSize: 14,
  fontWeight: 500, border: "1px solid var(--border)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
};
const btnAccent: React.CSSProperties = { ...btnPrimary, background: ACCENT };

// ─── Types ────────────────────────────────────────────────────────────────────
type StepStatus = "done" | "active" | "pending";
interface TrackStep { label: string; sub: string; status: StepStatus; icon: React.ReactNode }
type OrderStatus = "In production" | "Quality check" | "Shipped" | "Quote pending" | "Order placed" | "Order confirmed" | "Delivered" | "Completed" | "Cancelled";

interface OrderTrack {
  id: string; name: string; statusLabel: OrderStatus; statusColor: string;
  etaDate: string; defaultOpen: boolean; steps: TrackStep[]; isNew?: boolean;
  // ── Live-backend fields (real orders fetched from the API) ──
  apiId?: string;            // Mongo _id — presence marks this as a LIVE order
  adminStatus?: string;      // NEW | CONFIRMED | PAID | … (drives the payment gate)
  livePaymentStatus?: string; // unpaid | partial | paid | refunded | partial_refund
  cancelReason?: string; refundAmount?: number; refundedAt?: string; refundReason?: string;
  assignedEmployee?: string; // name shown on the coordinator card for this order
  rating?: number;           // customer rating 1–5 (persisted on the order)
  ratingFeedback?: string;
  totalAmount?: number;      // confirmed price (₹) to pay
  documents?: ApiOrderDocument[]; // admin invoices/quotes + own design uploads
  isAccessoryOrder?: boolean;
  accessoryItems?: { name: string; qty: number }[];
  fabric?: string; qty?: string; gsm?: string; colors?: string;
  stitching?: string; packaging?: string; total?: string;
  price?: OrderPrice;
  editPayload?: DraftPayload;
  paymentMode?: string; paymentDate?: string; paymentReference?: string;
  // ── Rich detail for orders submitted in-app (from SubmittedOrderSummary) ──
  isUniform?: boolean;
  orderForLabel?: string;
  garmentLabel?: string;
  garmentLines?: OrderGarmentLine[];
  fabricSource?: string;
  weave?: string;
  colorList?: { hex: string; label: string; qty?: number }[];
  colorDesc?: string;
  sizeCatLabel?: string;
  sizeBreakdown?: { size: string; qty: number }[];
  referenceMethod?: string;
  referenceFiles?: number;
  delivery?: { name: string; phone: string; email?: string; address: string; city: string; pin: string };
  accessorySpecs?: { name: string; qty: number; fields: { label: string; value: string }[]; notes: string }[];
}

// ─── Orders data ──────────────────────────────────────────────────────────────
const allOrders: OrderTrack[] = [
  {
    id: "#FL-2041", name: "Cotton Twill — Navy",
    statusLabel: "In production", statusColor: "text-emerald-700 bg-emerald-50",
    etaDate: "14 July 2025", defaultOpen: true,
    fabric: "100% Cotton Twill", qty: "300 pcs", gsm: "GSM 220",
    colors: "Navy Blue (PMS 289C)", stitching: "Single needle",
    packaging: "Individual poly bag", total: "₹28,500",
    steps: [
      { label: "Order placed",      sub: "Jun 2, 2025",                status: "done",    icon: <Check      size={12} strokeWidth={2.5}/> },
      { label: "Sourcing material", sub: "Jun 5, 2025",                status: "done",    icon: <Check      size={12} strokeWidth={2.5}/> },
      { label: "In production",     sub: "Started Jun 10 · ~40% done", status: "active",  icon: <Scissors   size={12} strokeWidth={1.5}/> },
      { label: "Quality check",     sub: "Est. Jul 8",                 status: "pending", icon: <Microscope size={12} strokeWidth={1.5}/> },
      { label: "Shipped",           sub: "Est. Jul 11",                status: "pending", icon: <Truck      size={12} strokeWidth={1.5}/> },
      { label: "Delivered",         sub: "Est. Jul 14",                status: "pending", icon: <Package    size={12} strokeWidth={1.5}/> },
    ],
  },
  {
    id: "#FL-2038", name: "Linen Blend Fabric — Ivory",
    statusLabel: "Quality check", statusColor: "text-amber-700 bg-amber-50",
    etaDate: "8 July 2025", defaultOpen: false,
    fabric: "Linen Blend", qty: "200 pcs", gsm: "GSM 160",
    colors: "Ivory (PMS 9182C)", stitching: "Double needle",
    packaging: "Bulk packing", total: "₹18,000",
    steps: [
      { label: "Order placed",      sub: "May 28, 2025",             status: "done",    icon: <Check      size={12} strokeWidth={2.5}/> },
      { label: "Sourcing material", sub: "Jun 1, 2025",              status: "done",    icon: <Check      size={12} strokeWidth={2.5}/> },
      { label: "In production",     sub: "Completed Jun 25",         status: "done",    icon: <Check      size={12} strokeWidth={2.5}/> },
      { label: "Quality check",     sub: "In progress · Est. Jul 5", status: "active",  icon: <Microscope size={12} strokeWidth={1.5}/> },
      { label: "Shipped",           sub: "Est. Jul 6",               status: "pending", icon: <Truck      size={12} strokeWidth={1.5}/> },
      { label: "Delivered",         sub: "Est. Jul 8",               status: "pending", icon: <Package    size={12} strokeWidth={1.5}/> },
    ],
  },
  {
    id: "#FL-2045", name: "Heavy Denim — Washed Black",
    statusLabel: "Quote pending", statusColor: "text-stone-600 bg-stone-100",
    etaDate: "TBD", defaultOpen: false,
    fabric: "Heavy Denim", qty: "1000 pcs", gsm: "GSM 360",
    colors: "Washed Black", stitching: "Chain stitch",
    packaging: "Bulk packing", total: "₹57,700",
    steps: [
      { label: "Order placed",      sub: "Jun 14, 2025",           status: "done",    icon: <Check      size={12} strokeWidth={2.5}/> },
      { label: "Sourcing material", sub: "Awaiting quote approval", status: "active",  icon: <Microscope size={12} strokeWidth={1.5}/> },
      { label: "In production",     sub: "Not started",            status: "pending", icon: <Scissors   size={12} strokeWidth={1.5}/> },
      { label: "Quality check",     sub: "–",                      status: "pending", icon: <Microscope size={12} strokeWidth={1.5}/> },
      { label: "Shipped",           sub: "–",                      status: "pending", icon: <Truck      size={12} strokeWidth={1.5}/> },
      { label: "Delivered",         sub: "–",                      status: "pending", icon: <Package    size={12} strokeWidth={1.5}/> },
    ],
  },
  {
    id: "#FL-2035", name: "Cotton Jersey — White",
    statusLabel: "Delivered", statusColor: "text-emerald-700 bg-emerald-50",
    etaDate: "Jun 10, 2025", defaultOpen: false,
    fabric: "100% Cotton Jersey", qty: "100 pcs", gsm: "GSM 180",
    colors: "White", stitching: "Single needle",
    packaging: "Individual poly bag", total: "₹9,200",
    paymentMode: "UPI", paymentDate: "Jun 10, 2025",
    paymentReference: "TXN-FL-2035-2025",
    steps: [
      { label: "Order placed",      sub: "May 15, 2025", status: "done", icon: <Check   size={12} strokeWidth={2.5}/> },
      { label: "Sourcing material", sub: "May 18, 2025", status: "done", icon: <Check   size={12} strokeWidth={2.5}/> },
      { label: "In production",     sub: "May 22, 2025", status: "done", icon: <Check   size={12} strokeWidth={2.5}/> },
      { label: "Quality check",     sub: "Jun 2, 2025",  status: "done", icon: <Check   size={12} strokeWidth={2.5}/> },
      { label: "Shipped",           sub: "Jun 7, 2025",  status: "done", icon: <Check   size={12} strokeWidth={2.5}/> },
      { label: "Delivered",         sub: "Jun 10, 2025", status: "done", icon: <Package size={12} strokeWidth={1.5}/> },
    ],
  },
  {
    id: "#FL-2029", name: "Oxford Shirt Fabric — Sky Blue",
    statusLabel: "Completed", statusColor: "text-stone-600 bg-stone-100",
    etaDate: "May 20, 2025", defaultOpen: false,
    fabric: "Oxford Cotton", qty: "250 pcs", gsm: "GSM 200",
    colors: "Sky Blue", stitching: "Double needle",
    packaging: "Bundle packing", total: "₹21,500",
    paymentMode: "Card", paymentDate: "May 20, 2025",
    paymentReference: "TXN-FL-2029-2025",
    steps: [
      { label: "Order placed",      sub: "Apr 28, 2025", status: "done", icon: <Check   size={12} strokeWidth={2.5}/> },
      { label: "Sourcing material", sub: "May 1, 2025",  status: "done", icon: <Check   size={12} strokeWidth={2.5}/> },
      { label: "In production",     sub: "May 5, 2025",  status: "done", icon: <Check   size={12} strokeWidth={2.5}/> },
      { label: "Quality check",     sub: "May 14, 2025", status: "done", icon: <Check   size={12} strokeWidth={2.5}/> },
      { label: "Shipped",           sub: "May 17, 2025", status: "done", icon: <Check   size={12} strokeWidth={2.5}/> },
      { label: "Delivered",         sub: "May 20, 2025", status: "done", icon: <Package size={12} strokeWidth={1.5}/> },
    ],
  },
];

const todayLabel = () => new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// Local placeholder steps shown the instant an order is submitted, BEFORE the
// backend copy lands. Must mirror the backend's real step sequences (see
// backend/src/models/Order.ts pre-save) so nothing jumps when sync completes.
const b2cSubmittedSteps = (): TrackStep[] => [
  // Submitted is the CURRENT stage — "Order confirmed" stays visibly
  // unreached until the Garm team actually confirms.
  { label: "Order submitted", sub: `${todayLabel()} · Waiting for Garm to confirm`, status: "active"  as StepStatus, icon: <Check          size={12} strokeWidth={2.5}/> },
  { label: "Order confirmed", sub: "Garm will confirm your order",                 status: "pending" as StepStatus, icon: <ClipboardCheck size={12} strokeWidth={1.5}/> },
  { label: "Payment",         sub: "Unlocks once your order is confirmed",     status: "pending" as StepStatus, icon: <Wallet         size={12} strokeWidth={1.5}/> },
  { label: "In production",   sub: "Starts after payment",                     status: "pending" as StepStatus, icon: <Scissors       size={12} strokeWidth={1.5}/> },
  { label: "Shipped",         sub: "–",                                        status: "pending" as StepStatus, icon: <Truck          size={12} strokeWidth={1.5}/> },
  { label: "Delivered",       sub: "–",                                        status: "pending" as StepStatus, icon: <Package        size={12} strokeWidth={1.5}/> },
];
const orgSubmittedSteps = (): TrackStep[] => [
  { label: "Order placed",      sub: `${todayLabel()} · Just now`,   status: "done"    as StepStatus, icon: <Check      size={12} strokeWidth={2.5}/> },
  { label: "Sourcing material", sub: "Pending coordinator review",   status: "active"  as StepStatus, icon: <Scissors   size={12} strokeWidth={1.5}/> },
  { label: "In production",     sub: "–",                            status: "pending" as StepStatus, icon: <Scissors   size={12} strokeWidth={1.5}/> },
  { label: "Quality check",     sub: "–",                            status: "pending" as StepStatus, icon: <Microscope size={12} strokeWidth={1.5}/> },
  { label: "Shipped",           sub: "–",                            status: "pending" as StepStatus, icon: <Truck      size={12} strokeWidth={1.5}/> },
  { label: "Delivered",         sub: "–",                            status: "pending" as StepStatus, icon: <Package    size={12} strokeWidth={1.5}/> },
];

function buildNewSubmittedOrder(summary?: SubmittedOrderSummary | null, accountType?: "personal" | "organisation"): OrderTrack {
  const isPersonal = accountType === "personal";
  if (!summary) {
    return {
      id: "FL-PENDING", name: "New Order — Just submitted",
      statusLabel: "Order placed", statusColor: "text-blue-700 bg-blue-50",
      etaDate: "TBD", defaultOpen: true, isNew: true,
      steps: isPersonal ? b2cSubmittedSteps() : orgSubmittedSteps(),
    };
  }
  const steps = isPersonal
    ? b2cSubmittedSteps()
    : summary.isAccessoryOrder
    ? [
        { label: "Order placed",      sub: `${todayLabel()} · Just now`,       status: "active"  as StepStatus, icon: <Check        size={12} strokeWidth={2.5}/> },
        { label: "Quote preparation", sub: "Coordinator reviewing items",     status: "pending" as StepStatus, icon: <ClipboardCheck size={12} strokeWidth={1.5}/> },
        { label: "Production",        sub: "–",                              status: "pending" as StepStatus, icon: <Package      size={12} strokeWidth={1.5}/> },
        { label: "Quality check",     sub: "–",                              status: "pending" as StepStatus, icon: <Microscope   size={12} strokeWidth={1.5}/> },
        { label: "Shipped",           sub: "–",                              status: "pending" as StepStatus, icon: <Truck        size={12} strokeWidth={1.5}/> },
        { label: "Delivered",         sub: "–",                              status: "pending" as StepStatus, icon: <Package      size={12} strokeWidth={1.5}/> },
      ]
    : orgSubmittedSteps();
  return {
    id: summary.id, name: summary.name,
    statusLabel: "Order placed", statusColor: "text-blue-700 bg-blue-50",
    etaDate: "TBD", defaultOpen: true, isNew: true,
    isAccessoryOrder: summary.isAccessoryOrder,
    accessoryItems: summary.accessoryItems,
    total: summary.totalPcs ? `${summary.totalPcs} pcs` : undefined,
    // Rich detail captured at submit — drives the real Order Details card
    isUniform: summary.isUniform,
    orderForLabel: summary.orderForLabel,
    garmentLabel: summary.garmentLabel,
    garmentLines: summary.garmentLines,
    fabricSource: summary.fabricSource,
    fabric: summary.fabric,
    gsm: summary.gsm,
    weave: summary.weave,
    colorList: summary.colors,
    colorDesc: summary.colorDesc,
    qty: summary.qty != null ? `${summary.qty} pcs` : undefined,
    sizeCatLabel: summary.sizeCatLabel,
    sizeBreakdown: summary.sizeBreakdown,
    stitching: summary.stitching,
    packaging: summary.packaging,
    price: summary.price,
    editPayload: summary.editPayload,
    referenceMethod: summary.referenceMethod,
    referenceFiles: summary.referenceFiles,
    paymentMode: summary.paymentMethod,
    delivery: summary.delivery,
    accessorySpecs: summary.accessorySpecs,
    steps,
  };
}

const ACTIVE_STATUSES: OrderStatus[]     = ["Order placed", "Order confirmed", "Quote pending", "In production", "Quality check", "Shipped"];
const PAST_STATUSES: OrderStatus[]       = ["Delivered", "Completed", "Cancelled"];
const CHANGEABLE_STATUSES: OrderStatus[] = ["Order placed", "Quote pending"];

// ─── Live order → OrderTrack mapping ─────────────────────────────────────────
const STATUS_COLORS: Record<OrderStatus, string> = {
  "Order placed":    "text-blue-700 bg-blue-50",
  "Order confirmed": "text-amber-700 bg-amber-50",
  "Quote pending":   "text-stone-600 bg-stone-100",
  "In production":   "text-emerald-700 bg-emerald-50",
  "Quality check":   "text-amber-700 bg-amber-50",
  "Shipped":         "text-blue-700 bg-blue-50",
  "Delivered":       "text-emerald-700 bg-emerald-50",
  "Completed":       "text-stone-600 bg-stone-100",
  "Cancelled":       "text-red-700 bg-red-50",
};

function iconForStepLabel(label: string, status: StepStatus): React.ReactNode {
  if (status === "done") return <Check size={12} strokeWidth={2.5}/>;
  const l = label.toLowerCase();
  if (l.includes("confirm"))  return <ClipboardCheck size={12} strokeWidth={1.5}/>;
  if (l.includes("payment"))  return <Wallet     size={12} strokeWidth={1.5}/>;
  if (l.includes("product"))  return <Scissors   size={12} strokeWidth={1.5}/>;
  if (l.includes("sourc"))    return <Scissors   size={12} strokeWidth={1.5}/>;
  if (l.includes("quality"))  return <Microscope size={12} strokeWidth={1.5}/>;
  if (l.includes("ship"))     return <Truck      size={12} strokeWidth={1.5}/>;
  if (l.includes("deliver"))  return <Package    size={12} strokeWidth={1.5}/>;
  return <Check size={12} strokeWidth={1.5}/>;
}

function fmtINR(n?: number): string | undefined {
  return typeof n === "number" && n > 0 ? `₹${n.toLocaleString("en-IN")}` : undefined;
}

// Organisations pay in two stages: an advance (production starts), then the
// balance after the QC report (shipping starts). The advance % is configured
// in the admin portal (Settings → Order Form → Service Fee) and read live via
// orgAdvancePct() — no hardcoded value.
function orgAdvanceAmount(total?: number): number { return Math.round(((total ?? 0) * orgAdvancePct()) / 100); }

// Builds a Track card from a real backend order, enriched with the rich
// display summary saved locally at submit time (keyed by orderRef).
function apiOrderToTrack(o: ApiOrder, summaries: Record<string, SubmittedOrderSummary>): OrderTrack {
  const summary = o.orderRef ? summaries[o.orderRef] : undefined;
  const statusLabel: OrderStatus = (o.adminStatus === "CANCELLED" || o.status === "Cancelled")
    ? "Cancelled"
    : (((["In production","Quality check","Shipped","Quote pending","Order placed","Order confirmed","Delivered","Completed"] as OrderStatus[])
        .includes(o.status as OrderStatus) ? o.status : "Order placed") as OrderStatus);
  const steps: TrackStep[] = (o.trackSteps || []).map((s) => ({
    label: s.label, sub: s.sub || "–",
    status: (s.status === "done" || s.status === "active" ? s.status : "pending") as StepStatus,
    icon: iconForStepLabel(s.label, s.status as StepStatus),
  }));
  const amount = o.total || o.quoteAmount;
  // Price shown in Track. For a LIVE order (exists on the backend) we build it
  // from the STORED order total — the exact same number the admin portal shows —
  // so the two never disagree. The label only says "paid" once payment is really
  // done; before that it's "Total payable". Local-only (not-yet-synced) orders
  // keep their submitted summary price but still never claim to be paid.
  const isPaid = o.paymentStatus === "paid";
  const livePrice: OrderPrice | undefined = o._id
    ? {
        kind: "fixed",
        rateLine: o.qty && amount ? `${fmtINR(Math.round(amount / o.qty))}/pc × ${o.qty} pcs` : (summary?.price?.rateLine ?? "—"),
        serviceFeeLine: o.serviceFee ? fmtINR(o.serviceFee) : summary?.price?.serviceFeeLine,
        totalLabel: isPaid ? "Total paid" : "Total payable",
        totalValue: fmtINR(amount) ?? summary?.price?.totalValue ?? "—",
        note: summary?.price?.note,
      }
    : undefined;
  const trackPrice: OrderPrice | undefined = livePrice
    ?? (summary?.price ? { ...summary.price, totalLabel: isPaid ? "Total paid" : (summary.price.totalLabel === "Total paid" ? "Total payable" : summary.price.totalLabel) } : undefined);
  return {
    id: o.orderRef || `#${(o._id || "").slice(-6).toUpperCase()}`,
    name: summary?.name || o.garmentType || o.serviceLabel || (o.isAccessoryOrder ? "Accessories order" : "Custom order"),
    statusLabel,
    statusColor: STATUS_COLORS[statusLabel],
    etaDate: o.etaDate || "TBD",
    defaultOpen: false,
    steps,
    isAccessoryOrder: o.isAccessoryOrder,
    accessoryItems: o.accessoryItems?.map((a) => ({ name: a.itemName, qty: a.qty })),
    fabric: o.fabric || summary?.fabric,
    gsm: o.gsm || summary?.gsm,
    weave: o.weave || summary?.weave,
    qty: o.qty ? `${o.qty} pcs` : undefined,
    stitching: o.stitching || summary?.stitching,
    packaging: o.packaging || summary?.packaging,
    total: fmtINR(amount),
    paymentMode: o.paymentMode || summary?.paymentMethod,
    paymentDate: o.paymentDate ? new Date(o.paymentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : undefined,
    paymentReference: o.paymentReference,
    // Rich detail from the local summary (order-for, garment lines, price, delivery…)
    isUniform: summary?.isUniform,
    orderForLabel: summary?.orderForLabel,
    garmentLabel: summary?.garmentLabel,
    garmentLines: summary?.garmentLines,
    fabricSource: summary?.fabricSource,
    colorList: summary?.colors ?? o.colors?.map((c) => ({ hex: c.hex, label: c.label })),
    colorDesc: summary?.colorDesc,
    sizeCatLabel: summary?.sizeCatLabel,
    sizeBreakdown: summary?.sizeBreakdown ?? o.sizes?.map((s) => ({ size: s.label, qty: s.qty })),
    referenceMethod: summary?.referenceMethod,
    referenceFiles: summary?.referenceFiles,
    delivery: summary?.delivery ?? (o.deliveryAddress ? {
      name: o.contactName || "", phone: o.contactPhone || "", email: o.contactEmail,
      address: o.deliveryAddress, city: o.deliveryCity || "", pin: o.deliveryPin || "",
    } : undefined),
    accessorySpecs: summary?.accessorySpecs,
    price: trackPrice,
    editPayload: summary?.editPayload,
    // Live gate fields
    apiId: o._id,
    adminStatus: o.adminStatus,
    rating: o.rating,
    ratingFeedback: o.ratingFeedback,
    livePaymentStatus: o.paymentStatus,
    cancelReason: o.cancelReason,
    refundAmount: o.refundAmount,
    refundedAt: o.refundedAt ? new Date(o.refundedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : undefined,
    refundReason: o.refundReason,
    assignedEmployee: o.assignedEmployee,
    totalAmount: amount,
    documents: o.documents,
  };
}

type TrackFilter = "active" | "past" | "all";

const procurementStages = [
  "Under Review", "Quote Shared", "Waiting Approval",
  "Production Started", "QA Inspection", "Shipped", "Delivered",
];

// ─── Panel — shared bordered card ─────────────────────────────────────────────
function Panel({ title, icon, action, children }: {
  title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={card} className="p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <p className="text-foreground text-sm font-semibold">{title}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full ${cls}`}
      style={{ fontWeight: 600, fontSize: 10, letterSpacing: "0.02em", boxShadow: "inset 0 0 0 1px rgba(13,13,13,0.05)" }}>
      {label}
    </span>
  );
}

// ─── Detail row ───────────────────────────────────────────────────────────────
function DetailRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground flex-shrink-0" style={{ fontSize: 12 }}>{label}</span>
      <span className={`text-right ${accent ? "text-emerald-700" : "text-foreground"}`}
        style={{ fontSize: 12, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ─── Payment Method Card ──────────────────────────────────────────────────────
function PaymentMethodCard({ order, accountType, paidOverride, onMarkPaid, onPayLive }: {
  order: OrderTrack; accountType?: "personal" | "organisation"; paidOverride?: boolean; onMarkPaid?: () => void;
  onPayLive?: (mode: string, stage?: "advance" | "balance" | "full") => Promise<void>;
}) {
  const statusPaid = order.statusLabel !== "Quote pending" && order.statusLabel !== "Order placed";
  const [showPay, setShowPay]     = useState(false);
  const [method, setMethod]       = useState<"upi" | "card">("upi");
  const [upiApp, setUpiApp]       = useState<UpiProvider>("gpay");
  const [upiId, setUpiId]         = useState("");
  const [card, setCard]           = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [paying, setPaying]       = useState(false);
  const [payError, setPayError]   = useState("");
  const isOrg = accountType !== "personal";
  const isLive = !!order.apiId;

  // ── Individuals: the confirm-then-pay flow ──
  // Submitted (adminStatus NEW, or a local just-submitted card that hasn't
  // synced yet): payment is LOCKED until the admin confirms. Confirmed: pay
  // the confirmed amount here. Paid: locked, shows the receipt info.
  const isUnconfirmedStage  = order.statusLabel === "Order placed" || order.statusLabel === "Quote pending";
  const liveAwaitingConfirm = !isOrg && (isLive ? (order.adminStatus === "NEW" || !order.adminStatus) : isUnconfirmedStage);
  const livePaid            = isLive && order.livePaymentStatus === "paid";
  const liveCanPay          = isLive && !isOrg && !livePaid && !liveAwaitingConfirm && order.statusLabel !== "Completed";
  // ── Organisations, LIVE orders: advance → balance ──
  const orgQuoted     = isLive && isOrg && (order.totalAmount ?? 0) > 0;
  const orgAdvanceDue = orgQuoted && !livePaid && order.livePaymentStatus !== "partial";
  const orgBalanceDue = orgQuoted && !livePaid && order.livePaymentStatus === "partial";
  const orgPayAmount  = orgAdvanceDue ? orgAdvanceAmount(order.totalAmount) : (order.totalAmount ?? 0) - orgAdvanceAmount(order.totalAmount);
  const orgStage: "advance" | "balance" = orgAdvanceDue ? "advance" : "balance";
  // Paid is NEVER assumed: live orders use the real paymentStatus; non-live
  // demo orders only count as paid once they're past the confirmation stage.
  const paid = isLive ? livePaid : isOrg ? (statusPaid || !!paidOverride) : !isUnconfirmedStage;

  async function payNow(modeLabel: string) {
    if (!onPayLive) return;
    setPaying(true); setPayError("");
    try {
      await onPayLive(modeLabel, isOrg ? orgStage : undefined);
      setShowPay(false);
    } catch (e) {
      setPayError((e as Error).message || "Payment failed — try again");
    } finally {
      setPaying(false);
    }
  }

  const fmtCard   = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const fmtExpiry = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length >= 3 ? d.slice(0, 2) + "/" + d.slice(2) : d; };
  const upiOk  = /^[\w.\-]+@[\w]+$/.test(upiId.trim());
  const cardOk = card.number.replace(/\D/g, "").length >= 13 && /^\d{2}\/\d{2}$/.test(card.expiry) && card.cvv.length >= 3 && card.name.trim().length > 0;
  const canPay = method === "upi" ? upiOk : cardOk;
  const inputStyle: React.CSSProperties = { border: "1px solid var(--border)", background: "var(--card)", outline: "none", color: DARK, fontSize: 13 };

  return (
    <Panel title="Payment">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-foreground" style={{ fontSize: 13 }}>
          Payment method: {paid ? (order.paymentMode || "—") : liveAwaitingConfirm ? "Chosen at payment" : "Not selected"}
        </p>
        {isOrg && !isLive && (paid ? (
          <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 600 }} title="Already paid">Change</span>
        ) : (
          <button onClick={() => setShowPay(v => !v)} style={{ fontSize: 12, color: ACCENT, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
            Change
          </button>
        ))}
      </div>
      <p className="text-foreground" style={{ fontSize: 13 }}>
        Payment status:{" "}
        <span style={{ fontWeight: 600, color: paid ? "#059669" : "#D97706" }}>
          {paid ? "Paid" : liveAwaitingConfirm ? "Locked" : orgBalanceDue ? "Advance paid · balance due" : orgAdvanceDue ? "Advance due" : "Pending"}
        </span>
        {paid && order.paymentDate ? <span className="text-muted-foreground" style={{ fontWeight: 400 }}> · {order.paymentDate}</span> : null}
      </p>
      {paid && order.paymentReference && (
        <p className="text-muted-foreground" style={{ fontSize: 11, marginTop: 2 }}>Ref: {order.paymentReference}</p>
      )}

      {/* ── Individuals, live order: waiting for admin confirmation ── */}
      {liveAwaitingConfirm && (
        <div className="mt-3 rounded-xl px-3 py-2.5" style={{ background: ACCENT_BG, border: `1px solid ${ACCENT}` }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: ACCENT_TEXT }}>Waiting for Garm to confirm your order</p>
          <p className="text-muted-foreground" style={{ fontSize: 11, marginTop: 2, lineHeight: 1.5 }}>
            Once your order is confirmed you'll see the final price here and can pay — production starts right after payment.
          </p>
        </div>
      )}

      {/* ── Individuals, live order: confirmed — pay now ── */}
      {liveCanPay && !showPay && (
        <button onClick={() => setShowPay(true)}
          className="w-full mt-3 py-2.5 rounded-xl"
          style={{ background: DARK, color: "#fff", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer" }}>
          Pay {fmtINR(order.totalAmount) ?? order.price?.totalValue ?? "now"} — confirmed by Garm
        </button>
      )}

      {/* ── Organisations, live order: advance then balance ── */}
      {(orgAdvanceDue || orgBalanceDue) && !showPay && (
        <button onClick={() => setShowPay(true)}
          className="w-full mt-3 py-2.5 rounded-xl"
          style={{ background: DARK, color: "#fff", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer" }}>
          {orgAdvanceDue
            ? `Pay advance ${fmtINR(orgPayAmount)} (${orgAdvancePct()}%) — production starts after this`
            : `Pay balance ${fmtINR(orgPayAmount)} — shipping starts after this`}
        </button>
      )}

      {((isOrg && !isLive && !paid) || liveCanPay || orgAdvanceDue || orgBalanceDue) && showPay && (
        <div className="mt-3 rounded-xl border border-border p-3">
          <p style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 8 }}>Choose a payment method</p>
          {([["upi", "UPI", "Google Pay, PhonePe, Paytm & more"], ["card", "Card", "Credit or debit card"]] as const).map(([id, lbl, sub]) => {
            const sel = method === id;
            return (
              <button key={id} onClick={() => setMethod(id)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-2 text-left"
                style={{ border: `1.5px solid ${sel ? DARK : "var(--border)"}`, background: sel ? "rgba(13,13,13,0.03)" : "var(--card)", cursor: "pointer" }}>
                <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ border: `2px solid ${sel ? DARK : "#d1d5db"}`, background: sel ? DARK : "var(--card)" }}>
                  {sel && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                </div>
                <div><p className="text-foreground" style={{ fontSize: 13, fontWeight: sel ? 600 : 400 }}>{lbl}</p><p className="text-muted-foreground" style={{ fontSize: 11 }}>{sub}</p></div>
              </button>
            );
          })}

          {/* ── UPI details ── */}
          {method === "upi" && (
            <div className="mb-1">
              <p style={{ fontSize: 11, fontWeight: 600, color: DARK, margin: "4px 0 6px" }}>Pay using</p>
              <div className="grid grid-cols-4 gap-2 mb-2.5">
                {(Object.keys(upiProviderDefs) as UpiProvider[]).map(key => {
                  const sel = upiApp === key;
                  return (
                    <button key={key} onClick={() => setUpiApp(key)} className="flex flex-col items-center gap-1 py-2 rounded-xl"
                      style={{ background: sel ? "rgba(13,13,13,0.03)" : "var(--card)", border: `1.5px solid ${sel ? DARK : "var(--border)"}`, cursor: "pointer" }}>
                      <UpiLogo provider={key} size={26}/>
                      <span style={{ fontSize: 9, fontWeight: sel ? 600 : 500, color: "var(--foreground)" }}>{upiProviderDefs[key].label.split(" ")[0]}</span>
                    </button>
                  );
                })}
              </div>
              <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@bank"
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                className="w-full rounded-lg px-3 py-2" style={inputStyle}/>
              {upiId.length > 0 && !upiOk && <p style={{ fontSize: 10.5, color: "#dc2626", marginTop: 4 }}>Enter a valid UPI ID (e.g. name@okicici)</p>}
            </div>
          )}

          {/* ── Card details ── */}
          {method === "card" && (
            <div className="mb-1">
              <p style={{ fontSize: 11, fontWeight: 600, color: DARK, margin: "4px 0 6px" }}>Card number</p>
              <input value={card.number} onChange={e => setCard(c => ({ ...c, number: fmtCard(e.target.value) }))}
                inputMode="numeric" placeholder="1234 5678 9012 3456" className="w-full rounded-lg px-3 py-2" style={{ ...inputStyle, letterSpacing: 1 }}/>
              <div className="flex gap-2 mt-2">
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 11, fontWeight: 600, color: DARK, margin: "0 0 6px" }}>Expiry</p>
                  <input value={card.expiry} onChange={e => setCard(c => ({ ...c, expiry: fmtExpiry(e.target.value) }))}
                    inputMode="numeric" placeholder="MM/YY" maxLength={5} className="w-full rounded-lg px-3 py-2" style={inputStyle}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 11, fontWeight: 600, color: DARK, margin: "0 0 6px" }}>CVV</p>
                  <input value={card.cvv} onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                    type="password" inputMode="numeric" placeholder="•••" maxLength={4} className="w-full rounded-lg px-3 py-2" style={inputStyle}/>
                </div>
              </div>
              <p style={{ fontSize: 11, fontWeight: 600, color: DARK, margin: "8px 0 6px" }}>Name on card</p>
              <input value={card.name} onChange={e => setCard(c => ({ ...c, name: e.target.value }))}
                placeholder="As printed on card" className="w-full rounded-lg px-3 py-2" style={inputStyle}/>
            </div>
          )}

          <button
            onClick={() => {
              if (!canPay || paying) return;
              const modeLabel = method === "upi" ? "UPI" : "Card";
              if (liveCanPay || orgAdvanceDue || orgBalanceDue) payNow(modeLabel);
              else { onMarkPaid?.(); setShowPay(false); }
            }}
            disabled={!canPay || paying}
            className="w-full mt-2.5 py-2.5 rounded-xl" style={{ background: canPay && !paying ? DARK : "#E5E7EB", color: canPay && !paying ? "#fff" : "#9CA3AF", fontWeight: 600, fontSize: 13, border: "none", cursor: canPay && !paying ? "pointer" : "not-allowed" }}>
            {paying ? "Processing…" : `Pay ${(orgAdvanceDue || orgBalanceDue) ? fmtINR(orgPayAmount) : (fmtINR(order.totalAmount) ?? order.price?.totalValue ?? "now")} by ${method === "upi" ? "UPI" : "card"}`}
          </button>
          {payError && <p style={{ fontSize: 11, color: "#dc2626", marginTop: 6 }}>{payError}</p>}
          <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 6, lineHeight: 1.5 }}>Demo checkout — no real charge is made. CVV is never stored.</p>
        </div>
      )}
    </Panel>
  );
}

// ─── Order Details Card ───────────────────────────────────────────────────────
function OrderDetailsCard({ order, canChange, accountType, onEdit }: {
  order: OrderTrack; canChange?: boolean; accountType?: "personal" | "organisation"; onEdit?: () => void;
}) {
  // Change is only for organisations, only before production starts, and only when the
  // order carries an editable snapshot (so seed orders don't open a blank order).
  const changeAction = (accountType !== "personal" && canChange && !!order.editPayload) ? (
    <button onClick={onEdit}
      style={{ fontSize: 12, color: ACCENT, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
      Change
    </button>
  ) : undefined;

  const sec = (t: string) => (
    <p className="text-muted-foreground" style={{ fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", fontWeight: 500 }}>{t}</p>
  );
  const divider = <div className="border-t border-border my-1"/>;
  const deliveryBlock = order.delivery ? (
    <>
      <div className="border-t border-border my-1"/>
      {sec("Delivery & contact")}
      <DetailRow label="Name" value={order.delivery.name}/>
      <DetailRow label="Phone" value={order.delivery.phone}/>
      {order.delivery.email && <DetailRow label="Email" value={order.delivery.email}/>}
      <DetailRow label="Address" value={`${order.delivery.address}, ${order.delivery.city} ${order.delivery.pin}`}/>
    </>
  ) : null;

  // ── Accessories ──
  if (order.isAccessoryOrder && (order.accessorySpecs?.length || order.accessoryItems?.length)) {
    const specs = order.accessorySpecs;
    const items = order.accessoryItems ?? [];
    const totalPcs = specs?.length ? specs.reduce((a, b) => a + b.qty, 0) : items.reduce((a, b) => a + b.qty, 0);
    return (
      <Panel title="Order details" action={changeAction}>
        <div className="flex flex-col gap-2">
          <DetailRow label="Order type" value="Accessories & promo items"/>
          <DetailRow label="Total quantity" value={`${totalPcs} pcs`}/>
          {divider}
          {sec("Items & specifications")}
          {specs?.length
            ? specs.map(it => (
                <div key={it.name} className="rounded-xl border border-border overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2" style={{ background: "var(--muted)" }}>
                    <span className="text-foreground" style={{ fontSize: 12.5, fontWeight: 600 }}>{it.name}</span>
                    <span className="text-foreground" style={{ fontSize: 12, fontWeight: 700 }}>{it.qty} pcs</span>
                  </div>
                  {(it.fields.length > 0 || it.notes) && (
                    <div className="px-3 py-2 flex flex-col gap-1.5">
                      {it.fields.map(f => <DetailRow key={f.label} label={f.label} value={f.value}/>)}
                      {it.notes && <DetailRow label="Notes" value={`“${it.notes}”`}/>}
                    </div>
                  )}
                </div>
              ))
            : items.map(item => <DetailRow key={item.name} label={item.name} value={`${item.qty} pcs`}/>)}
          {order.referenceMethod && (<>{divider}{sec("Reference")}<DetailRow label="Method" value={order.referenceMethod}/>{order.referenceFiles ? <DetailRow label="Files attached" value={`${order.referenceFiles}`}/> : null}</>)}
          {order.price && (
            <>
              {divider}{sec("Price details")}
              <DetailRow label="Items" value={order.price.rateLine}/>
              {order.price.serviceFeeLine && <DetailRow label="Service fee" value={order.price.serviceFeeLine}/>}
              <DetailRow label={order.price.totalLabel} value={order.price.totalValue} accent/>
              {order.price.note && (
                <p className="text-muted-foreground" style={{ fontSize: 11, lineHeight: 1.5, marginTop: 1 }}>{order.price.note}</p>
              )}
            </>
          )}
          {deliveryBlock}
        </div>
      </Panel>
    );
  }

  // ── Apparel / custom ──
  const hasLines = (order.garmentLines?.length ?? 0) > 0;
  const hasMaterials = !order.isUniform && (order.fabricSource || order.fabric || order.gsm || order.weave);
  const hasColors = (order.colorList?.length ?? 0) > 0 || order.colors || order.colorDesc;
  const hasSize = order.sizeCatLabel || (order.sizeBreakdown?.length ?? 0) > 0 || order.qty;

  return (
    <Panel title="Order details" action={changeAction}>
      <div className="flex flex-col gap-2">
        {order.orderForLabel && <DetailRow label="Order for" value={order.orderForLabel}/>}

        {hasLines ? (
          /* Full per-garment breakdown — mirrors the Review step for multi-garment orders. */
          <>
            {divider}{sec("Garments")}
            <div className="flex flex-col gap-2">
              {order.garmentLines!.map((g, i) => (
                <div key={i} className="rounded-xl border border-border overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ background: "var(--muted)" }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: g.colorHex, border: "1px solid rgba(0,0,0,0.18)" }}/>
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{g.name}{g.audience ? ` · ${g.audience}` : g.gender ? ` (${g.gender === "boy" ? "Boys" : "Girls"})` : ""}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{g.qty} pcs</span>
                  </div>
                  <div className="px-3 py-2 flex flex-col gap-1">
                    {g.style && <DetailRow label="Style" value={g.style}/>}
                    <DetailRow label="Colour" value={g.colorLabel}/>
                    {(g.fabric || g.gsm || g.weave) && <DetailRow label="Fabric" value={[g.fabric, g.gsm, g.weave].filter(Boolean).join(" · ")}/>}
                    {g.sizes.length > 0
                      ? (
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {g.sizes.map(s => (
                            <span key={s.size} className="px-2 py-0.5 rounded-lg" style={{ background: "var(--muted)", border: "1px solid var(--border)", fontSize: 11, fontWeight: 500 }}>{s.size}: {s.qty}</span>
                          ))}
                        </div>
                      )
                      : <DetailRow label="Sizes" value="To be confirmed"/>}
                    {(g.stitching || g.packaging) && <DetailRow label="Finishing" value={[g.stitching, g.packaging].filter(Boolean).join(" · ")}/>}
                    {g.referenceMethod && <DetailRow label="Reference" value={`${g.referenceMethod}${g.referenceFiles ? ` · ${g.referenceFiles} file${g.referenceFiles !== 1 ? "s" : ""}` : ""}`}/>}
                  </div>
                </div>
              ))}
            </div>
            {order.qty && <DetailRow label="Total pieces" value={order.qty}/>}
            {order.colorDesc && <DetailRow label="Design note" value={order.colorDesc}/>}
          </>
        ) : (
        <>
        {order.garmentLabel && <DetailRow label="Garment" value={order.garmentLabel}/>}

        {order.isUniform && (
          <div className="flex gap-1.5 px-2.5 py-2 rounded-lg" style={{ background: "var(--success-bg)", border: "0.5px solid var(--success-border)" }}>
            <Check size={12} style={{ color: "#059669", flexShrink: 0, marginTop: 1 }}/>
            <p style={{ fontSize: 11, color: "#065f46", lineHeight: 1.5 }}>Fabric, GSM, colours &amp; stitching are taken from your school/college record.</p>
          </div>
        )}

        {hasMaterials && (
          <>
            {divider}{sec("Materials")}
            {order.fabricSource && <DetailRow label="Fabric source" value={order.fabricSource}/>}
            {order.fabric && <DetailRow label="Fabric type" value={order.fabric}/>}
            {order.gsm && <DetailRow label="GSM weight" value={order.gsm}/>}
            {order.weave && <DetailRow label="Weave" value={order.weave}/>}
          </>
        )}

        {hasColors && (
          <>
            {divider}{sec("Colours")}
            {(order.colorList?.length ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {order.colorList!.map((c, i) => (
                  <div key={c.hex + i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border" style={{ background: "var(--muted)" }}>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.hex, border: "1px solid rgba(0,0,0,0.12)" }}/>
                    <span style={{ fontSize: 11, fontWeight: 500 }}>{c.label}{typeof c.qty === "number" ? ` × ${c.qty}` : ""}</span>
                  </div>
                ))}
              </div>
            ) : order.colors ? <DetailRow label="Confirm colours" value={order.colors}/> : null}
            {order.colorDesc && <DetailRow label="Description" value={order.colorDesc}/>}
          </>
        )}

        {hasSize && (
          <>
            {divider}{sec("Size & quantity")}
            {order.sizeCatLabel && <DetailRow label="Sizing" value={order.sizeCatLabel}/>}
            {order.qty && <DetailRow label="Total pieces" value={order.qty}/>}
            {(order.sizeBreakdown?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-end">
                {order.sizeBreakdown!.map(s => (
                  <span key={s.size} className="px-2 py-0.5 rounded-lg" style={{ background: "var(--muted)", border: "1px solid var(--border)", fontSize: 11, fontWeight: 500 }}>{s.size}: {s.qty}</span>
                ))}
              </div>
            )}
          </>
        )}
        </>
        )}

        {(order.stitching || order.packaging) && (
          <>
            {divider}{sec("Finishing")}
            {order.stitching && <DetailRow label="Stitching" value={order.stitching}/>}
            {order.packaging && <DetailRow label="Packaging" value={order.packaging}/>}
          </>
        )}

        {order.referenceMethod && (
          <>
            {divider}{sec("Reference")}
            <DetailRow label="Method" value={order.referenceMethod}/>
            {order.referenceFiles ? <DetailRow label="Files attached" value={`${order.referenceFiles}`}/> : null}
          </>
        )}

        {order.price && (
          <>
            {divider}{sec("Price details")}
            <DetailRow label="Rate" value={order.price.rateLine}/>
            {order.price.addOnLine && <DetailRow label="Stitching & packaging" value={order.price.addOnLine}/>}
            {order.price.serviceFeeLine && <DetailRow label="Service fee" value={order.price.serviceFeeLine}/>}
            <DetailRow label={order.price.totalLabel} value={order.price.totalValue} accent/>
            {order.price.note && (
              <p className="text-muted-foreground" style={{ fontSize: 11, lineHeight: 1.5, marginTop: 1 }}>{order.price.note}</p>
            )}
          </>
        )}

        {order.total && (<>{divider}<DetailRow label="Order total" value={order.total}/></>)}

        {deliveryBlock}
      </div>
    </Panel>
  );
}

// ─── Procurement Stage Strip ──────────────────────────────────────────────────
function ProcurementStageStrip({ status }: { status: OrderStatus }) {
  const current =
    status === "Order placed"  ? 0 :
    status === "Quote pending" ? 1 :
    status === "In production" ? 3 :
    status === "Quality check" ? 4 :
    status === "Shipped"       ? 5 : 6;

  return (
    <Panel title="My request status" icon={<ClipboardCheck size={14} strokeWidth={1.5}/>}>
      <div className="grid grid-cols-2 gap-2">
        {procurementStages.map((stage, i) => {
          const done   = i < current;
          const active = i === current;
          return (
            <div key={stage}
              className="rounded-xl px-3 py-2.5 flex items-center gap-2 border"
              style={{
                background: done ? "var(--success-bg)" : active ? ACCENT_BG : "var(--card)",
                borderColor: done ? "var(--success-border)" : active ? ACCENT : "var(--border)",
              }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: done ? "#059669" : active ? ACCENT : "var(--muted)",
                  color: done || active ? "#fff" : "var(--muted-foreground)",
                  fontSize: 10, fontWeight: 700,
                }}>
                {done ? <Check size={11} strokeWidth={2.5}/> : i + 1}
              </span>
              <span className="text-foreground"
                style={{
                  fontSize: 11,
                  fontWeight: active ? 600 : done ? 500 : 400,
                  color: active || done ? "var(--foreground)" : "var(--muted-foreground)",
                }}>
                {stage}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ─── Coordinator Card ─────────────────────────────────────────────────────────
// Details come from the Garm Admin Portal (Settings → Procurement Manager).
// When an order is assigned to an employee, only the NAME shown changes —
// phone, WhatsApp and email are company-wide and stay the same, always.
const DEFAULT_COORDINATOR: Coordinator = {
  name: "Priya Raman",
  role: "Owns quote, mill follow-up, QA and delivery",
  phone: "+91 98400 12345",
  whatsapp: "+91 98400 12345",
  email: "support@garm.com",
};

function CoordinatorCard({ coordinator, employeeName, onMessage }: {
  coordinator?: Coordinator | null; employeeName?: string; onMessage?: () => void;
}) {
  const c = coordinator ?? DEFAULT_COORDINATOR;
  const name = employeeName || c.name;
  const waDigits = (c.whatsapp || c.phone || "").replace(/\D/g, "");
  return (
    <Panel title="Your procurement manager">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: ACCENT, color: "#fff", fontWeight: 700, fontSize: 16 }}>
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-foreground" style={{ fontSize: 14, fontWeight: 600 }}>{name}</p>
          <p className="text-muted-foreground" style={{ fontSize: 11, marginTop: 2 }}>{c.role}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {([
          [<Phone size={13} strokeWidth={1.5}/>, "Call", () => { window.location.href = `tel:${(c.phone || "").replace(/\s/g, "")}`; }],
          [<MessageSquare size={13} strokeWidth={1.5}/>, "WhatsApp", () => { if (waDigits) window.open(`https://wa.me/${waDigits}`, "_blank"); else onMessage?.(); }],
          [<Mail size={13} strokeWidth={1.5}/>, "Email", () => { window.location.href = `mailto:${c.email}`; }],
        ] as [React.ReactNode, string, (() => void) | undefined][]).map(([icon, label, handler]) => (
          <button key={String(label)} onClick={handler}
            className="rounded-xl py-2 flex items-center justify-center gap-1.5 border border-border text-foreground"
            style={{ fontSize: 11, fontWeight: 500, cursor: "pointer", background: "var(--card)" }}>
            {icon}{label}
          </button>
        ))}
      </div>
    </Panel>
  );
}

// ─── Payment Milestones ───────────────────────────────────────────────────────
function PaymentMilestones({ order }: { order: OrderTrack }) {
  const isQuote = order.statusLabel === "Quote pending" || order.statusLabel === "Order placed";
  // Live orders show the REAL two-stage schedule from the backend.
  const rows: [string, string, string][] = order.apiId
    ? [
        ["Advance payment", `${orgAdvancePct()}%`, ["partial", "paid"].includes(order.livePaymentStatus ?? "") ? "Received" : "Due after quote confirmation"],
        ["Balance payment", `${100 - orgAdvancePct()}%`, order.livePaymentStatus === "paid" ? "Received" : "Due after the QC report"],
      ]
    : [
    ["Advance payment",    "30%", isQuote ? "Due after approval" : "Received"],
    ["Production payment", "50%", ["In production", "Quality check", "Shipped"].includes(order.statusLabel) ? "Received" : "Upcoming"],
    ["Final settlement",   "20%", order.statusLabel === "Shipped" ? "Due before dispatch" : "Upcoming"],
  ];
  return (
    <Panel title="Payment milestones" icon={<Wallet size={14} strokeWidth={1.5}/>}>
      <div className="flex flex-col gap-2">
        {rows.map(([label, pct, status]) => (
          <div key={label} className="flex items-center justify-between rounded-xl px-3 py-2.5 border border-border"
            style={{ background: "var(--card)" }}>
            <div>
              <p className="text-foreground" style={{ fontSize: 12, fontWeight: 600 }}>{label}</p>
              <p className="text-muted-foreground" style={{ fontSize: 10 }}>{pct} of order value</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${status === "Received" ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}
              style={{ fontWeight: 500, fontSize: 10 }}>
              {status}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── Sample Approval Card ─────────────────────────────────────────────────────
// Shows what's actually being approved — the real fabric, colour and logo/reference
// chosen when the order was placed — instead of three fixed placeholder swatches.
function SampleApprovalCard({ order }: { order: OrderTrack }) {
  const [decision, setDecision] = useState<"approved" | "changes" | null>(null);

  const firstLine = order.garmentLines?.[0];
  const fabricText = firstLine?.fabric || order.fabric || "Not specified";

  const colorEntry = order.colorList?.[0] ?? (firstLine ? { hex: firstLine.colorHex, label: firstLine.colorLabel } : undefined);
  const colorLabel = colorEntry?.label || order.colors || "Not selected";
  const colorHex = colorEntry?.hex || "#D1D5DB"; // neutral grey when nothing was actually chosen

  const refMethod = firstLine?.referenceMethod ?? order.referenceMethod;
  const refFiles = firstLine?.referenceFiles ?? order.referenceFiles ?? 0;
  const hasLogo = !!refMethod || refFiles > 0;
  const logoLabel = hasLogo ? (refMethod || `${refFiles} file${refFiles !== 1 ? "s" : ""} uploaded`) : "Not added";

  const swatches: { label: string; value: string; color: string }[] = [
    { label: "Fabric", value: fabricText,  color: "#1f2f46" },
    { label: "Color",  value: colorLabel,  color: colorHex },
    { label: "Logo",   value: logoLabel,   color: hasLogo ? ACCENT : "#D1D5DB" },
  ];

  return (
    <Panel title="Sample approval" icon={<Palette size={14} strokeWidth={1.5}/>}>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {swatches.map(sw => (
          <div key={sw.label} className="rounded-xl border border-border overflow-hidden bg-muted">
            <div className="h-10" style={{ background: sw.color }}/>
            <div className="text-center py-1.5 px-1">
              <p className="text-muted-foreground" style={{ fontSize: 9, lineHeight: 1.3 }}>{sw.label}</p>
              <p className="text-foreground" style={{ fontSize: 10.5, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sw.value}>{sw.value}</p>
            </div>
          </div>
        ))}
      </div>
      {decision ? (
        <p className={`rounded-xl ${decision === "approved" ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}
          style={{ fontSize: 12, fontWeight: 600, padding: "10px 12px" }}>
          {decision === "approved"
            ? "Sample approved for production"
            : "Changes requested. Your manager will confirm updates."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setDecision("approved")}
            className="rounded-xl py-2.5 text-xs text-white"
            style={{ fontWeight: 500, cursor: "pointer", background: DARK, border: "none" }}>
            Approve
          </button>
          <button onClick={() => setDecision("changes")}
            className="rounded-xl py-2.5 text-xs border border-border text-foreground"
            style={{ fontWeight: 500, cursor: "pointer", background: "var(--card)" }}>
            Request change
          </button>
        </div>
      )}
    </Panel>
  );
}

// ─── Document Vault ───────────────────────────────────────────────────────────
// Live orders: real files — invoices/quotations/billing the Garm team uploaded
// in the admin portal (tap to download), plus your own design/logo uploads.
// Demo orders keep the old placeholder rows.
const DOC_KIND_LABELS: Record<string, string> = {
  INVOICE: "Invoice", QUOTATION: "Quotation", BILLING: "Billing", DESIGN: "Your design upload", OTHER: "Document",
};

function downloadDataUrl(dataUrl: string, name: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = name;
  a.click();
}

function DocumentVault({ order }: { order: OrderTrack }) {
  // ── Live order: show the real attached documents ──
  if (order.apiId) {
    // Only show documents the admin has actually sent — a generated invoice
    // stays a hidden draft (visible:false) until the admin clicks "Send".
    const docs = (order.documents ?? []).filter((d) => d.visible !== false);
    if (docs.length === 0) return null;
    return (
      <div style={{ ...card, overflow: "hidden" }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <FileText size={14} strokeWidth={1.5} className="text-muted-foreground"/>
          <p className="text-foreground text-sm font-semibold">Documents</p>
        </div>
        {docs.map((d, i) => (
          <button key={d._id ?? i}
            onClick={() => downloadDataUrl(d.dataUrl, d.name)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
            style={{ background: "transparent", border: "none", borderTop: "1px solid var(--border)", cursor: "pointer" }}>
            <span className="flex items-center gap-2 text-foreground min-w-0" style={{ fontSize: 12, fontWeight: 500 }}>
              <ReceiptText size={13} strokeWidth={1.5} style={{ color: ACCENT, flexShrink: 0 }}/>
              <span className="min-w-0" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.name}
                <span className="text-muted-foreground" style={{ fontWeight: 400 }}> · {DOC_KIND_LABELS[d.kind] ?? d.kind}{d.uploadedBy === "admin" ? " from Garm" : ""}</span>
              </span>
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT_TEXT, flexShrink: 0 }}>Download</span>
          </button>
        ))}
      </div>
    );
  }

  // ── Demo orders: legacy placeholder rows ──
  const documentsAvailable = !order.isNew && ["Quality check", "Shipped", "Delivered", "Completed"].includes(order.statusLabel);
  if (!documentsAvailable) return null;

  const docs: [string, string][] = [
    ["Invoice",         order.statusLabel === "Quote pending" ? "Draft" : `INV-${order.id.slice(4)}`],
    ["Payment receipt", order.statusLabel === "Quote pending" ? "Pending" : "Available"],
  ];

  return (
    <div style={{ ...card, overflow: "hidden" }}>
      <div className="px-4 py-3 flex items-center gap-2">
        <FileText size={14} strokeWidth={1.5} className="text-muted-foreground"/>
        <p className="text-foreground text-sm font-semibold">Documents</p>
      </div>
      {docs.map(([label, status]) => {
        const available = status === "Available";
        return (
          <button key={label} disabled={!available}
            onClick={() => available && alert(`Downloading ${label}…`)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
            style={{
              background: "transparent", border: "none",
              borderTop: "1px solid var(--border)",
              cursor: available ? "pointer" : "default",
              opacity: available ? 1 : 0.5,
            }}>
            <span className="flex items-center gap-2 text-foreground" style={{ fontSize: 12, fontWeight: 500 }}>
              <ReceiptText size={13} strokeWidth={1.5} style={{ color: ACCENT }}/>{label}
            </span>
            <span className="text-muted-foreground" style={{ fontSize: 10 }}>{status}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Star Rating ──────────────────────────────────────────────────────────────
function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i}
          onClick={() => onChange?.(i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          style={{ background: "none", border: "none", cursor: onChange ? "pointer" : "default", padding: 1 }}>
          <Star size={22} strokeWidth={1.5}
            fill={(hovered || value) >= i ? ACCENT : "none"}
            stroke={(hovered || value) >= i ? ACCENT : "rgba(0,0,0,0.2)"}/>
        </button>
      ))}
    </div>
  );
}

// ─── Return / damage request modal ────────────────────────────────────────────
// Raises a support ticket of type "return" against a delivered order, with
// damage photos. The admin verifies the photos and approves/declines; the
// customer follows it under Account › Help & support › Track my tickets.
const RETURN_REASONS = ["Damaged / defective item", "Wrong item received", "Wrong size / fit", "Quality not as expected", "Missing items", "Other"];
function ReturnModal({ order, onClose, onDone }: { order: OrderTrack; onClose: () => void; onDone: (ref: string) => void }) {
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [details, setDetails] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addImages(files: FileList | null) {
    if (!files) return;
    const room = 5 - images.length;
    const picked = Array.from(files).slice(0, room);
    const read = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
    const okType = (f: File) => /^image\/(png|jpe?g|webp|gif)$/i.test(f.type);
    const okSize = (f: File) => f.size <= 4 * 1024 * 1024;
    const valid = picked.filter((f) => okType(f) && okSize(f));
    if (valid.length < picked.length) setError("Some files were skipped — only images up to 4MB each.");
    const dataUrls = await Promise.all(valid.map(read));
    setImages((prev) => [...prev, ...dataUrls].slice(0, 5));
  }

  async function submit() {
    if (!details.trim()) { setError("Please describe the problem."); return; }
    setBusy(true); setError("");
    try {
      const { ticket } = await supportApi.create({
        type: "return",
        category: "Return / Damage",
        subject: `${reason} — ${order.id}`,
        message: details.trim(),
        orderRef: order.id,
        images,
      });
      onDone(ticket.ref);
    } catch (e) {
      setError((e as Error).message || "Couldn't submit. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full bg-background rounded-t-3xl p-5 max-h-[88%] overflow-y-auto" onClick={(e) => e.stopPropagation()} style={{ animation: "trackPopIn .25s ease" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-foreground text-base" style={{ fontWeight: 700 }}>Report a problem / Return</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><ChevronDown size={16}/></button>
        </div>
        <p className="text-muted-foreground text-xs mb-3">Order {order.id}. Tell us what's wrong and add photos — our team will review and get back to you.</p>

        <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>What's the issue?</p>
        <div className="relative mb-3">
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none appearance-none pr-10" style={{ ...fnt, cursor: "pointer" }}>
            {RETURN_REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <ChevronDown size={15} strokeWidth={1.8} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#6b7280", pointerEvents: "none" }}/>
        </div>

        <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Describe the problem</p>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="e.g. Two t-shirts arrived with stitching coming apart at the seam." className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none resize-none h-20 mb-3" style={fnt}/>

        <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Photos of the damage ({images.length}/5)</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {images.map((src, i) => (
            <div key={i} className="relative" style={{ width: 64, height: 64 }}>
              <img src={src} className="w-full h-full object-cover rounded-lg" style={{ border: "1px solid var(--border)" }}/>
              <button onClick={() => setImages((p) => p.filter((_, x) => x !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-foreground text-white flex items-center justify-center" style={{ fontSize: 11 }}>×</button>
            </div>
          ))}
          {images.length < 5 && (
            <label className="flex items-center justify-center rounded-lg cursor-pointer" style={{ width: 64, height: 64, border: "1.5px dashed var(--border)", color: "#9ca3af" }}>
              <Package size={18}/>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addImages(e.target.files)}/>
            </label>
          )}
        </div>

        {error && <p style={{ fontSize: 12, color: "#b91c1c", marginBottom: 10 }}>{error}</p>}
        <button onClick={submit} disabled={busy || !details.trim()} style={busy || !details.trim() ? { ...btnPrimary, background: "#e5e7eb", color: "#9ca3af" } : btnPrimary}>
          {busy ? "Submitting…" : "Submit return request"}
        </button>
        <div style={{ height: 8 }}/>
      </div>
    </div>
  );
}

// ─── Past Order Detail ────────────────────────────────────────────────────────
function PastOrderDetail({ order, onReorder, onRated }: { order: OrderTrack; onReorder?: () => void; onRated?: (apiId: string, rating: number, feedback?: string) => void }) {
  // Initialise from the saved rating so a rated order shows "submitted" instead
  // of asking again (previously this was local-only, so it re-appeared and the
  // admin never saw it).
  const [rating, setRating]         = useState(order.rating ?? 0);
  const [feedback, setFeedback]     = useState(order.ratingFeedback ?? "");
  const [ratingDone, setRatingDone] = useState(!!order.rating);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnRef, setReturnRef]   = useState("");
  // Keep this section in step with the order's saved rating — so a rating given
  // in the delivered popup (or on another device) shows here too, instead of the
  // box still looking un-rated ("fresh").
  useEffect(() => {
    if (order.rating) {
      setRating(order.rating);
      setFeedback(order.ratingFeedback ?? "");
      setRatingDone(true);
    }
  }, [order.rating, order.ratingFeedback]);

  async function submitRating() {
    if (rating < 1) return;
    setRatingBusy(true);
    try {
      if (order.apiId) {
        await ordersApi.rate(order.apiId, rating, feedback.trim() || undefined);
        onRated?.(order.apiId, rating, feedback.trim() || undefined);
      }
      setRatingDone(true);
    } catch { /* keep the form open so they can retry */ }
    finally { setRatingBusy(false); }
  }

  return (
    <div className="flex flex-col gap-3">
      {returnOpen && <ReturnModal order={order} onClose={() => setReturnOpen(false)} onDone={(ref) => { setReturnRef(ref); setReturnOpen(false); }}/>}
      <OrderDetailsCard order={order}/>

      {/* Payment details */}
      <Panel title="Payment details">
        <div className="flex flex-col gap-2">
          {([
            ["Payment mode",  order.paymentMode ?? "Recorded payment"],
            ["Amount",        order.total ?? "–"],
            ["Payment date",  order.paymentDate ?? order.etaDate],
            ["Status",        "Payment received"],
            ["Reference",     order.paymentReference ?? `TXN-${order.id.slice(1)}-2025`],
          ] as [string, string][]).map(([k, v]) => (
            <DetailRow key={k} label={k} value={v} accent={v === "Payment received"}/>
          ))}
        </div>
      </Panel>

      {/* Rating & Feedback */}
      <Panel title="Rating & feedback">
        {ratingDone ? (
          <div className="flex flex-col items-center py-2">
            <StarRating value={rating}/>
            <p className="text-emerald-600 text-sm mt-2" style={{ fontWeight: 500 }}>Feedback submitted</p>
            {feedback && <p className="text-muted-foreground text-xs mt-1 text-center">{feedback}</p>}
          </div>
        ) : (
          <>
            <p className="text-foreground text-xs font-medium mb-3">How was your experience?</p>
            <div className="flex justify-center mb-3">
              <StarRating value={rating} onChange={setRating}/>
            </div>
            {rating > 0 && (
              <>
                <textarea value={feedback} onChange={e => setFeedback(e.target.value)}
                  placeholder="Tell us about the quality, delivery speed, coordinator service…"
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-xs outline-none resize-none h-20 mb-3"
                  style={fnt}/>
                <button onClick={submitRating} disabled={ratingBusy} style={ratingBusy ? { ...btnPrimary, opacity: 0.6 } : btnPrimary}>
                  {ratingBusy ? "Submitting…" : "Submit feedback"}
                </button>
              </>
            )}
            {rating === 0 && (
              <p className="text-muted-foreground text-xs text-center">Tap a star to rate</p>
            )}
          </>
        )}
      </Panel>

      <DocumentVault order={order}/>

      {/* Return / damage — raise a verified return request against this order */}
      {returnRef ? (
        <div className="rounded-2xl p-3.5" style={{ background: "#e8f5e9", border: "1px solid #a5d6a7" }}>
          <p className="text-emerald-800 text-sm" style={{ fontWeight: 600 }}>Return request submitted · {returnRef}</p>
          <p className="text-emerald-700 text-xs mt-1">Our team is reviewing your photos. Track the outcome under Account › Help &amp; support › Track my tickets.</p>
        </div>
      ) : (
        <button onClick={() => setReturnOpen(true)} className="w-full rounded-2xl py-3 text-sm flex items-center justify-center gap-2"
          style={{ border: "1.5px solid var(--border)", background: "var(--card)", color: "#b91c1c", fontWeight: 600 }}>
          <RotateCcw size={15} strokeWidth={1.6}/> Report a problem / Return
        </button>
      )}

      {onReorder && (
        <button onClick={onReorder} style={btnAccent}>
          <RotateCcw size={15} strokeWidth={1.5}/> {order.isUniform ? "Reorder this uniform" : "Order this again"}
        </button>
      )}
    </div>
  );
}

// ─── First-login coach-mark spotlight ──────────────────────────────────────────
// One-shot "tap here" pointer at the first order card's header — shown only the very
// first time someone reaches Track (tracked by a one-time localStorage flag, never
// reset). Targets the header button (a fixed-height element) rather than the whole
// card, since the card's overall height can grow hugely when it's auto-expanded
// (forceOpen), which previously blew the spotlight's position math off-screen.
function TrackCoachmark({ storageKey, targetId, title, body }: {
  storageKey: string; targetId: string; title: string; body: string;
}) {
  const [done, setDone] = useState(() => {
    try { return localStorage.getItem(storageKey) === "1"; } catch { return false; }
  });
  const [frame, setFrame] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [rect, setRect]   = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (done) return;
    let raf = 0;
    const tick = () => {
      const frameEl  = document.getElementById("garm-phone-frame");
      const targetEl = document.getElementById(targetId);
      if (frameEl && targetEl) {
        const f = frameEl.getBoundingClientRect();
        const t = targetEl.getBoundingClientRect();
        setFrame({ top: f.top, left: f.left, width: f.width, height: f.height });
        setRect({ top: t.top - f.top, left: t.left - f.left, width: t.width, height: t.height });
      } else {
        setRect(null);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [done, targetId]);

  if (done || !rect || !frame) return null;

  function dismiss() {
    setDone(true);
    try { localStorage.setItem(storageKey, "1"); } catch { /* ignore */ }
  }

  const pad = 6;
  const hole = { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  const placeBelow = hole.top < frame.height * 0.55;
  const bubbleTop = placeBelow ? Math.min(hole.top + hole.height + 12, frame.height - 140) : undefined;
  const bubbleBottom = !placeBelow ? Math.max(frame.height - hole.top + 12, 12) : undefined;

  return (
    <div style={{ position: "fixed", top: frame.top, left: frame.left, width: frame.width, height: frame.height, zIndex: 9999, overflow: "hidden", borderRadius: 44, pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: Math.max(0, hole.top), background: "rgba(13,13,13,0.68)" }}/>
      <div style={{ position: "absolute", top: hole.top + hole.height, left: 0, right: 0, bottom: 0, background: "rgba(13,13,13,0.68)" }}/>
      <div style={{ position: "absolute", top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height, background: "rgba(13,13,13,0.68)" }}/>
      <div style={{ position: "absolute", top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height, background: "rgba(13,13,13,0.68)" }}/>
      <div style={{ position: "absolute", top: hole.top, left: hole.left, width: hole.width, height: hole.height, borderRadius: 16, border: `2px solid ${ACCENT}`, boxShadow: "0 0 0 3px rgba(200,169,126,0.25)" }}/>
      <div style={{
          position: "absolute", top: bubbleTop, bottom: bubbleBottom, left: 20, right: 20,
          background: "var(--background)", borderRadius: 16, padding: 16,
          boxShadow: "0 12px 28px rgba(0,0,0,0.22)", border: "1px solid var(--border)",
          pointerEvents: "auto",
        }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 4 }}>{title}</p>
        <p className="text-muted-foreground mb-3" style={{ fontSize: 12, lineHeight: 1.5 }}>{body}</p>
        <div className="flex justify-end">
          <button onClick={dismiss} className="flex items-center gap-1 px-3.5 py-2 rounded-xl" style={{ background: DARK, color: "#fff", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({ order, accountType, onMessage, onReorder, onEditOrder, paidOverride, onMarkPaid, forceOpen, onDeliveredOpen, headerId, coordinator, onPayLive, onRated }: {
  order: OrderTrack; accountType?: "personal" | "organisation";
  onMessage?: () => void; onReorder?: () => void; onEditOrder?: (payload?: DraftPayload) => void;
  paidOverride?: boolean; onMarkPaid?: () => void; forceOpen?: boolean;
  onDeliveredOpen?: (order: OrderTrack) => void; headerId?: string;
  coordinator?: Coordinator | null;
  onPayLive?: (order: OrderTrack, mode: string, stage?: "advance" | "balance" | "full") => Promise<void>;
  onRated?: (apiId: string, rating: number, feedback?: string) => void;
}) {
  const [open, setOpen] = useState(order.defaultOpen || forceOpen);
  const firedRef = React.useRef(false);
  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);

  const isPast    = PAST_STATUSES.includes(order.statusLabel);
  const canChange = CHANGEABLE_STATUSES.includes(order.statusLabel);
  // Coordinator/manager details are REAL admin data — only shown once Garm has
  // confirmed the order and (ideally) assigned a person. Before that we never
  // invent a name; we show a "being assigned" placeholder instead.
  const awaitingConfirm = order.apiId
    ? (order.adminStatus === "NEW" || !order.adminStatus)
    : (order.statusLabel === "Order placed" || order.statusLabel === "Quote pending");
  const showCoordinator = !!order.assignedEmployee || (!awaitingConfirm && !!coordinator);

  // Fire onDeliveredOpen once when a delivered order card is expanded — pass the
  // order so the rating popup knows WHICH order to attach the rating to.
  useEffect(() => {
    if (open && isPast && onDeliveredOpen && !firedRef.current) {
      firedRef.current = true;
      setTimeout(() => onDeliveredOpen(order), 600);
    }
  }, [open, isPast, onDeliveredOpen]);

  return (
    <div className="rounded-2xl overflow-hidden mb-3"
      style={{
        background: "var(--card)",
        border: order.isNew
          ? `1.5px solid ${ACCENT}`
          : "1px solid var(--border)",
        boxShadow: open
          ? "0 2px 4px rgba(13,13,13,0.04), 0 10px 24px rgba(13,13,13,0.07)"
          : "0 1px 2px rgba(13,13,13,0.03), 0 4px 14px rgba(13,13,13,0.04)",
        transition: "box-shadow .25s ease",
      }}>

      {/* Gold thread strip — appears when the card is open */}
      {open && !order.isNew && (
        <div style={{ height: 3, background: "linear-gradient(90deg, #C8A97E 0%, rgba(200,169,126,0.2) 100%)" }}/>
      )}

      {/* New order banner */}
      {order.isNew && order.statusLabel !== "Cancelled" && (
        <div className="px-4 py-2 border-b border-border" style={{ background: ACCENT_BG }}>
          <span style={{ fontSize: 11, color: ACCENT_TEXT, fontWeight: 500 }}>
            Newly submitted — awaiting coordinator review
          </span>
        </div>
      )}

      {/* Cancelled banner */}
      {order.statusLabel === "Cancelled" && (
        <div className="px-4 py-2 border-b border-border" style={{ background: "#fef2f2" }}>
          <span style={{ fontSize: 11, color: "#b91c1c", fontWeight: 600 }}>
            Order cancelled{order.cancelReason ? ` · ${order.cancelReason}` : ""}
            {(order.refundAmount ?? 0) > 0 ? ` · Refund ${fmtINR(order.refundAmount)} issued` : ""}
          </span>
        </div>
      )}

      {/* Refund banner (order not cancelled but a refund was issued, e.g. damage) */}
      {order.statusLabel !== "Cancelled" && (order.refundAmount ?? 0) > 0 && (
        <div className="px-4 py-2 border-b border-border" style={{ background: "#fffbeb" }}>
          <span style={{ fontSize: 11, color: "#92400e", fontWeight: 600 }}>
            Refund issued · {fmtINR(order.refundAmount)}{order.refundReason ? ` · ${order.refundReason}` : ""}{order.refundedAt ? ` · ${order.refundedAt}` : ""}
          </span>
        </div>
      )}

      {/* Card header (tap to expand) — a fixed-size element regardless of open/forceOpen
          state, unlike the card as a whole, which makes it the safe coachmark target. */}
      <button onClick={() => setOpen(v => !v)}
        id={headerId}
        className="w-full flex items-start justify-between p-4 text-left"
        style={{ background: "transparent", border: "none", cursor: "pointer" }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-muted-foreground" style={{ fontSize: 11 }}>
              {order.id === "FL-PENDING" ? "Ref assigning…" : order.id}
            </span>
            <StatusBadge label={order.statusLabel} cls={order.statusColor}/>
          </div>
          <p className="text-foreground" style={{ fontSize: 14, fontWeight: 600 }}>{order.name}</p>
          {!open && (
            <p className="text-muted-foreground mt-1" style={{ fontSize: 11 }}>
              {order.statusLabel} · {order.etaDate}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2 mt-0.5">
          {!open && <span className="text-muted-foreground" style={{ fontSize: 11 }}>{order.etaDate}</span>}
          {open
            ? <ChevronUp size={15} strokeWidth={1.5} className="text-muted-foreground"/>
            : <ChevronDown size={15} strokeWidth={1.5} className="text-muted-foreground"/>}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-4 pb-4 border-t border-border">
          {isPast ? (
            <div className="pt-3">
              <PastOrderDetail order={order} onReorder={onReorder} onRated={onRated}/>
            </div>
          ) : (
            <div className="pt-3">
              {/* Stage animation — scene follows the order's current stage */}
              <div className="mb-4">
                <StageAnimation stage={
                  (order.steps.find(s => s.status === "active")
                    ? stageFromLabel(order.steps.find(s => s.status === "active")!.label)
                    : "delivered") as OrderStage
                }/>
              </div>

              {/* Timeline steps */}
              {order.steps.map((step, i) => {
                const isLast     = i === order.steps.length - 1;
                const iconBg     = step.status === "done"   ? DARK      : step.status === "active" ? ACCENT_BG : "var(--card)";
                const iconBorder = step.status === "done"   ? DARK      : step.status === "active" ? ACCENT    : "var(--border)";
                const iconColor  = step.status === "done"   ? "#fff"    : step.status === "active" ? ACCENT    : "var(--muted-foreground)";
                return (
                  <div key={i} className="flex items-start gap-3 relative"
                    style={{ marginBottom: isLast ? 0 : 16 }}>
                    {!isLast && (
                      <div className="absolute"
                        style={{
                          left: 11, top: 24, bottom: -16, width: 2, borderRadius: 2,
                          background: step.status === "done" ? "rgba(13,13,13,0.55)" : "var(--border)",
                          zIndex: 0,
                        }}/>
                    )}
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center relative"
                      style={{
                        background: iconBg, border: `1.5px solid ${iconBorder}`, color: iconColor, zIndex: 1,
                        boxShadow: step.status === "active" ? `0 0 0 4px ${ACCENT_BG}` : "none",
                        animation: step.status === "active" ? "trackActivePulse 2s ease-in-out infinite" : "none",
                      }}>
                      {step.icon}
                    </div>
                    <div style={{ paddingTop: 2 }}>
                      <p style={{
                        fontSize: 13,
                        fontWeight: step.status === "pending" ? 400 : 500,
                        lineHeight: 1.3,
                        color: step.status === "pending" ? "var(--muted-foreground)" : "var(--foreground)",
                      }}>
                        {step.label}
                      </p>
                      <p className="text-muted-foreground" style={{ fontSize: 11, marginTop: 1 }}>{step.sub}</p>
                    </div>
                  </div>
                );
              })}

              {/* ETA row */}
              <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-border">
                <p className="text-muted-foreground" style={{ fontSize: 12 }}>Estimated delivery</p>
                <p className="text-foreground" style={{ fontSize: 13, fontWeight: 600 }}>{order.etaDate}</p>
              </div>

              {/* Sub-cards */}
              <div className="mt-3 flex flex-col gap-3">
                {showCoordinator
                  ? <CoordinatorCard coordinator={coordinator} employeeName={order.assignedEmployee} onMessage={onMessage}/>
                  : <Panel title="Your procurement manager">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--muted)", color: "#9ca3af" }}>
                          <User size={18} strokeWidth={1.6}/>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground" style={{ fontSize: 13.5, fontWeight: 600 }}>Being assigned</p>
                          <p className="text-muted-foreground" style={{ fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>Garm will assign your coordinator once this order is confirmed. Their contact appears here then.</p>
                        </div>
                      </div>
                    </Panel>}
                <PaymentMethodCard order={order} accountType={accountType} paidOverride={paidOverride} onMarkPaid={onMarkPaid}
                  onPayLive={order.apiId && onPayLive ? (mode, stage) => onPayLive(order, mode, stage) : undefined}/>
                <OrderDetailsCard order={order} canChange={canChange} accountType={accountType} onEdit={() => onEditOrder?.(order.editPayload)}/>
                {accountType !== "personal" && CHANGEABLE_STATUSES.includes(order.statusLabel) && !order.isAccessoryOrder && <SampleApprovalCard order={order}/>}
                <DocumentVault order={order}/>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TrackTab export ──────────────────────────────────────────────────────────
export function TrackTab({ showNew, newOrderSummary, accountType, onMessageCoordinator, onReorder, onEditOrder, paidOrderIds, onMarkOrderPaid, targetOrderId, onOrderDelivered, ratingOverrides, onRated }: {
  showNew?: boolean;
  newOrderSummary?: SubmittedOrderSummary | null;
  accountType?: "personal" | "organisation";
  onMessageCoordinator?: () => void;
  onReorder?: () => void;
  onEditOrder?: (payload?: DraftPayload) => void;
  paidOrderIds?: string[];
  onMarkOrderPaid?: (id: string) => void;
  targetOrderId?: string | null;
  onOrderDelivered?: (order: OrderTrack) => void;
  // Ratings just submitted via the delivered popup — applied immediately so the
  // Track "Rating & feedback" section reflects them before the next poll.
  ratingOverrides?: Record<string, { rating: number; feedback?: string }>;
  // Called when a rating is submitted from the inline section, so the parent can
  // record it (keeps the popup from re-nagging on reopen).
  onRated?: (apiId: string, rating: number, feedback?: string) => void;
}) {
  const [filter, setFilter] = useState<TrackFilter>("active");
  const newSubmittedOrder = buildNewSubmittedOrder(newOrderSummary, accountType);

  // ── Live orders from the backend ─────────────────────────────────────────
  // null = fetch hasn't succeeded (offline / signed out) → fall back to the
  // built-in demo orders so the tab never looks broken. Once the fetch works,
  // ONLY real orders are shown. Polled so admin-side changes (confirmation,
  // status updates) appear without reopening the tab.
  const [liveOrders, setLiveOrders] = useState<OrderTrack[] | null>(null);
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);
  const [pendingSync, setPendingSync] = useState(() => readPendingOrders().length);
  // Popups: admin confirmed your order (pay now) / payment success.
  const [confirmedPopup, setConfirmedPopup] = useState<{ ref: string; amount?: number } | null>(null);
  const [paySuccess, setPaySuccess] = useState<{ ref: string; amount?: number } | null>(null);
  // Order card force-opened from a popup's "View & pay" button.
  const [localTarget, setLocalTarget] = useState<string | null>(null);

  // Detect admin-side status transitions between refreshes so the customer
  // gets an explicit in-app popup AND a system notification (Android/iOS
  // tray, browser notification on web) the moment something changes.
  function detectConfirmations(orders: OrderTrack[]) {
    let seen: Record<string, string> = {};
    try { seen = JSON.parse(localStorage.getItem("fl_seen_admin_status") || "{}"); } catch { /* ignore */ }
    for (const o of orders) {
      const prev = seen[o.id];
      const cur = o.adminStatus;
      if (cur && prev && prev !== cur) {
        if (cur === "CONFIRMED" && o.livePaymentStatus !== "paid") {
          setConfirmedPopup({ ref: o.id, amount: o.totalAmount });
          notifyDevice("Order confirmed 🎉", `${o.id} is confirmed by Garm${o.totalAmount ? ` — pay ₹${o.totalAmount.toLocaleString("en-IN")} to start production` : ""}.`);
        }
        if (["ASSIGNED", "IN_PROGRESS"].includes(cur) && !["ASSIGNED", "IN_PROGRESS"].includes(prev)) {
          notifyDevice("In production 🧵", `${o.id} — your garments are being made.`);
        }
        if (cur === "SHIPPED") {
          notifyDevice("Shipped 🚚", `${o.id} is on the way${o.etaDate && o.etaDate !== "TBD" ? ` — arriving ${o.etaDate}` : ""}.`);
        }
        if (cur === "DELIVERED") {
          notifyDevice("Delivered ✅", `${o.id} was delivered. Thank you for ordering with Garm!`);
        }
      }
      if (cur) seen[o.id] = cur;
    }
    try { localStorage.setItem("fl_seen_admin_status", JSON.stringify(seen)); } catch { /* ignore */ }
  }

  // Retry any orders that couldn't reach the backend when they were submitted
  // (offline, expired session…). Runs before every live refresh, so a queued
  // order lands in the admin portal as soon as connectivity is back.
  // Uses the SHARED, lock-guarded flush so it can't double-submit a queued
  // order alongside the app-level poller (both call the same locked routine).
  async function flushPendingOrders() {
    const remaining = await flushPendingOrdersShared();
    setPendingSync(remaining);
  }

  async function refreshLive() {
    if (!authToken.get()) { setPendingSync(readPendingOrders().length); return; }
    await flushPendingOrders();
    try {
      const { orders } = await ordersApi.list();
      const summaries = readOrderSummaries();
      const mapped = orders.filter(o => o.status !== "Draft").map(o => apiOrderToTrack(o, summaries));
      detectConfirmations(mapped);
      setLiveOrders(mapped);
    } catch { /* keep whatever we had */ }
  }

  useEffect(() => {
    initNotifications();
    refreshLive();
    const loadCoordinator = () => coordinatorApi.get().then(d => setCoordinator(d.coordinator)).catch(() => {});
    loadCoordinator();
    const t = setInterval(refreshLive, 30_000);
    // Coordinator contact is edited in the admin portal — refresh it too so a
    // changed name/phone/WhatsApp reaches the customer without an app reload.
    const c = setInterval(loadCoordinator, 60_000);
    // Refresh the moment the customer returns to the app — so a payment the
    // admin just recorded (or a doc they just sent) shows immediately, instead
    // of waiting up to 30s for the next poll.
    const onFocus = () => { if (document.visibilityState === "visible") refreshLive(); };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t); clearInterval(c);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePayLive(order: OrderTrack, mode: string, stage?: "advance" | "balance" | "full") {
    if (!order.apiId) return;
    await ordersApi.pay(order.apiId, mode, undefined, stage);
    // Success popup — the payment status also flows straight to the admin
    // portal (its Orders page polls the shared database).
    setPaySuccess({ ref: order.id, amount: order.totalAmount });
    notifyDevice("Payment received ✅", `${order.id} — payment successful. Production starts shortly.`);
    setConfirmedPopup(null);
    await refreshLive();
  }

  useEffect(() => {
    if (targetOrderId) {
      const order = (liveOrders ?? []).find(o => o.id === targetOrderId);
      if (order && PAST_STATUSES.includes(order.statusLabel)) setFilter("past");
      else if (order) setFilter("active");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetOrderId]);

  // Real orders ONLY. Never fall back to demo data — showing built-in sample
  // orders (#FL-2041 etc.) to a signed-in customer looks like another person's
  // orders leaking into their account. While the first fetch is still in flight
  // (`liveOrders === null`) we show nothing but the just-submitted card, and the
  // empty/loading state below covers the rest.
  let base: OrderTrack[];
  if (liveOrders) {
    const showLocalNew = showNew && !liveOrders.some(o => o.id === newSubmittedOrder.id);
    base = showLocalNew ? [newSubmittedOrder, ...liveOrders] : liveOrders;
  } else {
    base = showNew ? [newSubmittedOrder] : [];
  }
  // Apply just-submitted popup ratings so the Rating & feedback section updates
  // instantly (the 30s poll then confirms the same value from the backend).
  if (ratingOverrides) {
    base = base.map(o => {
      const ov = o.apiId ? ratingOverrides[o.apiId] : undefined;
      return ov && !o.rating ? { ...o, rating: ov.rating, ratingFeedback: ov.feedback ?? o.ratingFeedback } : o;
    });
  }
  const filtered = base.filter(o => {
    if (filter === "active") return [...ACTIVE_STATUSES, ...(showNew ? ["Order placed" as OrderStatus] : [])].includes(o.statusLabel);
    if (filter === "past")   return PAST_STATUSES.includes(o.statusLabel);
    return true;
  });

  const counts = {
    active: base.filter(o => ACTIVE_STATUSES.includes(o.statusLabel) || o.statusLabel === "Order placed").length,
    past:   base.filter(o => PAST_STATUSES.includes(o.statusLabel)).length,
    all:    base.length,
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
      <style>{`
        @keyframes trackActivePulse{0%,100%{box-shadow:0 0 0 4px ${ACCENT_BG}}50%{box-shadow:0 0 0 7px rgba(200,169,126,0.06)}}
        @keyframes trackPopIn{0%{transform:scale(.85);opacity:0}100%{transform:scale(1);opacity:1}}
        @media (prefers-reduced-motion:reduce){.track-anim-off,[style*="trackActivePulse"],[style*="trackPopIn"]{animation:none!important}}
      `}</style>

      {/* ── "Order confirmed — pay now" notification popup ── */}
      {confirmedPopup && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-6" style={{ background: "rgba(13,13,13,0.55)" }}>
          <div className="w-full rounded-3xl p-5 text-center" style={{ background: "var(--background)", animation: "trackPopIn .25s ease", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
            <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: ACCENT_BG, border: `2px solid ${ACCENT}` }}>
              <ClipboardCheck size={26} strokeWidth={1.5} style={{ color: ACCENT_TEXT }}/>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: DARK }}>Order confirmed!</p>
            <p className="text-muted-foreground mt-1.5" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
              Garm has confirmed <b style={{ color: DARK }}>{confirmedPopup.ref}</b>.
              {confirmedPopup.amount ? <> Pay <b style={{ color: DARK }}>{fmtINR(confirmedPopup.amount)}</b> to start production.</> : " Pay now to start production."}
            </p>
            <button onClick={() => { setLocalTarget(confirmedPopup.ref); setConfirmedPopup(null); }} style={{ ...btnPrimary, marginTop: 16 }}>
              <Wallet size={15} strokeWidth={1.5}/> View & pay
            </button>
            <button onClick={() => setConfirmedPopup(null)} style={{ ...btnSecondary, marginTop: 8 }}>Later</button>
          </div>
        </div>
      )}

      {/* ── Payment success popup ── */}
      {paySuccess && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-6" style={{ background: "rgba(13,13,13,0.55)" }}>
          <div className="w-full rounded-3xl p-5 text-center" style={{ background: "var(--background)", animation: "trackPopIn .25s ease", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
            <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: "#ECFDF5", border: "2px solid #059669" }}>
              <Check size={28} strokeWidth={2.5} style={{ color: "#059669" }}/>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: DARK }}>Payment received!</p>
            <p className="text-muted-foreground mt-1.5" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
              {paySuccess.amount ? <><b style={{ color: DARK }}>{fmtINR(paySuccess.amount)}</b> paid for </> : "Paid for "}
              <b style={{ color: DARK }}>{paySuccess.ref}</b>. The Garm team has been notified — production starts shortly. Follow every step right here in Track.
            </p>
            <button onClick={() => { setLocalTarget(paySuccess.ref); setPaySuccess(null); }} style={{ ...btnPrimary, marginTop: 16 }}>Done</button>
          </div>
        </div>
      )}

      {/* ── Filter tabs — segmented control ── */}
      <div className="px-5 pt-4 pb-3 flex-shrink-0">
        <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
          {(["active", "past", "all"] as TrackFilter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="flex-1 py-2 rounded-xl text-sm"
              style={{
                background: filter === f ? "var(--card)" : "transparent",
                color: filter === f ? "var(--foreground)" : "var(--muted-foreground)",
                fontWeight: filter === f ? 600 : 500,
                border: "none", cursor: "pointer",
                boxShadow: filter === f ? "0 1px 3px rgba(13,13,13,0.10), 0 1px 2px rgba(13,13,13,0.06)" : "none",
                transition: "background .2s, box-shadow .2s, color .2s",
              }}>
              {f === "active" ? `Active (${counts.active})` : f === "past" ? `Past (${counts.past})` : `All (${counts.all})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Pending-sync notice — an order couldn't reach the server yet ── */}
      {pendingSync > 0 && (
        <div className="mx-5 mb-3 flex-shrink-0 rounded-xl px-3.5 py-2.5" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>
            {pendingSync} order{pendingSync === 1 ? "" : "s"} waiting to sync
          </p>
          <p style={{ fontSize: 11, color: "#92400E", lineHeight: 1.5, marginTop: 2 }}>
            We couldn't reach Garm's servers — your order is saved on this device and will be submitted automatically. Check your connection.
          </p>
          <button onClick={refreshLive} className="mt-1.5 px-3 py-1.5 rounded-lg" style={{ fontSize: 11.5, fontWeight: 700, color: "#92400E", background: "#FEF3C7", border: "1px solid #FDE68A", cursor: "pointer" }}>
            Retry now
          </button>
        </div>
      )}

      {/* ── Order list ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-4 min-h-0" style={{ scrollbarWidth: "none" }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Package size={28} className="text-muted-foreground mb-3" strokeWidth={1}/>
            <p className="text-foreground text-sm" style={{ fontWeight: 500 }}>No {filter} orders</p>
            <p className="text-muted-foreground text-xs mt-1">
              {filter === "past" ? "Completed orders will appear here" : "Your active orders will appear here"}
            </p>
          </div>
        ) : (
          filtered.map((order, i) => (
            <OrderCard
              key={order.id}
              order={order}
              accountType={accountType}
              onMessage={onMessageCoordinator}
              onReorder={onReorder}
              onEditOrder={onEditOrder}
              paidOverride={paidOrderIds?.includes(order.id)}
              onMarkPaid={() => onMarkOrderPaid?.(order.id)}
              forceOpen={order.id === targetOrderId || order.id === localTarget}
              onDeliveredOpen={PAST_STATUSES.includes(order.statusLabel) ? onOrderDelivered : undefined}
              headerId={i === 0 ? "coachmark-track-first-order" : undefined}
              coordinator={coordinator}
              onPayLive={handlePayLive}
              onRated={onRated}
            />
          ))
        )}
      </div>
      {filtered.length > 0 && (
        <TrackCoachmark storageKey="fl_coach_track_order_done" targetId="coachmark-track-first-order"
          title="Tap to see progress" body="Tap any order to expand it and follow production, QA and delivery step by step."/>
      )}
    </div>
  );
}
