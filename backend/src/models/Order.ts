import mongoose, { Document, Schema } from "mongoose";

// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface ISizeEntry {
  label: string;   // "S", "M", "L", "XL", "3-4Y", etc.
  qty: number;
}

export interface IColorEntry {
  hex: string;
  pantone?: string;
  label: string;
  position?: string;
}

export interface IAccessoryItem {
  categoryId: string;
  categoryLabel: string;
  itemName: string;
  qty: number;
}

export interface ITrackStep {
  label: string;
  sub: string;
  status: "done" | "active" | "pending";
  completedAt?: Date;
}

export interface IOrderLine {
  p: string;      // product/garment name
  size: string;
  color: string;
  qty: number;
  unit: number;   // unit price, INR
}

// Files attached to an order — customer design/logo references uploaded at
// submit, and admin-uploaded documents (invoice, quotation, billing) that the
// customer can download from the Garm App's Documents section.
export interface IOrderDocument {
  _id?: mongoose.Types.ObjectId;
  name: string;
  kind: "INVOICE" | "QUOTATION" | "BILLING" | "DESIGN" | "OTHER";
  dataUrl: string;              // data: URL (base64) — kept small, per-file cap enforced at the route
  uploadedBy: "admin" | "customer";
  generated?: boolean;          // built by the admin's invoice generator (vs uploaded)
  visible?: boolean;            // false = draft, hidden from the customer until "sent"
  createdAt?: Date;
}

// Manufacturing-ops fields the Garm Admin Portal needs. Additive on top of the
// customer-facing fields above — `status`/trackSteps still drive what the
// Garm App itself shows; `adminStatus` is the operational workflow the admin
// team runs (assign manufacturer -> production -> QC -> invoice -> pay ->
// ship). Individuals (B2C / persona "individual") skip QC entirely — see the
// default in the pre-save hook below and server/index.js's buildTrackSteps()
// on the admin side, which enforces the same rule.
// CONFIRMED is the B2C acceptance gate: an individual's order sits at NEW
// ("submitted") until an admin explicitly accepts it. Only then can the
// customer see the confirmation + final price in the Garm App and pay —
// and only after payment (PAID) can production start. B2B orders keep the
// quote-approval flow instead and never use CONFIRMED.
export type AdminOrderStatus =
  | "NEW" | "CONFIRMED" | "ASSIGNED" | "IN_PROGRESS" | "QC_READY" | "QC_APPROVED"
  | "INVOICED" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type QcResult = "PENDING" | "PASSED" | "FAILED" | "REWORK" | "N/A";
export type AdminPayStatus = "PENDING" | "PARTIAL" | "COMPLETED";

export type OrderStatus =
  | "Draft"
  | "Quote pending"
  | "Order placed"
  | "Order confirmed"
  | "In production"
  | "Quality check"
  | "Shipped"
  | "Delivered"
  | "Completed"
  | "Cancelled";

export interface IOrder extends Document {
  userId: mongoose.Types.ObjectId;

  // Order meta
  orderRef: string;          // e.g. "FL-2046"
  persona: "organisation" | "individual";
  isAccessoryOrder: boolean;

  // Org context
  orgType?: string;
  orgName?: string;
  service?: string;          // "uniform", "sports", "accessories", etc.
  serviceLabel?: string;

  // Garment / accessory details
  garmentType?: string;
  fabric?: string;
  gsm?: string;
  weave?: string;
  fabricSource?: "fresh" | "surplus";

  // Sizes & quantities
  qty: number;
  sizes: ISizeEntry[];

  // Colors
  colors: IColorEntry[];

  // Accessories
  accessoryItems: IAccessoryItem[];

  // Stitching & packaging
  stitching?: string;
  packaging?: string;

  // Delivery
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryPin?: string;

  // Contact (for individual orders)
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;

  // Tracking
  status: OrderStatus;
  trackSteps: ITrackStep[];
  etaDate?: string;

  // Financial
  quoteAmount?: number;
  serviceFee?: number;       // ₹ service fee included in total (shown as its own line)
  quoteApprovedAt?: Date;
  confirmedAt?: Date;        // when the admin accepted/confirmed the order (B2C gate)
  paymentStatus?: "unpaid" | "partial" | "paid";
  paymentMode?: string;
  paymentDate?: Date;
  paymentReference?: string;

