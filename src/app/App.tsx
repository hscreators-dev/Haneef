import React, { useState, useRef } from "react";
import {
  Bell, User, Home, PlusCircle, MapPin,
  ChevronRight, TrendingUp, Clock, CheckCircle2, ArrowRight, Box, Package,
  Mail, Smartphone, ShieldCheck, Building2, UserCircle, ChevronLeft, Phone,
  MapPinned, Headphones, Star, Check, Navigation,
} from "lucide-react";
import { NewOrderTab, type SubmittedOrderSummary } from "./components/NewOrderTab";
import { TrackTab } from "./components/TrackTab";
import { AccountTab, type UserProfile } from "./components/AccountTab";
import { NotificationsScreen } from "./components/NotificationsScreen";

export type Tab = "home" | "order" | "track" | "account";

// ─── Design tokens (mirrors theme.css) ────────────────────────────────────────
const ACCENT     = "#C8A97E";
const ACCENT_BG  = "rgba(200,169,126,0.12)";
const ACCENT_TEXT = "#7C5419";
const DARK       = "#0D0D0D";

// ─── Shared style constants ────────────────────────────────────────────────────
// Primary CTA — full-width, dark fill, rounded-2xl
const btnPrimary: React.CSSProperties = {
  width: "100%", background: DARK, color: "#fff",
  borderRadius: 20, padding: "14px 20px", fontSize: 14,
  fontWeight: 500, border: "none", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
};
// Primary CTA disabled state
const btnPrimaryDisabled: React.CSSProperties = {
  ...btnPrimary, background: "#E5E7EB", color: "#9CA3AF", cursor: "not-allowed",
};
// Secondary CTA — muted fill
const btnSecondary: React.CSSProperties = {
  width: "100%", background: "var(--muted)", color: "var(--foreground)",
  borderRadius: 20, padding: "14px 20px", fontSize: 14,
  fontWeight: 500, border: "1px solid var(--border)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
};
// Accent CTA — golden fill
const btnAccent: React.CSSProperties = {
  ...btnPrimary, background: ACCENT,
};
// Standard card
const card: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16,
};
// Muted input
const inputStyle: React.CSSProperties = {
  width: "100%", background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: 12, padding: "10px 14px", color: "var(--foreground)",
  fontSize: 14, fontFamily: "DM Sans, sans-serif", outline: "none",
};

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full ${cls}`} style={{ fontWeight: 500, fontSize: 11 }}>
      {label}
    </span>
  );
}

// ─── Fabrics data ─────────────────────────────────────────────────────────────
const fabrics = [
  { id: "A", name: "Premium Shirt Fabric",  desc: "100% Cotton Pique · 220 GSM", bg: "#e8e0d0" },
  { id: "B", name: "Sports T-Shirt Fabric", desc: "Cotton-Poly Blend · 180 GSM",  bg: "#d4e8e0" },
  { id: "C", name: "Uniform Twill",         desc: "65/35 Poly-Cotton · 240 GSM",  bg: "#d4dce8" },
  { id: "D", name: "Heavyweight Canvas",    desc: "100% Cotton · 320 GSM",        bg: "#e8d4d4" },
];

// ─── Swatch Box Modal ──────────────────────────────────────────────────────────
function SwatchBoxModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"browse" | "address" | "done">("browse");
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="bg-background rounded-t-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* drag pill */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-1"/>
        {/* header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <p className="text-foreground text-sm font-semibold">Free Fabric Swatch Box</p>
            <p className="text-muted-foreground" style={{ fontSize: 11 }}>Ships in 1–2 days · No cost</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs border border-border">
            ✕
          </button>
        </div>

        {step === "browse" && (
          <div className="px-5 py-4">
            <p className="text-muted-foreground mb-4" style={{ fontSize: 12, lineHeight: 1.6 }}>
              Touch each fabric before you order. We'll mail 10×10 cm swatches — pick your favourite in the app.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {fabrics.map(f => (
                <div key={f.id} style={card} className="overflow-hidden">
                  <div className="h-14 flex items-center justify-center text-2xl font-bold"
                    style={{ background: f.bg, color: "rgba(0,0,0,0.12)" }}>{f.id}</div>
                  <div className="p-2.5">
                    <p className="text-foreground" style={{ fontSize: 12, fontWeight: 500 }}>{f.name}</p>
                    <p className="text-muted-foreground mt-0.5" style={{ fontSize: 10 }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setStep("address")} style={btnPrimary}>
              <Box size={15}/> Order Free Swatch Box <ArrowRight size={13}/>
            </button>
          </div>
        )}

        {step === "address" && (
          <div className="px-5 py-4">
            <p className="text-foreground text-sm font-semibold mb-3">Delivery address</p>
            <div className="flex flex-col gap-2 mb-4">
              {["School / Institution name", "Street address", "City & PIN code", "Contact person name", "Phone number"].map(p => (
                <input key={p} placeholder={p} style={inputStyle}/>
              ))}
            </div>
            <button onClick={() => setStep("done")} style={btnAccent}>
              Confirm & Request Delivery
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="px-5 py-8 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--success-bg)", border: "1px solid var(--success-border)" }}>
              <CheckCircle2 size={26} style={{ color: "var(--success)" }} strokeWidth={1.5}/>
            </div>
            <p className="text-foreground font-semibold mb-2" style={{ fontSize: 16 }}>Swatch box on its way!</p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-5">We'll deliver 4 fabric samples within 1–2 days.</p>
            <button onClick={onClose} style={btnSecondary}>Done</button>
          </div>
        )}
        <div style={{ height: 24 }}/>
      </div>
    </div>
  );
}

// ─── Status Bar ────────────────────────────────────────────────────────────────
function StatusBar() {
  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-1 flex-shrink-0">
      <span style={{ fontWeight: 600, fontSize: 15 }}>9:41</span>
      <div className="flex items-center gap-1.5">
        <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
          <rect x="0"    y="3" width="3" height="9"  rx="1" fill="#0D0D0D" opacity="0.3"/>
          <rect x="4.5"  y="2" width="3" height="10" rx="1" fill="#0D0D0D" opacity="0.5"/>
          <rect x="9"    y="0" width="3" height="12" rx="1" fill="#0D0D0D" opacity="0.8"/>
          <rect x="13.5" y="0" width="3" height="12" rx="1" fill="#0D0D0D"/>
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <path d="M8 2.5C10.2 2.5 12.2 3.4 13.6 4.9L15 3.4C13.2 1.5 10.7 0.5 8 0.5C5.3 0.5 2.8 1.5 1 3.4L2.4 4.9C3.8 3.4 5.8 2.5 8 2.5Z" fill="#0D0D0D" opacity="0.4"/>
          <path d="M8 5.5C9.5 5.5 10.8 6.1 11.8 7L13.2 5.5C11.8 4.2 10 3.5 8 3.5C6 3.5 4.2 4.2 2.8 5.5L4.2 7C5.2 6.1 6.5 5.5 8 5.5Z" fill="#0D0D0D" opacity="0.7"/>
          <circle cx="8" cy="10" r="1.5" fill="#0D0D0D"/>
        </svg>
        <div className="w-6 h-3 rounded-sm border border-black/30 p-px flex">
          <div className="w-4/5 h-full bg-black/80 rounded-xs"/>
        </div>
      </div>
    </div>
  );
}

// ─── Orders data ───────────────────────────────────────────────────────────────
const orders = [
  { id: "#FL-2041", name: "300m Cotton Twill",  shade: "Navy",         qty: "500 pcs",  gsm: "GSM 220", eta: "ETA Jul 14", status: "In production", statusCls: "text-emerald-700 bg-emerald-50", pct: 55,  quoteReady: false },
  { id: "#FL-2038", name: "Linen Blend Fabric", shade: "Ivory",        qty: "200 pcs",  gsm: "GSM 160", eta: "ETA Jul 8",  status: "Quality check",  statusCls: "text-amber-700 bg-amber-50",   pct: 78,  quoteReady: false },
  { id: "#FL-2045", name: "Heavy Denim",        shade: "Washed Black", qty: "1000 pcs", gsm: "GSM 360", eta: "Awaiting",   status: "Quote pending",  statusCls: "text-stone-600 bg-stone-100",  pct: 15,  quoteReady: true  },
];

// ─── Home Tab ─────────────────────────────────────────────────────────────────
function HomeTab({ onNavigate, onBell, profile }: {
  onNavigate: (t: Tab, orderId?: string) => void;
  onBell: () => void;
  profile?: UserProfile;
}) {
  const [showSwatch, setShowSwatch] = useState(false);

  // Active order drives the horizontal progress tracker
  const trackStages = ["Review", "Quote", "Approve", "Production", "QA", "Shipped", "Delivered"];
  const statusToStage: Record<string, number> = {
    "Order placed": 0, "Quote pending": 1, "In production": 3,
    "Quality check": 4, "Shipped": 5, "Delivered": 6, "Completed": 6,
  };
  const activeOrder = orders.find(o => !["Delivered", "Completed"].includes(o.status)) ?? orders[0];
  const curStage = activeOrder ? (statusToStage[activeOrder.status] ?? 0) : 0;

  return (
    <div className="flex-1 overflow-y-auto pb-4 min-h-0" style={{ scrollbarWidth: "none" }}>

      {/* ── Top bar ── */}
      <div className="px-5 pt-2 pb-4 flex items-center justify-between">
        <div>
          <p className="label-section">Good morning</p>
          <h2 className="text-foreground mt-0.5" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>
            {profile?.name?.split(" ")[0] || "Arjun"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBell}
            className="w-9 h-9 rounded-full bg-card flex items-center justify-center border border-border relative"
            style={{ boxShadow: "var(--shadow-sm)" }}>
            <Bell size={16} strokeWidth={1.5}/>
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }}/>
          </button>
          <button onClick={() => onNavigate("account")}
            className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center"
            style={{ background: DARK }}>
            {profile?.avatar
              ? <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover"/>
              : <User size={15} strokeWidth={1.5} color="white"/>}
          </button>
        </div>
      </div>

      {/* ── Hero banner ── */}
      <div className="mx-5 mb-5 rounded-2xl p-5 relative overflow-hidden" style={{ background: DARK }}>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full border border-white/5"
          style={{ transform: "translate(30%,-30%)" }}/>
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full border border-white/5"
          style={{ transform: "translate(-30%,30%)" }}/>
        <p className="text-white/40 mb-2 label-section">FabricLink Procurement</p>
        <h1 className="text-white mb-1" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.25 }}>
          Managed textile<br/><span style={{ color: ACCENT }}>sourcing for teams</span>
        </h1>
        <p className="text-white/50 mb-5" style={{ fontSize: 12 }}>
          Requirements, quotes, QA and delivery in one place
        </p>
        <button onClick={() => onNavigate("order")}
          className="w-full bg-white text-foreground rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-medium">
          <PlusCircle size={15} strokeWidth={2}/> Request a quote
        </button>
      </div>

      {/* ── Stats row ── */}
      <div className="mx-5 mb-5 grid grid-cols-3 gap-2.5">
        {[
          { label: "Requests",  value: "3",   icon: <Clock        size={14} strokeWidth={1.5} className="text-muted-foreground"/> },
          { label: "Delivered", value: "12",  icon: <CheckCircle2 size={14} strokeWidth={1.5} className="text-muted-foreground"/> },
          { label: "On-time",   value: "97%", icon: <TrendingUp   size={14} strokeWidth={1.5} className="text-muted-foreground"/> },
        ].map(s => (
          <div key={s.label} style={card} className="p-3.5">
            <div className="mb-2">{s.icon}</div>
            <p className="text-foreground" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1 }}>{s.value}</p>
            <p className="text-muted-foreground mt-0.5" style={{ fontSize: 11 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Active order progress (org & individual, shown once an order exists) ── */}
      {activeOrder && (
        <div className="mx-5 mb-5 overflow-hidden" style={card}>
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <p className="label-section">Order in progress</p>
              <p className="text-foreground text-sm font-semibold mt-0.5">{activeOrder.id}</p>
            </div>
            <button onClick={() => onNavigate("track", activeOrder.id)}
              className="text-xs text-foreground flex items-center gap-1 font-medium">
              Track <ArrowRight size={11} strokeWidth={2}/>
            </button>
          </div>

          <div className="px-4 pt-5 pb-4">
            {/* Horizontal progress stepper */}
            <div className="relative flex justify-between items-start">
              <div className="absolute" style={{ left: 11, right: 11, top: 10, height: 2, background: "var(--border)" }}/>
              <div className="absolute" style={{ left: 11, top: 10, height: 2, width: `calc((100% - 22px) * ${curStage / (trackStages.length - 1)})`, background: ACCENT, transition: "width .3s" }}/>
              {trackStages.map((s, i) => {
                const done = i < curStage, current = i === curStage;
                return (
                  <div key={s} className="relative flex flex-col items-center" style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center justify-center rounded-full"
                      style={{
                        width: 22, height: 22,
                        background: done ? ACCENT : current ? "#fff" : "var(--muted)",
                        border: `2px solid ${done || current ? ACCENT : "var(--border)"}`,
                        boxShadow: current ? `0 0 0 3px ${ACCENT_BG}` : "none",
                        zIndex: 1,
                      }}>
                      {done
                        ? <Check size={11} color="#fff" strokeWidth={3}/>
                        : <div className="rounded-full" style={{ width: 7, height: 7, background: current ? ACCENT : "var(--border)" }}/>}
                    </div>
                    <span className="text-center" style={{ fontSize: 8.5, lineHeight: 1.2, marginTop: 5, fontWeight: current ? 700 : 500, color: current ? DARK : "var(--muted-foreground)" }}>{s}</span>
                  </div>
                );
              })}
            </div>

            {/* Order data, shown clearly below */}
            <div className="mt-4 pt-3.5 border-t border-border">
              <div className="flex items-center justify-between mb-1">
                <p className="text-foreground text-sm" style={{ fontWeight: 600 }}>{activeOrder.name} — {activeOrder.shade}</p>
                <span className={activeOrder.statusCls?.split(" ").find(c => c.startsWith("text-")) ?? "text-foreground"} style={{ fontSize: 11, fontWeight: 600, background: "transparent" }}>{activeOrder.status}</span>
              </div>
              <p className="text-muted-foreground" style={{ fontSize: 12 }}>{activeOrder.qty} · {activeOrder.gsm} · {activeOrder.eta}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Wedding & Events banner (personal only) ── */}
      {(!profile?.accountType || profile.accountType === "personal") && (
        <button className="mx-5 mb-5 text-left w-[calc(100%-2.5rem)] overflow-hidden rounded-2xl"
          style={{ background: "linear-gradient(135deg,#2d1b4e 0%,#5b2d8e 50%,#c8a84b 100%)", border: "none", cursor: "pointer" }}>
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Star size={20} strokeWidth={1.5} color="#fff"/>
              <span className="text-white text-sm font-bold">Wedding & Events</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-medium">New</span>
            </div>
            <p className="text-white/80 text-xs leading-relaxed mb-3">
              Custom fabric orders for weddings, functions & events. Match your theme colours, get coordinated outfits for the whole family — from sarees to sherwanis — with free design consultation.
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-white/60" style={{ fontSize: 11 }}>Explore the workflow</span>
              <ChevronRight size={13} color="rgba(255,255,255,0.6)" strokeWidth={2}/>
            </div>
          </div>
        </button>
      )}

      {/* ── My requests header ── */}
      <div className="px-5 mb-3 flex items-center justify-between">
        <p className="label-section">My requests</p>
        <button onClick={() => onNavigate("track")}
          className="text-xs text-foreground flex items-center gap-0.5 font-medium">
          See all <ArrowRight size={11} strokeWidth={2}/>
        </button>
      </div>

      {/* ── Order cards ── */}
      <div className="px-5 flex flex-col gap-2.5">
        {orders.map(o => (
          <button key={o.id} onClick={() => onNavigate("track", o.id)}
            className="text-left w-full overflow-hidden"
            style={{
              ...card,
              border: `1px solid ${o.quoteReady ? ACCENT : "var(--border)"}`,
              borderRadius: 16,
            }}>
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-muted-foreground" style={{ fontSize: 11 }}>{o.id}</p>
                <StatusBadge label={o.status} cls={o.statusCls}/>
              </div>
              <p className="text-foreground text-sm font-medium mb-1">{o.name} — {o.shade}</p>
              <p className="text-muted-foreground" style={{ fontSize: 12 }}>{o.qty} · {o.gsm} · {o.eta}</p>
              {/* Progress bar */}
              <div className="h-1 bg-muted rounded-full mt-3 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${o.pct}%`, background: ACCENT }}/>
              </div>
            </div>
            {o.quoteReady && (
              <div className="px-4 py-2.5 flex items-center justify-between border-t"
                style={{ background: ACCENT_BG, borderColor: "rgba(200,169,126,0.3)" }}>
                <div className="flex items-center gap-2">
                  <TrendingUp size={13} style={{ color: "#7c5419" }}/>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: ACCENT_TEXT }}>Quote ready — ₹57,700</p>
                    <p style={{ fontSize: 10, color: "#92400e" }}>Tap to review & approve</p>
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: ACCENT }} strokeWidth={1.5}/>
              </div>
            )}
          </button>
        ))}
      </div>

      {showSwatch && <SwatchBoxModal onClose={() => setShowSwatch(false)}/>}
    </div>
  );
}

