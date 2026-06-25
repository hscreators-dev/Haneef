/**
 * Garm API client
 * All calls go through this module — swap BASE_URL for production.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

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
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const t = token.get();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
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
const post = <T>(path: string, body?: unknown) => request<T>("POST",   path, body);
const put  = <T>(path: string, body?: unknown) => request<T>("PUT",    path, body);
const patch= <T>(path: string, body?: unknown) => request<T>("PATCH",  path, body);
const del  = <T>(path: string) => request<T>("DELETE", path);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
  sendOTP: (identity: string, mode: "phone" | "email") =>
    post<{ success: boolean; message: string }>("/auth/send-otp", { identity, mode }, ),

  verifyOTP: async (identity: string, otp: string, mode: "phone" | "email") => {
    const data = await post<{ token: string; user: UserProfile }>("/auth/verify-otp", { identity, otp, mode });
    token.set(data.token);
    return data;
  },

  me: () => get<{ user: UserProfile }>("/auth/me"),

  logout: async () => {
    await post("/auth/logout").catch(() => {});
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
};

// ─── Quotes ───────────────────────────────────────────────────────────────────

export const quotes = {
  list:    ()                => get<{ quotes: Quote[] }>("/quotes"),
  get:     (id: string)      => get<{ quote: Quote }>(`/quotes/${id}`),
  approve: (id: string)      => post<{ quote: Quote }>(`/quotes/${id}/approve`),
  reject:  (id: string, note?: string) => post<{ quote: Quote }>(`/quotes/${id}/reject`, { note }),
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
  type: "bank" | "upi";
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  accountHolder?: string;
  upiId?: string;
  upiProvider?: string;
  isDefault: boolean;
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
  qty: number;
  sizes: { label: string; qty: number }[];
  colors: { hex: string; pantone?: string; label: string }[];
  accessoryItems: { categoryId: string; categoryLabel: string; itemName: string; qty: number }[];
  status: string;
  trackSteps: { label: string; sub: string; status: string }[];
  etaDate?: string;
  quoteAmount?: number;
  paymentStatus?: string;
  createdAt?: string;
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

export interface TrackOrder {
  id: string;
  orderRef: string;
  status: string;
  etaDate?: string;
  trackSteps: { label: string; sub: string; status: string }[];
  isAccessoryOrder: boolean;
  qty: number;
}
