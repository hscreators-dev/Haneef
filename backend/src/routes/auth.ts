import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { generateOTP, verifyOTP } from "../services/otpService";
import { sendSMS }   from "../services/smsService";
import { sendEmail } from "../services/emailService";
import { User }      from "../models/User";
import { LoginEvent } from "../models/LoginEvent";
import { signToken, requireAuth, AuthRequest } from "../middleware/auth";
import { httpError } from "../middleware/error";

const router = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────

const SendOTPSchema = z.object({
  identity: z.string().min(5),
  mode: z.enum(["phone", "email"]),
});

// Keep the accepted OTP length in sync with otpService's OTP_LENGTH — hard-coding
// 6 here silently rejected every valid code whenever OTP_LENGTH was changed.
const OTP_LENGTH = parseInt(process.env.OTP_LENGTH ?? "6");
const VerifyOTPSchema = z.object({
  identity: z.string().min(5),
  otp:      z.string().length(OTP_LENGTH),
  mode:     z.enum(["phone", "email"]),
});

// ─── POST /api/auth/send-otp ─────────────────────────────────────────────────
// Generates + sends OTP via Twilio (phone) or Gmail (email)

router.post("/send-otp", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identity, mode } = SendOTPSchema.parse(req.body);

    const otp = await generateOTP(identity, mode);

    // Dev-OTP escape hatch: when ALLOW_DEV_OTP=true, the code is returned in the
    // response (and shown on-screen by the app) so you can log in for FREE with
    // NO SMS/email gateway — handy for demos or when SMS isn't wired. Off by
    // default; while it's on, anyone who knows an email/phone can sign in as it,
    // so turn it back off before real users rely on the app.
    const devOtp = process.env.ALLOW_DEV_OTP === "true";

    // Deliver via the configured provider (see services/smsService.ts and
    // emailService.ts — provider-agnostic, no Twilio required). If a real
    // gateway isn't configured they fall back to a console log in dev. In
    // production a delivery failure is a hard error (don't issue a code no one
    // receives); in dev — or when dev-OTP is on — it's swallowed so you can test
    // with the on-screen code.
    try {
      if (mode === "phone") await sendSMS(identity, otp);
      else await sendEmail(identity, otp);
    } catch (gatewayErr) {
      if (process.env.NODE_ENV === "production" && !devOtp) throw gatewayErr;
    }

    res.json({
      success: true,
      message: `OTP sent to ${identity}`,
      // Echo the code outside production, OR whenever ALLOW_DEV_OTP is on, so
      // testing works without a real gateway. Never echoed in normal production.
      ...(process.env.NODE_ENV !== "production" || devOtp ? { devCode: otp } : {}),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/verify-otp ───────────────────────────────────────────────
// Verifies OTP, upserts user, returns JWT

router.post("/verify-otp", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identity, otp, mode } = VerifyOTPSchema.parse(req.body);

    const valid = await verifyOTP(identity, otp);
    if (!valid) {
      return next(httpError("Invalid or expired OTP", 401));
    }

    // Upsert user — with NORMALISED identity. Previously the match used the
    // raw string, so "+91 63803 39944", "6380339944" and "+916380339944" each
    // created a separate account and a returning user looked like a nameless
    // "Guest". Now every phone format maps to ONE canonical "+91XXXXXXXXXX"
    // account (emails: lowercased), and legacy-format records are matched and
    // healed to the canonical form.
    const canon = mode === "phone"
      ? `+91${identity.replace(/\D/g, "").slice(-10)}`
      : identity.trim().toLowerCase();
    const variants = mode === "phone"
      ? [...new Set([canon, canon.slice(1), canon.slice(3), identity])] // +91X…, 91X…, bare 10-digit, as-typed
      : [...new Set([canon, identity])];
    const filter  = mode === "phone" ? { phone: { $in: variants } } : { email: { $in: variants } };
    // If duplicates exist from the old exact-match era, prefer the record that
    // completed onboarding (has the name) — never resurrect a nameless "Guest".
    let user = await User.findOne(filter).sort({ onboardingComplete: -1, createdAt: 1 });
    const isNewUser = !user;   // brand-new account created on this sign-in
    if (!user) {
      user = await User.create(mode === "phone" ? { phone: canon } : { email: canon });
    }
    // Heal a legacy-format record so future logins hit the canonical value.
    if (mode === "phone" && user.phone !== canon) { user.phone = canon; await user.save(); }
    else if (mode === "email" && user.email !== canon) { user.email = canon; await user.save(); }

    // Self-heal poisoned accounts: a user who already has a name IS onboarded.
    // An earlier bug (empty orgType rejected the profile PUT) meant many personal
    // accounts saved their name but never got onboardingComplete=true, so they
    // were re-asked to onboard on every login. If we see a name, mark it done.
    if (user.name && user.name.trim() && !user.onboardingComplete) {
      user.onboardingComplete = true;
      await user.save();
    }

    // Record the sign-in for the admin portal's Customer Log (new vs returning).
    // Best-effort — a logging failure must never block the login.
    try {
      await LoginEvent.create({
        userId: user._id, name: user.name, phone: user.phone, email: user.email,
        mode, isNewUser, at: new Date(),
      });
    } catch { /* non-fatal */ }

    const token = signToken(user._id.toString());

    res.json({
      token,
      user: {
        id:                 user._id,
        name:               user.name,
        phone:              user.phone,
        email:              user.email,
        accountType:        user.accountType,
        onboardingComplete: user.onboardingComplete,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get("/me", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.userId).select("-__v");
    if (!user) return next(httpError("User not found", 404));
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
// JWT is stateless; client just discards the token.
// Kept as an endpoint so the frontend can call it symmetrically.

router.post("/logout", requireAuth, (_req, res) => {
  res.json({ success: true });
});

export default router;
