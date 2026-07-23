import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { Order } from "../models/Order";
import { Quote } from "../models/Quote";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { httpError } from "../middleware/error";
import { getFeeSchedule, computeServiceFee, linesSubtotal } from "../lib/serviceFee";

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
  // Fixed catalog price for individual orders — shown to the admin as the
  // proposed amount; the admin sets the final price at Accept & Confirm.
  total:            z.number().optional(),
  quoteAmount:      z.number().optional(),
  serviceFee:       z.number().min(0).optional(),
  // Customer design/logo reference uploads (base64 data URLs), downloadable
  // by the admin team from the portal's order Documents card. 4MB per file.
  // Only safe reference formats (images + PDF) are accepted — the data URL's
  // declared MIME must be on the allow-list, so an attacker can't smuggle in
  // an HTML/SVG/script payload that the admin's browser might execute on view.
  documents:        z.array(z.object({
    name:    z.string().min(1).max(200),
    kind:    z.enum(["DESIGN", "OTHER"]).default("DESIGN"),
    dataUrl: z.string()
      .max(4 * 1024 * 1024 * 1.4)
      .regex(/^data:(image\/(png|jpeg|jpg|webp|gif)|application\/pdf);base64,/i, "Only PNG, JPG, WEBP, GIF or PDF files are allowed"),
  })).max(6).default([]),
  // Per-garment line items — product name INCLUDES the chosen style
  // ("T-Shirts · Round neck") so the admin sees the full configuration.
  lines:            z.array(z.object({
    p:     z.string(),
    size:  z.string(),
    color: z.string(),
    qty:   z.number().min(0),
    unit:  z.number().min(0).default(0),
  })).max(80).default([]),
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
    // Individuals just SUBMIT their order — nothing is payable until an admin
    // accepts it in the Garm Admin Portal (adminStatus NEW -> CONFIRMED).
    // Organisations keep the quote flow ("Quote pending").
    const status = data.persona === "individual" ? "Order placed" : "Quote pending";
    const documents = data.documents.map((d) => ({ ...d, uploadedBy: "customer" as const }));

    // ── Server-side fee/total recompute (do not trust client amounts) ──
    // For individuals (who carry a payable total at submit), recompute the
    // service fee and total from the submitted line items using the live fee
    // schedule. Organisations stay on the quote flow — the admin sets the final
    // quoteAmount later — so we leave their amounts alone here.
    let safeData = { ...data };
    if (data.persona === "individual") {
      const subtotal = data.lines?.length ? linesSubtotal(data.lines) : Math.max(0, (data.total ?? 0) - (data.serviceFee ?? 0));
      if (subtotal > 0) {
        const fee = await getFeeSchedule();
        const serverFee = computeServiceFee(subtotal, data.qty || (data.lines?.reduce((s, l) => s + l.qty, 0) ?? 0), "individual", fee);
        safeData = { ...safeData, serviceFee: serverFee, total: subtotal + serverFee };
      }
    } else {
      // Organisations are priced exclusively through the admin quote flow —
      // quotes.ts's /approve handler is the only place quoteAmount is ever set
      // server-side, and total is never legitimately set for organisations at
      // all. Both fields were previously accepted straight from the client with
      // no stripping here, so a customer could self-issue a price at creation
      // time and have it sit on the order looking like a real Garm-issued quote
      // before any admin had seen it (and, combined with the old /pay gate,
      // immediately unlock payment). Strip them — only /approve may set these.
      delete safeData.total;
      delete safeData.quoteAmount;
    }

    const order = await Order.create({ ...safeData, documents, status, userId: req.userId });
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
// Partial update — customer-editable fields ONLY (delivery address + contact +
// notes). Previously this did `$set: req.body`, a mass-assignment hole: a
// signed-in customer could PATCH their OWN order to set paymentStatus:"paid",
// status:"Delivered", total:1, adminStatus, trackSteps, etc. — bypassing the
// entire payment/QC gate. We now allow-list the safe fields and ignore the rest.
const OrderPatchSchema = z.object({
  deliveryAddress: z.string().max(500).optional(),
  deliveryCity:    z.string().max(120).optional(),
  deliveryPin:     z.string().max(20).optional(),
  contactName:     z.string().max(120).optional(),
  contactPhone:    z.string().max(30).optional(),
  contactEmail:    z.string().max(200).optional(),
  notes:           z.string().max(2000).optional(),
}).strict();

