import { useState, useEffect } from "react";
import {
  ChevronDown, ChevronUp, Check, Scissors, Microscope, Truck, Package, MessageSquare,
  RotateCcw, Star, CreditCard, FileText, Phone, Mail, UserCircle,
  Palette, Wallet, ReceiptText, ClipboardCheck,
} from "lucide-react";

const ACCENT       = "#A8916A";   // warm antique gold
const CREAM        = "#FAF8F4";   // linen off-white
const ESPRESSO     = "#0D0D0D";
const BORDER_WARM  = "#E8E2D6";   // parchment border
const GOLD_LIGHT   = "#F5EFE6";   // soft gold tint
const MUTED_TEXT   = "#7C6F5E";   // warm muted brown

type StepStatus = "done" | "active" | "pending";
interface TrackStep { label: string; sub: string; status: StepStatus; icon: React.ReactNode }
type OrderStatus = "In production" | "Quality check" | "Shipped" | "Quote pending" | "Order placed" | "Delivered" | "Completed";

interface OrderTrack {
  id: string; name: string; statusLabel: OrderStatus; statusColor: string;
  etaDate: string; defaultOpen: boolean; steps: TrackStep[]; isNew?: boolean;
  // For past orders
  fabric?: string; qty?: string; gsm?: string; colors?: string; stitching?: string; packaging?: string; total?: string;
  paymentMode?: string; paymentDate?: string; paymentReference?: string;
}

