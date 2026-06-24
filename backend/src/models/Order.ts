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

export type OrderStatus =
  | "Draft"
  | "Quote pending"
  | "Order placed"
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
  quoteApprovedAt?: Date;
  paymentStatus?: "unpaid" | "partial" | "paid";
  paymentMode?: string;
  paymentDate?: Date;
  paymentReference?: string;

  // Coordinator
  coordinatorId?: mongoose.Types.ObjectId;

  // Notes
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

let _counter = 2046;
function nextRef() { return `FL-${++_counter}`; }

const SizeEntrySchema = new Schema<ISizeEntry>({ label: String, qty: Number }, { _id: false });
const ColorEntrySchema = new Schema<IColorEntry>({ hex: String, pantone: String, label: String, position: String }, { _id: false });
const AccessoryItemSchema = new Schema<IAccessoryItem>({ categoryId: String, categoryLabel: String, itemName: String, qty: Number }, { _id: false });
const TrackStepSchema = new Schema<ITrackStep>({ label: String, sub: String, status: String, completedAt: Date }, { _id: false });

const OrderSchema = new Schema<IOrder>(
  {
    userId:   { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderRef: { type: String, unique: true, default: nextRef },
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
      enum: ["Draft","Quote pending","Order placed","In production","Quality check","Shipped","Delivered","Completed","Cancelled"],
      default: "Quote pending",
    },
    trackSteps: { type: [TrackStepSchema], default: [] },
    etaDate:    String,

    quoteAmount:     Number,
    quoteApprovedAt: Date,
    paymentStatus:   { type: String, enum: ["unpaid","partial","paid"], default: "unpaid" },
    paymentMode:     String,
    paymentDate:     Date,
    paymentReference: String,

    coordinatorId: { type: Schema.Types.ObjectId, ref: "User" },
    notes: String,
  },
  { timestamps: true }
);

// Generate default track steps on save if empty
OrderSchema.pre("save", function (next) {
  if (this.trackSteps.length === 0) {
    this.trackSteps = [
      { label: "Order placed",      sub: new Date().toLocaleDateString("en-IN",{ day:"numeric",month:"short",year:"numeric" }), status: "done" },
      { label: "Sourcing material", sub: "Pending",     status: "pending" },
      { label: "In production",     sub: "Pending",     status: "pending" },
      { label: "Quality check",     sub: "Pending",     status: "pending" },
      { label: "Shipped",           sub: "Pending",     status: "pending" },
      { label: "Delivered",         sub: "Pending",     status: "pending" },
    ];
  }
  next();
});

export const Order = mongoose.model<IOrder>("Order", OrderSchema);
