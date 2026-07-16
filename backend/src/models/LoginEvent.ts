import mongoose, { Document, Schema } from "mongoose";

// A row per customer sign-in, written on every successful OTP verification.
// Powers the admin portal's "Customer Log" (who signed in, and whether it was a
// brand-new account or a returning customer). Shares the same MongoDB the Garm
// App backend and admin portal both use.
export interface ILoginEvent extends Document {
  userId: mongoose.Types.ObjectId;
  name?: string;
  phone?: string;
  email?: string;
  mode: "phone" | "email";
  isNewUser: boolean;   // true = the account was created on this sign-in
  at: Date;
}

const LoginEventSchema = new Schema<ILoginEvent>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name:      String,
    phone:     String,
    email:     String,
    mode:      { type: String, enum: ["phone", "email"], required: true },
    isNewUser: { type: Boolean, default: false },
    at:        { type: Date, default: Date.now, index: true },
  },
  { collection: "loginevents" }
);

export const LoginEvent = mongoose.models.LoginEvent
  || mongoose.model<ILoginEvent>("LoginEvent", LoginEventSchema);