const allOrders: OrderTrack[] = [
  {
    id: "#FL-2041", name: "300m Cotton Twill — Navy",
    statusLabel: "In production", statusColor: "text-emerald-700 bg-emerald-50",
    etaDate: "14 July 2025", defaultOpen: true,
    fabric:"100% Cotton Pique", qty:"300 pcs", gsm:"GSM 220", colors:"Navy Blue (PMS 289C)", stitching:"Single needle", packaging:"Individual poly bag", total:"₹28,500",
    steps: [
      { label:"Order placed",      sub:"Jun 2, 2025",                status:"done",   icon:<Check      size={12} strokeWidth={2.5}/> },
      { label:"Sourcing material", sub:"Jun 5, 2025",                status:"done",   icon:<Check      size={12} strokeWidth={2.5}/> },
      { label:"In production",     sub:"Started Jun 10 · ~40% done", status:"active", icon:<Scissors   size={12} strokeWidth={1.5}/> },
      { label:"Quality check",     sub:"Est. Jul 8",                 status:"pending",icon:<Microscope size={12} strokeWidth={1.5}/> },
      { label:"Shipped",           sub:"Est. Jul 11",                status:"pending",icon:<Truck      size={12} strokeWidth={1.5}/> },
      { label:"Delivered",         sub:"Est. Jul 14",                status:"pending",icon:<Package    size={12} strokeWidth={1.5}/> },
    ],
  },
  {
    id: "#FL-2038", name: "Linen Blend Fabric — Ivory",
    statusLabel: "Quality check", statusColor: "text-amber-700 bg-amber-50",
    etaDate: "8 July 2025", defaultOpen: false,
    fabric:"Linen Blend", qty:"200 pcs", gsm:"GSM 160", colors:"Ivory (PMS 9182C)", stitching:"Double needle", packaging:"Bulk packing", total:"₹18,000",
    steps: [
      { label:"Order placed",      sub:"May 28, 2025",             status:"done",   icon:<Check      size={12} strokeWidth={2.5}/> },
      { label:"Sourcing material", sub:"Jun 1, 2025",              status:"done",   icon:<Check      size={12} strokeWidth={2.5}/> },
      { label:"In production",     sub:"Completed Jun 25",         status:"done",   icon:<Check      size={12} strokeWidth={2.5}/> },
      { label:"Quality check",     sub:"In progress · Est. Jul 5", status:"active", icon:<Microscope size={12} strokeWidth={1.5}/> },
      { label:"Shipped",           sub:"Est. Jul 6",               status:"pending",icon:<Truck      size={12} strokeWidth={1.5}/> },
      { label:"Delivered",         sub:"Est. Jul 8",               status:"pending",icon:<Package    size={12} strokeWidth={1.5}/> },
    ],
  },
  {
    id: "#FL-2045", name: "Heavy Denim — Washed Black",
    statusLabel: "Quote pending", statusColor: "text-stone-600 bg-stone-100",
    etaDate: "TBD", defaultOpen: false,
    fabric:"Heavy Denim", qty:"1000 pcs", gsm:"GSM 360", colors:"Washed Black", stitching:"Chain stitch", packaging:"Bulk packing", total:"₹57,700",
    steps: [
      { label:"Order placed",      sub:"Jun 14, 2025",            status:"done",   icon:<Check      size={12} strokeWidth={2.5}/> },
      { label:"Sourcing material", sub:"Awaiting quote approval",  status:"active", icon:<Microscope size={12} strokeWidth={1.5}/> },
      { label:"In production",     sub:"Not started",             status:"pending",icon:<Scissors   size={12} strokeWidth={1.5}/> },
      { label:"Quality check",     sub:"–",                       status:"pending",icon:<Microscope size={12} strokeWidth={1.5}/> },
      { label:"Shipped",           sub:"–",                       status:"pending",icon:<Truck      size={12} strokeWidth={1.5}/> },
      { label:"Delivered",         sub:"–",                       status:"pending",icon:<Package    size={12} strokeWidth={1.5}/> },
    ],
  },
  // Past / completed orders
  {
    id: "#FL-2035", name: "Cotton Jersey — White",
    statusLabel: "Delivered", statusColor: "text-emerald-700 bg-emerald-50",
    etaDate: "Jun 10, 2025", defaultOpen: false,
    fabric:"100% Cotton Jersey", qty:"100 pcs", gsm:"GSM 180", colors:"White", stitching:"Single needle", packaging:"Individual poly bag", total:"₹9,200",
    paymentMode:"UPI", paymentDate:"Jun 10, 2025", paymentReference:"TXN-FL-2035-2025",
    steps: [
      { label:"Order placed",      sub:"May 15, 2025", status:"done", icon:<Check   size={12} strokeWidth={2.5}/> },
      { label:"Sourcing material", sub:"May 18, 2025", status:"done", icon:<Check   size={12} strokeWidth={2.5}/> },
      { label:"In production",     sub:"May 22, 2025", status:"done", icon:<Check   size={12} strokeWidth={2.5}/> },
      { label:"Quality check",     sub:"Jun 2, 2025",  status:"done", icon:<Check   size={12} strokeWidth={2.5}/> },
      { label:"Shipped",           sub:"Jun 7, 2025",  status:"done", icon:<Check   size={12} strokeWidth={2.5}/> },
      { label:"Delivered",         sub:"Jun 10, 2025", status:"done", icon:<Package size={12} strokeWidth={1.5}/> },
    ],
  },
  {
    id: "#FL-2029", name: "Oxford Shirt Fabric — Sky Blue",
    statusLabel: "Completed", statusColor: "text-stone-600 bg-stone-100",
    etaDate: "May 20, 2025", defaultOpen: false,
    fabric:"Oxford Cotton", qty:"250 pcs", gsm:"GSM 200", colors:"Sky Blue", stitching:"Double needle", packaging:"Bundle packing", total:"₹21,500",
    paymentMode:"Card", paymentDate:"May 20, 2025", paymentReference:"TXN-FL-2029-2025",
    steps: [
      { label:"Order placed",      sub:"Apr 28, 2025", status:"done", icon:<Check   size={12} strokeWidth={2.5}/> },
      { label:"Sourcing material", sub:"May 1, 2025",  status:"done", icon:<Check   size={12} strokeWidth={2.5}/> },
      { label:"In production",     sub:"May 5, 2025",  status:"done", icon:<Check   size={12} strokeWidth={2.5}/> },
      { label:"Quality check",     sub:"May 14, 2025", status:"done", icon:<Check   size={12} strokeWidth={2.5}/> },
      { label:"Shipped",           sub:"May 17, 2025", status:"done", icon:<Check   size={12} strokeWidth={2.5}/> },
      { label:"Delivered",         sub:"May 20, 2025", status:"done", icon:<Package size={12} strokeWidth={1.5}/> },
    ],
  },
];

