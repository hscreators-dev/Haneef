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
    // Match by userId OR the account's phone/email. A customer can end up with
    // more than one User document over time (duplicate accounts from earlier
    // onboarding issues), and tickets raised under a previous account would then
    // vanish. Matching on phone/email too keeps ALL their old tickets visible.
    const me = await User.findById(req.userId).select("phone email");
    const or: Record<string, unknown>[] = [{ userId: req.userId }];
    if (me?.phone) or.push({ customerPhone: me.phone });
    if (me?.email) or.push({ customerEmail: me.email });
    const tickets = await SupportTicket.find({ $or: or }).sort({ updatedAt: -1 }).select("-__v");
    res.json({ tickets });
  } catch (err) { next(err); }
});

// ─── POST /api/support/tickets — raise a ticket ──────────────────────────────
router.post("/tickets", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = CreateTicketSchema.parse(req.body);
    const isReturn = data.type === "return";

    // ── Server-enforced duplicate guard ──────────────────────────────────────
    // The app has a client-side check too, but it can be raced (ticket list not
    // yet refreshed) or bypassed, which is how the same customer ended up with
    // two open tickets for one issue on the admin side. Enforce it here so it
    // can't be worked around.
    //
    // 1) Any second OPEN/IN_PROGRESS ticket for the SAME order (regardless of
    //    type — a return + a general query about one order are still "one issue"
    //    to the ops team).
    if (data.orderRef) {
      const existing = await SupportTicket.findOne({
        userId: req.userId, orderRef: data.orderRef,
        status: { $in: ["OPEN", "IN_PROGRESS"] },
      }).select("ref _id");
      if (existing) {
        return res.status(409).json({
          error: `You already have an open ticket for order ${data.orderRef} (ticket ${existing.ref}). Please continue in that ticket.`,
          existingTicketId: existing._id,
          existingRef: existing.ref,
        });
      }
    }
    // 2) Double-submit / same-issue guard for tickets with no order ref: an
    //    existing open ticket with the same (case-insensitive) subject.
    {
      const subjectExact = new RegExp(`^\\s*${data.subject.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
      const dup = await SupportTicket.findOne({
        userId: req.userId, status: { $in: ["OPEN", "IN_PROGRESS"] }, subject: subjectExact,
      }).select("ref _id");
      if (dup) {
        return res.status(409).json({
          error: `You already have an open ticket for "${data.subject.trim()}" (ticket ${dup.ref}). Please continue in that ticket.`,
          existingTicketId: dup._id,
          existingRef: dup.ref,
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