// ─── OTP Input ────────────────────────────────────────────────────────────────
function OTPInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
      const arr = value.split("");
      arr[i - 1] = "";
      onChange(arr.join(""));
    }
  }
  function handleChange(i: number, v: string) {
    const digit = v.replace(/\D/g, "").slice(-1);
    const arr = value.split("").concat(Array(6).fill("")).slice(0, 6);
    arr[i] = digit;
    onChange(arr.join(""));
    if (digit && i < 5) inputRefs.current[i + 1]?.focus();
  }

  return (
    <div className="flex gap-2 justify-center mb-3">
      {Array(6).fill(null).map((_, i) => (
        <input key={i}
          ref={el => { inputRefs.current[i] = el; }}
          value={value[i] || ""}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          inputMode="numeric" maxLength={1}
          className="w-11 h-14 text-center text-foreground outline-none"
          style={{
            fontSize: 22, fontWeight: 700,
            borderRadius: 14,
            border: value[i] ? `2px solid ${DARK}` : "2px solid var(--border)",
            background: value[i] ? "var(--card)" : "var(--muted)",
            fontFamily: "monospace",
            transition: "border-color 0.15s",
          }}/>
      ))}
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode]         = useState<"phone" | "email">("phone");
  const [step, setStep]         = useState<"identity" | "sending" | "otp">("identity");
  const [identity, setIdentity] = useState("+91");
  const [otp, setOtp]           = useState("");
  const [resendSecs, setResendSecs] = useState(0);
  const resendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const otpReady = otp.replace(/\s/g, "").length === 6;

  // Validation — strip +91 prefix, then require exactly 10 digits starting with 6-9
  const mobileDigits = identity.replace(/^\+91\s*/, "").replace(/\D/g, "");
  const phoneOk = mode === "phone" && /^[6-9]\d{9}$/.test(mobileDigits);
  const emailOk = mode === "email" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(identity.trim());
  const identityOk = mode === "phone" ? phoneOk : emailOk;

  function switchMode(next: "phone" | "email") {
    setMode(next); setIdentity(next === "phone" ? "+91" : ""); setOtp(""); setStep("identity"); setResendSecs(0);
    if (resendTimer.current) clearInterval(resendTimer.current);
  }

  function startResendCountdown() {
    setResendSecs(30);
    resendTimer.current = setInterval(() => {
      setResendSecs(s => {
        if (s <= 1) { clearInterval(resendTimer.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  function sendCode() {
    if (!identityOk) return;
    setStep("sending");
    // Simulate network delay (1.2s) then show OTP screen
    setTimeout(() => { setStep("otp"); startResendCountdown(); }, 1200);
  }

  function resend() {
    if (resendSecs > 0) return;
    setOtp("");
    setStep("sending");
    setTimeout(() => { setStep("otp"); startResendCountdown(); }, 800);
  }

  return (
    <div className="flex-1 flex flex-col px-5 pt-6 pb-5 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>

      {/* Header */}
      <div className="mb-7">
        <div className="w-12 h-12 rounded-2xl bg-foreground flex items-center justify-center mb-4">
          <ShieldCheck size={22} color="#fff" strokeWidth={1.5}/>
        </div>
        <p className="text-foreground mb-1" style={{ fontSize: 24, fontWeight: 700 }}>Sign in</p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          We'll send a 6-digit OTP to verify your identity.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        {([["phone", "Mobile", <Smartphone size={14} strokeWidth={1.5}/>], ["email", "Email", <Mail size={14} strokeWidth={1.5}/>]] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => switchMode(id)}
            className="py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-sm"
            style={{
              background: mode === id ? DARK : "var(--card)",
              color: mode === id ? "#fff" : "var(--foreground)",
              border: `1px solid ${mode === id ? DARK : "var(--border)"}`,
              fontWeight: 500, cursor: "pointer",
            }}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* Identity step */}
      {(step === "identity" || step === "sending") && (
        <div style={card} className="p-4">
          <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>
            {mode === "phone" ? "Mobile number" : "Email address"}
          </p>
          <input
            value={identity}
            onChange={e => {
              if (mode === "phone") {
                // Keep +91 prefix locked, only allow digits after it (max 10)
                const after = e.target.value.replace(/^\+91\s*/, "").replace(/\D/g, "").slice(0, 10);
                setIdentity("+91" + after);
              } else {
                setIdentity(e.target.value);
              }
            }}
            onKeyDown={e => {
              // Prevent deleting the +91 prefix
              if (mode === "phone" && (e.key === "Backspace" || e.key === "Delete") && identity.length <= 3) {
                e.preventDefault();
              }
              if (e.key === "Enter") sendCode();
            }}
            placeholder={mode === "phone" ? "+91 98765 43210" : "you@example.com"}
            inputMode={mode === "phone" ? "tel" : "email"}
            maxLength={mode === "phone" ? 13 : undefined}
            style={{ ...inputStyle, marginBottom: 4 }}
          />
          {identity.length > 0 && !identityOk && (
            <p style={{ fontSize: 11, color: "var(--error)", marginBottom: 12, marginTop: 4 }}>
              {mode === "phone" ? "Enter 10-digit number after +91 (must start with 6, 7, 8 or 9)" : "Enter a valid email address"}
            </p>
          )}
          {(identity.length === 0 || identityOk) && <div style={{ marginBottom: 12 }}/>}
          <button
            onClick={sendCode}
            disabled={!identityOk || step === "sending"}
            style={identityOk && step !== "sending" ? btnPrimary : { ...btnPrimaryDisabled }}>
            {step === "sending" ? "Sending code…" : "Send OTP"}
          </button>
        </div>
      )}

      {/* OTP step */}
      {step === "otp" && (
        <div style={card} className="p-4">
          {/* Back link */}
          <button onClick={() => { setStep("identity"); setOtp(""); }}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, marginBottom: 14 }}>
            <ChevronLeft size={14} strokeWidth={2} style={{ color: "var(--muted-foreground)" }}/>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              {mode === "phone" ? identity : identity}
            </span>
          </button>

          <p className="text-foreground font-semibold mb-1" style={{ fontSize: 15 }}>Enter OTP</p>
          <p className="text-muted-foreground mb-4" style={{ fontSize: 12 }}>
            Code sent to <strong style={{ color: "var(--foreground)" }}>{identity}</strong>
          </p>

          {/* Demo banner */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-4"
            style={{ background: "rgba(200,169,126,0.12)", border: "1px solid rgba(200,169,126,0.4)" }}>
            <ShieldCheck size={14} style={{ color:"#7c5419", flexShrink:0 }}/>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#7c5419" }}>Prototype mode</p>
              <p style={{ fontSize: 11, color: "#92400e", lineHeight: 1.4 }}>
                No real SMS is sent. Type any 6 digits to continue.
              </p>
            </div>
          </div>

          <OTPInput value={otp} onChange={setOtp}/>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mb-5">
            {Array(6).fill(null).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full transition-all"
                style={{ background: i < otp.replace(/\s/g,"").length ? DARK : "var(--border)" }}/>
            ))}
          </div>

          <button onClick={onLogin} disabled={!otpReady}
            style={otpReady ? { ...btnPrimary, marginBottom: 10 } : { ...btnPrimaryDisabled, marginBottom: 10 }}>
            Verify & sign in
          </button>

          {/* Resend */}
          <p className="text-center" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            Didn't receive it?{" "}
            {resendSecs > 0 ? (
              <span style={{ color: "var(--muted-foreground)" }}>Resend in {resendSecs}s</span>
            ) : (
              <button onClick={resend}
                style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: "var(--foreground)", fontSize: 12 }}>
                Resend OTP
              </button>
            )}
          </p>
        </div>
      )}

      {/* Trust badge */}
      <div className="mt-auto pt-4 rounded-2xl p-4 bg-muted border border-border">
        <p className="text-foreground text-sm font-semibold">Secure & private</p>
        <p className="text-muted-foreground mt-1" style={{ fontSize: 12, lineHeight: 1.55 }}>
          OTP expires in 10 minutes. You'll stay signed in on this device.
        </p>
      </div>
    </div>
  );
}