const newSubmittedOrder: OrderTrack = {
  id: "#FL-2046", name: "New Order — Just submitted",
  statusLabel: "Order placed", statusColor: "text-blue-700 bg-blue-50",
  etaDate: "TBD", defaultOpen: true, isNew: true,
  steps: [
    { label:"Order placed",      sub:"Jun 14, 2025 · Just now",   status:"active", icon:<Check      size={12} strokeWidth={2.5}/> },
    { label:"Sourcing material", sub:"Pending coordinator review", status:"pending",icon:<Scissors   size={12} strokeWidth={1.5}/> },
    { label:"In production",     sub:"–",                         status:"pending",icon:<Scissors   size={12} strokeWidth={1.5}/> },
    { label:"Quality check",     sub:"–",                         status:"pending",icon:<Microscope size={12} strokeWidth={1.5}/> },
    { label:"Shipped",           sub:"–",                         status:"pending",icon:<Truck      size={12} strokeWidth={1.5}/> },
    { label:"Delivered",         sub:"–",                         status:"pending",icon:<Package    size={12} strokeWidth={1.5}/> },
  ],
};

const ACTIVE_STATUSES: OrderStatus[] = ["Order placed","Quote pending","In production","Quality check","Shipped"];
const PAST_STATUSES:   OrderStatus[] = ["Delivered","Completed"];
// Statuses that allow requesting a change (before production starts)
const CHANGEABLE_STATUSES: OrderStatus[] = ["Order placed","Quote pending"];

type TrackFilter = "active" | "past" | "all";

const procurementStages = [
  "Under Review",
  "Quote Shared",
  "Waiting Approval",
  "Production Started",
  "QA Inspection",
  "Shipped",
  "Delivered",
];

function MiniSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: CREAM, border: `1px solid ${BORDER_WARM}` }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ background: GOLD_LIGHT, borderBottom: `1px solid ${BORDER_WARM}` }}>
        <span style={{ color: ACCENT }}>{icon}</span>
        <p style={{ fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:500, color: ACCENT }}>{title}</p>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function CollapsibleMiniSection({ title, icon, children, defaultOpen = true }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: CREAM, border: `1px solid ${BORDER_WARM}` }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-4 py-3 flex items-center gap-2 text-left"
        style={{ background: GOLD_LIGHT, border:"none", borderBottom: open ? `1px solid ${BORDER_WARM}` : "none", cursor:"pointer" }}
      >
        <span style={{ color: ACCENT }}>{icon}</span>
        <p style={{ fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:500, color: ACCENT }}>{title}</p>
        <ChevronDown size={13} style={{ color: ACCENT, marginLeft:"auto", transform: open ? "rotate(180deg)" : "none", transition:"transform 0.18s" }} strokeWidth={1.5}/>
      </button>
      {open && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}

function RequestPanel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: CREAM, border: `1px solid ${BORDER_WARM}` }}>
      <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ background: GOLD_LIGHT, borderBottom: `1px solid ${BORDER_WARM}` }}>
        <p style={{ fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:500, color: ACCENT }}>{title}</p>
        {action}
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

function PaymentMethodCard({ order }: { order: OrderTrack }) {
  const paid = order.statusLabel !== "Quote pending" && order.statusLabel !== "Order placed";
  return (
    <RequestPanel title="Payment method">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p style={{ fontSize:13, color: ESPRESSO }}>Payment method: *****@upi</p>
        <button style={{ fontSize:12, color: ACCENT, fontWeight:600, background:"none", border:"none", cursor:"pointer" }}>Change</button>
      </div>
      <p style={{ fontSize:13, color: ESPRESSO }}>
        Payment status:{" "}
        <span style={{ fontWeight:600, color: paid ? "#2d7a4f" : "#b45309" }}>{paid ? "Paid" : "Pending"}</span>
      </p>
    </RequestPanel>
  );
}

