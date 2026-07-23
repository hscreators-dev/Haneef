import { Router, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { User } from "../models/User";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { httpError } from "../middleware/error";

const router = Router();
router.use(requireAuth);

// ─── GET /api/account/profile ─────────────────────────────────────────────────

router.get("/profile", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.userId).select("-__v -paymentMethods");
    if (!user) return next(httpError("User not found", 404));
    res.json({ user });
  } catch (err) { next(err); }
});

// ─── PUT /api/account/profile ─────────────────────────────────────────────────

// Empty strings from the app's onboarding/profile forms (e.g. a personal user
// never picks an orgType, so it arrives as "") must NOT be written to enum
// fields — `orgType: ""` fails the model's enum validator, the whole PUT 400s,
// and because the app calls this fire-and-forget, `onboardingComplete: true`
// was silently lost, re-asking every personal user to onboard on each login.
// Coerce blanks to undefined so they're simply omitted from the update.
const blankToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const ORG_TYPES = ["school","college","corporate","hospital","industry","hospitality","sports","government","ngo"] as const;

const ProfileSchema = z.object({
  name:        z.preprocess(blankToUndef, z.string().min(1).optional()),
  email:       z.preprocess(blankToUndef, z.string().email().optional()),
  phone:       z.preprocess(blankToUndef, z.string().optional()),
  accountType: z.preprocess(blankToUndef, z.enum(["organisation","personal"]).optional()),
  orgName:     z.preprocess(blankToUndef, z.string().optional()),
  orgType:     z.preprocess(blankToUndef, z.enum(ORG_TYPES).optional()),
  orgBoard:    z.preprocess(blankToUndef, z.string().optional()),
  designation: z.preprocess(blankToUndef, z.string().optional()),
  avatarUrl:   z.preprocess(blankToUndef, z.string().optional()),
  twoFAEnabled: z.boolean().optional(),
  onboardingComplete: z.boolean().optional(),
}).strict();

router.put("/profile", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = ProfileSchema.parse(req.body);
    // Drop keys that resolved to undefined so we never $set a blank onto an
    // enum/validated field (which would reject the whole update).
    const update = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    );

    // Once onboarding is complete, accountType/orgType are locked. They drive
    // persona-specific business logic throughout the app (pricing, order status
    // vocabulary, the whole quote-vs-direct-order flow) — letting a fully
    // onboarded user silently relabel themselves personal<->organisation via
    // this endpoint would switch their future orders onto a different flow
    // without ever going back through onboarding. Only the original
    // onboarding-time PUT (while onboardingComplete is still false) may set
    // these freely, same as today — and resubmitting the SAME value (e.g. the
    // frontend re-PUTting the full profile on an unrelated field edit) is still
    // allowed since nothing is actually changing.
    const existing = await User.findById(req.userId).select("onboardingComplete accountType orgType");
    if (!existing) return next(httpError("User not found", 404));
    if (existing.onboardingComplete) {
      const locked = (["accountType", "orgType"] as const).find(
        (key) => key in update && update[key] !== existing[key]
      );
      if (locked) {
        return next(httpError(`${locked} can't be changed after onboarding — contact support if this needs to change`, 403));
      }
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: update },
      { new: true, runValidators: true }
    ).select("-__v -paymentMethods");
    if (!user) return next(httpError("User not found", 404));
    res.json({ user });
  } catch (err) { next(err); }
});

// ─── Addresses ────────────────────────────────────────────────────────────────

const AddressSchema = z.object({
  label:     z.string().default("Home"),
  line1:     z.string().min(1),
  line2:     z.string().optional(),
  city:      z.string().min(1),
  state:     z.string().default(""),
  pin:       z.string().regex(/^\d{6}$/),
  isDefault: z.boolean().default(false),
});

router.get("/addresses", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.userId).select("addresses");
    res.json({ addresses: user?.addresses ?? [] });
  } catch (err) { next(err); }
});

router.post("/addresses", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = AddressSchema.parse(req.body);
    const user = await User.findById(req.userId);
    if (!user) return next(httpError("User not found", 404));

    if (data.isDefault) {
      user.addresses.forEach(a => { a.isDefault = false; });
    }
    user.addresses.push(data as any);
    await user.save();
    res.status(201).json({ addresses: user.addresses });
  } catch (err) { next(err); }
});

router.put("/addresses/:addrId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = AddressSchema.partial().parse(req.body);
    const user = await User.findById(req.userId);
    if (!user) return next(httpError("User not found", 404));

    const addr = user.addresses.id(req.params.addrId);
    if (!addr) return next(httpError("Address not found", 404));

    if (data.isDefault) {
      user.addresses.forEach(a => { a.isDefault = false; });
    }
    Object.assign(addr, data);
    await user.save();
    res.json({ addresses: user.addresses });
  } catch (err) { next(err); }
});

router.delete("/addresses/:addrId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return next(httpError("User not found", 404));
    user.addresses = user.addresses.filter(
      a => a._id?.toString() !== req.params.addrId
    ) as any;
    await user.save();
    res.json({ addresses: user.addresses });
  } catch (err) { next(err); }
});

// ─── Payment Methods ──────────────────────────────────────────────────────────

const PaymentSchema = z.discriminatedUnion("type", [
  z.object({
    type:          z.literal("bank"),
    bankName:      z.string().min(1),
    accountNumber: z.string().min(8),
    ifsc:          z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),
    accountHolder: z.string().min(1),
    isDefault:     z.boolean().default(false),
  }),
  z.object({
    type:        z.literal("upi"),
    upiId:       z.string().includes("@"),
    upiProvider: z.string().optional(),
    isDefault:   z.boolean().default(false),
  }),
]);

router.get("/payment", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.userId).select("paymentMethods");
    res.json({ paymentMethods: user?.paymentMethods ?? [] });
  } catch (err) { next(err); }
});

router.post("/payment", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = PaymentSchema.parse(req.body);
    const user = await User.findById(req.userId);
    if (!user) return next(httpError("User not found", 404));

    if (data.isDefault) {
      user.paymentMethods.forEach(p => { p.isDefault = false; });
    }
    user.paymentMethods.push(data as any);
    await user.save();
    res.status(201).json({ paymentMethods: user.paymentMethods });
  } catch (err) { next(err); }
});

router.delete("/payment/:pmId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return next(httpError("User not found", 404));
    user.paymentMethods = user.paymentMethods.filter(
      p => p._id?.toString() !== req.params.pmId
    ) as any;
    await user.save();
    res.json({ paymentMethods: user.paymentMethods });
  } catch (err) { next(err); }
});

export default router;
