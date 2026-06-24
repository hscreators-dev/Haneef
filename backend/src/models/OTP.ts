import mongoose, { Document, Schema } from "mongoose";

export interface IOTP extends Document {
  identity: string;          // phone number or email
  mode: "phone" | "email";
  code: string;              // 6-digit OTP (hashed)
  expiresAt: Date;
  used: boolean;
  attempts: number;          // failed verify attempts
  createdAt: Date;
}

const OTPSchema = new Schema<IOTP>(
  {
    identity:  { type: String, required: true, index: true },
    mode:      { type: String, enum: ["phone", "email"], required: true },
    code:      { type: String, required: true },
    expiresAt: { type: Date, required: true },
    used:      { type: Boolean, default: false },
    attempts:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Auto-delete expired OTP documents
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OTP = mongoose.model<IOTP>("OTP", OTPSchema);