// ─── Onboarding Screen ────────────────────────────────────────────────────────
type AccountType = "organisation" | "personal" | null;

function OnboardingScreen({ onComplete }: { onComplete: (profile: UserProfile) => void }) {
  const [step, setStep] = useState<"name" | "type" | "org-details" | "personal-details">("name");
  const [fullName, setFullName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [orgName, setOrgName] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [address, setAddress]   = useState("");
  const [city, setCity]         = useState("");
  const [pin, setPin]           = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError]   = useState("");
  const [showGeoMap, setShowGeoMap] = useState(false);
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoResolved, setGeoResolved] = useState<{ address: string; city: string; pin: string } | null>(null);
  const [geoResolving, setGeoResolving] = useState(false);

  async function reverseGeocodeOnboarding(lat: number, lng: number) {
    setGeoResolving(true);
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await resp.json();
      const a = data.address || {};
      const road     = [a.road, a.house_number, a.suburb, a.neighbourhood].filter(Boolean).join(", ");
      const cityVal  = a.city || a.town || a.village || a.county || "";
      const postcode = (a.postcode || "").replace(/\s/g, "").slice(0, 6);
      setGeoResolved({ address: road || data.display_name?.split(",")[0] || "", city: cityVal, pin: postcode });
    } catch { setGeoResolved(null); }
    setGeoResolving(false);
  }

  function handleUseLocationOnboarding() {
    if (!navigator.geolocation) { setGeoError("Geolocation not supported."); return; }
    setGeoLoading(true); setGeoError("");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGeoCoords(pt); reverseGeocodeOnboarding(pt.lat, pt.lng); setShowGeoMap(true); setGeoLoading(false);
      },
      err => {
        setGeoLoading(false);
        setGeoError(err.code === 1 ? "Location access denied — enable in browser settings." : "Could not get location. Fill manually.");
      },
      { timeout: 12000, enableHighAccuracy: true }
    );
  }

  function confirmGeoOnboarding() {
    if (geoResolved) { setAddress(geoResolved.address); setCity(geoResolved.city); setPin(geoResolved.pin); }
    setShowGeoMap(false);
  }

  function handleTypeSelect(type: AccountType) {
    setAccountType(type);
    setStep(type === "organisation" ? "org-details" : "personal-details");
  }

  function handleComplete() {
    onComplete({ name: fullName, avatar: null, accountType: accountType || "personal", orgName, gstNumber });
  }

  const steps = ["name", "type", "details"];
  const currentIdx = step === "name" ? 0 : step === "type" ? 1 : 2;
  const canGoBack = step === "type" || step === "org-details" || step === "personal-details";

  return (
    <div className="flex-1 flex flex-col px-5 pt-6 pb-5 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>

      {/* Back button */}
      {canGoBack && (
        <button onClick={() => setStep(step === "type" ? "name" : "type")}
          className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center mb-5 border border-border">
          <ChevronLeft size={18} strokeWidth={2}/>
        </button>
      )}

      {/* Step dots */}
      <div className="flex gap-1.5 mb-6">
        {steps.map((_, i) => (
          <div key={i} className="h-1 rounded-full flex-1 transition-all"
            style={{ background: i <= currentIdx ? DARK : "var(--border)" }}/>
        ))}
      </div>

      {/* ── Name step ── */}
      {step === "name" && (
        <>
          <div className="mb-8">
            <p className="text-foreground mb-1" style={{ fontSize: 24, fontWeight: 700 }}>What's your name?</p>
            <p className="text-muted-foreground text-sm">Let's get your account set up.</p>
          </div>
          <div style={card} className="p-4 mb-4">
            <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Full name</p>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="e.g. Arjun Kumar" style={inputStyle}/>
          </div>
          <button onClick={() => { if (fullName.trim()) setStep("type"); }}
            disabled={!fullName.trim()}
            style={fullName.trim() ? btnPrimary : btnPrimaryDisabled}>
            Continue
          </button>
        </>
      )}

      {/* ── Account type step ── */}
      {step === "type" && (
        <>
          <div className="mb-8">
            <p className="text-foreground mb-1" style={{ fontSize: 24, fontWeight: 700 }}>How will you use FabricLink?</p>
            <p className="text-muted-foreground text-sm">This helps us tailor your experience.</p>
          </div>
          <div className="flex flex-col gap-3">
            {/* Organisation option */}
            <button onClick={() => handleTypeSelect("organisation")}
              className="p-4 rounded-2xl text-left flex items-start gap-4"
              style={{ border: "1.5px solid var(--border)", background: "var(--card)", cursor: "pointer" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: ACCENT_BG }}>
                <Building2 size={20} style={{ color: ACCENT }}/>
              </div>
              <div>
                <p className="text-foreground text-sm font-semibold mb-0.5">For my organisation</p>
                <p className="text-muted-foreground" style={{ fontSize: 12 }}>Schools, hospitals, businesses — bulk procurement with GST</p>
              </div>
            </button>
            {/* Personal option */}
            <button onClick={() => handleTypeSelect("personal")}
              className="p-4 rounded-2xl text-left flex items-start gap-4"
              style={{ border: "1.5px solid var(--border)", background: "var(--card)", cursor: "pointer" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-muted">
                <UserCircle size={20} className="text-foreground"/>
              </div>
              <div>
                <p className="text-foreground text-sm font-semibold mb-0.5">Personal use</p>
                <p className="text-muted-foreground" style={{ fontSize: 12 }}>Individual orders, small batches, personal projects</p>
              </div>
            </button>
          </div>
        </>
      )}

      {/* ── Org details step ── */}
      {step === "org-details" && (
        <>
          <div className="mb-6">
            <p className="text-foreground mb-1" style={{ fontSize: 24, fontWeight: 700 }}>Organisation details</p>
            <p className="text-muted-foreground text-sm">Tell us a bit about your organisation.</p>
          </div>
          <div style={card} className="p-4 mb-5">
            <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Organisation name</p>
            <input value={orgName} onChange={e => setOrgName(e.target.value)}
              placeholder="e.g. Sri Vidya Mandir School" style={inputStyle}/>
          </div>
          <button onClick={handleComplete}
            disabled={!orgName.trim()}
            style={orgName.trim() ? btnPrimary : btnPrimaryDisabled}>
            Save & open home
          </button>
        </>
      )}

      {/* ── Personal details step ── */}
      {step === "personal-details" && (
        <>
          {/* Full-screen map modal */}
          {showGeoMap && geoCoords && (
            <div className="absolute inset-0 z-50 flex flex-col" style={{ background:"var(--background)", borderRadius:44, overflow:"hidden" }}>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
                <button onClick={() => setShowGeoMap(false)} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                  <ChevronLeft size={20} style={{ color: DARK }}/>
                </button>
                <div className="flex-1">
                  <p style={{ fontSize:15, fontWeight:700, color: DARK }}>Choose delivery location</p>
                  <p style={{ fontSize:11, color:"var(--muted-foreground)" }}>Pin shows your detected spot</p>
                </div>
              </div>

              {/* Map */}
              <div className="relative flex-shrink-0" style={{ height:300 }}>
                <iframe
                  title="Delivery map"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${geoCoords.lng-0.008},${geoCoords.lat-0.008},${geoCoords.lng+0.008},${geoCoords.lat+0.008}&layer=mapnik&marker=${geoCoords.lat},${geoCoords.lng}`}
                  className="w-full h-full" style={{ border:"none" }}
                />
                {/* Centre pin overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <MapPin size={36} strokeWidth={2} style={{ color:DARK, marginBottom:28, filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.35))" }}/>
                </div>
              </div>

              {/* Detected address */}
              <div className="flex-1 overflow-y-auto px-4 pt-4">
                <div style={{ ...card, padding:16, marginBottom:12 }}>
                  <p style={{ fontSize:11, fontWeight:600, color:"var(--muted-foreground)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>Detected address</p>
                  {geoResolving ? (
                    <p style={{ fontSize:13, color:"var(--muted-foreground)" }}>Locating…</p>
                  ) : geoResolved ? (
                    <>
                      <p style={{ fontSize:14, fontWeight:600, color:DARK, lineHeight:1.4 }}>{geoResolved.address}</p>
                      <p style={{ fontSize:12, color:"var(--muted-foreground)", marginTop:2 }}>{geoResolved.city}{geoResolved.pin ? ` — ${geoResolved.pin}` : ""}</p>
                    </>
                  ) : (
                    <p style={{ fontSize:13, color:"var(--muted-foreground)" }}>Could not detect — you can edit manually after confirming.</p>
                  )}
                </div>
              </div>

              {/* Confirm CTA */}
              <div className="flex-shrink-0 px-4 py-3 border-t border-border">
                <button onClick={confirmGeoOnboarding} style={btnPrimary}>
                  <Check size={15}/> Confirm this location
                </button>
              </div>
            </div>
          )}

          <div className="mb-6">
            <p className="text-foreground mb-1" style={{ fontSize: 24, fontWeight: 700 }}>Delivery details</p>
            <p className="text-muted-foreground text-sm">Where should we deliver your orders?</p>
          </div>

          <div style={card} className="p-4 mb-4 flex flex-col gap-3">
            {/* Use current location */}
            <button onClick={handleUseLocationOnboarding} disabled={geoLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border"
              style={{ borderStyle:"dashed", borderColor:DARK, background:"rgba(13,13,13,0.04)", color:DARK, cursor:geoLoading?"not-allowed":"pointer", fontWeight:600, fontSize:13 }}>
              {geoLoading
                ? <span style={{ width:14, height:14, border:`2px solid ${DARK}`, borderTopColor:"transparent", borderRadius:"50%", display:"inline-block", animation:"spin 0.8s linear infinite" }}/>
                : <Navigation size={14} strokeWidth={2}/>}
              {geoLoading ? "Getting your location…" : "Use current location"}
            </button>

            {geoError && (
              <p style={{ fontSize:11, color:"#dc2626" }}>{geoError}</p>
            )}

            {/* Auto-filled badge */}
            {address && geoCoords && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background:"rgba(13,13,13,0.05)" }}>
                <Check size={11} style={{ color:DARK }}/><p style={{ fontSize:11, color:DARK, fontWeight:500 }}>Auto-filled · Edit below if needed</p>
                <button onClick={() => setShowGeoMap(true)} style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", fontSize:11, color:DARK, fontWeight:600, textDecoration:"underline" }}>Change</button>
              </div>
            )}

            {/* Field 1: Address (full row) */}
            <div>
              <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Address *</p>
              <input value={address} onChange={e => setAddress(e.target.value)}
                placeholder="Flat / Building, Street, Area" style={inputStyle}/>
            </div>

            {/* Field 2: City | PIN (2-col) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>City *</p>
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="City" style={inputStyle}/>
              </div>
              <div>
                <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>PIN code *</p>
                <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,"").slice(0,6))}
                  placeholder="6-digit PIN" inputMode="numeric" maxLength={6} style={inputStyle}/>
              </div>
            </div>
          </div>

          <button onClick={handleComplete}
            disabled={!address.trim() || !city.trim() || pin.length !== 6}
            style={address.trim() && city.trim() && pin.length === 6 ? btnPrimary : btnPrimaryDisabled}>
            Save & open home
          </button>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </>
      )}
    </div>
  );
}

// ─── Help & Support Screen ─────────────────────────────────────────────────────
function HelpSupportScreen({ onBack }: { onBack: () => void }) {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const faqs = [
    { q: "How do I place a bulk order?",          a: "Go to the Quote tab and fill in your material requirements. Our team will get back with a quote within 24 hours." },
    { q: "What is the minimum order quantity?",   a: "Minimum order is 50 metres or 100 pieces depending on fabric type. Contact our team for exceptions." },
    { q: "How long does delivery take?",          a: "Standard orders take 7–14 business days. Expedited delivery is available at extra cost." },
    { q: "Can I track my order?",                 a: "Yes! Use the Requests tab to see live production status, QA reports, and delivery tracking." },
    { q: "What payment methods are accepted?",    a: "We accept bank transfer (NEFT/RTGS), UPI, and credit cards through our secure payment gateway." },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Sub-page header */}
      <div className="px-5 pt-2 pb-4 flex items-center gap-3 border-b border-border flex-shrink-0">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center border border-border">
          <ChevronLeft size={18} strokeWidth={2}/>
        </button>
        <p className="text-foreground text-sm font-semibold">Help & Support</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: "none" }}>
        <p className="label-section mb-4">Frequently asked questions</p>

        {/* FAQs */}
        <div className="flex flex-col gap-2 mb-5">
          {faqs.map((faq, i) => (
            <div key={i} style={card} className="overflow-hidden">
              <button onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                className="w-full text-left px-4 py-3.5 flex items-center justify-between bg-transparent border-none cursor-pointer">
                <p className="text-foreground text-sm pr-3" style={{ fontWeight: 500 }}>{faq.q}</p>
                <ChevronRight size={14} strokeWidth={2}
                  className={`flex-shrink-0 text-muted-foreground transition-transform ${expandedFaq === i ? "rotate-90" : ""}`}/>
              </button>
              {expandedFaq === i && (
                <div className="px-4 pb-3.5 border-t border-border">
                  <p className="text-muted-foreground text-sm mt-3 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact card */}
        <div style={card} className="p-4 mb-3">
          <p className="text-foreground text-sm font-semibold mb-1">Still need help?</p>
          <p className="text-muted-foreground mb-3" style={{ fontSize: 12 }}>Our support team is available Mon–Sat, 9 AM to 6 PM.</p>
          <button style={btnPrimary}>
            <Headphones size={15} strokeWidth={1.5}/> Contact customer care
          </button>
        </div>

        {/* Phone row */}
        <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-3 border border-border">
          <Phone size={14} strokeWidth={1.5} className="text-muted-foreground flex-shrink-0"/>
          <div>
            <p className="text-foreground" style={{ fontSize: 12, fontWeight: 500 }}>Call us directly</p>
            <p className="text-muted-foreground" style={{ fontSize: 11 }}>+91 98765 00000 · Available 9 AM – 6 PM</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab items ────────────────────────────────────────────────────────────────
const tabItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "home",    label: "Home",     icon: <Home      size={20} strokeWidth={1.5}/> },
  { id: "order",   label: "Quote",    icon: <PlusCircle size={20} strokeWidth={1.5}/> },
  { id: "track",   label: "Requests", icon: <MapPin    size={20} strokeWidth={1.5}/> },
  { id: "account", label: "Account",  icon: <User      size={20} strokeWidth={1.5}/> },
];
const tabTitleMap: Record<Tab, string> = {
  home: "", order: "Request Quote", track: "My Requests", account: "Account",
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [authStep, setAuthStep]               = useState<"login" | "onboarding" | "app">("login");
  const [activeTab, setActiveTab]             = useState<Tab>("home");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNewOrder, setShowNewOrder]       = useState(false);
  const [newOrderSummary, setNewOrderSummary] = useState<SubmittedOrderSummary | null>(null);
  const [showRatingPopup, setShowRatingPopup] = useState(false);
  const [ratingVal, setRatingVal]             = useState(0);
  const [ratingFeedback, setRatingFeedback]   = useState("");
  const [ratingDone, setRatingDone]           = useState(false);
  const [targetOrderId, setTargetOrderId]     = useState<string | null>(null);
  const [userProfile, setUserProfile]         = useState<UserProfile>({ name: "", avatar: null, accountType: "personal" });
  const [showHelp, setShowHelp]               = useState(false);

  function handleNavigate(tab: Tab, orderId?: string) {
    setActiveTab(tab);
    setTargetOrderId(orderId ?? null);
  }
  function handleOrderSubmitted(summary?: SubmittedOrderSummary) {
    setNewOrderSummary(summary ?? null);
    setShowNewOrder(true);
    setActiveTab("track");
    // ⚠️ Do NOT show rating popup here — only show after order is delivered
  }
  function handleOrderDelivered() {
    // Called by TrackTab when user opens a delivered order
    if (!ratingDone) setShowRatingPopup(true);
  }
  function handleNotifNavigate(tab: string, orderId?: string) {
    setShowNotifications(false);
    setActiveTab(tab as Tab);
    setTargetOrderId(orderId ?? null);
  }
  function handleContactAdmin() {
    alert("Calling admin: +91 98765 00000");
  }
  function handleSignOut() {
    setAuthStep("login");
    setActiveTab("home");
    setShowNotifications(false);
    setShowNewOrder(false);
    setNewOrderSummary(null);
    setShowRatingPopup(false);
    setRatingVal(0); setRatingFeedback(""); setRatingDone(false);
    setTargetOrderId(null);
    setShowHelp(false);
    setUserProfile({ name: "", avatar: null, accountType: "personal" });
  }

  // ── Phone frame shell ──
  const phoneShell = (children: React.ReactNode) => (
    <div className="size-full flex items-center justify-center"
      style={{ fontFamily: "DM Sans, system-ui, sans-serif", background: "var(--secondary)" }}>
      <div className="flex flex-col overflow-hidden"
        style={{
          position: "relative", width: 375, height: 812,
          borderRadius: 44, background: "var(--background)",
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
        }}>
        <StatusBar/>
        {children}
      </div>
    </div>
  );

  // ── Auth screens ──────────────────────────────────────────────────────────
  if (authStep === "login")       return phoneShell(<LoginScreen onLogin={() => setAuthStep("onboarding")}/>);
  if (authStep === "onboarding")  return phoneShell(<OnboardingScreen onComplete={p => { setUserProfile(p); setAuthStep("app"); }}/>);

  return phoneShell(
    <>
      {/* Sub-page header (non-home tabs) */}
      {activeTab !== "home" && !showHelp && (
        <div className="px-5 pt-1 pb-3 flex items-center justify-between border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-foreground/25 text-xs" style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>FabricLink</span>
            <span className="text-border">·</span>
            <span className="text-foreground text-sm font-semibold">{tabTitleMap[activeTab]}</span>
          </div>
          <button onClick={() => setShowNotifications(true)}
            className="w-8 h-8 rounded-full bg-card flex items-center justify-center border border-border relative">
            <Bell size={14} strokeWidth={1.5}/>
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }}/>
          </button>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {showHelp ? (
          <HelpSupportScreen onBack={() => setShowHelp(false)}/>
        ) : (
          <>
            {activeTab === "home"    && <HomeTab onNavigate={handleNavigate} onBell={() => setShowNotifications(true)} profile={userProfile}/>}
            {activeTab === "order"   && <NewOrderTab onNavigate={handleNavigate} onTrackOrder={handleOrderSubmitted} accountType={userProfile.accountType}/>}
            {activeTab === "track"   && (
              <TrackTab
                showNew={showNewOrder}
                newOrderSummary={newOrderSummary}
                targetOrderId={targetOrderId}
                accountType={userProfile.accountType}
                onMessageCoordinator={handleContactAdmin}
                onReorder={() => setActiveTab("order")}
                onOrderDelivered={handleOrderDelivered}
              />
            )}
            {activeTab === "account" && (
              <AccountTab
                onNavigate={(tab, orderId) => handleNavigate(tab as Tab, orderId)}
                profile={userProfile}
                onProfileUpdate={setUserProfile}
                onSignOut={handleSignOut}
              />
            )}
          </>
        )}
      </div>

      {/* ── Bottom nav ── */}
      <div className="flex-shrink-0 flex items-center px-2 border-t border-border relative"
        style={{
          paddingTop: 8, paddingBottom: 22,
          background: "rgba(248,247,245,0.96)",
          backdropFilter: "blur(16px)",
        }}>
        {tabItems.map(tab => {
          const active = activeTab === tab.id && !showHelp;
          return (
            <button key={tab.id}
              onClick={() => { setShowHelp(false); setActiveTab(tab.id); }}
              className="flex-1 flex flex-col items-center gap-0.5 py-1">
              <span className={active ? "text-foreground" : "text-muted-foreground"}>{tab.icon}</span>
              <span className={active ? "text-foreground" : "text-muted-foreground"}
                style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>
                {tab.label}
              </span>
              {active
                ? <span className="w-1 h-1 rounded-full bg-foreground mt-0.5"/>
                : <span className="w-1 h-1 mt-0.5"/>}
            </button>
          );
        })}
        {/* Home indicator */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 rounded-full bg-foreground/20 pointer-events-none"/>
      </div>

      {/* Notifications overlay */}
      {showNotifications && (
        <NotificationsScreen onClose={() => setShowNotifications(false)} onNavigate={handleNotifNavigate}/>
      )}

      {/* Rating popup */}
      {showRatingPopup && !ratingDone && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowRatingPopup(false)}>
          <div className="bg-background rounded-t-3xl px-5 py-6" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4"/>

            {/* Order identity */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <Package size={20} className="text-emerald-500" strokeWidth={1.5}/>
              </div>
              <div>
                <p className="text-foreground text-sm font-semibold">How was your order?</p>
                <p className="text-muted-foreground" style={{ fontSize: 11 }}>#FL-2035 · Cotton Jersey — White</p>
              </div>
            </div>

            {/* Stars */}
            <div className="flex justify-center mb-4">
              {[1, 2, 3, 4, 5].map(i => (
                <button key={i} onClick={() => setRatingVal(i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 3 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24"
                    fill={ratingVal >= i ? ACCENT : "none"}
                    stroke={ratingVal >= i ? ACCENT : "rgba(0,0,0,0.2)"}
                    strokeWidth="1.5">
                    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
                  </svg>
                </button>
              ))}
            </div>

            {/* Feedback textarea */}
            {ratingVal > 0 && (
              <textarea value={ratingFeedback} onChange={e => setRatingFeedback(e.target.value)}
                placeholder="Tell us about the quality, delivery, coordinator service…"
                className="w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none resize-none h-16 mb-3"
                style={{ fontFamily: "DM Sans, sans-serif" }}/>
            )}

            <button
              onClick={() => { if (ratingVal > 0) { setRatingDone(true); setShowRatingPopup(false); } }}
              disabled={ratingVal === 0}
              style={ratingVal > 0 ? btnAccent : btnPrimaryDisabled}>
              {ratingVal > 0 ? "Submit feedback" : "Tap a star to rate"}
            </button>

            <button onClick={() => setShowRatingPopup(false)}
              className="w-full text-center text-muted-foreground text-xs mt-3"
              style={{ background: "none", border: "none", cursor: "pointer" }}>
              Maybe later
            </button>
            <div style={{ height: 16 }}/>
          </div>
        </div>
      )}
    </>
  );
}
