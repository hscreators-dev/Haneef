import { useState, useRef } from "react";
import {
  Bell, User, Home, PlusCircle, MapPin,
  ChevronRight, TrendingUp, Clock, CheckCircle2, ArrowRight, Box, Package,
  Mail, Smartphone, ShieldCheck, Building2, UserCircle, ChevronLeft, Phone,
  FileText, Lock, CreditCard, MapPinned, HistoryIcon, Headphones, AlertCircle,
} from "lucide-react";
import { NewOrderTab } from "./components/NewOrderTab";
import { TrackTab } from "./components/TrackTab";
import { AccountTab, type UserProfile } from "./components/AccountTab";
import { NotificationsScreen } from "./components/NotificationsScreen";

export type Tab = "home" | "order" | "track" | "account";
const ACCENT = "#C8A97E";
const DARK = "#0D0D0D";

// ─── Swatch Box Modal ──────────────────────────────────────────────────────────
const fabrics = [
  { id: "A", name: "Premium Shirt Fabric",  desc: "100% Cotton Pique · 220 GSM", bg: "#e8e0d0" },
  { id: "B", name: "Sports T-Shirt Fabric", desc: "Cotton-Poly Blend · 180 GSM",  bg: "#d4e8e0" },
  { id: "C", name: "Uniform Twill",         desc: "65/35 Poly-Cotton · 240 GSM",  bg: "#d4dce8" },
  { id: "D", name: "Heavyweight Canvas",    desc: "100% Cotton · 320 GSM",        bg: "#e8d4d4" },
];
function SwatchBoxModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"browse" | "address" | "done">("browse");
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="bg-background rounded-t-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-1"/>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <p className="text-foreground text-sm" style={{ fontWeight: 600 }}>Free Fabric Swatch Box</p>
            <p className="text-muted-foreground" style={{ fontSize: 11 }}>Ships in 1–2 days · No cost</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-foreground">✕</button>
        </div>
        {step === "browse" && (
          <div className="px-5 py-4">
            <p className="text-muted-foreground mb-4 text-xs leading-relaxed">Touch each fabric before you order. We'll mail 10×10 cm swatches — pick your favourite in the app.</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {fabrics.map(f => (
                <div key={f.id} className="rounded-xl overflow-hidden border border-border">
                  <div className="h-14 flex items-center justify-center text-2xl font-bold" style={{ background: f.bg, color: "rgba(0,0,0,0.12)" }}>{f.id}</div>
                  <div className="p-2"><p className="text-foreground" style={{ fontSize: 12, fontWeight: 500 }}>{f.name}</p><p className="text-muted-foreground" style={{ fontSize: 10, marginTop: 2 }}>{f.desc}</p></div>
                </div>
              ))}
            </div>
            <button onClick={() => setStep("address")} className="w-full bg-foreground text-white rounded-2xl py-3.5 flex items-center justify-center gap-2 text-sm" style={{ fontWeight: 500 }}>
              <Box size={15}/> Order Free Swatch Box <ArrowRight size={13}/>
            </button>
          </div>
        )}
        {step === "address" && (
          <div className="px-5 py-4">
            <p className="text-foreground text-sm mb-3" style={{ fontWeight: 500 }}>Delivery address</p>
            {["School / Institution name","Street address","City & PIN code","Contact person name","Phone number"].map(p => (
              <input key={p} placeholder={p} className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none mb-2" style={{ fontFamily:"DM Sans, sans-serif" }}/>
            ))}
            <button onClick={() => setStep("done")} className="w-full py-3.5 rounded-2xl text-sm mt-1 text-white" style={{ background: ACCENT, fontWeight: 500 }}>Confirm & Request Delivery</button>
          </div>
        )}
        {step === "done" && (
          <div className="px-5 py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={26} className="text-emerald-500" strokeWidth={1.5}/></div>
            <p className="text-foreground mb-2" style={{ fontSize: 16, fontWeight: 600 }}>Swatch box on its way!</p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-5">We'll deliver 4 fabric samples within 1–2 days.</p>
            <button onClick={onClose} className="w-full py-3 rounded-2xl bg-muted text-foreground text-sm" style={{ fontWeight: 500 }}>Done</button>
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
        <div className="w-6 h-3 rounded-sm border border-black/30 p-px flex"><div className="w-4/5 h-full bg-black/80 rounded-xs"/></div>
      </div>
    </div>
  );
}

