import mongoose, { Document, Schema } from "mongoose";

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

export interface IAddress {
  _id?: mongoose.Types.ObjectId;
  label: string;          // "Home", "Office", etc.
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pin: string;
  isDefault: boolean;
}

export interface IPaymentMethod {
  _id?: mongoose.Types.ObjectId;
  type: "bank" | "upi";
  // Bank
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  accountHolder?: string;
  // UPI
  upiId?: string;
  upiProvider?: string;
  isDefault: boolean;
}

// ─── Main User document ───────────────────────────────────────────────────────

export interface IUser extends Document {
  phone?: string;
  email?: string;
  name: string;
  accountType: "organisation" | "personal";

  // Organisation fields
  orgName?: string;
  orgType?: "school" | "college" | "corporate" | "hospital" | "industry" | "hospitality" | "sports" | "government" | "ngo";
  orgBoard?: string;        // Affiliation / registration number
  designation?: string;

  // Profile
  avatarUrl?: string;
  twoFAEnabled: boolean;

  // Sub-documents
  addresses: IAddress[];
  paymentMethods: IPaymentMethod[];

  onboardingComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>({
  label:     { type: String, default: "Home" },
  line1:     { type: String, required: true },
  line2:     { type: String },
  city:      { type: String, required: true },
  state:     { type: String, default: "" },
  pin:       { type: String, required: true },
  isDefault: { type: Boolean, default: false },
});

const PaymentMethodSchema = new Schema<IPaymentMethod>({
  type:          { type: String, enum: ["bank", "upi"], required: true },
  bankName:      String,
  accountNumber: String,
  ifsc:          String,
  accountHolder: String,
  upiId:         String,
  upiProvider:   String,
  isDefault:     { type: Boolean, default: false },
});

const UserSchema = new Schema<IUser>(
  {
    phone:    { type: String, sparse: true, unique: true },
    email:    { type: String, sparse: true, unique: true, lowercase: true },
    name:     { type: String, default: "" },
    accountType: { type: String, enum: ["organisation", "personal"], default: "personal" },

    orgName:     String,
    orgType:     { type: String, enum: ["school","college","corporate","hospital","industry","hospitality","sports","government","ngo"] },
    orgBoard:    String,
    designation: String,
    avatarUrl:   String,
    twoFAEnabled: { type: Boolean, default: false },

    addresses:      { type: [AddressSchema], default: [] },
    paymentMethods: { type: [PaymentMethodSchema], default: [] },

    onboardingComplete: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);