  // Coordinator
  coordinatorId?: mongoose.Types.ObjectId;

  // Notes
  notes?: string;

  // ── Garm Admin Portal operational fields (additive — see note above) ──
  seq?: number;             // stable numeric id for the admin UI (Mongo _id is a string)
  adminStatus: AdminOrderStatus;
  // Employee handling this order — the NAME changes per assignment, while the
  // contact/email/WhatsApp shown to the customer stay the company-wide
  // coordinator details configured in the admin portal (never per-employee).
  assignedEmployee?: string;
  trackingCourier?: string;
  trackingNumber?: string;
  manufacturer?: string;
  qcResult: QcResult;
  adminPayStatus: AdminPayStatus;
  // Customer rating (1–5) + feedback, submitted once the order is delivered.
  rating?: number;
  ratingFeedback?: string;
  ratedAt?: Date;
  total: number;
  lines: IOrderLine[];
  documents: mongoose.Types.DocumentArray<IOrderDocument>;

  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

// Atomic sequence for `seq` — the Garm Admin Portal shows orders with a plain
// numeric id (its UI/routes were built around integers, and Mongo's own _id
// is a string), so every order gets one assigned on first save, regardless of
// which app (Garm App or admin portal's "Log Manual Order") created it.
//
// `orderRef` is DERIVED from that same atomic seq (FL-<2046+seq>) instead of a
// module-level counter. The old counter reset to 2046 on every server restart,
// so the first order after a restart collided with an existing orderRef
// (unique index) and creation failed silently — orders never reached the
// admin portal. Deriving from the shared counter also means the customer app
// and the admin portal always show the exact same reference for an order.
const CounterSchema = new Schema({ _id: String, value: { type: Number, default: 0 } });
const Counter = mongoose.models.Counter || mongoose.model("Counter", CounterSchema, "counters");
async function nextSeq(): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    "orderSeq",
    { $inc: { value: 1 } },
    { upsert: true, new: true }
  );
  return doc!.value;
}

