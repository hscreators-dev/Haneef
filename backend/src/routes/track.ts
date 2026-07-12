import { Router, Response, NextFunction } from "express";
import { Order } from "../models/Order";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { httpError } from "../middleware/error";

const router = Router();
router.use(requireAuth);

// ─── GET /api/track/:orderRef ─────────────────────────────────────────────────
// Returns full tracking info for a single order

router.get("/:orderRef", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Accept either MongoDB _id or the human-readable orderRef (e.g. "FL-2047",
    // with or without a leading "#" — older records/screens used "#FL-…").
    const { orderRef } = req.params;
    const clean = orderRef.replace(/^#/, "");
    const query = clean.startsWith("FL-")
      ? { orderRef: { $in: [clean, `#${clean}`] }, userId: req.userId }
      : { _id: orderRef, userId: req.userId };

    const order = await Order.findOne(query).select("-__v");
    if (!order) return next(httpError("Order not found", 404));

    res.json({
      id:              order._id,
      orderRef:        order.orderRef,
      status:          order.status,
      etaDate:         order.etaDate,
      trackSteps:      order.trackSteps,
      isAccessoryOrder: order.isAccessoryOrder,
      accessoryItems:  order.accessoryItems,
      fabric:          order.fabric,
      qty:             order.qty,
      gsm:             order.gsm,
      colors:          order.colors,
      stitching:       order.stitching,
      packaging:       order.packaging,
      quoteAmount:     order.quoteAmount,
      paymentStatus:   order.paymentStatus,
      paymentMode:     order.paymentMode,
      paymentDate:     order.paymentDate,
    });
  } catch (err) { next(err); }
});

// ─── GET /api/track (all active orders) ──────────────────────────────────────

router.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const activeStatuses = ["Quote pending","Order placed","Order confirmed","In production","Quality check","Shipped"];
    const orders = await Order
      .find({ userId: req.userId, status: { $in: activeStatuses } })
      .sort({ createdAt: -1 })
      .select("orderRef status etaDate isAccessoryOrder serviceLabel accessoryItems trackSteps qty");
    res.json({ orders });
  } catch (err) { next(err); }
});

export default router;
