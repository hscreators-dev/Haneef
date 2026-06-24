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

    if (mode === "phone") {
      await sendSMS(identity, otp);
    } else {
      await sendEmail(identity, otp);
    }

    // In development, also log to console so you can test without credentials
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n🔑 OTP for ${identity}: ${otp}\n`);
    }

    res.json({ success: true, message: `OTP sent to ${identity}` });
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
