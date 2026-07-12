import mongoose, { Schema, Document, Types } from "mongoose";

// Customer support tickets. Raised from the Garm App's Help & Support screen,
// worked by the admin team in the Admin Portal's Support page — both read this
// same collection (the admin backend has a mirror model in server/mongo.js).

export interface ITicketMessage {
  from: "customer" | "admin";
  authorName: string;
  body: string;
  at: Date;
}

export interface ISupportTicket extends Document {
  ref: string;                 // "SUP-1042"
  userId: Types.ObjectId;      // owning customer
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  category: string;
  subject: string;
  orderRef?: string;
  // "general" = a normal support ticket. "return" = a damage/return request
  // against a delivered order, carrying photos and an approve/decline decision.
  type: "general" | "return";
  images: string[];            // base64 data URLs (damage photos) for returns
  returnStatus: "NONE" | "REQUESTED" | "APPROVED" | "DECLINED";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "NORMAL" | "HIGH";
  assignedTo: string;
  messages: ITicketMessage[];
  seq?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Shared atomic counter (same collection Order uses) so refs never collide
// across restarts.
const CounterSchema = new Schema({ _id: String, value: { type: Number, default: 0 } });
const Counter = mongoose.models.Counter || mongoose.model("Counter", CounterSchema, "counters");

const MessageSchema = new Schema<ITicketMessage>({
  from: { type: String, enum: ["customer", "admin"], required: true },
  authorName: String,
  body: String,
  at: { type: Date, default: Date.now },
}, { _id: false });

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    ref: { type: String, unique: true, sparse: true, index: true },
    seq: { type: Number },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerName: String,
    customerEmail: String,
    customerPhone: String,
    category: String,
    subject: { type: String, required: true },
    orderRef: String,
    type: { type: String, enum: ["general", "return"], default: "general" },
    images: { type: [String], default: [] },
    returnStatus: { type: String, enum: ["NONE", "REQUESTED", "APPROVED", "DECLINED"], default: "NONE" },
    status: { type: String, enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"], default: "OPEN" },
    priority: { type: String, enum: ["LOW", "NORMAL", "HIGH"], default: "NORMAL" },
    assignedTo: { type: String, default: "" },
    messages: { type: [MessageSchema], default: [] },
  },
  { timestamps: true, collection: "supporttickets" }
);

SupportTicketSchema.pre("save", async function (next) {
  if (this.isNew && this.seq == null) {
    const doc = await Counter.findByIdAndUpdate(
      "ticketSeq",
      { $inc: { value: 1 } },
      { new: true, upsert: true }
    );
    this.seq = doc.value;
    this.ref = `SUP-${1041 + doc.value}`;
  }
  next();
});

export const SupportTicket =
  mongoose.models.SupportTicket ||
  mongoose.model<ISupportTicket>("SupportTicket", SupportTicketSchema);
