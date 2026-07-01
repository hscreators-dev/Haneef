import React, { useState, useEffect } from "react";
import {
  ChevronDown, ChevronUp, Check, Scissors, Microscope, Truck, Package, MessageSquare,
  RotateCcw, Star, Wallet, ReceiptText, ClipboardCheck, Phone, Mail, Palette, FileText,
} from "lucide-react";
import type { SubmittedOrderSummary, OrderPrice, DraftPayload, OrderGarmentLine } from "./NewOrderTab";
import { UpiLogo, upiProviderDefs, type UpiProvider } from "./AccountTab";

// ─── Design tokens ────────────────────────────────────────────────────────────
const ACCENT      = "#C8A97E";
const ACCENT_BG   = "rgba(200,169,126,0.12)";
const ACCENT_TEXT = "#7C5419";
const DARK        = "#0D0D0D";
const fnt: React.CSSProperties = { fontFamily: "DM Sans, sans-serif" };

// ─── Shared style helpers ─────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16,
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
type OrderStatus = "In production" | "Quality check" | "Shipped" | "Quote pending" | "Order placed" | "Delivered" | "Completed";

interface OrderTrack {
  id: string; name: string; statusLabel: OrderStatus; statusColor: string;
  etaDate: string; defaultOpen: boolean; steps: TrackStep[]; isNew?: boolean;
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

const defaultNewSubmittedSteps: TrackStep[] = [
  { label: "Order placed",      sub: "Jun 14, 2025 · Just now",   status: "active",  icon: <Check      size={12} strokeWidth={2.5}/> },
  { label: "Sourcing material", sub: "Pending coordinator review", status: "pending", icon: <Scissors   size={12} strokeWidth={1.5}/> },
  { label: "In production",     sub: "–",                         status: "pending", icon: <Scissors   size={12} strokeWidth={1.5}/> },
  { label: "Quality check",     sub: "–",                         status: "pending", icon: <Microscope size={12} strokeWidth={1.5}/> },
  { label: "Shipped",           sub: "–",                         status: "pending", icon: <Truck      size={12} strokeWidth={1.5}/> },
  { label: "Delivered",         sub: "–",                         status: "pending", icon: <Package    size={12} strokeWidth={1.5}/> },
];

function buildNewSubmittedOrder(summary?: SubmittedOrderSummary | null): OrderTrack {
  if (!summary) {
    return {
      id: "#FL-2046", name: "New Order — Just submitted",
      statusLabel: "Order placed", statusColor: "text-blue-700 bg-blue-50",
      etaDate: "TBD", defaultOpen: true, isNew: true,
      steps: defaultNewSubmittedSteps,
    };
  }
  const steps = summary.isAccessoryOrder
    ? [
        { label: "Order placed",      sub: "Jun 14, 2025 · Just now",       status: "active"  as StepStatus, icon: <Check        size={12} strokeWidth={2.5}/> },
        { label: "Quote preparation", sub: "Coordinator reviewing items",     status: "pending" as StepStatus, icon: <ClipboardCheck size={12} strokeWidth={1.5}/> },
        { label: "Production",        sub: "–",                              status: "pending" as StepStatus, icon: <Package      size={12} strokeWidth={1.5}/> },
        { label: "Quality check",     sub: "–",                              status: "pending" as StepStatus, icon: <Microscope   size={12} strokeWidth={1.5}/> },
        { label: "Shipped",           sub: "–",                              status: "pending" as StepStatus, icon: <Truck        size={12} strokeWidth={1.5}/> },
        { label: "Delivered",         sub: "–",                              status: "pending" as StepStatus, icon: <Package      size={12} strokeWidth={1.5}/> },
      ]
    : defaultNewSubmittedSteps;
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

const ACTIVE_STATUSES: OrderStatus[]     = ["Order placed", "Quote pending", "In production", "Quality check", "Shipped"];
const PAST_STATUSES: OrderStatus[]       = ["Delivered", "Completed"];
const CHANGEABLE_STATUSES: OrderStatus[] = ["Order placed", "Quote pending"];

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
    <span className={`text-xs px-2.5 py-0.5 rounded-full ${cls}`} style={{ fontWeight: 500, fontSize: 10 }}>
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
function PaymentMethodCard({ order, accountType, paidOverride, onMarkPaid }: { order: OrderTrack; accountType?: "personal" | "organisation"; paidOverride?: boolean; onMarkPaid?: () => void }) {
  const statusPaid = order.statusLabel !== "Quote pending" && order.statusLabel !== "Order placed";
  const [showPay, setShowPay]     = useState(false);
  const [method, setMethod]       = useState<"upi" | "card">("upi");
  const [upiApp, setUpiApp]       = useState<UpiProvider>("gpay");
  const [upiId, setUpiId]         = useState("");
  const [card, setCard]           = useState({ number: "", expiry: "", cvv: "", name: "" });
  // Individuals pay the fixed price at checkout, so they're always "Paid" and just track.
  // Organisations can pay/change the method until payment is done, then it's locked.
  // paidOverride is held in App (by order id) so it survives this card collapsing/remounting.
  const isOrg = accountType !== "personal";
  const paid  = isOrg ? (statusPaid || !!paidOverride) : true;

  const fmtCard   = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const fmtExpiry = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length >= 3 ? d.slice(0, 2) + "/" + d.slice(2) : d; };
  const upiOk  = /^[\w.\-]+@[\w]+$/.test(upiId.trim());
  const cardOk = card.number.replace(/\D/g, "").length >= 13 && /^\d{2}\/\d{2}$/.test(card.expiry) && card.cvv.length >= 3 && card.name.trim().length > 0;
  const canPay = method === "upi" ? upiOk : cardOk;
  const inputStyle: React.CSSProperties = { border: "1px solid var(--border)", background: "var(--card)", outline: "none", color: DARK, fontSize: 13 };

  return (
    <Panel title="Payment method">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-foreground" style={{ fontSize: 13 }}>Payment method: {paid ? "*****@upi" : "Not selected"}</p>
        {isOrg && (paid ? (
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
          {paid ? "Paid" : "Pending"}
        </span>
      </p>

      {isOrg && !paid && showPay && (
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

          <button onClick={() => { if (canPay) { onMarkPaid?.(); setShowPay(false); } }} disabled={!canPay}
            className="w-full mt-2.5 py-2.5 rounded-xl" style={{ background: canPay ? DARK : "#E5E7EB", color: canPay ? "#fff" : "#9CA3AF", fontWeight: 600, fontSize: 13, border: "none", cursor: canPay ? "pointer" : "not-allowed" }}>
            Pay {order.price?.totalValue ?? "now"} by {method === "upi" ? "UPI" : "card"}
          </button>
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
function CoordinatorCard({ onMessage }: { onMessage?: () => void }) {
  return (
    <Panel title="Your procurement manager">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: ACCENT, color: "#fff", fontWeight: 700, fontSize: 16 }}>
          P
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-foreground" style={{ fontSize: 14, fontWeight: 600 }}>Priya Raman</p>
          <p className="text-muted-foreground" style={{ fontSize: 11, marginTop: 2 }}>Owns quote, mill follow-up, QA and delivery</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {([
          [<Phone size={13} strokeWidth={1.5}/>, "Call", undefined],
          [<MessageSquare size={13} strokeWidth={1.5}/>, "WhatsApp", onMessage],
          [<Mail size={13} strokeWidth={1.5}/>, "Email", undefined],
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
  const rows: [string, string, string][] = [
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
function SampleApprovalCard() {
  const [decision, setDecision] = useState<"approved" | "changes" | null>(null);
  return (
    <Panel title="Sample approval" icon={<Palette size={14} strokeWidth={1.5}/>}>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[["Fabric", "#1f2f46"], ["Color", "#23395d"], ["Logo", ACCENT]].map(([label, color]) => (
          <div key={label} className="rounded-xl border border-border overflow-hidden bg-muted">
            <div className="h-10" style={{ background: color }}/>
            <p className="text-center text-muted-foreground py-1.5" style={{ fontSize: 10 }}>{label}</p>
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
function DocumentVault({ order }: { order: OrderTrack }) {
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

// ─── Past Order Detail ────────────────────────────────────────────────────────
function PastOrderDetail({ order, onReorder }: { order: OrderTrack; onReorder?: () => void }) {
  const [rating, setRating]         = useState(0);
  const [feedback, setFeedback]     = useState("");
  const [ratingDone, setRatingDone] = useState(false);

  return (
    <div className="flex flex-col gap-3">
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
                <button onClick={() => setRatingDone(true)} style={btnPrimary}>
                  Submit feedback
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

      {onReorder && (
        <button onClick={onReorder} style={btnAccent}>
          <RotateCcw size={15} strokeWidth={1.5}/> Reorder last year's uniform
        </button>
      )}
    </div>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({ order, accountType, onMessage, onReorder, onEditOrder, paidOverride, onMarkPaid, forceOpen, onDeliveredOpen }: {
  order: OrderTrack; accountType?: "personal" | "organisation";
  onMessage?: () => void; onReorder?: () => void; onEditOrder?: (payload?: DraftPayload) => void;
  paidOverride?: boolean; onMarkPaid?: () => void; forceOpen?: boolean;
  onDeliveredOpen?: () => void;
}) {
  const [open, setOpen] = useState(order.defaultOpen || forceOpen);
  const firedRef = React.useRef(false);
  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);

  const isPast    = PAST_STATUSES.includes(order.statusLabel);
  const canChange = CHANGEABLE_STATUSES.includes(order.statusLabel);

  // Fire onDeliveredOpen once when a delivered order card is expanded
  useEffect(() => {
    if (open && isPast && onDeliveredOpen && !firedRef.current) {
      firedRef.current = true;
      setTimeout(onDeliveredOpen, 600);
    }
  }, [open, isPast, onDeliveredOpen]);

  return (
    <div className="rounded-2xl overflow-hidden mb-3"
      style={{
        background: "var(--card)",
        border: order.isNew
          ? `1.5px solid ${ACCENT}`
          : "1px solid var(--border)",
      }}>

      {/* New order banner */}
      {order.isNew && (
        <div className="px-4 py-2 border-b border-border" style={{ background: ACCENT_BG }}>
          <span style={{ fontSize: 11, color: ACCENT_TEXT, fontWeight: 500 }}>
            Newly submitted — awaiting coordinator review
          </span>
        </div>
      )}

      {/* Card header (tap to expand) */}
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-start justify-between p-4 text-left"
        style={{ background: "transparent", border: "none", cursor: "pointer" }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-muted-foreground" style={{ fontSize: 11 }}>{order.id}</span>
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
              <PastOrderDetail order={order} onReorder={onReorder}/>
            </div>
          ) : (
            <div className="pt-3">
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
                        style={{ left: 11, top: 24, bottom: -16, width: 1, background: "var(--border)", zIndex: 0 }}/>
                    )}
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center relative"
                      style={{ background: iconBg, border: `1.5px solid ${iconBorder}`, color: iconColor, zIndex: 1 }}>
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
                <CoordinatorCard onMessage={onMessage}/>
                <PaymentMethodCard order={order} accountType={accountType} paidOverride={paidOverride} onMarkPaid={onMarkPaid}/>
                <OrderDetailsCard order={order} canChange={canChange} accountType={accountType} onEdit={() => onEditOrder?.(order.editPayload)}/>
                {accountType !== "personal" && CHANGEABLE_STATUSES.includes(order.statusLabel) && !order.isAccessoryOrder && <SampleApprovalCard/>}
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
export function TrackTab({ showNew, newOrderSummary, accountType, onMessageCoordinator, onReorder, onEditOrder, paidOrderIds, onMarkOrderPaid, targetOrderId, onOrderDelivered }: {
  showNew?: boolean;
  newOrderSummary?: SubmittedOrderSummary | null;
  accountType?: "personal" | "organisation";
  onMessageCoordinator?: () => void;
  onReorder?: () => void;
  onEditOrder?: (payload?: DraftPayload) => void;
  paidOrderIds?: string[];
  onMarkOrderPaid?: (id: string) => void;
  targetOrderId?: string | null;
  onOrderDelivered?: () => void;
}) {
  const [filter, setFilter] = useState<TrackFilter>("active");
  const newSubmittedOrder = buildNewSubmittedOrder(newOrderSummary);

  useEffect(() => {
    if (targetOrderId) {
      const order = allOrders.find(o => o.id === targetOrderId);
      if (order && PAST_STATUSES.includes(order.statusLabel)) setFilter("past");
      else if (order) setFilter("active");
    }
  }, [targetOrderId]);

  const base = showNew ? [newSubmittedOrder, ...allOrders] : allOrders;
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
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">

      {/* ── Filter tabs ── */}
      <div className="flex px-5 pt-4 pb-3 gap-2 flex-shrink-0">
        {(["active", "past", "all"] as TrackFilter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="flex-1 py-2.5 rounded-xl text-sm"
            style={{
              background: filter === f ? DARK : "var(--muted)",
              color: filter === f ? "#fff" : "var(--muted-foreground)",
              fontWeight: filter === f ? 600 : 400,
              border: "none", cursor: "pointer",
            }}>
            {f === "active" ? `Active (${counts.active})` : f === "past" ? `Past (${counts.past})` : `All (${counts.all})`}
          </button>
        ))}
      </div>

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
          filtered.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              accountType={accountType}
              onMessage={onMessageCoordinator}
              onReorder={onReorder}
              onEditOrder={onEditOrder}
              paidOverride={paidOrderIds?.includes(order.id)}
              onMarkPaid={() => onMarkOrderPaid?.(order.id)}
              forceOpen={order.id === targetOrderId}
              onDeliveredOpen={PAST_STATUSES.includes(order.statusLabel) ? onOrderDelivered : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}