function OrderDetailsCard({ order, canChange, onChange }: { order: OrderTrack; canChange?: boolean; onChange?: () => void }) {
  const isDenim = order.fabric?.toLowerCase().includes("denim");
  const fabricType = order.fabric ?? "Soft 100% Cotton";
  const gsm = order.gsm ?? (isDenim ? "GSM 360" : "140-160 GSM (lightweight)");
  const colors = order.colors ?? (isDenim ? "Washed Black" : "Forest Green");
  return (
    <RequestPanel
      title="Order Details"
      action={canChange ? (
        <button onClick={onChange} style={{ fontSize:12, color: ACCENT, fontWeight:600, background:"none", border:"none", cursor:"pointer" }}>
          Change
        </button>
      ) : undefined}
    >
      <div className="flex flex-col gap-2">
        {[
          ["Order for", "Kids"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <span style={{ fontSize:12, color: MUTED_TEXT }}>{k}</span>
            <span style={{ fontSize:12, fontWeight:500, color: ESPRESSO }}>{v}</span>
          </div>
        ))}
        <div style={{ height:1, background: BORDER_WARM, margin:"4px 0" }}/>
        <p style={{ fontSize:11, letterSpacing:"0.07em", textTransform:"uppercase", color: ACCENT, fontWeight:500 }}>Materials</p>
        {[
          ["Fabric source", "Fresh fabric"],
          ["Fabric type", fabricType],
          ["GSM weight", gsm],
          ["Weave", "Plain"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <span style={{ fontSize:12, color: MUTED_TEXT }}>{k}</span>
            <span style={{ fontSize:12, fontWeight:500, color: ESPRESSO }}>{v}</span>
          </div>
        ))}
        <div style={{ height:1, background: BORDER_WARM, margin:"4px 0" }}/>
        <p style={{ fontSize:11, letterSpacing:"0.07em", textTransform:"uppercase", color: ACCENT, fontWeight:500 }}>Colors</p>
        {[
          ["Confirm colors", colors],
          ["Description", "Minimalist style"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <span style={{ fontSize:12, color: MUTED_TEXT }}>{k}</span>
            <span style={{ fontSize:12, fontWeight:500, color: ESPRESSO }}>{v}</span>
          </div>
        ))}
        <div style={{ height:1, background: BORDER_WARM, margin:"4px 0" }}/>
        <p style={{ fontSize:11, letterSpacing:"0.07em", textTransform:"uppercase", color: ACCENT, fontWeight:500 }}>Size</p>
        <div className="flex items-start justify-between">
          <span style={{ fontSize:12, color: MUTED_TEXT }}>Garment for</span>
          <span style={{ fontSize:12, fontWeight:500, color: ESPRESSO }}>Kids</span>
        </div>
        <div className="flex items-start justify-between">
          <span style={{ fontSize:12, color: MUTED_TEXT }}>Qty per size</span>
          <span style={{ fontSize:12, fontWeight:500, color: ESPRESSO, textAlign:"right" }}>3-4Y · 5-6Y · 7-8Y<br/><span style={{ color: MUTED_TEXT, fontWeight:400 }}>10 pcs each</span></span>
        </div>
        <div style={{ height:1, background: BORDER_WARM, margin:"4px 0" }}/>
        <p style={{ fontSize:11, letterSpacing:"0.07em", textTransform:"uppercase", color: ACCENT, fontWeight:500 }}>Reference</p>
        {[["Logo / Design", "Attachment"], ["Style photo", "Attachment"]].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <span style={{ fontSize:12, color: MUTED_TEXT }}>{k}</span>
            <button style={{ fontSize:12, fontWeight:500, color: ACCENT, background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}>{v}</button>
          </div>
        ))}
      </div>
    </RequestPanel>
  );
}

