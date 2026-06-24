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

const ProfileSchema = z.object({
  name:        z.string().min(1).optional(),
  email:       z.string().email().optional(),
  phone:       z.string().optional(),
  accountType: z.enum(["organisation","personal"]).optional(),
  orgName:     z.string().optional(),
  orgType:     z.string().optional(),
  orgBoard:    z.string().optional(),
  designation: z.string().optional(),
  onboardingComplete: z.boolean().optional(),
}).strict();

router.put("/profile", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = ProfileSchema.parse(req.body);
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: data },
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
