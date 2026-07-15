/**
 * Garm API client
 * All calls go through this module — swap BASE_URL for production.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

// The Garm Admin Portal's backend — source of truth for the catalog
// (categories/products/stock availability) and the procurement-coordinator
// card. Orders/auth/account stay on BASE_URL (this app's own backend); both
// backends share the same MongoDB for orders.
const ADMIN_BASE_URL = import.meta.env.VITE_ADMIN_API_URL ?? "http://localhost:5050/api/garm";

// ─── Token storage ────────────────────────────────────────────────────────────

export const token = {
  get: ()          => localStorage.getItem("fl_token"),
  set: (t: string) => localStorage.setItem("fl_token", t),
  clear: ()        => localStorage.removeItem("fl_token"),
};

// ─── Base fetch ───────────────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  auth = true,
  base: string = BASE_URL,
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const t = token.get();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }

  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

const get  = <T>(path: string) => request<T>("GET",    path);
const adminGet = <T>(path: string) => request<T>("GET", path, undefined, false, ADMIN_BASE_URL);
const post = <T>(path: string, body?: unknown) => request<T>("POST",   path, body);
const put  = <T>(path: string, body?: unknown) => request<T>("PUT",    path, body);
const patch= <T>(path: string, body?: unknown) => request<T>("PATCH",  path, body);
const del  = <T>(path: string) => request<T>("DELETE", path);

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isDevOtpFallbackEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  // Local dev only. `github.io` was previously included, which meant the public
  // GitHub Pages build minted a fake client-side session (dev-<ts> token) with no
  // real backend — logins looked to work but nothing persisted. Opt in explicitly
  // with VITE_DEV_OTP=true for a hosted demo; never on by default off localhost.
  const explicit = import.meta.env.VITE_DEV_OTP === 'true';
  return explicit || host === 'localhost' || host === '127.0.0.1';
}

let pendingDevOtp: { identity: string; mode: 'phone' | 'email'; code: string } | null = null;
function generateDevOtpCode(): string {
  return Array.from({ length: 6 }, () => String(Math.floor(Math.random() * 10))).join('');
}

export const auth = {
  // `devCode` is only present until a real SMS/email gateway (Twilio/Gmail)
  // is configured on the backend — see server/README.md "Garm App: auth (OTP)".
  sendOTP: async (identity: string, mode: "phone" | "email") => {
    try {
      return await post<{ success: boolean; message: string; devCode?: string }>('/auth/send-otp', { identity, mode });
    } catch (err) {
      if (!isDevOtpFallbackEnabled()) throw err;
      const code = generateDevOtpCode();
      pendingDevOtp = { identity, mode, code };
      return { success: true, message: 'Dev OTP fallback enabled', devCode: code };
    }
  },

  verifyOTP: async (identity: string, otp: string, mode: "phone" | "email") => {
    try {
      const data = await post<{ token: string; user: UserProfile }>('/auth/verify-otp', { identity, otp, mode });
      token.set(data.token);
      return data;
    } catch (err) {
      if (!isDevOtpFallbackEnabled()) throw err;
      const dev = pendingDevOtp;
      const matches = !!dev && dev.identity === identity && dev.mode === mode && dev.code === otp;
      if (!matches) throw err;
      const user: UserProfile = {
        name: identity.includes('@') ? identity.split('@')[0] : `Guest ${identity}`,
        phone: mode === 'phone' ? identity : undefined,
        email: mode === 'email' ? identity : undefined,
        accountType: 'personal',
        onboardingComplete: false,
      };
      const devToken = `dev-${Date.now()}`;
      token.set(devToken);
      return { token: devToken, user };
    }
  },

  me: () => get<{ user: UserProfile }>('/auth/me'),

  logout: async () => {
    await post('/auth/logout').catch(() => {});
    token.clear();
  },
};

// ─── Orders ───────────────────────────────────────────────────────────────────

export const orders = {
  list: ()                  => get<{ orders: Order[] }>("/orders"),
  get:  (id: string)        => get<{ order: Order }>(`/orders/${id}`),
  create: (body: Partial<Order>) => post<{ order: Order }>("/orders", body),
  update: (id: string, body: Partial<Order>) => patch<{ order: Order }>(`/orders/${id}`, body),
  cancel: (id: string)      => del<{ success: boolean; order: Order }>(`/orders/${id}`),
  reorder:(id: string)      => post<{ order: Order }>(`/orders/${id}/reorder`),
  getQuote: (id: string)    => get<{ quote: Quote }>(`/orders/${id}/quote`),
  // Payments. Individuals: one full payment after admin confirmation.
  // Organisations: stage "advance" (unlocks production) then "balance"
  // (after the QC report — unlocks shipping). Gates enforced server-side.
  pay: (id: string, mode: string, reference?: string, stage?: "advance" | "balance" | "full") =>
    post<{ order: Order }>(`/orders/${id}/pay`, { mode, reference, stage }),
};

// ─── Account ──────────────────────────────────────────────────────────────────

export const account = {
  getProfile: ()             => get<{ user: UserProfile }>("/account/profile"),
  updateProfile: (body: Partial<UserProfile>) => put<{ user: UserProfile }>("/account/profile", body),

  getAddresses: ()           => get<{ addresses: Address[] }>("/account/addresses"),
  addAddress: (body: Omit<Address,"_id">) => post<{ addresses: Address[] }>("/account/addresses", body),
  updateAddress: (id: string, body: Partial<Address>) => put<{ addresses: Address[] }>(`/account/addresses/${id}`, body),
  deleteAddress: (id: string) => del<{ addresses: Address[] }>(`/account/addresses/${id}`),

  getPayment: ()              => get<{ paymentMethods: PaymentMethod[] }>("/account/payment"),
  addPayment: (body: Omit<PaymentMethod,"_id">) => post<{ paymentMethods: PaymentMethod[] }>("/account/payment", body),
  deletePayment: (id: string) => del<{ paymentMethods: PaymentMethod[] }>(`/account/payment/${id}`),
  setDefaultPayment: (id: string) => put<{ paymentMethods: PaymentMethod[] }>(`/account/payment/${id}/default`),
};

// ─── Quotes ───────────────────────────────────────────────────────────────────

export const quotes = {
  list:    ()                => get<{ quotes: Quote[] }>("/quotes"),
  get:     (id: string)      => get<{ quote: Quote }>(`/quotes/${id}`),
  approve: (id: string)      => post<{ quote: Quote }>(`/quotes/${id}/approve`),
  reject:  (id: string, note?: string) => post<{ quote: Quote }>(`/quotes/${id}/reject`, { note }),
};

// ─── Catalog (categories & products, managed live from the Garm Admin Portal) ─

export const catalog = {
  categories: () => adminGet<{ categories: Category[] }>("/catalog/categories"),
  products:   () => adminGet<{ products: Product[] }>("/catalog/products"),
};

// ─── Coordinator ("Your procurement manager" — configured in the admin portal) ─

export interface Coordinator {
  name: string;
  role: string;
  phone: string;
  whatsapp: string;
  email: string;
}

export const coordinator = {
  get: () => adminGet<{ coordinator: Coordinator }>("/coordinator"),
};

// ─── Support tickets (this app's own backend — authenticated) ─────────────────

export interface TicketMessage { from: "customer" | "admin"; authorName: string; body: string; at: string; }
export interface SupportTicket {
  _id: string;
  ref: string;
  subject: string;
  category: string;
  orderRef?: string;
  type: "general" | "return";
  images?: string[];
  returnStatus: "NONE" | "REQUESTED" | "APPROVED" | "DECLINED";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "NORMAL" | "HIGH";
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

export const support = {
  list:   () => get<{ tickets: SupportTicket[] }>("/support/tickets"),
  get:    (id: string) => get<{ ticket: SupportTicket }>(`/support/tickets/${id}`),
  create: (body: { category?: string; subject: string; message: string; orderRef?: string; type?: "general" | "return"; images?: string[] }) =>
    post<{ ticket: SupportTicket }>("/support/tickets", body),
  reply:  (id: string, body: string) =>
    post<{ ticket: SupportTicket }>(`/support/tickets/${id}/messages`, { body }),
};

// ─── Order-form configuration (which custom-order sections show — admin-controlled) ─

export interface OrderFormConfig {
  style: boolean;
  materials: boolean;
  sizes: boolean;
  referenceUpload: boolean;
  livePreview: boolean;
}

// Service-fee schedule (set in the admin portal): % by customer type, a lower
// slab for bulk orders, and a ₹ floor for tiny orders.
export interface ServiceFeeConfig {
  b2cPercent: number;
  b2cPerPiece: number; // ₹ per piece, Individuals — each piece carries handling cost
  b2bPercent: number;
  bulkQtyThreshold: number;
  bulkPercent: number;
  minFee: number;
  surplusDiscountPercent?: number; // % off garment rate when Surplus fabric is chosen
  orgAdvancePercent?: number; // % advance organisations pay before production
}

export const orderConfig = {
  get: () => adminGet<{ orderForm: OrderFormConfig; serviceFee?: ServiceFeeConfig; features?: Record<string, boolean> }>("/order-config"),
};

// ─── Virtual try-on ("live picture") ──────────────────────────────────────────

export const tryon = {
  generate: (body: {
    selfie: string; garment: string; colour?: string; colourHex?: string;
    material?: string; designUrl?: string; notes?: string; audience?: string; placement?: string;
  }) => post<{ imageUrl: string }>("/tryon", body),
};

// ─── Track ────────────────────────────────────────────────────────────────────

export const track = {
  active: ()                  => get<{ orders: TrackOrder[] }>("/track"),
  get:    (ref: string)       => get<TrackOrder>(`/track/${ref}`),
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  _id?: string;
  name: string;
  phone?: string;
  email?: string;
  accountType: "organisation" | "personal";
  orgName?: string;
  orgType?: string;
  orgBoard?: string;
  designation?: string;
  twoFAEnabled?: boolean;
  onboardingComplete?: boolean;
}

export interface Address {
  _id?: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pin: string;
  isDefault: boolean;
}

export interface PaymentMethod {
  _id?: string;
  type: "bank" | "upi" | "card";
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  accountHolder?: string;
  upiId?: string;
  upiProvider?: string;
  // Card fields — only ever last4 + non-sensitive metadata. Full PAN and CVV
  // are never sent to or stored by this backend (no PCI-DSS tokenization here).
  cardLast4?: string;
  cardNetwork?: "visa" | "mastercard" | "rupay";
  cardType?: "credit" | "debit";
  cardHolderName?: string;
  cardExpiry?: string;
  isDefault: boolean;
}

export interface OrderDocument {
  _id?: string;
  name: string;
  kind: "INVOICE" | "QUOTATION" | "BILLING" | "DESIGN" | "OTHER";
  dataUrl: string;
  uploadedBy: "admin" | "customer";
  generated?: boolean;
  visible?: boolean; // false = draft the admin hasn't sent yet
  createdAt?: string;
}

export interface Order {
  _id?: string;
  orderRef?: string;
  persona: "organisation" | "individual";
  isAccessoryOrder: boolean;
  orgType?: string;
  orgName?: string;
  service?: string;
  serviceLabel?: string;
  garmentType?: string;
  fabric?: string;
  gsm?: string;
  weave?: string;
  fabricSource?: string;
  qty: number;
  sizes: { label: string; qty: number }[];
  colors: { hex: string; pantone?: string; label: string }[];
  accessoryItems: { categoryId: string; categoryLabel: string; itemName: string; qty: number }[];
  stitching?: string;
  packaging?: string;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryPin?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  status: string;
  adminStatus?: string;       // NEW | CONFIRMED | PAID | … (drives the payment gate)
  trackSteps: { label: string; sub: string; status: string }[];
  etaDate?: string;
  quoteAmount?: number;
  serviceFee?: number;
  confirmedAt?: string;
  paymentStatus?: string;     // unpaid | partial | paid
  paymentMode?: string;
  paymentDate?: string;
  paymentReference?: string;
  assignedEmployee?: string;  // employee name shown on the coordinator card
  total?: number;
  // Attachments: customer design/logo refs (uploaded at submit) and admin
  // documents (invoice/quotation/billing, downloadable in the app).
  documents?: OrderDocument[];
  // Per-garment line items (product · style, size, colour, qty) — what the
  // admin portal's Order Items table renders.
  lines?: { p: string; size: string; color: string; qty: number; unit: number }[];
  createdAt?: string;
  updatedAt?: string; // last change (admin status moves, payments…) — drives notifications
}

export interface Quote {
  _id?: string;
  orderId: string | Order;
  amount: number;
  currency: string;
  breakdown: { label: string; amount: number }[];
  validUntil: string;
  status: "pending" | "approved" | "rejected" | "expired";
  rejectionNote?: string;
  createdAt?: string;
}

export interface Category {
  id: number;
  name: string;
  appliesTo: ("B2C" | "B2B")[]; // B2C = individual, B2B = organisation
  image: string | null;
}

export interface Product {
  id: number;
  name: string;
  categoryId: number;
  appliesTo: ("B2C" | "B2B")[];
  productType?: "GARMENT" | "ACCESSORY" | "OTHER";
  inStock?: boolean; // false = shown greyed out ("Out of stock"), not orderable
  price: number;
  sizes: string[];
  colors: { label: string; hex: string }[]; // real swatches, never bare text
  // Admin-defined spec dropdowns (Material, Finish, Print method…) — replace
  // the app's built-in per-category defaults for this product when present.
  specFields?: { label: string; options: string[]; hint?: string }[];
  // Garment configurator lists managed in the admin's Catalog — when present
  // they OVERRIDE the app's built-in lists for this product; when empty or
  // missing the app falls back to its own hardcoded options (never breaks).
  styles?: string[];
  fabricOptions?: string[];
  gsmOptions?: string[];
  weaveOptions?: string[];
  moq: number;
  status: "ACTIVE" | "INACTIVE";
  image: string | null;
}

export interface TrackOrder {
  id: string;
  orderRef: string;
  status: string;
  etaDate?: string;
  trackSteps: { label: string; sub: string; status: string }[];
  isAccessoryOrder: boolean;
  qty: number;
}