const SizeEntrySchema = new Schema<ISizeEntry>({ label: String, qty: Number }, { _id: false });
const ColorEntrySchema = new Schema<IColorEntry>({ hex: String, pantone: String, label: String, position: String }, { _id: false });
const AccessoryItemSchema = new Schema<IAccessoryItem>({ categoryId: String, categoryLabel: String, itemName: String, qty: Number }, { _id: false });
const TrackStepSchema = new Schema<ITrackStep>({ label: String, sub: String, status: String, completedAt: Date }, { _id: false });
const OrderLineSchema = new Schema<IOrderLine>({ p: String, size: String, color: String, qty: Number, unit: Number }, { _id: false });
const OrderDocumentSchema = new Schema<IOrderDocument>({
  name:       { type: String, required: true },
  kind:       { type: String, enum: ["INVOICE", "QUOTATION", "BILLING", "DESIGN", "OTHER"], default: "OTHER" },
  dataUrl:    { type: String, required: true },
  uploadedBy: { type: String, enum: ["admin", "customer"], required: true },
  generated:  { type: Boolean, default: false },
  visible:    { type: Boolean, default: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

const OrderSchema = new Schema<IOrder>(
  {
    userId:   { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderRef: { type: String, unique: true, sparse: true }, // assigned from seq in pre-save

    persona:  { type: String, enum: ["organisation", "individual"], required: true },
    isAccessoryOrder: { type: Boolean, default: false },

    orgType:      String,
    orgName:      String,
    service:      String,
    serviceLabel: String,

    garmentType:  String,
    fabric:       String,
    gsm:          String,
    weave:        String,
    fabricSource: { type: String, enum: ["fresh", "surplus"] },

    qty:    { type: Number, default: 0 },
    sizes:  { type: [SizeEntrySchema], default: [] },
    colors: { type: [ColorEntrySchema], default: [] },

    accessoryItems: { type: [AccessoryItemSchema], default: [] },

    stitching: String,
    packaging: String,

    deliveryAddress: String,
    deliveryCity:    String,
    deliveryPin:     String,

    contactName:  String,
    contactPhone: String,
    contactEmail: String,

    status: {
      type: String,
      enum: ["Draft","Quote pending","Order placed","Order confirmed","In production","Quality check","Shipped","Delivered","Completed","Cancelled"],
      default: "Quote pending",
    },
    trackSteps: { type: [TrackStepSchema], default: [] },
    etaDate:    String,

    quoteAmount:     Number,
    serviceFee:      { type: Number, default: 0 },
    quoteApprovedAt: Date,
    confirmedAt:     Date,
    paymentStatus:   { type: String, enum: ["unpaid","partial","paid"], default: "unpaid" },
    paymentMode:     String,
    paymentDate:     Date,
    paymentReference: String,

    coordinatorId: { type: Schema.Types.ObjectId, ref: "User" },
    notes: String,

    // ── Garm Admin Portal operational fields ──
    seq: { type: Number, unique: true, sparse: true, index: true },
    adminStatus: {
      type: String,
      enum: ["NEW","CONFIRMED","ASSIGNED","IN_PROGRESS","QC_READY","QC_APPROVED","INVOICED","PAID","SHIPPED","DELIVERED","CANCELLED"],
      default: "NEW",
    },
    assignedEmployee: String,
    trackingCourier: String,
    trackingNumber: String,
    manufacturer: { type: String, default: "—" },
    qcResult: { type: String, enum: ["PENDING","PASSED","FAILED","REWORK","N/A"], default: "PENDING" },
    adminPayStatus: { type: String, enum: ["PENDING","PARTIAL","COMPLETED"], default: "PENDING" },
    rating:         { type: Number, min: 1, max: 5 },
    ratingFeedback: { type: String },
    ratedAt:        { type: Date },
    total: { type: Number, default: 0 },
    lines: { type: [OrderLineSchema], default: [] },
    documents: { type: [OrderDocumentSchema], default: [] },
  },
  { timestamps: true }
);

// Generate default track steps on save if empty. Individuals (persona
// "individual") skip in-house QC entirely in the Garm App — only
// Organisation orders go through inspection before shipping — so their
// tracker never shows a "Quality check" step. Mirrors the same rule enforced
// admin-side in server/index.js's buildTrackSteps().
OrderSchema.pre("save", async function (next) {
  if (this.trackSteps.length === 0) {
    const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    if (this.persona === "individual") {
      // Individuals: submit -> admin confirms -> customer pays -> production.
      // No in-house QC step for B2C, ever.
      // "Order submitted" is the CURRENT stage until the Garm team explicitly
      // confirms — "Order confirmed" must never look reached before that.
      this.trackSteps = [
        { label: "Order submitted",  sub: `${today} · Waiting for Garm to confirm`, status: "active"  as const },
        { label: "Order confirmed",  sub: "Garm will confirm your order",           status: "pending" as const },
        { label: "Payment",          sub: "Unlocks once your order is confirmed",   status: "pending" as const },
        { label: "In production",    sub: "Starts after payment",                   status: "pending" as const },
        { label: "Shipped",          sub: "Pending",                                status: "pending" as const },
        { label: "Delivered",        sub: "Pending",                                status: "pending" as const },
      ];
    } else {
      this.trackSteps = [
        { label: "Order placed",      sub: today,     status: "done"    as const },
        { label: "Sourcing material", sub: "Pending", status: "pending" as const },
        { label: "In production",     sub: "Pending", status: "pending" as const },
        { label: "Quality check",     sub: "Pending", status: "pending" as const },
        { label: "Shipped",           sub: "Pending", status: "pending" as const },
        { label: "Delivered",         sub: "Pending", status: "pending" as const },
      ];
    }
  }
  // Individuals never carry a real QC result — only Organisation orders do.
  // (Runs after schema defaults are applied, so explicitly override rather
  // than checking for undefined — the schema default is always "PENDING".)
  if (this.isNew && this.persona === "individual") {
    this.qcResult = "N/A";
  }
  if (this.isNew && this.seq == null) {
    try {
      this.seq = await nextSeq();
    } catch (err) {
      return next(err as Error);
    }
  }
  // Same reference everywhere: FL-<2046+seq>, shown identically in the Garm
  // App and the admin portal. Assigned exactly once, from the atomic counter.
  if (this.isNew && !this.orderRef && this.seq != null) {
    this.orderRef = `FL-${2046 + this.seq}`;
  }
  next();
});

export const Order = mongoose.model<IOrder>("Order", OrderSchema);