router.patch("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // `.strict()` rejects any field not on the allow-list, so an attacker can't
    // smuggle in status/payment/amount fields. Only editable while the order
    // hasn't started production/payment.
    const patch = OrderPatchSchema.parse(req.body);
    const order = await Order.findOne({ _id: req.params.id, userId: req.userId });
    if (!order) return next(httpError("Order not found", 404));
    if (["In production", "Quality check", "Shipped", "Delivered", "Completed"].includes(order.status)) {
      return next(httpError("This order can no longer be edited — contact your coordinator", 409));
    }
    Object.assign(order, patch);
    await order.save();
    res.json({ order: await Order.findById(order._id).select("-__v") });
  } catch (err) { next(err); }
});

// ─── DELETE /api/orders/:id ───────────────────────────────────────────────────
// Cancel — only if still in Quote pending / Draft stage

router.delete("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.userId });
    if (!order) return next(httpError("Order not found", 404));

    const cancellable: string[] = ["Draft", "Quote pending", "Order placed", "Order confirmed"];
    if (!cancellable.includes(order.status)) {
      return next(httpError(`Cannot cancel an order in '${order.status}' status`, 400));
    }
    // Money has moved — cancellation needs a human (refund handling), not a button.
    if (order.paymentStatus === "paid" || order.paymentStatus === "partial") {
      return next(httpError("This order already has a payment on it — contact your Garm coordinator to cancel and arrange a refund.", 400));
    }

    order.status = "Cancelled";
    // Keep the ADMIN side in step — otherwise the portal still shows the order
    // as live and it could be confirmed/produced after the customer cancelled.
    order.adminStatus = "CANCELLED";
    await order.save();
    res.json({ success: true, order });
  } catch (err) { next(err); }
});

// ─── POST /api/orders/:id/pay ─────────────────────────────────────────────────
// Individuals: single full payment, only AFTER the admin has confirmed the
// order (adminStatus CONFIRMED). Organisations: two-stage — ADVANCE (unlocks
// production) then BALANCE after the QC report (unlocks shipping).

const PaySchema = z.object({
  mode:      z.string().min(2),          // "UPI", "Card", ...
  reference: z.string().optional(),
  stage:     z.enum(["advance", "balance", "full"]).optional(),
});

// Verify a payment actually happened with the gateway before trusting "paid".
// Wire this to your provider when you integrate one. Example below is the
// Razorpay signature check (reference = "order_id|payment_id|signature").
// Returns false by default so nothing is trusted until a gateway is wired.
async function verifyGatewayPayment(reference: string | undefined, _order: unknown): Promise<boolean> {
  if (!reference) return false;
  const provider = (process.env.PAYMENT_PROVIDER ?? "").toLowerCase();
  if (provider === "razorpay") {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return false;
    const [orderId, paymentId, signature] = reference.split("|");
    if (!orderId || !paymentId || !signature) return false;
    const crypto = await import("crypto");
    const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch { return false; }
  }
  // Unknown/absent provider → not verified.
  return false;
}

