import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { SupportTicket } from "../models/SupportTicket";
import { User } from "../models/User";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { httpError } from "../middleware/error";

const router = Router();
router.use(requireAuth);

const CreateTicketSchema = z.object({
  category: z.string().max(120).optional(),
  subject:  z.string().min(1).max(200),
  message:  z.string().min(1).max(4000),
  orderRef: z.string().max(40).optional(),
  type:     z.enum(["general", "return"]).optional(),
  // Damage photos for a return — only safe image formats, ≤4MB each, ≤5 images.
  images:   z.array(z.string().max(4 * 1024 * 1024 * 1.4)
              .regex(/^data:image\/(png|jpe?g|webp|gif);base64,/i, "Only image files are allowed"))
              .max(5).optional(),
});
const ReplySchema = z.object({ body: z.string().min(1).max(4000) });

// ─── GET /api/support/tickets — the customer's own tickets ───────────────────
router.get("/tickets", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.userId }).sort({ updatedAt: -1 }).select("-__v");
    res.json({ tickets });
  } catch (err) { next(err); }
});

// ─── POST /api/support/tickets — raise a ticket ──────────────────────────────
router.post("/tickets", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = CreateTicketSchema.parse(req.body);
    const isReturn = data.type === "return";

    // Prevent duplicate RETURNS for the same order. If the customer already has
    // an active return (not yet resolved/closed) against this order, don't let
    // them open a second one — point them back to the existing ticket instead.
    if (isReturn && data.orderRef) {
      const existing = await SupportTicket.findOne({
        userId: req.userId, type: "return", orderRef: data.orderRef,
        status: { $in: ["OPEN", "IN_PROGRESS"] },
      }).select("ref _id");
      if (existing) {
        return res.status(409).json({
          error: `You've already raised a return for order ${data.orderRef} (ticket ${existing.ref}). Please continue in that ticket.`,
          existingTicketId: existing._id,
          existingRef: existing.ref,
        });
      }
    }

    const user = await User.findById(req.userId).select("name orgName email phone");
    const ticket = await SupportTicket.create({
      userId: req.userId,
      customerName: user?.orgName || user?.name || "Customer",
      customerEmail: user?.email || "",
      customerPhone: user?.phone || "",
      category: data.category || (isReturn ? "Return / Damage" : "General"),
      subject: data.subject,
      orderRef: data.orderRef || "",
      type: isReturn ? "return" : "general",
      images: data.images || [],
      returnStatus: isReturn ? "REQUESTED" : "NONE",
      priority: isReturn ? "HIGH" : "NORMAL",
      messages: [{ from: "customer", authorName: user?.orgName || user?.name || "Customer", body: data.message, at: new Date() }],
    });
    res.status(201).json({ ticket });
  } catch (err) { next(err); }
});

// ─── GET /api/support/tickets/:id — one of the customer's tickets ────────────
router.get("/tickets/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await SupportTicket.findOne({ _id: req.params.id, userId: req.userId }).select("-__v");
    if (!ticket) return next(httpError("Ticket not found", 404));
    res.json({ ticket });
  } catch (err) { next(err); }
});

// ─── POST /api/support/tickets/:id/messages — customer replies ───────────────
router.post("/tickets/:id/messages", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { body } = ReplySchema.parse(req.body);
    const ticket = await SupportTicket.findOne({ _id: req.params.id, userId: req.userId });
    if (!ticket) return next(httpError("Ticket not found", 404));
    ticket.messages.push({ from: "customer", authorName: ticket.customerName || "Customer", body, at: new Date() });
    // A reply on a resolved/closed ticket reopens it.
    if (["RESOLVED", "CLOSED"].includes(ticket.status)) ticket.status = "IN_PROGRESS";
    await ticket.save();
    res.json({ ticket });
  } catch (err) { next(err); }
});

export default router;
