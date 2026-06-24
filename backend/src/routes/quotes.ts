import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { Quote } from "../models/Quote";
import { Order } from "../models/Order";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { httpError } from "../middleware/error";

const router = Router();
router.use(requireAuth);

// ─── GET /api/quotes ──────────────────────────────────────────────────────────

router.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const quotes = await Quote
      .find({ userId: req.userId })
      .populate("orderId", "orderRef persona serviceLabel isAccessoryOrder")
      .sort({ createdAt: -1 })
      .select("-__v");
    res.json({ quotes });
  } catch (err) { next(err); }
});

// ─── GET /api/quotes/:id ──────────────────────────────────────────────────────

router.get("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const quote = await Quote
      .findOne({ _id: req.params.id, userId: req.userId })
      .populate("orderId")
      .select("-__v");
    if (!quote) return next(httpError("Quote not found", 404));
    res.json({ quote });
  } catch (err) { next(err); }
});

// ─── POST /api/quotes/:id/approve ────────────────────────────────────────────

router.post("/:id/approve", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const quote = await Quote.findOne({ _id: req.params.id, userId: req.userId });
    if (!quote) return next(httpError("Quote not found", 404));
    if (quote.status !== "pending") return next(httpError(`Quote is already ${quote.status}`, 400));
    if (quote.validUntil < new Date()) {
      quote.status = "expired";
      await quote.save();
      return next(httpError("Quote has expired", 400));
    }

    quote.status     = "approved";
    quote.approvedAt = new Date();
    await quote.save();

    // Advance order status to "Order placed"
    await Order.findByIdAndUpdate(quote.orderId, {
      $set: { status: "Order placed", quoteAmount: quote.amount, quoteApprovedAt: new Date() },
    });

    res.json({ quote });
  } catch (err) { next(err); }
});

// ─── POST /api/quotes/:id/reject ─────────────────────────────────────────────

const RejectSchema = z.object({ note: z.string().optional() });

router.post("/:id/reject", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { note } = RejectSchema.parse(req.body);
    const quote = await Quote.findOne({ _id: req.params.id, userId: req.userId });
    if (!quote) return next(httpError("Quote not found", 404));
    if (quote.status !== "pending") return next(httpError(`Quote is already ${quote.status}`, 400));

    quote.status        = "rejected";
    quote.rejectedAt    = new Date();
    quote.rejectionNote = note;
    await quote.save();

    res.json({ quote });
  } catch (err) { next(err); }
});

export default router;
