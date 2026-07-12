import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { generateOTP, verifyOTP } from "../services/otpService";
import { sendSMS }   from "../services/smsService";
import { sendEmail } from "../services/emailService";
import { User }      from "../models/User";
import { signToken, requireAuth, AuthRequest } from "../middleware/auth";
import { httpError } from "../middleware/error";

const router = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────

const SendOTPSchema = z.object({
  identity: z.string().min(5),
  mode: z.enum(["phone", "email"]),
});

const VerifyOTPSchema = z.object({
  identity: z.string().min(5),
  otp:      z.string().length(6),
  mode:     z.enum(["phone", "email"]),
});

// ─── POST /api/auth/send-otp ─────────────────────────────────────────────────
// Generates + sends OTP via Twilio (phone) or Gmail (email)

router.post("/send-otp", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identity, mode } = SendOTPSchema.parse(req.body);

    const otp = await generateOTP(identity, mode);

    // Deliver via the configured provider (see services/smsService.ts and
    // emailService.ts — provider-agnostic, no Twilio required). If a real
    // gateway isn't configured they fall back to a console log in dev. In
    // production a delivery failure is a hard error (don't issue a code no one
    // receives); in dev it's swallowed so you can test with the console code.
    try {
      if (mode === "phone") await sendSMS(identity, otp);
      else await sendEmail(identity, otp);
    } catch (gatewayErr) {
      if (process.env.NODE_ENV === "production") throw gatewayErr;
    }

    res.json({
      success: true,
      message: `OTP sent to ${identity}`,
      // Echo the code ONLY outside production so local testing works without a
      // real gateway. Never returned in production — there it must be delivered.
      ...(process.env.NODE_ENV !== "production" ? { devCode: otp } : {}),
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

    // Upsert user
    const filter  = mode === "phone" ? { phone: identity } : { email: identity };
    const update  = mode === "phone" ? { phone: identity } : { email: identity };
    const user    = await User.findOneAndUpdate(filter, { $setOnInsert: update }, {
      upsert: true, new: true, setDefaultsOnInsert: true,
    });

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