router.post("/:id/pay", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { mode, reference, stage } = PaySchema.parse(req.body);
    const order = await Order.findOne({ _id: req.params.id, userId: req.userId });
    if (!order) return next(httpError("Order not found", 404));

    // ── Payment integrity guard ──
    // This endpoint marks an order paid; it does NOT itself take money. With a
    // real gateway (Razorpay/Stripe) the client pays the gateway first and we
    // only flip status once the gateway CONFIRMS. Set PAYMENTS_REQUIRE_GATEWAY=true
    // in production so a "paid" claim must carry a gateway-verified reference —
    // otherwise a customer could mark their own order paid for free. Until a
    // gateway is wired, leave it unset for the demo checkout (dev only).
    if (process.env.PAYMENTS_REQUIRE_GATEWAY === "true") {
      const verified = await verifyGatewayPayment(reference, order);
      if (!verified) {
        return next(httpError("Payment could not be verified. Please complete payment through the secure gateway.", 402));
      }
    } else if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_PAYMENTS !== "true") {
      // Safety net: refuse silent self-asserted payments in production even if
      // the flag was forgotten — better to block than to hand out free orders.
      // ALLOW_DEMO_PAYMENTS=true re-enables the demo checkout on a live deploy
      // for end-to-end TESTING; turn it off before real customers pay.
      return next(httpError("Online payment isn't available yet — please contact your Garm coordinator to pay.", 503));
    }

    if (order.paymentStatus === "paid") {
      return next(httpError("This order is already fully paid", 400));
    }
    if (order.adminStatus === "CANCELLED" || order.status === "Cancelled") {
      return next(httpError("This order was cancelled", 400));
    }

    const now = new Date();
    const dateLabel = now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const ref = reference || `TXN-${(order.orderRef || "").replace("#", "")}-${now.getFullYear()}`;

    if (order.persona === "individual") {
      if (order.adminStatus === "NEW") {
        return next(httpError("Your order hasn't been confirmed yet — payment unlocks once Garm confirms it", 400));
      }
      order.paymentStatus    = "paid";
      order.paymentMode      = mode;
      order.paymentDate      = now;
      order.paymentReference = ref;
      order.adminPayStatus   = "COMPLETED";
      if (order.adminStatus === "CONFIRMED") order.adminStatus = "PAID";

      // Tracker: mark Payment done, make "In production" the upcoming active step.
      const payIdx = order.trackSteps.findIndex((s) => s.label.toLowerCase().includes("payment"));
      if (payIdx >= 0) {
        order.trackSteps = order.trackSteps.map((s, i) => {
          if (i < payIdx)  return { ...s, status: "done" as const };
          if (i === payIdx) return { ...s, label: s.label, sub: `Paid by ${mode} · ${dateLabel}`, status: "done" as const, completedAt: now };
          if (i === payIdx + 1) return { ...s, sub: "Starting soon", status: "active" as const };
          return s;
        }) as typeof order.trackSteps;
      }
    } else {
      // ── Organisation: advance then balance ──
      // quoteApprovedAt is set ONLY by quotes.ts's /approve handler, atomically
      // with the admin-issued quote.amount — unlike total/quoteAmount, nothing
      // client-supplied can set it. The old (!order.total && !order.quoteAmount)
      // check could be satisfied entirely by client-supplied creation data,
      // letting a customer self-issue a price and unlock payment with no admin
      // ever involved.
      if (!order.quoteApprovedAt) {
        return next(httpError("Your quote isn't approved yet — payment unlocks once you approve the quote Garm shared", 400));
      }
      const isAdvance = order.paymentStatus !== "partial" && stage !== "balance" && stage !== "full";
      if (isAdvance) {
        // Advance received → production can start (admin-side gate reads 'partial').
        order.paymentStatus = "partial";
        order.adminPayStatus = "PARTIAL";
      } else {
        // Balance received → fully paid, shipping can start.
        order.paymentStatus = "paid";
        order.adminPayStatus = "COMPLETED";
        // Post-QC balance settles the order; reflect PAID admin-side when
        // it's sitting in a post-QC state.
        if (["QC_APPROVED", "INVOICED"].includes(order.adminStatus)) order.adminStatus = "PAID";
      }
      order.paymentMode      = mode;
      order.paymentDate      = now;
      order.paymentReference = ref;
    }

    await order.save();
    res.json({ order });
  } catch (err) { next(err); }
});

// ─── POST /api/orders/:id/rating ──────────────────────────────────────────────
// Customer rates a delivered order (1–5) with optional feedback. Stored on the
// order so the admin portal can see it. Idempotent — re-submitting updates it.
const RatingSchema = z.object({
  rating:   z.number().int().min(1).max(5),
  feedback: z.string().max(2000).optional(),
});

router.post("/:id/rating", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rating, feedback } = RatingSchema.parse(req.body);
    const order = await Order.findOne({ _id: req.params.id, userId: req.userId });
    if (!order) return next(httpError("Order not found", 404));
    order.rating = rating;
    order.ratingFeedback = feedback ?? "";
    order.ratedAt = new Date();
    await order.save();
    res.json({ order: await Order.findById(order._id).select("-__v") });
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
            quoteApprovedAt, paymentStatus, paymentDate, paymentReference,
            seq, adminStatus, manufacturer, qcResult, adminPayStatus, total, lines, ...rest } = src as any;

    const newOrder = await Order.create({ ...rest, userId: req.userId, status: "Draft" });
    res.status(201).json({ order: newOrder });
  } catch (err) { next(err); }
});

export default router;