function ProcurementStageStrip({ status }: { status: OrderStatus }) {
  const current = status === "Order placed" ? 0
    : status === "Quote pending" ? 1
    : status === "In production" ? 3
    : status === "Quality check" ? 4
    : status === "Shipped" ? 5
    : 6;

  return (
    <MiniSection title="My request status" icon={<ClipboardCheck size={13} strokeWidth={1.5}/>}>
      <div className="grid grid-cols-2 gap-2">
        {procurementStages.map((stage, i) => {
          const active = i === current;
          const done = i < current;
          return (
            <div key={stage} className="rounded-xl px-3 py-2.5 flex items-center gap-2"
              style={{ border: `1px solid ${active ? ACCENT : BORDER_WARM}`, background: done ? "#EEF7EE" : active ? GOLD_LIGHT : "#fff" }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: done ? "#2d7a4f" : active ? ACCENT : BORDER_WARM, color: done || active ? "#fff" : MUTED_TEXT, fontSize:10, fontWeight:700 }}>
                {done ? <Check size={11} strokeWidth={2.5}/> : i + 1}
              </span>
              <span style={{ fontSize:11, fontWeight: active ? 600 : 400, color: active ? ESPRESSO : MUTED_TEXT }}>{stage}</span>
            </div>
          );
        })}
      </div>
    </MiniSection>
  );
}

function CoordinatorCard({ onMessage }: { onMessage?: () => void }) {
  return (
    <RequestPanel title="Your Procurement Manager">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: ESPRESSO, color: GOLD_LIGHT, fontWeight:700, fontSize:16 }}>P</div>
        <div className="min-w-0 flex-1">
          <p style={{ fontSize:14, fontWeight:600, color: ESPRESSO }}>Priya Raman</p>
          <p style={{ fontSize:11, color: MUTED_TEXT, marginTop:2 }}>Owns quote, mill follow-up, QA and delivery</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          [<Phone size={13} strokeWidth={1.5}/>, "Call"],
          [<MessageSquare size={13} strokeWidth={1.5}/>, "WhatsApp"],
          [<Mail size={13} strokeWidth={1.5}/>, "Email"],
        ].map(([icon, label]) => (
          <button key={String(label)} onClick={label === "WhatsApp" ? onMessage : undefined}
            className="rounded-xl py-2 flex items-center justify-center gap-1.5"
            style={{ fontSize:11, fontWeight:500, background:"#fff", border:`1px solid ${BORDER_WARM}`, color: ESPRESSO }}>
            {icon}{label}
          </button>
        ))}
      </div>
    </RequestPanel>
  );
}

function PaymentMilestones({ order }: { order: OrderTrack }) {
  const isQuote = order.statusLabel === "Quote pending" || order.statusLabel === "Order placed";
  const rows = [
    ["Advance payment", "30%", isQuote ? "Due after approval" : "Received"],
    ["Production payment", "50%", order.statusLabel === "In production" || order.statusLabel === "Quality check" || order.statusLabel === "Shipped" ? "Received" : "Upcoming"],
    ["Final settlement", "20%", order.statusLabel === "Shipped" ? "Due before dispatch" : "Upcoming"],
  ];
  return (
    <MiniSection title="Payment milestones" icon={<Wallet size={13} strokeWidth={1.5}/>}>
      <div className="flex flex-col gap-2">
        {rows.map(([label, pct, status]) => (
          <div key={label} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background:"#fff", border:`1px solid ${BORDER_WARM}` }}>
            <div>
              <p style={{ fontSize:12, fontWeight:600, color: ESPRESSO }}>{label}</p>
              <p style={{ fontSize:10, color: MUTED_TEXT }}>{pct} of order value</p>
            </div>
            <span style={{ fontSize:10, fontWeight:600, borderRadius:999, padding:"4px 8px",
              background: status === "Received" ? "#EEF7EE" : GOLD_LIGHT,
              color: status === "Received" ? "#2d7a4f" : MUTED_TEXT }}>
              {status}
            </span>
          </div>
        ))}
      </div>
    </MiniSection>
  );
}