// ─── Orders data ───────────────────────────────────────────────────────────────
const orders = [
  { id:"#FL-2041", name:"300m Cotton Twill",  shade:"Navy",         qty:"500 pcs",  gsm:"GSM 220", eta:"ETA Jul 14", status:"In production", statusColor:"text-emerald-700 bg-emerald-50", pct:55,  go:"track" as Tab, quoteReady:false },
  { id:"#FL-2038", name:"Linen Blend Fabric", shade:"Ivory",        qty:"200 pcs",  gsm:"GSM 160", eta:"ETA Jul 8",  status:"Quality check",  statusColor:"text-amber-700 bg-amber-50",   pct:78,  go:"track" as Tab, quoteReady:false },
  { id:"#FL-2045", name:"Heavy Denim",        shade:"Washed Black", qty:"1000 pcs", gsm:"GSM 360", eta:"Awaiting",   status:"Quote pending",  statusColor:"text-stone-600 bg-stone-100",  pct:15,  go:"track" as Tab, quoteReady:true  },
];

// ─── Home Tab ─────────────────────────────────────────────────────────────────
function HomeTab({ onNavigate, onBell, profile }: { onNavigate: (t: Tab, orderId?: string) => void; onBell: () => void; profile?: UserProfile }) {
  const [showSwatch, setShowSwatch] = useState(false);
  return (
    <div className="flex-1 overflow-y-auto pb-4 min-h-0" style={{ scrollbarWidth:"none" }}>
      <div className="px-5 pt-2 pb-4 flex items-center justify-between">
        <div>
          <p className="text-muted-foreground" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>Good morning</p>
          <h2 className="text-foreground" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>{profile?.name?.split(" ")[0] || "Arjun"}</h2>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onBell} className="w-9 h-9 rounded-full bg-card flex items-center justify-center border border-border relative">
            <Bell size={16} strokeWidth={1.5}/>
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }}/>
          </button>
          <button onClick={() => onNavigate("account")} className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center overflow-hidden">
            {profile?.avatar
              ? <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover"/>
              : <User size={15} strokeWidth={1.5} color="white"/>
            }
          </button>
        </div>
      </div>

      <div className="mx-5 mb-5 bg-foreground rounded-2xl p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full border border-white/5" style={{ transform:"translate(30%,-30%)" }}/>
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full border border-white/5" style={{ transform:"translate(-30%,30%)" }}/>
        <p className="text-white/40 mb-2" style={{ fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase" }}>FabricLink Procurement</p>
        <h1 className="text-white mb-1" style={{ fontSize:24, fontWeight:600, lineHeight:1.25 }}>
          Managed textile<br/><span style={{ color: ACCENT }}>sourcing for teams</span>
        </h1>
        <p className="text-white/40 mb-5" style={{ fontSize: 12 }}>Requirements, quotes, QA and delivery in one place</p>
        <button onClick={() => onNavigate("order")} className="w-full bg-white text-foreground rounded-xl py-3 flex items-center justify-center gap-2 text-sm" style={{ fontWeight: 500 }}>
          <PlusCircle size={15} strokeWidth={2}/> Request a quote
        </button>
      </div>

      <div className="mx-5 mb-5 grid grid-cols-3 gap-3">
        {[
          { label:"Requests", value:"3",   icon:<Clock        size={14} strokeWidth={1.5} className="text-muted-foreground"/> },
          { label:"Delivered", value:"12",  icon:<CheckCircle2 size={14} strokeWidth={1.5} className="text-muted-foreground"/> },
          { label:"On-time",   value:"97%", icon:<TrendingUp   size={14} strokeWidth={1.5} className="text-muted-foreground"/> },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl p-3.5 border border-border">
            <div className="mb-2">{s.icon}</div>
            <p className="text-foreground" style={{ fontSize:20, fontWeight:600, lineHeight:1 }}>{s.value}</p>
            <p className="text-muted-foreground mt-0.5" style={{ fontSize:11 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {(profile?.accountType === "organisation") && (
      <div className="mx-5 mb-5 bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-muted-foreground" style={{ fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:500 }}>Request dashboard</p>
            <p className="text-foreground text-sm mt-0.5" style={{ fontWeight:600 }}>Your procurement pipeline</p>
          </div>
          <button onClick={() => onNavigate("track")} className="text-xs text-foreground flex items-center gap-1" style={{ fontWeight:500 }}>
            Open <ArrowRight size={11} strokeWidth={2}/>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3">
          {[
            ["Under review", "1"],["Quote shared", "1"],["Production", "1"],
            ["QA inspection", "1"],["Shipped", "0"],["Delivered", "12"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-muted px-3 py-2.5 flex items-center justify-between">
              <span className="text-muted-foreground" style={{ fontSize:11 }}>{label}</span>
              <span className="text-foreground" style={{ fontSize:12, fontWeight:700 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Wedding & Events feature banner — for personal/individual users */}
      {(!profile?.accountType || profile.accountType === "personal") && (
        <button className="mx-5 mb-5 text-left w-[calc(100%-2.5rem)] overflow-hidden rounded-2xl"
          style={{ background:"linear-gradient(135deg,#2d1b4e 0%,#5b2d8e 50%,#c8a84b 100%)", border:"none", cursor:"pointer" }}
          onClick={() => {}}>
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize:20 }}>💍</span>
              <span className="text-white text-sm" style={{ fontWeight:700 }}>Wedding & Events</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-white/20 text-white" style={{ fontWeight:500 }}>New</span>
            </div>
            <p className="text-white/80 text-xs leading-relaxed mb-3">
              Custom fabric orders for weddings, functions & events. Match your theme colours, get coordinated outfits for the whole family — from sarees to sherwanis — with free design consultation.
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-white/60" style={{ fontSize:11 }}>Explore the workflow</span>
              <ChevronRight size={13} color="rgba(255,255,255,0.6)" strokeWidth={2}/>
            </div>
          </div>
        </button>
      )}

      <div className="px-5 mb-3 flex items-center justify-between">
        <p className="text-muted-foreground" style={{ fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase" }}>My requests</p>
        <button onClick={() => onNavigate("track")} className="text-xs text-foreground flex items-center gap-0.5" style={{ fontWeight:500 }}>
          See all <ArrowRight size={11} strokeWidth={2}/>
        </button>
      </div>

      <div className="px-5 flex flex-col gap-2.5">
        {orders.map(o => (
          <button key={o.id} onClick={() => onNavigate("track", o.id)} className="text-left w-full overflow-hidden" style={{ border:`1px solid ${o.quoteReady ? ACCENT : "rgba(0,0,0,0.08)"}`, background:"#fff", borderRadius:16 }}>
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-muted-foreground" style={{ fontSize:11 }}>{o.id}</p>
                <span className={`text-xs px-2.5 py-1 rounded-full ${o.statusColor}`} style={{ fontWeight:500, fontSize:11 }}>{o.status}</span>
              </div>
              <p className="text-foreground text-sm mb-1" style={{ fontWeight:500 }}>{o.name} — {o.shade}</p>
              <p className="text-muted-foreground" style={{ fontSize:12 }}>{o.qty} · {o.gsm} · {o.eta}</p>
              <div className="h-1 bg-muted rounded-full mt-2.5 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width:`${o.pct}%`, background: ACCENT }}/>
              </div>
            </div>
            {o.quoteReady && (
              <div className="px-4 py-2.5 flex items-center justify-between border-t" style={{ background:"rgba(200,169,126,0.08)", borderColor:"rgba(200,169,126,0.3)" }}>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize:13 }}>💰</span>
                  <div>
                    <p style={{ fontSize:12, fontWeight:600, color:"#7c5419" }}>Quote ready — ₹57,700</p>
                    <p style={{ fontSize:10, color:"#92400e" }}>Tap to review & approve</p>
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
        <input key={i} ref={el => { inputRefs.current[i] = el; }} value={value[i] || ""}
          onChange={e => handleChange(i, e.target.value)} onKeyDown={e => handleKey(i, e)}
          inputMode="numeric" maxLength={1} className="w-11 h-14 text-center text-foreground outline-none"
          style={{ fontSize:22, fontWeight:700, borderRadius:14, border: value[i] ? `2px solid ${DARK}` : "2px solid rgba(0,0,0,0.12)", background: value[i] ? "white" : "rgba(0,0,0,0.04)", fontFamily:"monospace", transition:"border-color 0.15s" }}/>
      ))}
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [step, setStep] = useState<"identity" | "otp">("identity");
  const [identity, setIdentity] = useState("+91 98765 43210");
  const [otp, setOtp] = useState("");
  const otpReady = otp.replace(/\s/g, "").length === 6;

  function switchMode(next: "phone" | "email") {
    setMode(next);
    setIdentity(next === "phone" ? "+91 98765 43210" : "arjun@threadcraft.in");
    setOtp(""); setStep("identity");
  }

  return (
    <div className="flex-1 flex flex-col px-5 pt-6 pb-5 min-h-0 overflow-y-auto" style={{ scrollbarWidth:"none" }}>
      <div className="mb-7">
        <div className="w-12 h-12 rounded-2xl bg-foreground flex items-center justify-center mb-4">
          <ShieldCheck size={22} color="#fff" strokeWidth={1.5}/>
        </div>
        <p className="text-foreground mb-1" style={{ fontSize:24, fontWeight:700 }}>FabricLink login</p>
        <p className="text-muted-foreground text-sm leading-relaxed">Verify with phone or email OTP to open your procurement dashboard.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-5">
        {([["phone","Phone",<Smartphone size={14} strokeWidth={1.5}/>],["email","Email",<Mail size={14} strokeWidth={1.5}/>]] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => switchMode(id)} className="py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-sm"
            style={{ background: mode===id ? DARK : "var(--card)", color: mode===id ? "#fff" : "var(--foreground)", border:`1px solid ${mode===id ? DARK : "var(--border)"}`, fontWeight:500 }}>
            {icon}{label}
          </button>
        ))}
      </div>
      {step === "identity" ? (
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>{mode==="phone" ? "Mobile number" : "Email address"}</p>
          <input value={identity} onChange={e => setIdentity(e.target.value)} inputMode={mode==="phone" ? "tel" : "email"}
            className="w-full bg-background border border-border rounded-xl px-3.5 py-3 text-foreground text-sm outline-none mb-4" style={{ fontFamily:"DM Sans, sans-serif" }}/>
          <button onClick={() => setStep("otp")} className="w-full bg-foreground text-white rounded-2xl py-3.5 text-sm" style={{ fontWeight:500 }}>
            Send 6-digit code
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-foreground text-sm mb-1" style={{ fontWeight:600 }}>Enter OTP</p>
          <p className="text-muted-foreground mb-5" style={{ fontSize:12 }}>We sent a 6-digit code to <span className="text-foreground font-semibold">{identity}</span></p>
          <OTPInput value={otp} onChange={setOtp}/>
          <p className="text-muted-foreground text-center mb-4" style={{ fontSize:11 }}>{otp.replace(/\s/g,"").length}/6 digits entered</p>
          <button onClick={onLogin} disabled={!otpReady} className="w-full rounded-2xl py-3.5 text-sm mb-2"
            style={{ background: otpReady ? DARK : "#e5e7eb", color: otpReady ? "#fff" : "#9ca3af", fontWeight:500, cursor: otpReady ? "pointer" : "not-allowed" }}>
            Verify & continue
          </button>
          <button onClick={() => { setOtp(""); setStep("identity"); }} className="w-full py-2.5 rounded-xl text-sm bg-muted text-foreground" style={{ fontWeight:500 }}>
            {mode === "email" ? "Change email address" : "Change number"}
          </button>
          <p className="text-center mt-3" style={{ fontSize:12 }}>
            Didn't receive it? <button className="font-bold text-foreground" style={{ background:"none", border:"none", cursor:"pointer" }}>Resend OTP</button>
          </p>
        </div>
      )}
      <div className="mt-auto pt-4 rounded-2xl p-4 bg-muted border border-border">
        <p className="text-foreground text-sm" style={{ fontWeight:600 }}>Secure login</p>
        <p className="text-muted-foreground mt-1" style={{ fontSize:12, lineHeight:1.55 }}>One-time verification — you'll stay logged in on this device.</p>
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
  const [address, setAddress] = useState("");

  function handleTypeSelect(type: AccountType) {
    setAccountType(type);
    setStep(type === "organisation" ? "org-details" : "personal-details");
  }

  function handleComplete() {
    onComplete({ name: fullName, avatar: null, accountType: accountType || "personal", orgName, gstNumber });
  }

  const steps = ["name","type","details"];
  const currentIdx = step === "name" ? 0 : step === "type" ? 1 : 2;

  return (
    <div className="flex-1 flex flex-col px-5 pt-6 pb-5 min-h-0 overflow-y-auto" style={{ scrollbarWidth:"none" }}>
      {(step === "type" || step === "org-details" || step === "personal-details") && (
        <button onClick={() => setStep(step === "type" ? "name" : "type")}
          className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center mb-5 border border-border">
          <ChevronLeft size={18} strokeWidth={2}/>
        </button>
      )}
      <div className="flex gap-1.5 mb-6">
        {steps.map((_, i) => (
          <div key={i} className="h-1 rounded-full flex-1 transition-all" style={{ background: i <= currentIdx ? DARK : "rgba(0,0,0,0.12)" }}/>
        ))}
      </div>

      {step === "name" && (
        <>
          <div className="mb-8">
            <p className="text-foreground mb-1" style={{ fontSize:24, fontWeight:700 }}>What's your name?</p>
            <p className="text-muted-foreground text-sm">Let's get your account set up.</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 mb-4">
            <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Full name</p>
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Arjun Kumar"
              className="w-full bg-background border border-border rounded-xl px-3.5 py-3 text-foreground text-sm outline-none" style={{ fontFamily:"DM Sans, sans-serif" }}/>
          </div>
          <button onClick={() => { if (fullName.trim()) setStep("type"); }} disabled={!fullName.trim()} className="w-full rounded-2xl py-3.5 text-sm"
            style={{ background: fullName.trim() ? DARK : "#e5e7eb", color: fullName.trim() ? "#fff" : "#9ca3af", fontWeight:500 }}>
            Continue
          </button>
        </>
      )}

      {step === "type" && (
        <>
          <div className="mb-8">
            <p className="text-foreground mb-1" style={{ fontSize:24, fontWeight:700 }}>How will you use FabricLink?</p>
            <p className="text-muted-foreground text-sm">This helps us tailor your experience.</p>
          </div>
          <div className="flex flex-col gap-3">
            <button onClick={() => handleTypeSelect("organisation")} className="p-4 rounded-2xl text-left flex items-start gap-4" style={{ border:"2px solid rgba(0,0,0,0.10)", background:"white" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:"rgba(200,169,126,0.15)" }}>
                <Building2 size={20} style={{ color: ACCENT }}/>
              </div>
              <div>
                <p className="text-foreground text-sm mb-0.5" style={{ fontWeight:600 }}>For my organisation</p>
                <p className="text-muted-foreground" style={{ fontSize:12 }}>Schools, hospitals, businesses — bulk procurement with GST</p>
              </div>
            </button>
            <button onClick={() => handleTypeSelect("personal")} className="p-4 rounded-2xl text-left flex items-start gap-4" style={{ border:"2px solid rgba(0,0,0,0.10)", background:"white" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:"rgba(13,13,13,0.06)" }}>
                <UserCircle size={20} className="text-foreground"/>
              </div>
              <div>
                <p className="text-foreground text-sm mb-0.5" style={{ fontWeight:600 }}>Personal use</p>
                <p className="text-muted-foreground" style={{ fontSize:12 }}>Individual orders, small batches, personal projects</p>
              </div>
            </button>
          </div>
        </>
      )}

      {step === "org-details" && (
        <>
          <div className="mb-6">
            <p className="text-foreground mb-1" style={{ fontSize:24, fontWeight:700 }}>Organisation details</p>
            <p className="text-muted-foreground text-sm">Required for business procurement & invoicing.</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 mb-4 flex flex-col gap-3">
            <div>
              <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Organisation name</p>
              <input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. Sri Vidya Mandir School"
                className="w-full bg-background border border-border rounded-xl px-3.5 py-3 text-foreground text-sm outline-none" style={{ fontFamily:"DM Sans, sans-serif" }}/>
            </div>
            <div>
              <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>GST number</p>
              <input value={gstNumber} onChange={e => setGstNumber(e.target.value.toUpperCase())} placeholder="e.g. 29ABCDE1234F1Z5"
                className="w-full bg-background border border-border rounded-xl px-3.5 py-3 text-foreground text-sm outline-none" style={{ fontFamily:"monospace", letterSpacing:"0.05em" }}/>
            </div>
          </div>
          <button onClick={handleComplete} disabled={!orgName.trim() || !gstNumber.trim()} className="w-full rounded-2xl py-3.5 text-sm"
            style={{ background: orgName.trim() && gstNumber.trim() ? DARK : "#e5e7eb", color: orgName.trim() && gstNumber.trim() ? "#fff" : "#9ca3af", fontWeight:500 }}>
            Save & open home
          </button>
        </>
      )}

      {step === "personal-details" && (
        <>
          <div className="mb-6">
            <p className="text-foreground mb-1" style={{ fontSize:24, fontWeight:700 }}>Delivery details</p>
            <p className="text-muted-foreground text-sm">Where should we deliver your orders?</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 mb-4 flex flex-col gap-3">
            <div>
              <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Delivery address</p>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, City, PIN code"
                className="w-full bg-background border border-border rounded-xl px-3.5 py-3 text-foreground text-sm outline-none" style={{ fontFamily:"DM Sans, sans-serif" }}/>
            </div>
            <button className="flex items-center gap-2 text-sm py-2.5 px-3.5 rounded-xl bg-background border border-border text-muted-foreground" style={{ fontWeight:500 }}>
              <MapPinned size={14} strokeWidth={1.5}/> Use current location
            </button>
          </div>
          <button onClick={handleComplete} disabled={!address.trim()} className="w-full rounded-2xl py-3.5 text-sm"
            style={{ background: address.trim() ? DARK : "#e5e7eb", color: address.trim() ? "#fff" : "#9ca3af", fontWeight:500 }}>
            Save & open home
          </button>
        </>
      )}
    </div>
  );
}

// ─── Help & Support Screen ─────────────────────────────────────────────────────
function HelpSupportScreen({ onBack }: { onBack: () => void }) {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const faqs = [
    { q:"How do I place a bulk order?", a:"Go to the Quote tab and fill in your material requirements. Our team will get back with a quote within 24 hours." },
    { q:"What is the minimum order quantity?", a:"Minimum order is 50 metres or 100 pieces depending on fabric type. Contact our team for exceptions." },
    { q:"How long does delivery take?", a:"Standard orders take 7–14 business days. Expedited delivery is available at extra cost." },
    { q:"Can I track my order?", a:"Yes! Use the Requests tab to see live production status, QA reports, and delivery tracking." },
    { q:"What payment methods are accepted?", a:"We accept bank transfer (NEFT/RTGS), UPI, and credit cards through our secure payment gateway." },
  ];
  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="px-5 pt-2 pb-4 flex items-center gap-3 border-b border-border flex-shrink-0">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center border border-border">
          <ChevronLeft size={18} strokeWidth={2}/>
        </button>
        <p className="text-foreground text-sm" style={{ fontWeight:600 }}>Help & Support</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth:"none" }}>
        <p className="text-muted-foreground mb-4" style={{ fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase" }}>Frequently asked questions</p>
        <div className="flex flex-col gap-2 mb-5">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
              <button onClick={() => setExpandedFaq(expandedFaq === i ? null : i)} className="w-full text-left px-4 py-3.5 flex items-center justify-between">
                <p className="text-foreground text-sm pr-3" style={{ fontWeight:500 }}>{faq.q}</p>
                <ChevronRight size={14} strokeWidth={2} className={`flex-shrink-0 text-muted-foreground transition-transform ${expandedFaq===i ? "rotate-90" : ""}`}/>
              </button>
              {expandedFaq === i && (
                <div className="px-4 pb-3.5 border-t border-border">
                  <p className="text-muted-foreground text-sm mt-3 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 mb-3">
          <p className="text-foreground text-sm mb-1" style={{ fontWeight:600 }}>Still need help?</p>
          <p className="text-muted-foreground mb-3" style={{ fontSize:12 }}>Our support team is available Mon–Sat, 9 AM to 6 PM.</p>
          <button className="w-full py-3 rounded-xl text-white text-sm flex items-center justify-center gap-2" style={{ background: DARK, fontWeight:500 }}>
            <Headphones size={15} strokeWidth={1.5}/> Contact customer care
          </button>
        </div>
        <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-3">
          <Phone size={14} strokeWidth={1.5} className="text-muted-foreground flex-shrink-0"/>
          <div>
            <p className="text-foreground" style={{ fontSize:12, fontWeight:500 }}>Call us directly</p>
            <p className="text-muted-foreground" style={{ fontSize:11 }}>+91 98765 00000 · Available 9 AM – 6 PM</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab items (4 tabs — no Inbox) ────────────────────────────────────────────
const tabItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id:"home",    label:"Home",     icon:<Home      size={20} strokeWidth={1.5}/> },
  { id:"order",   label:"Quote",    icon:<PlusCircle size={20} strokeWidth={1.5}/> },
  { id:"track",   label:"Requests", icon:<MapPin    size={20} strokeWidth={1.5}/> },
  { id:"account", label:"Account",  icon:<User      size={20} strokeWidth={1.5}/> },
];
const tabTitleMap: Record<Tab, string> = { home:"", order:"Request Quote", track:"My Requests", account:"Account" };

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [authStep, setAuthStep]               = useState<"login" | "onboarding" | "app">("login");
  const [activeTab, setActiveTab]             = useState<Tab>("home");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNewOrder, setShowNewOrder]       = useState(false);
  const [showRatingPopup, setShowRatingPopup] = useState(false);
  const [ratingVal, setRatingVal]             = useState(0);
  const [ratingFeedback, setRatingFeedback]   = useState("");
  const [ratingDone, setRatingDone]           = useState(false);
  const [targetOrderId, setTargetOrderId]     = useState<string | null>(null);
  const [userProfile, setUserProfile]         = useState<UserProfile>({ name:"", avatar:null, accountType:"personal" });
  const [showHelp, setShowHelp]               = useState(false);

  function handleNavigate(tab: Tab, orderId?: string) {
    setActiveTab(tab);
    setTargetOrderId(orderId ?? null);
  }
  function handleOrderSubmitted() {
    setShowNewOrder(true);
    setActiveTab("track");
    setTimeout(() => setShowRatingPopup(true), 800);
  }
  function handleNotifNavigate(tab: string, orderId?: string) {
    setShowNotifications(false);
    setActiveTab(tab as Tab);
    setTargetOrderId(orderId ?? null);
  }
  function handleContactAdmin() {
    // Internally call admin
    alert("Calling admin: +91 98765 00000");
  }
  function handleSignOut() {
    setAuthStep("login");
    setActiveTab("home");
    setShowNotifications(false);
    setShowNewOrder(false);
    setShowRatingPopup(false);
    setRatingVal(0);
    setRatingFeedback("");
    setRatingDone(false);
    setTargetOrderId(null);
    setShowHelp(false);
    setUserProfile({ name:"", avatar:null, accountType:"personal" });
  }

  // ── Auth screens ──────────────────────────────────────────────────────────
  if (authStep === "login") {
    return (
      <div className="size-full flex items-center justify-center" style={{ fontFamily:"DM Sans, system-ui, sans-serif", background:"var(--secondary)" }}>
        <div className="flex flex-col overflow-hidden" style={{ position:"relative", width:375, height:812, borderRadius:44, background:"var(--background)", border:"1px solid rgba(0,0,0,0.08)", boxShadow:"0 40px 80px rgba(0,0,0,0.18)" }}>
          <StatusBar/>
          <LoginScreen onLogin={() => setAuthStep("onboarding")}/>
        </div>
      </div>
    );
  }

  if (authStep === "onboarding") {
    return (
      <div className="size-full flex items-center justify-center" style={{ fontFamily:"DM Sans, system-ui, sans-serif", background:"var(--secondary)" }}>
        <div className="flex flex-col overflow-hidden" style={{ position:"relative", width:375, height:812, borderRadius:44, background:"var(--background)", border:"1px solid rgba(0,0,0,0.08)", boxShadow:"0 40px 80px rgba(0,0,0,0.18)" }}>
          <StatusBar/>
          <OnboardingScreen onComplete={p => { setUserProfile(p); setAuthStep("app"); }}/>
        </div>
      </div>
    );
  }

  return (
    <div className="size-full flex items-center justify-center" style={{ fontFamily:"DM Sans, system-ui, sans-serif", background:"var(--secondary)" }}>
      <div className="flex flex-col overflow-hidden" style={{ position:"relative", width:375, height:812, borderRadius:44, background:"var(--background)", border:"1px solid rgba(0,0,0,0.08)", boxShadow:"0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)" }}>
        <StatusBar/>

        {/* Sub-page header (non-home tabs) */}
        {activeTab !== "home" && !showHelp && (
          <div className="px-5 pt-1 pb-3 flex items-center justify-between border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-foreground/25 text-xs" style={{ letterSpacing:"0.1em", textTransform:"uppercase" }}>FabricLink</span>
              <span className="text-border">·</span>
              <span className="text-foreground text-sm" style={{ fontWeight:600 }}>{tabTitleMap[activeTab]}</span>
            </div>
            <button onClick={() => setShowNotifications(true)} className="w-8 h-8 rounded-full bg-card flex items-center justify-center border border-border relative">
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
                  targetOrderId={targetOrderId}
                  accountType={userProfile.accountType}
                  onMessageCoordinator={handleContactAdmin}
                  onReorder={() => setActiveTab("order")}
                />
              )}
              {activeTab === "account" && (
                <AccountTab
                  onNavigate={(tab) => setActiveTab(tab as Tab)}
                  profile={userProfile}
                  onProfileUpdate={setUserProfile}
                  onSignOut={handleSignOut}
                />
              )}
            </>
          )}
        </div>

        {/* Bottom nav — 4 tabs */}
        <div className="flex-shrink-0 flex items-center px-2 border-t border-border relative" style={{ paddingTop:8, paddingBottom:22, background:"rgba(248,247,245,0.96)", backdropFilter:"blur(16px)" }}>
          {tabItems.map(tab => {
            const active = activeTab === tab.id && !showHelp;
            return (
              <button key={tab.id} onClick={() => { setShowHelp(false); setActiveTab(tab.id); }} className="flex-1 flex flex-col items-center gap-0.5 py-1">
                <span className={active ? "text-foreground" : "text-muted-foreground"}>{tab.icon}</span>
                <span className={active ? "text-foreground" : "text-muted-foreground"} style={{ fontSize:10, fontWeight:active ? 500 : 400 }}>{tab.label}</span>
                {active ? <span className="w-1 h-1 rounded-full bg-foreground mt-0.5"/> : <span className="w-1 h-1 mt-0.5"/>}
              </button>
            );
          })}
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 rounded-full bg-foreground/20 pointer-events-none"/>
        </div>

        {/* Notifications overlay */}
        {showNotifications && (
          <NotificationsScreen onClose={() => setShowNotifications(false)} onNavigate={handleNotifNavigate}/>
        )}

        {/* Rating popup */}
        {showRatingPopup && !ratingDone && (
          <div className="absolute inset-0 z-50 flex flex-col justify-end" style={{ background:"rgba(0,0,0,0.5)" }} onClick={() => setShowRatingPopup(false)}>
            <div className="bg-background rounded-t-3xl px-5 py-6" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4"/>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <Package size={20} className="text-emerald-500" strokeWidth={1.5}/>
                </div>
                <div>
                  <p className="text-foreground text-sm" style={{ fontWeight:600 }}>How was your order?</p>
                  <p className="text-muted-foreground" style={{ fontSize:11 }}>#FL-2035 · Cotton Jersey — White</p>
                </div>
              </div>
              <div className="flex justify-center mb-4">
                {[1,2,3,4,5].map(i => (
                  <button key={i} onClick={() => setRatingVal(i)} style={{ background:"none", border:"none", cursor:"pointer", padding:3 }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill={(ratingVal>=i) ? ACCENT : "none"} stroke={(ratingVal>=i) ? ACCENT : "rgba(0,0,0,0.2)"} strokeWidth="1.5">
                      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
                    </svg>
                  </button>
                ))}
              </div>
              {ratingVal > 0 && (
                <textarea value={ratingFeedback} onChange={e => setRatingFeedback(e.target.value)}
                  placeholder="Tell us about the quality, delivery, coordinator service…"
                  className="w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none resize-none h-16 mb-3"
                  style={{ fontFamily:"DM Sans, sans-serif" }}/>
              )}
              <button onClick={() => { if (ratingVal > 0) { setRatingDone(true); setShowRatingPopup(false); } }}
                disabled={ratingVal === 0} className="w-full rounded-2xl py-3.5 text-sm"
                style={{ background: ratingVal>0 ? ACCENT : "#e5e7eb", color: ratingVal>0 ? "#fff" : "#9ca3af", fontWeight:500, border:"none", cursor: ratingVal>0 ? "pointer" : "default" }}>
                {ratingVal > 0 ? "Submit feedback" : "Tap a star to rate"}
              </button>
              <button onClick={() => setShowRatingPopup(false)} className="w-full text-center text-muted-foreground text-xs mt-3" style={{ background:"none", border:"none", cursor:"pointer" }}>
                Maybe later
              </button>
              <div style={{ height:16 }}/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
