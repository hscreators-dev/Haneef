import mongoose, { Document, Schema } from "mongoose";

export interface IQuote extends Document {
  orderId:   mongoose.Types.ObjectId;
  userId:    mongoose.Types.ObjectId;
  amount:    number;
  currency:  string;
  breakdown: { label: string; amount: number }[];
  validUntil: Date;
  status: "pending" | "approved" | "rejected" | "expired";
  rejectionNote?: string;
  approvedAt?: Date;
  rejectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QuoteSchema = new Schema<IQuote>(
  {
    orderId:  { type: Schema.Types.ObjectId, ref: "Order", required: true },
    userId:   { type: Schema.Types.ObjectId, ref: "User",  required: true, index: true },
    amount:   { type: Number, required: true },
    currency: { type: String, default: "INR" },
    breakdown: [{ label: String, amount: Number }],
    validUntil:    { type: Date, required: true },
    status:        { type: String, enum: ["pending","approved","rejected","expired"], default: "pending" },
    rejectionNote: String,
    approvedAt:    Date,
    rejectedAt:    Date,
  },
  { timestamps: true }
);

export const Quote = mongoose.model<IQuote>("Quote", QuoteSchema);
