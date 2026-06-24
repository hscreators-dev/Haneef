import bcrypt from "bcryptjs";
import { OTP } from "../models/OTP";

const OTP_LENGTH   = parseInt(process.env.OTP_LENGTH   ?? "6");
const OTP_EXPIRES  = parseInt(process.env.OTP_EXPIRES_MINUTES ?? "10");
const MAX_ATTEMPTS = 5;

/** Generate a random numeric OTP, hash it, store in DB, return plain code */
export async function generateOTP(identity: string, mode: "phone" | "email"): Promise<string> {
  // Invalidate any previous unused OTP for this identity
  await OTP.deleteMany({ identity, used: false });

  const plain = Array.from({ length: OTP_LENGTH }, () =>
    Math.floor(Math.random() * 10).toString()
  ).join("");

  const hashed = await bcrypt.hash(plain, 10);

  await OTP.create({
    identity,
    mode,
    code: hashed,
    expiresAt: new Date(Date.now() + OTP_EXPIRES * 60 * 1000),
  });

  return plain;
}

/** Verify a submitted OTP. Returns true/false and deletes on success. */
export async function verifyOTP(identity: string, submitted: string): Promise<boolean> {
  const record = await OTP.findOne({
    identity,
    used: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!record) return false;

  // Brute-force guard
  if (record.attempts >= MAX_ATTEMPTS) {
    await record.deleteOne();
    return false;
  }

  const match = await bcrypt.compare(submitted, record.code);
  if (!match) {
    record.attempts += 1;
    await record.save();
    return false;
  }

  record.used = true;
  await record.save();
  return true;
}