function SampleApprovalCard() {
  const [decision, setDecision] = useState<"approved" | "changes" | null>(null);
  return (
    <MiniSection title="Sample approval" icon={<Palette size={13} strokeWidth={1.5}/>}>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          ["Fabric", "#1f2f46"],
          ["Color", "#23395d"],
          ["Logo", "#C8A97E"],
        ].map(([label, color]) => (
          <div key={label} className="rounded-xl border border-border overflow-hidden bg-muted">
            <div className="h-10" style={{ background: color }}/>
            <p className="text-center text-muted-foreground py-1.5" style={{ fontSize:10 }}>{label}</p>
          </div>
        ))}
      </div>
      {decision ? (
        <p className={decision === "approved" ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}
          style={{ fontSize:12, fontWeight:600, borderRadius:12, padding:"10px 12px" }}>
          {decision === "approved" ? "Sample approved for production" : "Changes requested. Your manager will confirm updates."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setDecision("approved")} className="rounded-xl py-2.5 text-xs" style={{ background: ESPRESSO, color: GOLD_LIGHT, fontWeight:600 }}>Approve</button>
          <button onClick={() => setDecision("changes")} className="rounded-xl py-2.5 text-xs" style={{ background:"#fff", border:`1px solid ${BORDER_WARM}`, color: ESPRESSO, fontWeight:600 }}>Request change</button>
        </div>
      )}
    </MiniSection>
  );
}

function DocumentVault({ order }: { order: OrderTrack }) {
  const documentsAvailable = !order.isNew && ["Quality check", "Shipped", "Delivered", "Completed"].includes(order.statusLabel);
  if (!documentsAvailable) return null;

  const docs = [
    ["Invoice", order.statusLabel === "Quote pending" ? "Draft" : "INV-" + order.id.slice(4)],
    ["Payment receipt", order.statusLabel === "Quote pending" ? "Pending" : "Available"],
  ];
  return (
    <RequestPanel title="Documents">
      <div className="flex flex-col gap-2">
        {docs.map(([label, status]) => (
          <button key={label} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-left" style={{ background:"#fff", border:`1px solid ${BORDER_WARM}` }}>
            <span className="flex items-center gap-2" style={{ fontSize:12, fontWeight:500, color: ESPRESSO }}>
              <ReceiptText size={13} strokeWidth={1.5} color={ACCENT}/>{label}
            </span>
            <span style={{ fontSize:10, color: MUTED_TEXT }}>{status}</span>
          </button>
        ))}
      </div>
    </RequestPanel>
  );
}

// ─── Star Rating ──────────────────────────────────────────────────────────────
function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(i => (
        <button key={i}
          onClick={() => onChange?.(i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          style={{ background:"none", border:"none", cursor: onChange ? "pointer" : "default", padding:1 }}>
          <Star size={22}
            strokeWidth={1.5}
            fill={(hovered || value) >= i ? ACCENT : "none"}
            stroke={(hovered || value) >= i ? ACCENT : "rgba(0,0,0,0.2)"}/>
        </button>
      ))}
    </div>
  );
}

