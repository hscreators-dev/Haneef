import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { Order } from "../models/Order";
import { Quote } from "../models/Quote";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { httpError } from "../middleware/error";

const router = Router();
router.use(requireAuth);

// ─── Validation ───────────────────────────────────────────────────────────────

const CreateOrderSchema = z.object({
  persona:          z.enum(["organisation", "individual"]),
  isAccessoryOrder: z.boolean().default(false),
  orgType:          z.string().optional(),
  orgName:          z.string().optional(),
  service:          z.string().optional(),
  serviceLabel:     z.string().optional(),
  garmentType:      z.string().optional(),
  fabric:           z.string().optional(),
  gsm:              z.string().optional(),
  weave:            z.string().optional(),
  fabricSource:     z.enum(["fresh","surplus"]).optional(),
  qty:              z.number().min(0).default(0),
  sizes:            z.array(z.object({ label: z.string(), qty: z.number() })).default([]),
  colors:           z.array(z.object({ hex: z.string(), pantone: z.string().optional(), label: z.string(), position: z.string().optional() })).default([]),
  accessoryItems:   z.array(z.object({ categoryId: z.string(), categoryLabel: z.string(), itemName: z.string(), qty: z.number() })).default([]),
  stitching:        z.string().optional(),
  packaging:        z.string().optional(),
  deliveryAddress:  z.string().optional(),
  deliveryCity:     z.string().optional(),
  deliveryPin:      z.string().optional(),
  contactName:      z.string().optional(),
  contactPhone:     z.string().optional(),
  contactEmail:     z.string().optional(),
  notes:            z.string().optional(),
});

// ─── GET /api/orders ──────────────────────────────────────────────────────────

router.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orders = await Order
      .find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .select("-__v");
    res.json({ orders });
  } catch (err) { next(err); }
});

// ─── POST /api/orders ─────────────────────────────────────────────────────────

router.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data  = CreateOrderSchema.parse(req.body);
    const order = await Order.create({ ...data, userId: req.userId });
    res.status(201).json({ order });
  } catch (err) { next(err); }
});

// ─── GET /api/orders/:id ──────────────────────────────────────────────────────

router.get("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.userId }).select("-__v");
    if (!order) return next(httpError("Order not found", 404));
    res.json({ order });
  } catch (err) { next(err); }
});

// ─── PATCH /api/orders/:id ────────────────────────────────────────────────────
// Partial update (notes, delivery address, contact, etc.)

router.patch("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: req.body },
      { new: true, runValidators: true }
    ).select("-__v");
    if (!order) return next(httpError("Order not found", 404));
    res.json({ order });
  } catch (err) { next(err); }
});

// ─── DELETE /api/orders/:id ───────────────────────────────────────────────────
// Cancel — only if still in Quote pending / Draft stage

router.delete("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.userId });
    if (!order) return next(httpError("Order not found", 404));

    const cancellable: string[] = ["Draft", "Quote pending"];
    if (!cancellable.includes(order.status)) {
      return next(httpError(`Cannot cancel an order in '${order.status}' status`, 400));
    }

    order.status = "Cancelled";
    await order.save();
    res.json({ success: true, order });
  } catch (err) { next(err); }
});

// ─── GET /api/orders/:id/quote ────────────────────────────────────────────────

router.get("/:id/quote", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const quote = await Quote.findOne({ orderId: req.params.id, userId: req.userId }).select("-__v");
    if (!quote) return next(httpError("Quote not found", 404));
    res.json({ quote });
  } catch (err) { next(err); }
});

// ─── POST /api/orders/:id/reorder ────────────────────────────────────────────
// Duplicate a past order as a new draft

router.post("/:id/reorder", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const src = await Order.findOne({ _id: req.params.id, userId: req.userId }).lean();
    if (!src) return next(httpError("Order not found", 404));

    const { _id, orderRef, createdAt, updatedAt, trackSteps, status, quoteAmount,
            quoteApprovedAt, paymentStatus, paymentDate, paymentReference, ...rest } = src as any;

    const newOrder = await Order.create({ ...rest, userId: req.userId, status: "Draft" });
    res.status(201).json({ order: newOrder });
  } catch (err) { next(err); }
});

export default router;