// ─── Past Order Detail (Amazon-style) ────────────────────────────────────────
function PastOrderDetail({ order, onReorder }: { order: OrderTrack; onReorder?: () => void }) {
  const [rating, setRating]       = useState(0);
  const [feedback, setFeedback]   = useState("");
  const [ratingDone, setRatingDone] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <OrderDetailsCard order={order}/>

      {/* ── Payment details ── */}
      <RequestPanel title="Payment method">
          <div className="flex flex-col gap-2 text-sm">
            {[
              ["Payment mode",  order.paymentMode ?? "Recorded payment"],
              ["Amount",        order.total ?? "–"],
              ["Payment date",  order.paymentDate ?? order.etaDate],
              ["Status",        "Payment received"],
              ["Reference",     order.paymentReference ?? `TXN-${order.id.slice(1)}-2025`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4">
                <span className="flex-shrink-0" style={{ fontSize:12, color: MUTED_TEXT }}>{k}</span>
                <span className="text-right" style={{ fontSize:12, fontWeight:500, color: v === "Payment received" ? "#2d7a4f" : ESPRESSO }}>{v}</span>
              </div>
            ))}
          </div>
      </RequestPanel>

      {/* ── Rating & Feedback ── */}
      <RequestPanel title="Rating & feedback">
          {ratingDone ? (
            <div className="flex flex-col items-center py-2">
              <StarRating value={rating}/>
              <p className="text-emerald-600 text-sm mt-2" style={{ fontWeight:500 }}>Feedback submitted</p>
              {feedback && <p className="text-muted-foreground text-xs mt-1 text-center">{feedback}</p>}
            </div>
          ) : (
            <>
              <p className="text-foreground text-xs mb-3" style={{ fontWeight:500 }}>How was your experience?</p>
              <div className="flex justify-center mb-3">
                <StarRating value={rating} onChange={setRating}/>
              </div>
              {rating > 0 && (
                <>
                  <textarea value={feedback} onChange={e => setFeedback(e.target.value)}
                    placeholder="Tell us about the quality, delivery speed, coordinator service…"
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-xs outline-none resize-none h-16 mb-3"
                    style={{ fontFamily:"DM Sans, sans-serif" }}/>
                  <button onClick={() => setRatingDone(true)}
                    className="w-full py-2.5 rounded-xl text-sm"
                    style={{ background: ESPRESSO, color: GOLD_LIGHT, fontWeight:500, cursor:"pointer" }}>
                    Submit feedback
                  </button>
                </>
              )}
              {rating === 0 && <p className="text-muted-foreground text-xs text-center">Tap a star to rate</p>}
            </>
          )}
      </RequestPanel>

      <DocumentVault order={order}/>

      {/* Reorder CTA */}
      {onReorder && (
        <button onClick={onReorder}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm"
          style={{ background: ESPRESSO, color: GOLD_LIGHT, fontWeight:500, cursor:"pointer" }}>
          <RotateCcw size={15} strokeWidth={1.5}/> Reorder last year's uniform
        </button>
      )}
    </div>
  );
}

// ─── OrderCard ────────────────────────────────────────────────────────────────
function OrderCard({ order, accountType, onMessage, onReorder, forceOpen }: {
  order: OrderTrack; accountType?: "personal" | "organisation"; onMessage?: () => void; onReorder?: () => void; forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(order.defaultOpen || forceOpen);
  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);

  const isPast       = PAST_STATUSES.includes(order.statusLabel);
  const canChange    = CHANGEABLE_STATUSES.includes(order.statusLabel);

  return (
    <div className="rounded-2xl overflow-hidden mb-3"
      style={{ background: CREAM, border: order.isNew ? `1.5px solid ${ACCENT}` : `1px solid ${BORDER_WARM}` }}>
      {order.isNew && (
        <div className="px-4 py-2" style={{ background: GOLD_LIGHT, borderBottom:`1px solid ${BORDER_WARM}` }}>
          <span style={{ fontSize:11, color: ACCENT, fontWeight:500 }}>✨ Newly submitted — awaiting coordinator review</span>
        </div>
      )}

      <button onClick={() => setOpen(v => !v)} className="w-full flex items-start justify-between p-4 text-left" style={{ background:"transparent", border:"none", cursor:"pointer" }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span style={{ fontSize:11, color: ACCENT }}>{order.id}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${order.statusColor}`} style={{ fontWeight:500, fontSize:10 }}>{order.statusLabel}</span>
          </div>
          <p style={{ fontSize:14, fontWeight:500, color: ESPRESSO }}>{order.name}</p>
          {!open && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }}/>
              <span style={{ fontSize:11, color: MUTED_TEXT }}>{order.statusLabel} · {order.etaDate}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2 mt-0.5">
          {!open && <span style={{ fontSize:11, color: MUTED_TEXT }}>{order.etaDate}</span>}
          {open ? <ChevronUp size={15} strokeWidth={1.5} style={{ color: ACCENT }}/> : <ChevronDown size={15} strokeWidth={1.5} style={{ color: ACCENT }}/>}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4" style={{ borderTop: `1px solid ${BORDER_WARM}` }}>
          {/* For past orders: show Amazon-style detail */}
          {isPast ? (
            <div className="pt-3">
              <PastOrderDetail order={order} onReorder={onReorder}/>
            </div>
          ) : (
            /* Active orders: show timeline */
            <div className="pt-3">
              {order.steps.map((step, i) => {
                const isLast = i === order.steps.length - 1;
                const iconBg    = step.status==="done" ? ESPRESSO : step.status==="active" ? GOLD_LIGHT : "#fff";
                const iconBorder = step.status==="done" ? ESPRESSO : step.status==="active" ? ACCENT : BORDER_WARM;
                const iconColor  = step.status==="done" ? GOLD_LIGHT : step.status==="active" ? ACCENT : MUTED_TEXT;
                return (
                  <div key={i} className="flex items-start gap-3 relative" style={{ marginBottom: isLast ? 0 : 16 }}>
                    {!isLast && <div className="absolute" style={{ left:11, top:24, bottom:-16, width:1, background: BORDER_WARM, zIndex:0 }}/>}
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center relative"
                      style={{ background:iconBg, border:`1.5px solid ${iconBorder}`, color:iconColor, zIndex:1 }}>
                      {step.icon}
                    </div>
                    <div style={{ paddingTop:2 }}>
                      <p style={{ fontSize:13, fontWeight:step.status==="pending" ? 400 : 500, lineHeight:1.3, color: step.status==="pending" ? MUTED_TEXT : ESPRESSO }}>{step.label}</p>
                      <p style={{ fontSize:11, marginTop:1, color: MUTED_TEXT }}>{step.sub}</p>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between mt-4 pt-3.5" style={{ borderTop:`1px solid ${BORDER_WARM}` }}>
                <p style={{ fontSize:12, color: MUTED_TEXT }}>Estimated delivery</p>
                <p style={{ fontSize:13, fontWeight:600, color: ESPRESSO }}>{order.etaDate}</p>
              </div>

              <div className="mt-3 flex flex-col gap-3">
                <CoordinatorCard onMessage={onMessage}/>
                <PaymentMethodCard order={order}/>
                <OrderDetailsCard order={order} canChange={canChange} onChange={onMessage}/>
                {accountType !== "personal" && (order.statusLabel === "Quote pending" || order.statusLabel === "Order placed") && <SampleApprovalCard/>}
                <DocumentVault order={order}/>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
export function TrackTab({ showNew, accountType, onMessageCoordinator, onReorder, targetOrderId }: {
  showNew?: boolean; accountType?: "personal" | "organisation"; onMessageCoordinator?: () => void; onReorder?: () => void; targetOrderId?: string | null;
}) {
  const [filter, setFilter] = useState<TrackFilter>("active");

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
      {/* 3-tab filter */}
      <div className="flex px-5 pt-3 pb-3 gap-2 flex-shrink-0">
        {(["active","past","all"] as TrackFilter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="flex-1 py-2 rounded-xl text-xs transition-all"
            style={{ background: filter===f ? ESPRESSO : GOLD_LIGHT, color: filter===f ? GOLD_LIGHT : MUTED_TEXT, fontWeight: filter===f ? 500 : 400, border: `1px solid ${filter===f ? ESPRESSO : BORDER_WARM}`, cursor:"pointer" }}>
            {f==="active" ? `Active (${counts.active})` : f==="past" ? `Past (${counts.past})` : `All (${counts.all})`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 min-h-0" style={{ scrollbarWidth:"none" }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Package size={28} className="text-muted-foreground mb-3" strokeWidth={1}/>
            <p className="text-foreground text-sm" style={{ fontWeight:500 }}>No {filter} orders</p>
            <p className="text-muted-foreground text-xs mt-1">{filter==="past" ? "Completed orders will appear here" : "Your active orders will appear here"}</p>
          </div>
        ) : (
          filtered.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              accountType={accountType}
              onMessage={onMessageCoordinator}
              onReorder={onReorder}
              forceOpen={order.id === targetOrderId}
            />
          ))
        )}
      </div>
    </div>
  );
}
