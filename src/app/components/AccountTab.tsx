import React, { useState, useRef, useEffect } from "react";
import {
  ChevronRight, ChevronDown, Building2, MapPin, CreditCard, Clock, FileText,
  Bell, ShieldCheck, LogOut, ArrowLeft, Camera, Check,
  Navigation, Plus, Trash2, Shield, Smartphone, Key, Edit3, Pencil,
  RotateCcw, Package, BookOpen, GraduationCap, Heart, Factory,
  Utensils, Trophy, Landmark, Users, AlertTriangle, Lock,
} from "lucide-react";
import {
  account as accountApi,
  support as supportApi,
  coordinator as coordinatorApi,
  type PaymentMethod as ApiPaymentMethod,
  type Address as ApiAddress,
  type SupportTicket,
  type Coordinator,
} from "../../lib/api";

const ACCENT      = "#C8A97E";
const ACCENT_BG   = "rgba(200,169,126,0.12)";
const DARK        = "#0D0D0D";
// Shared input class — consistent across all modules
const INP = "w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none";
const fnt: React.CSSProperties = { fontFamily: "DM Sans, sans-serif" };
// City names in India are alphabetic — strip digits and stray symbols as the user types.
const sanitizeCity = (v: string) => v.replace(/[^A-Za-z\s.'-]/g, "");

// Format a canonical "+91XXXXXXXXXX" number for display as "+91 98765 43210"
function fmtPhone(canonical: string): string {
  const d = canonical.replace(/^\+91/, "").replace(/\D/g, "").slice(0, 10);
  const a = d.slice(0, 5), b = d.slice(5, 10);
  return "+91" + (a ? " " + a : "") + (b ? " " + b : "");
}
const phoneDigits = (v: string) => v.replace(/^\+91\s*/, "").replace(/\D/g, "");
// Shared button styles
const btnPrimary: React.CSSProperties = {
  width:"100%", background:DARK, color:"#fff",
  borderRadius:20, padding:"14px 20px", fontSize:14,
  fontWeight:500, border:"none", cursor:"pointer",
  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
};
const btnSecondary: React.CSSProperties = {
  width:"100%", background:"var(--muted)", color:"var(--foreground)",
  borderRadius:20, padding:"14px 20px", fontSize:14,
  fontWeight:500, border:"1px solid var(--border)", cursor:"pointer",
  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
};
const btnAccent: React.CSSProperties = { ...btnPrimary, background: ACCENT };

export type UserProfile = { name: string; avatar: string | null; accountType?: "personal" | "organisation"; orgName?: string; orgType?: string; gstNumber?: string; phone?: string; email?: string; twoFAEnabled?: boolean };

type Screen =
  | "main" | "profile" | "business" | "delivery" | "payment"
  | "order_history" | "order_detail" | "tech_packs"
  | "notifications_settings" | "security" | "two_fa_setup"
  | "help_support" | "faq" | "terms" | "payment_gateway" | "privacy";

// ─── Sub-screen shell ─────────────────────────────────────────────────────────
function SubScreen({ title, sub, onBack, action, children }: {
  title: string; sub?: string; onBack: () => void;
  action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border flex-shrink-0">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <ArrowLeft size={15} strokeWidth={1.5}/>
        </button>
        <div className="flex-1">
          <p className="text-foreground text-sm" style={{ fontWeight: 600 }}>{title}</p>
          {sub && <p className="text-muted-foreground" style={{ fontSize: 11 }}>{sub}</p>}
        </div>
        {action}
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0" style={{ scrollbarWidth:"none" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Profile Edit ─────────────────────────────────────────────────────────────
function ProfileEdit({ profile, onBack, onSave }: {
  profile: UserProfile; onBack: () => void; onSave: (p: UserProfile) => void;
}) {
  const [name, setName]     = useState(profile.name);
  const [phone, setPhone]   = useState(profile.phone ?? "+91 98765 43210");
  const [email, setEmail]   = useState(profile.email ?? "");
  const [avatar, setAvatar] = useState<string | null>(profile.avatar);
  const fileRef             = useRef<HTMLInputElement>(null);
  const [saved, setSaved]   = useState(false);

  function handleSave() {
    onSave({ ...profile, name, avatar, phone, email });
    setSaved(true);
    setTimeout(() => { setSaved(false); onBack(); }, 900);
  }

  return (
    <SubScreen title="Edit profile" onBack={onBack}>
      {/* Avatar */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative w-20 h-20 rounded-full flex items-center justify-center mb-2" style={{ background: avatar ? undefined : ACCENT }}>
          {avatar
            ? <img src={avatar} alt="Avatar" className="w-full h-full rounded-full object-cover"/>
            : <span className="text-white text-xl" style={{ fontWeight: 700 }}>{name.split(" ").map(w => w[0]).join("").slice(0,2)}</span>
          }
          <button onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-foreground flex items-center justify-center border-2 border-background">
            <Camera size={12} color="#fff" strokeWidth={1.5}/>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) setAvatar(URL.createObjectURL(f)); }}/>
        </div>
        <p className="text-muted-foreground text-xs">Tap camera icon to update photo</p>
      </div>

      <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Full name</p>
      <input value={name} onChange={e => setName(e.target.value)} className={INP + " block"} style={fnt}/>
      {name && /\d/.test(name) && <p className="flex items-center gap-1 mt-1 mb-2" style={{ fontSize:10, color:"#dc2626" }}><AlertTriangle size={10}/>Name cannot contain numbers</p>}
      <div className="mb-3"/>

      <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Mobile number</p>
      <input value={fmtPhone(phone)}
        onChange={e => setPhone("+91" + phoneDigits(e.target.value).slice(0,10))}
        onKeyDown={e => { if ((e.key==="Backspace"||e.key==="Delete") && phoneDigits(phone).length===0) e.preventDefault(); }}
        placeholder="+91 98765 43210" inputMode="tel" maxLength={16} className={INP + " block"} style={fnt}/>
      {phoneDigits(phone).length > 0 && !/^[6-9]\d{9}$/.test(phoneDigits(phone)) && <p className="flex items-center gap-1 mt-1 mb-2" style={{ fontSize:10, color:"#dc2626" }}><AlertTriangle size={10}/>Enter 10 digits after +91 (start with 6-9)</p>}
      <div className="mb-3"/>

      <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Email address</p>
      <input value={email} onChange={e => setEmail(e.target.value)} inputMode="email" placeholder="you@example.com" className={INP + " block"} style={fnt}/>
      {email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) && <p className="flex items-center gap-1 mt-1 mb-2" style={{ fontSize:10, color:"#dc2626" }}><AlertTriangle size={10}/>Enter a valid email address</p>}
      <div className="mb-4"/>

      <button onClick={handleSave}
        style={saved
          ? { ...btnPrimary, background:"#e8f5e9", color:"#2e7d32" }
          : btnPrimary}>
        {saved ? <><Check size={15} strokeWidth={2}/> Profile updated!</> : "Save changes"}
      </button>
    </SubScreen>
  );
}

// ─── Business Details (save → view → edit) ────────────────────────────────────
export const orgTypeDefs = [
  { id:"school",       Icon: BookOpen,     label:"School"        },
  { id:"college",      Icon: GraduationCap,label:"College"       },
  { id:"corporate",    Icon: Building2,    label:"Corporate"     },
  { id:"hospital",     Icon: Heart,        label:"Hospital"      },
  { id:"industry",     Icon: Factory,      label:"Industry"      },
  { id:"hospitality",  Icon: Utensils,     label:"Hotel"         },
  { id:"sports",       Icon: Trophy,       label:"Sports Club"   },
  { id:"government",   Icon: Landmark,     label:"Government"    },
  { id:"ngo",          Icon: Users,        label:"NGO / Trust"   },
];

interface BizData { orgType:string; name:string; reg:string; addr1:string; addr2:string; landmark:string; location:string; city:string; pin:string }

// The "registration" field means something different for every organisation type, so a
// single generic label/placeholder (e.g. always showing "CBSE, NABH, CIN") is confusing
// for anyone who isn't a school. This maps each org type to wording that actually fits it.
const regFieldByOrgType: Record<string, { label: string; placeholder: string }> = {
  school:      { label: "Board / Affiliation",         placeholder: "e.g. CBSE, ICSE, State Board" },
  college:     { label: "University / Affiliation",     placeholder: "e.g. Affiliated university, UGC code" },
  corporate:   { label: "Registration number",          placeholder: "e.g. CIN, GSTIN" },
  hospital:    { label: "Accreditation",                placeholder: "e.g. NABH, NABL" },
  industry:    { label: "Registration number",          placeholder: "e.g. CIN, GSTIN, factory license" },
  hospitality: { label: "Registration / License",       placeholder: "e.g. FSSAI, trade license" },
  sports:      { label: "Affiliation",                  placeholder: "e.g. State or national federation" },
  government:  { label: "Department / Notification",    placeholder: "e.g. Department code, G.O. number" },
  ngo:         { label: "Registration",                 placeholder: "e.g. 12A, 80G, trust reg. no." },
};
const defaultRegField = { label: "Registration / Board / Affiliation", placeholder: "e.g. CBSE, NABH, CIN" };

// Custom org-type dropdown with per-option icons (native <select> can't render icons).
// value="" (or unmatched) shows a neutral placeholder, so it can be used as a required,
// not-yet-answered field (e.g. onboarding) as well as an always-set field (Account edit).
export function OrgTypeSelect({ value, onChange, placeholder = "Select organisation type" }: { value:string; onChange:(v:string)=>void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const cur = orgTypeDefs.find(t => t.id === value);
  const CurIcon = cur?.Icon ?? Building2;
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 bg-card border border-border rounded-xl px-3 py-2.5"
        style={{ cursor:"pointer" }}>
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <CurIcon size={16} strokeWidth={1.5} style={{ color: cur ? ACCENT : "#9ca3af" }}/>
        </div>
        <span className="flex-1 text-left text-sm" style={{ fontWeight:500, color: cur ? "var(--foreground)" : "var(--muted-foreground)" }}>{cur ? cur.label : placeholder}</span>
        <ChevronDown size={15} strokeWidth={1.8} style={{ color:"#6b7280", transform: open ? "rotate(180deg)" : "none", transition:"transform .18s" }}/>
      </button>
      {/* In-flow expanding list — never clipped by the surrounding card */}
      {open && (
        <div className="mt-1.5 rounded-xl bg-card border border-border overflow-hidden" style={{ maxHeight:300, overflowY:"auto" }}>
          {orgTypeDefs.map((t, i) => {
            const Ic = t.Icon; const sel = t.id === value;
            return (
              <button key={t.id} type="button" onClick={() => { onChange(t.id); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                style={{ background: sel ? ACCENT_BG : "transparent", border:"none", borderBottom: i < orgTypeDefs.length - 1 ? "1px solid var(--border)" : "none", cursor:"pointer" }}>
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Ic size={16} strokeWidth={1.5} style={{ color: sel ? ACCENT : "var(--muted-foreground)" }}/>
                </div>
                <span className="flex-1 text-foreground text-sm" style={{ fontWeight: sel ? 600 : 500 }}>{t.label}</span>
                {sel && <Check size={15} style={{ color:ACCENT, flexShrink:0 }} strokeWidth={2.5}/>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Payment & Billing ────────────────────────────────────────────────────────
export type UpiProvider = "gpay" | "phonepe" | "paytm" | "bhim";
interface UpiMethod  { id:string; provider:UpiProvider; address:string; default:boolean }
interface SavedCard  { id:string; type:"credit"|"debit"; network:"visa"|"mastercard"|"rupay"; last4:string; name:string; expiry:string; default:boolean }

// Split the backend's flat paymentMethods list into the two shapes this screen renders.
function splitPaymentMethods(pms: ApiPaymentMethod[]): { upis: UpiMethod[]; cards: SavedCard[] } {
  const upis = pms.filter(m => m.type === "upi" && m.upiId).map(m => ({
    id: m._id!, provider: (m.upiProvider as UpiProvider) || "gpay", address: m.upiId!, default: !!m.isDefault,
  }));
  const cards = pms.filter(m => m.type === "card").map(m => ({
    id: m._id!, type: m.cardType || "credit", network: m.cardNetwork || "visa",
    last4: m.cardLast4 || "0000", name: m.cardHolderName || "", expiry: m.cardExpiry || "", default: !!m.isDefault,
  }));
  return { upis, cards };
}

export const upiProviderDefs: Record<UpiProvider, { label:string }> = {
  gpay:    { label:"Google Pay" },
  phonepe: { label:"PhonePe"    },
  paytm:   { label:"Paytm"      },
  bhim:    { label:"BHIM UPI"   },
};

// ─── Branded payment marks (self-contained SVG, no external assets) ────────────
export function UpiLogo({ provider, size=32 }: { provider:UpiProvider; size?:number }) {
  const tile = (bg:string, border?:string): React.CSSProperties => ({
    width:size, height:size, borderRadius:size*0.26, background:bg,
    display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
    border: border ?? "none",
  });
  const g = size * 0.6;

  if (provider === "gpay") {
    return (
      <div style={tile("#fff", "1px solid #ececf0")}>
        <svg width={g} height={g} viewBox="0 0 24 24" aria-label="Google Pay">
          <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.86c2.26-2.08 3.57-5.15 3.57-8.87Z"/>
          <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.86-3c-1.08.72-2.45 1.16-4.09 1.16-3.13 0-5.78-2.11-6.73-4.96H1.3v3.09A12 12 0 0 0 12 24Z"/>
          <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.3A12 12 0 0 0 0 12c0 1.94.46 3.77 1.3 5.38l3.97-3.09Z"/>
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.3 6.62l3.97 3.09C6.22 6.86 8.87 4.75 12 4.75Z"/>
        </svg>
      </div>
    );
  }
  if (provider === "phonepe") {
    return (
      <div style={tile("#5f259f")}>
        <svg width={g} height={g} viewBox="0 0 24 24" aria-label="PhonePe">
          <path fill="#fff" d="M17.2 7.2a.85.85 0 0 0-.85-.85h-2.2l-.5-.86a.86.86 0 0 0-.74-.43H9.9c-.3 0-.46.3-.27.51l.62.78H6.85c-.24 0-.43.19-.43.43v.86c0 .24.19.43.43.43h1.3v2.84c0 1.96 1 3.1 2.72 3.1.53 0 .98-.07 1.5-.27v1.96c0 .55-.45 1-1 1h-.43c-.24 0-.43.2-.43.43v1.2c0 .23.19.43.43.43h1.07a2.57 2.57 0 0 0 2.57-2.57V9.27h1.4c.24 0 .43-.19.43-.43v-.78ZM12.4 11.9c-.3.13-.6.18-.9.18-.74 0-1.13-.4-1.13-1.27V8.07h2.45v3.4c-.13.13-.3.26-.42.43Z"/>
        </svg>
      </div>
    );
  }
  if (provider === "paytm") {
    return (
      <div style={tile("#fff", "1px solid #ececf0")}>
        <svg width={size*0.82} height={size*0.42} viewBox="0 0 64 26" aria-label="Paytm">
          <text x="0" y="20" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="22" letterSpacing="-1">
            <tspan fill="#00BAF2">Pay</tspan><tspan fill="#002970">tm</tspan>
          </text>
        </svg>
      </div>
    );
  }
  // bhim / generic UPI mark
  return (
    <div style={tile("#fff", "1px solid #ececf0")}>
      <svg width={size*0.78} height={size*0.46} viewBox="0 0 60 30" aria-label="UPI">
        <path d="M14 4 L24 4 L17 26 L7 26 Z" fill="#E97B27"/>
        <path d="M22 4 L32 4 L25 26 L15 26 Z" fill="#5BB948"/>
        <text x="34" y="20" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="15" fill="#0F4C81">UPI</text>
      </svg>
    </div>
  );
}

function CardNetworkLogo({ network, size=1 }: { network:SavedCard["network"]; size?:number }) {
  const w = 44 * size, h = 28 * size;
  if (network === "visa") {
    return (
      <div style={{ width:w, height:h, borderRadius:5*size, background:"#fff", border:"1px solid #ececf0", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <svg width={w*0.72} height={h*0.5} viewBox="0 0 64 22" aria-label="Visa">
          <text x="2" y="18" fontFamily="Arial, sans-serif" fontStyle="italic" fontWeight="800" fontSize="20" letterSpacing="0.5" fill="#1A1F71">VISA</text>
        </svg>
      </div>
    );
  }
  if (network === "mastercard") {
    return (
      <div style={{ width:w, height:h, borderRadius:5*size, background:"#fff", border:"1px solid #ececf0", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <svg width={h*0.82} height={h*0.6} viewBox="0 0 36 22" aria-label="Mastercard">
          <circle cx="13" cy="11" r="10" fill="#EB001B"/>
          <circle cx="23" cy="11" r="10" fill="#F79E1B"/>
          <path d="M18 3.2a10 10 0 0 0 0 15.6 10 10 0 0 0 0-15.6Z" fill="#FF5F00"/>
        </svg>
      </div>
    );
  }
  // rupay
  return (
    <div style={{ width:w, height:h, borderRadius:5*size, background:"#fff", border:"1px solid #ececf0", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
      <svg width={w*0.82} height={h*0.5} viewBox="0 0 70 20" aria-label="RuPay">
        <text x="1" y="16" fontFamily="Arial, sans-serif" fontStyle="italic" fontWeight="800" fontSize="16">
          <tspan fill="#E97B27">Ru</tspan><tspan fill="#0F7A3D">Pay</tspan>
        </text>
      </svg>
    </div>
  );
}

function PaymentBillingScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<"upi"|"cards">("upi");
  const [loadErr, setLoadErr] = useState("");

  // ── UPI state ──
  const [upis, setUpis]           = useState<UpiMethod[]>([]);
  const [addingUpi, setAddingUpi] = useState(false);
  const [upiProvider, setUpiProvider] = useState<UpiProvider>("gpay");
  const [upiAddr, setUpiAddr]     = useState("");
  const [upiErr, setUpiErr]       = useState("");
  const [savingUpi, setSavingUpi] = useState(false);

  // ── Cards state ──
  const [cards, setCards]           = useState<SavedCard[]>([]);
  const [addingCard, setAddingCard] = useState(false);
  const [cardType, setCardType]     = useState<"credit"|"debit">("credit");
  const [cardNetwork, setCardNetwork] = useState<SavedCard["network"]>("visa");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName]     = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv]       = useState("");
  const [cardErr, setCardErr]       = useState("");
  const [savingCard, setSavingCard] = useState(false);

  // Load real saved methods from the backend on open.
  useEffect(() => {
    let cancelled = false;
    accountApi.getPayment()
      .then(res => { if (!cancelled) { const { upis, cards } = splitPaymentMethods(res.paymentMethods || []); setUpis(upis); setCards(cards); } })
      .catch(err => { if (!cancelled) setLoadErr(err instanceof Error ? err.message : "Couldn't load saved payment methods"); });
    return () => { cancelled = true; };
  }, []);

  async function saveUpi() {
    const v = upiAddr.trim();
    if (!v) { setUpiErr("Enter your UPI ID"); return; }
    if (!/^[\w.\-]+@[\w]+$/.test(v)) { setUpiErr("Invalid UPI ID (e.g. name@okicici)"); return; }
    if (upis.some(u => u.address.toLowerCase() === v.toLowerCase())) { setUpiErr("This UPI ID is already saved"); return; }
    setSavingUpi(true);
    try {
      const res = await accountApi.addPayment({ type:"upi", upiId:v, upiProvider, isDefault: upis.length===0 });
      setUpis(splitPaymentMethods(res.paymentMethods).upis);
      setAddingUpi(false); setUpiAddr(""); setUpiErr(""); setUpiProvider("gpay");
    } catch (err) {
      setUpiErr(err instanceof Error ? err.message : "Couldn't save UPI ID. Try again.");
    } finally {
      setSavingUpi(false);
    }
  }
  async function makeUpiDefault(id: string) {
    try { const res = await accountApi.setDefaultPayment(id); setUpis(splitPaymentMethods(res.paymentMethods).upis); } catch { /* best-effort */ }
  }
  async function removeUpi(id: string) {
    try { const res = await accountApi.deletePayment(id); setUpis(splitPaymentMethods(res.paymentMethods).upis); } catch { /* best-effort */ }
  }

  function formatCardNumber(v: string) {
    const digits = v.replace(/\D/g,"").slice(0,16);
    return digits.replace(/(.{4})/g,"$1 ").trim();
  }
  function formatExpiry(v: string) {
    const digits = v.replace(/\D/g,"").slice(0,4);
    return digits.length > 2 ? digits.slice(0,2)+"/"+digits.slice(2) : digits;
  }
  async function saveCard() {
    const digits = cardNumber.replace(/\s/g,"");
    if (digits.length !== 16)               { setCardErr("Enter full 16-digit card number"); return; }
    if (!cardName.trim())                   { setCardErr("Enter name on card"); return; }
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) { setCardErr("Enter expiry as MM/YY"); return; }
    if (cardCvv.length < 3)                 { setCardErr("Enter CVV (3 digits)"); return; }
    setSavingCard(true);
    try {
      // Only last4 + non-sensitive metadata ever leaves this device — the full
      // card number and CVV are used for on-screen validation only and dropped here.
      const res = await accountApi.addPayment({
        type: "card", cardType, cardNetwork: cardNetwork, cardLast4: digits.slice(-4),
        cardHolderName: cardName.trim(), cardExpiry, isDefault: cards.length===0,
      });
      setCards(splitPaymentMethods(res.paymentMethods).cards);
      setAddingCard(false); setCardNumber(""); setCardName(""); setCardExpiry(""); setCardCvv(""); setCardErr("");
    } catch (err) {
      setCardErr(err instanceof Error ? err.message : "Couldn't save card. Try again.");
    } finally {
      setSavingCard(false);
    }
  }
  async function makeCardDefault(id: string) {
    try { const res = await accountApi.setDefaultPayment(id); setCards(splitPaymentMethods(res.paymentMethods).cards); } catch { /* best-effort */ }
  }
  async function removeCard(id: string) {
    try { const res = await accountApi.deletePayment(id); setCards(splitPaymentMethods(res.paymentMethods).cards); } catch { /* best-effort */ }
  }

  const defaultUpi  = upis.find(u => u.default);
  const defaultCard = cards.find(c => c.default);
  const hasAny      = upis.length > 0 || cards.length > 0;

  const tabs = [
    { id:"upi" as const,   label:"UPI / Wallets",        count: upis.length  },
    { id:"cards" as const, label:"Credit / Debit Card",  count: cards.length },
  ];

  return (
    <SubScreen title="Payments" sub="UPI apps & saved cards" onBack={onBack}>
      {loadErr && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-4" style={{ background:"rgba(220,38,38,0.06)", border:"1px solid rgba(220,38,38,0.2)" }}>
          <AlertTriangle size={13} style={{ color:"#dc2626", flexShrink:0 }}/>
          <p style={{ fontSize:11, color:"#dc2626" }}>{loadErr}</p>
        </div>
      )}
      {/* ── Default method hero ── */}
      <div className="rounded-2xl p-4 mb-5 relative overflow-hidden" style={{ background:DARK }}>
        <div className="absolute -right-6 -top-8 w-28 h-28 rounded-full" style={{ background:"rgba(200,169,126,0.18)" }}/>
        <div className="relative">
          <p style={{ fontSize:10, letterSpacing:1, textTransform:"uppercase", color:"rgba(255,255,255,0.55)", fontWeight:600 }}>Default payment method</p>
          {defaultUpi ? (
            <div className="flex items-center gap-3 mt-2.5">
              <UpiLogo provider={defaultUpi.provider} size={36}/>
              <div className="min-w-0">
                <p style={{ fontSize:14, fontWeight:700, color:"#fff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{defaultUpi.address}</p>
                <p style={{ fontSize:11, color:"rgba(255,255,255,0.6)" }}>{upiProviderDefs[defaultUpi.provider].label}</p>
              </div>
            </div>
          ) : defaultCard ? (
            <div className="flex items-center gap-3 mt-2.5">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:"linear-gradient(135deg,#d4af37,#f5e47e)" }}>
                <CreditCard size={18} color={DARK} strokeWidth={1.8}/>
              </div>
              <div className="min-w-0">
                <p style={{ fontSize:14, fontWeight:700, color:"#fff", fontFamily:"monospace", letterSpacing:1 }}>•••• {defaultCard.last4}</p>
                <p style={{ fontSize:11, color:"rgba(255,255,255,0.6)" }}>{defaultCard.type==="credit"?"Credit":"Debit"} · {defaultCard.name}</p>
              </div>
            </div>
          ) : (
            <p style={{ fontSize:13, color:"rgba(255,255,255,0.8)", marginTop:8, lineHeight:1.5 }}>
              No payment method yet. Add a UPI ID or card below — your first one becomes the default.
            </p>
          )}
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5"
            style={{ background: tab===t.id ? DARK : "var(--muted)", color: tab===t.id ? "#fff" : "var(--muted-foreground)", fontWeight: tab===t.id ? 600 : 400, border:"none", cursor:"pointer" }}>
            {t.label}
            {t.count > 0 && (
              <span style={{ fontSize:10, fontWeight:700, minWidth:16, height:16, padding:"0 4px", borderRadius:8, display:"inline-flex", alignItems:"center", justifyContent:"center", background: tab===t.id ? "rgba(255,255,255,0.2)" : "var(--border)", color: tab===t.id ? "#fff" : "var(--foreground)" }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════ UPI TAB ══════════════ */}
      {tab === "upi" && (
        <>
          {/* Quick-pay UPI apps */}
          <p className="text-muted-foreground mb-2" style={{ fontSize:12, fontWeight:500 }}>Pay instantly via</p>
          <div className="grid grid-cols-4 gap-2 mb-5">
            {(Object.keys(upiProviderDefs) as UpiProvider[]).map(key => (
              <button key={key}
                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl border border-border bg-card transition-transform active:scale-95"
                style={{ cursor:"pointer" }}
                onClick={() => {
                  const links: Record<UpiProvider,string> = { gpay:"gpay://upi/pay", phonepe:"phonepe://pay", paytm:"paytmmp://pay", bhim:"bhim://pay" };
                  alert(`Redirecting to ${upiProviderDefs[key].label}…\n(Deep-link: ${links[key]})`);
                }}>
                <UpiLogo provider={key} size={34}/>
                <span style={{ fontSize:10, fontWeight:500, color:"var(--foreground)" }}>{upiProviderDefs[key].label.split(" ")[0]}</span>
              </button>
            ))}
          </div>

          {/* Saved UPI IDs */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-muted-foreground" style={{ fontSize:12, fontWeight:500 }}>Linked UPI IDs</p>
            {upis.length > 0 && <span className="text-muted-foreground" style={{ fontSize:11 }}>{upis.length} saved</span>}
          </div>
          {upis.length === 0 && !addingUpi && (
            <div className="rounded-2xl px-4 py-5 mb-2 text-center" style={{ background:"var(--muted)", border:"1px dashed var(--border)" }}>
              <p className="text-muted-foreground" style={{ fontSize:12 }}>No UPI IDs linked yet.</p>
            </div>
          )}
          {upis.map(u => (
            <div key={u.id} className="bg-card border border-border rounded-2xl p-3.5 mb-2 flex items-center gap-3"
              style={{ borderColor: u.default ? ACCENT : "var(--border)" }}>
              <UpiLogo provider={u.provider} size={32}/>
              <div className="flex-1 min-w-0">
                <p className="text-foreground text-sm" style={{ fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.address}</p>
                <p className="text-muted-foreground" style={{ fontSize:11 }}>{upiProviderDefs[u.provider].label}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {u.default
                  ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:ACCENT_BG, color:"#7c5419", fontWeight:600 }}>Default</span>
                  : <button onClick={() => makeUpiDefault(u.id)} style={{ fontSize:10, color:DARK, fontWeight:600, background:"none", border:"none", cursor:"pointer" }}>Set default</button>}
                <button onClick={() => removeUpi(u.id)} style={{ background:"none", border:"none", cursor:"pointer" }}><Trash2 size={13} className="text-muted-foreground" strokeWidth={1.5}/></button>
              </div>
            </div>
          ))}
          <div className="mb-3"/>

          {/* Add UPI ID form */}
          {addingUpi ? (
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-foreground text-sm" style={{ fontWeight:700 }}>Add UPI ID</p>
                <button onClick={() => { setAddingUpi(false); setUpiErr(""); setUpiAddr(""); }} className="text-muted-foreground text-xs" style={{ background:"none", border:"none", cursor:"pointer" }}>Cancel</button>
              </div>
              <p className="text-muted-foreground mb-2" style={{ fontSize:12 }}>Select app</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {(Object.keys(upiProviderDefs) as UpiProvider[]).map(key => (
                  <button key={key} onClick={() => setUpiProvider(key)}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all"
                    style={{ background: upiProvider===key ? ACCENT_BG : "var(--card)", border:`1.5px solid ${upiProvider===key ? ACCENT : "var(--border)"}`, cursor:"pointer" }}>
                    <UpiLogo provider={key} size={26}/>
                    <span style={{ fontSize:9, fontWeight: upiProvider===key ? 700 : 400 }}>{upiProviderDefs[key].label.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
              <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>UPI ID / VPA *</p>
              <input value={upiAddr} onChange={e => { setUpiAddr(e.target.value); setUpiErr(""); }}
                placeholder="e.g. name@okicici · 98765@ybl" className={INP + " block mb-1"} style={fnt}/>
              {upiErr && <p className="flex items-center gap-1 mb-2" style={{ fontSize:10, color:"#dc2626" }}><AlertTriangle size={10}/>{upiErr}</p>}
              <div className="mb-3"/>
              <button onClick={saveUpi} disabled={savingUpi} style={savingUpi ? { ...btnPrimary, opacity:0.6 } : btnPrimary}>
                <Check size={14} strokeWidth={2}/> {savingUpi ? "Saving…" : "Save UPI ID"}
              </button>
            </div>
          ) : (
            <button onClick={() => setAddingUpi(true)}
              className="w-full border border-dashed border-border rounded-2xl py-4 text-sm text-muted-foreground flex items-center justify-center gap-2"
              style={{ cursor:"pointer", background:"var(--card)" }}>
              <Plus size={14}/> Add UPI ID
            </button>
          )}
        </>
      )}

      {/* ══════════════ CARDS TAB ══════════════ */}
      {tab === "cards" && (
        <>
          {cards.length === 0 && !addingCard && (
            <div className="rounded-2xl px-4 py-6 mb-3 text-center" style={{ background:"var(--muted)", border:"1px dashed var(--border)" }}>
              <CreditCard size={22} strokeWidth={1.5} className="text-muted-foreground mx-auto mb-2"/>
              <p className="text-muted-foreground" style={{ fontSize:12 }}>No cards saved yet.</p>
            </div>
          )}

          {/* Saved cards */}
          {cards.map(c => (
            <div key={c.id} className="rounded-2xl p-4 mb-3 relative overflow-hidden"
              style={{ background: DARK, color:"#fff", minHeight:128, border: c.default ? `1.5px solid ${ACCENT}` : "none" }}>
              <div className="absolute -right-8 -bottom-10 w-32 h-32 rounded-full" style={{ background:"rgba(200,169,126,0.12)" }}/>
              <div className="relative">
                {/* Card chip */}
                <div className="w-8 h-6 rounded mb-3" style={{ background:"linear-gradient(135deg,#d4af37,#f5e47e)", opacity:0.9 }}/>
                <p style={{ fontSize:15, fontWeight:700, letterSpacing:2, fontFamily:"monospace" }}>
                  •••• •••• •••• {c.last4}
                </p>
                <div className="flex items-end justify-between mt-3">
                  <div>
                    <p style={{ fontSize:9, opacity:0.55, textTransform:"uppercase", letterSpacing:1 }}>{c.type === "credit" ? "Credit card" : "Debit card"}</p>
                    <p style={{ fontSize:12, fontWeight:600 }}>{c.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p style={{ fontSize:9, opacity:0.55, textTransform:"uppercase", letterSpacing:1 }}>Expires</p>
                      <p style={{ fontSize:12, fontWeight:600 }}>{c.expiry}</p>
                    </div>
                    <CardNetworkLogo network={c.network}/>
                  </div>
                </div>
              </div>
              {/* Default / delete */}
              <div className="absolute top-3 right-3 flex items-center gap-3">
                {c.default
                  ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:"rgba(200,169,126,0.9)", color:DARK, fontWeight:600 }}>Default</span>
                  : <button onClick={() => makeCardDefault(c.id)} className="text-xs px-2 py-0.5 rounded-full" style={{ background:"rgba(255,255,255,0.18)", color:"#fff", fontWeight:500, border:"none", cursor:"pointer" }}>Set default</button>}
                <button onClick={() => removeCard(c.id)}
                  style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"50%", width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                  <Trash2 size={11} color="#fff" strokeWidth={1.5}/>
                </button>
              </div>
            </div>
          ))}

          {/* Add card form */}
          {addingCard ? (
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-foreground text-sm" style={{ fontWeight:700 }}>Add new card</p>
                <button onClick={() => { setAddingCard(false); setCardErr(""); }} className="text-muted-foreground text-xs" style={{ background:"none", border:"none", cursor:"pointer" }}>Cancel</button>
              </div>

              {/* Credit / Debit toggle */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {(["credit","debit"] as const).map(t => (
                  <button key={t} onClick={() => setCardType(t)} className="py-2 rounded-xl text-sm"
                    style={{ background: cardType===t ? DARK : "var(--muted)", color: cardType===t ? "#fff" : "var(--muted-foreground)", fontWeight: cardType===t ? 600 : 400, border:"none", cursor:"pointer" }}>
                    {t==="credit" ? "Credit Card" : "Debit Card"}
                  </button>
                ))}
              </div>

              {/* Network selector */}
              <p className="text-muted-foreground mb-2" style={{ fontSize:12 }}>Card network</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {(["visa","mastercard","rupay"] as SavedCard["network"][]).map(n => (
                  <button key={n} onClick={() => setCardNetwork(n)}
                    className="py-3 rounded-xl flex items-center justify-center"
                    style={{ background: cardNetwork===n ? ACCENT_BG : "var(--card)", border:`1.5px solid ${cardNetwork===n ? ACCENT : "var(--border)"}`, cursor:"pointer" }}>
                    <CardNetworkLogo network={n}/>
                  </button>
                ))}
              </div>

              {/* Card number */}
              <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Card number *</p>
              <input value={cardNumber} onChange={e => { setCardNumber(formatCardNumber(e.target.value)); setCardErr(""); }}
                placeholder="1234 5678 9012 3456" inputMode="numeric" maxLength={19}
                className={INP + " block mb-3"} style={{ ...fnt, fontFamily:"monospace", letterSpacing:2 }}/>

              {/* Name on card */}
              <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Name on card *</p>
              <input value={cardName} onChange={e => { setCardName(e.target.value.replace(/[^a-zA-Z\s]/g,"")); setCardErr(""); }}
                placeholder="As printed on card" className={INP + " block mb-3"} style={{ ...fnt, textTransform:"uppercase" }}/>

              {/* Expiry + CVV */}
              <div className="grid grid-cols-2 gap-3 mb-1">
                <div>
                  <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Expiry (MM/YY) *</p>
                  <input value={cardExpiry} onChange={e => { setCardExpiry(formatExpiry(e.target.value)); setCardErr(""); }}
                    placeholder="MM/YY" inputMode="numeric" maxLength={5} className={INP} style={{ ...fnt, fontFamily:"monospace" }}/>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>CVV *</p>
                  <input value={cardCvv} onChange={e => { setCardCvv(e.target.value.replace(/\D/g,"").slice(0,4)); setCardErr(""); }}
                    placeholder="•••" inputMode="numeric" maxLength={4} type="password" className={INP} style={{ ...fnt, fontFamily:"monospace" }}/>
                </div>
              </div>

              {cardErr && <p className="flex items-center gap-1 mt-2 mb-1" style={{ fontSize:10, color:"#dc2626" }}><AlertTriangle size={10}/>{cardErr}</p>}
              <div className="mb-4"/>

              {/* Security note */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4" style={{ background:"rgba(13,13,13,0.04)", border:"1px solid var(--border)" }}>
                <Shield size={12} strokeWidth={1.5} className="text-muted-foreground flex-shrink-0"/>
                <p style={{ fontSize:10, color:"var(--muted-foreground)" }}>Your card details are encrypted and stored securely. CVV is never saved.</p>
              </div>

              <button onClick={saveCard} disabled={savingCard} style={savingCard ? { ...btnPrimary, opacity:0.6 } : btnPrimary}>
                <CreditCard size={14}/> {savingCard ? "Saving…" : "Save card securely"}
              </button>
            </div>
          ) : (
            <button onClick={() => setAddingCard(true)}
              className="w-full border border-dashed border-border rounded-2xl py-4 text-sm text-muted-foreground flex items-center justify-center gap-2"
              style={{ cursor:"pointer", background:"var(--card)" }}>
              <Plus size={14}/> Add credit or debit card
            </button>
          )}
        </>
      )}

      {/* Footer note */}
      {hasAny && (
        <div className="flex items-center gap-2 mt-5 px-3 py-2.5 rounded-xl" style={{ background:"rgba(13,13,13,0.04)", border:"1px solid var(--border)" }}>
          <ShieldCheck size={13} strokeWidth={1.5} className="text-muted-foreground flex-shrink-0"/>
          <p style={{ fontSize:10.5, color:"var(--muted-foreground)" }}>Payments are processed over a secure, encrypted connection.</p>
        </div>
      )}
    </SubScreen>
  );
}

function BusinessDetails({ profile, onBack, onSave: onSaveProfile, onContactSupport }: { profile?: UserProfile; onBack: () => void; onSave?: (p: UserProfile) => void; onContactSupport?: () => void }) {
  // Pre-fill from what was entered at onboarding, instead of a hardcoded demo org —
  // and if that's already there, open straight to the view (it's effectively "saved").
  const [mode, setMode]     = useState<"edit"|"view">(profile?.orgName ? "view" : "edit");
  // Organisation type is set once at onboarding and isn't editable here — it's a
  // commercial classification (pricing, catalog, compliance) that only support/admin
  // should change, not something to flip casually mid-relationship. See the read-only
  // card below for where a user is told to go instead (Help & support).
  const orgType = profile?.orgType ?? "";
  const [name, setName]     = useState(profile?.orgName ?? "");
  const [reg, setReg]       = useState("");
  const [addr1, setAddr1]   = useState("");
  const [addr2, setAddr2]   = useState("");
  const [landmark, setLandmark] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity]     = useState("");
  const [pin, setPin]       = useState("");
  const [saved, setSaved]   = useState<BizData | null>(profile?.orgName
    ? { orgType: profile.orgType ?? "", name: profile.orgName, reg: "", addr1: "", addr2: "", landmark: "", location: "", city: "", pin: "" }
    : null);

  function save() {
    const d = { orgType, name, reg, addr1, addr2, landmark, location, city, pin };
    setSaved(d); setMode("view");
    // Keep the shared profile (used across Account, onboarding-derived defaults, and
    // New Order's organisation details) in sync with whatever is edited here.
    onSaveProfile?.({ ...profile, name: profile?.name ?? "", avatar: profile?.avatar ?? null, orgName: name, orgType });
  }

  const orgDef   = orgTypeDefs.find(t => t.id === orgType);
  const OrgIcon  = orgDef?.Icon ?? Building2;
  const orgLabel = orgDef?.label ?? orgType;

  return (
    <SubScreen
      title="Business details"
      sub={mode === "view" ? "Tap Edit to make changes" : "Your organisation profile"}
      onBack={onBack}
      action={mode === "view" ? (
        <button onClick={() => setMode("edit")} className="flex items-center gap-1 text-xs text-foreground px-3 py-1.5 rounded-xl border border-border bg-card" style={{ fontWeight:500 }}>
          <Pencil size={12} strokeWidth={1.5}/> Edit
        </button>
      ) : undefined}
    >
      {/* VIEW mode */}
      {mode === "view" && saved && (
        <div className="flex flex-col gap-3">
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center flex-shrink-0"><OrgIcon size={20} strokeWidth={1.5} style={{ color:"var(--muted-foreground)" }}/></div>
            <div>
              <p className="text-foreground text-sm" style={{ fontWeight:600 }}>{saved.name}</p>
              <p className="text-muted-foreground" style={{ fontSize:11 }}>{orgLabel}</p>
              {saved.reg && <p className="text-muted-foreground" style={{ fontSize:11 }}>{saved.reg}</p>}
            </div>
          </div>
          {(saved.addr1 || saved.city) && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-muted-foreground text-xs mb-2" style={{ fontWeight:500, textTransform:"uppercase", letterSpacing:"0.06em" }}>Address</p>
              {saved.addr1    && <p className="text-foreground text-sm">{saved.addr1}</p>}
              {saved.addr2    && <p className="text-foreground text-sm">{saved.addr2}</p>}
              {saved.landmark && <p className="text-muted-foreground" style={{ fontSize:12 }}>Near {saved.landmark}</p>}
              {saved.location && <p className="text-muted-foreground" style={{ fontSize:12 }}>{saved.location}</p>}
              {saved.city     && <p className="text-foreground text-sm">{saved.city}{saved.pin ? ` — ${saved.pin}` : ""}</p>}
            </div>
          )}
        </div>
      )}

      {/* EDIT mode */}
      {mode === "edit" && (
        <>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Organisation type</p>
          {/* Read-only — org type drives pricing, catalog and compliance, so it's not
              something to change casually from a text field. Changing it goes through
              support so it can be verified and applied correctly on the admin side. */}
          <div className="mb-2 flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-muted border border-border">
            <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center flex-shrink-0 border border-border">
              <OrgIcon size={16} strokeWidth={1.5} style={{ color:"var(--muted-foreground)" }}/>
            </div>
            <p className="text-foreground text-sm flex-1" style={{ fontWeight:600 }}>{orgLabel || "Not set"}</p>
            <Lock size={13} strokeWidth={1.5} className="text-muted-foreground flex-shrink-0"/>
          </div>
          <button onClick={onContactSupport}
            className="mb-4 text-xs text-left"
            style={{ background:"none", border:"none", cursor: onContactSupport ? "pointer" : "default", color:"var(--muted-foreground)", padding:0, textDecoration: onContactSupport ? "underline" : "none" }}>
            Need to change this? Contact Help &amp; support — our team verifies and updates it.
          </button>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Organisation name *</p>
          <input value={name} onChange={e => setName(e.target.value)} className={INP + " mb-3 block"} style={fnt}/>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>{(regFieldByOrgType[orgType] ?? defaultRegField).label}</p>
          <input value={reg} onChange={e => setReg(e.target.value)} placeholder={(regFieldByOrgType[orgType] ?? defaultRegField).placeholder} className={INP + " mb-3 block"} style={fnt}/>

          <p className="text-muted-foreground mb-1.5 mt-1" style={{ fontSize:12, fontWeight:500 }}>Business address</p>
          <p className="text-muted-foreground mb-1" style={{ fontSize:11 }}>Address line 1 *</p>
          <input value={addr1} onChange={e => setAddr1(e.target.value)} placeholder="Building number, floor, office name" className={INP + " mb-2.5 block"} style={fnt}/>
          <p className="text-muted-foreground mb-1" style={{ fontSize:11 }}>Address line 2</p>
          <input value={addr2} onChange={e => setAddr2(e.target.value)} placeholder="Street, road name" className={INP + " mb-2.5 block"} style={fnt}/>
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <div>
              <p className="text-muted-foreground mb-1" style={{ fontSize:11 }}>Landmark</p>
              <input value={landmark} onChange={e => setLandmark(e.target.value)} placeholder="Near bus stop, school gate" className={INP} style={fnt}/>
            </div>
            <div>
              <p className="text-muted-foreground mb-1" style={{ fontSize:11 }}>Location / Area</p>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. T. Nagar, Anna Nagar" className={INP} style={fnt}/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <p className="text-muted-foreground mb-1" style={{ fontSize:11 }}>City *</p>
              <input value={city} onChange={e => setCity(sanitizeCity(e.target.value))} placeholder="City" className={INP} style={fnt}/>
            </div>
            <div>
              <p className="text-muted-foreground mb-1" style={{ fontSize:11 }}>Pincode *</p>
              <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="6-digit PIN" inputMode="numeric" maxLength={6} className={INP} style={fnt}/>
              {pin && !/^\d{6}$/.test(pin) && <p className="flex items-center gap-1 mt-1" style={{ fontSize:10, color:"#dc2626" }}><AlertTriangle size={10}/>Must be 6 digits</p>}
            </div>
          </div>
          <div className="mb-4"/>
          <button onClick={save} style={btnPrimary}>
            Save business details
          </button>
        </>
      )}
    </SubScreen>
  );
}

// ─── Delivery Addresses ───────────────────────────────────────────────────────
interface Address { id:string; label:string; line1:string; city:string; pin:string; default:boolean }
const mapApiAddress = (a: ApiAddress): Address => ({ id: a._id!, label: a.label, line1: a.line1, city: a.city, pin: a.pin, default: !!a.isDefault });

function DeliveryAddresses({ onBack }: { onBack: () => void }) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadErr, setLoadErr]   = useState("");
  const [adding, setAdding]     = useState(false);
  const [saving, setSaving]     = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newLine1, setNewLine1] = useState("");
  const [newCity, setNewCity]   = useState("");
  const [newPin, setNewPin]     = useState("");

  useEffect(() => {
    let cancelled = false;
    accountApi.getAddresses()
      .then(res => { if (!cancelled) setAddresses((res.addresses || []).map(mapApiAddress)); })
      .catch(err => { if (!cancelled) setLoadErr(err instanceof Error ? err.message : "Couldn't load addresses"); });
    return () => { cancelled = true; };
  }, []);

  function detectGPS() {
    setGpsLoading(true);
    setTimeout(() => {
      setNewLine1("#45 Anna Salai, Guindy"); setNewCity("Chennai"); setNewPin("600032"); setNewLabel("Current location");
      setGpsLoading(false); setAdding(true);
    }, 1500);
  }
  async function saveNew() {
    if (!newLine1.trim() || !newCity.trim()) return;
    setSaving(true);
    try {
      const res = await accountApi.addAddress({ label: newLabel || "New address", line1: newLine1, city: newCity, state: "", pin: newPin, isDefault: addresses.length===0 });
      setAddresses(res.addresses.map(mapApiAddress));
      setAdding(false); setNewLabel(""); setNewLine1(""); setNewCity(""); setNewPin("");
    } catch (err) {
      setLoadErr(err instanceof Error ? err.message : "Couldn't save address. Try again.");
    } finally {
      setSaving(false);
    }
  }
  async function removeAddress(id: string) {
    try { const res = await accountApi.deleteAddress(id); setAddresses(res.addresses.map(mapApiAddress)); } catch { /* best-effort */ }
  }
  async function makeDefault(id: string) {
    try { const res = await accountApi.updateAddress(id, { isDefault: true }); setAddresses(res.addresses.map(mapApiAddress)); } catch { /* best-effort */ }
  }

  return (
    <SubScreen title="Delivery addresses" sub="Saved delivery locations" onBack={onBack}>
      {loadErr && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3" style={{ background:"rgba(220,38,38,0.06)", border:"1px solid rgba(220,38,38,0.2)" }}>
          <AlertTriangle size={13} style={{ color:"#dc2626", flexShrink:0 }}/>
          <p style={{ fontSize:11, color:"#dc2626" }}>{loadErr}</p>
        </div>
      )}
      {addresses.map(a => (
        <div key={a.id} className="bg-card border border-border rounded-2xl p-4 mb-3">
          <div className="flex items-start justify-between mb-1">
            <p className="text-foreground text-sm" style={{ fontWeight:500 }}>{a.label}</p>
            <div className="flex items-center gap-2">
              {a.default && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700" style={{ fontWeight:500 }}>Default</span>}
              <button onClick={() => removeAddress(a.id)}><Trash2 size={13} className="text-muted-foreground" strokeWidth={1.5}/></button>
            </div>
          </div>
          <p className="text-muted-foreground" style={{ fontSize:12 }}>{a.line1}</p>
          <p className="text-muted-foreground" style={{ fontSize:12 }}>{a.city}{a.pin ? ` — ${a.pin}` : ""}</p>
          {!a.default && (
            <button onClick={() => makeDefault(a.id)} className="mt-1.5 text-xs text-foreground" style={{ fontWeight:500 }}>Set as default</button>
          )}
        </div>
      ))}
      {!adding ? (
        <div className="flex flex-col gap-2">
          <button onClick={detectGPS} disabled={gpsLoading} style={btnSecondary}>
            <Navigation size={15} strokeWidth={1.5} style={{ color: ACCENT }}/>
            {gpsLoading ? "Detecting…" : "Use current location"}
          </button>
          <button onClick={() => setAdding(true)} style={btnPrimary}>
            <Plus size={15} strokeWidth={2}/> Add address manually
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-foreground text-sm" style={{ fontWeight:600 }}>New address</p>
            <button onClick={() => setAdding(false)} className="text-muted-foreground text-xs">Cancel</button>
          </div>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Label</p>
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. School, Office, Home" className={INP + " mb-3 block"} style={fnt}/>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Street address *</p>
          <input value={newLine1} onChange={e => setNewLine1(e.target.value)} placeholder="Building, street, area" className={INP + " mb-3 block"} style={fnt}/>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div><p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>City *</p><input value={newCity} onChange={e => setNewCity(sanitizeCity(e.target.value))} placeholder="City" className={INP} style={fnt}/></div>
            <div><p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>PIN code</p><input value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="6-digit PIN" inputMode="numeric" maxLength={6} className={INP} style={fnt}/></div>
          </div>
          <button onClick={saveNew} disabled={saving} style={saving ? { ...btnPrimary, opacity:0.6 } : btnPrimary}>{saving ? "Saving…" : "Save address"}</button>
        </div>
      )}
    </SubScreen>
  );
}

// ─── Security & 2FA ───────────────────────────────────────────────────────────
function SecurityScreen({ onBack, on2FASetup, twoFAEnabled, onDisable2FA }: {
  onBack: () => void; on2FASetup: () => void; twoFAEnabled: boolean; onDisable2FA: () => void;
}) {
  return (
    <SubScreen title="Security" sub="Account protection settings" onBack={onBack}>
      <p className="text-muted-foreground mb-3" style={{ fontSize: 12, lineHeight: 1.55 }}>
        Every login is already verified with an OTP sent to your phone or email. Turning on
        two-factor authentication adds a second check, and reviewing active sessions lets you
        sign out any device you don't recognise.
      </p>

      {/* 2FA */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: twoFAEnabled ? "rgba(200,169,126,0.15)" : "var(--muted)" }}>
            <Smartphone size={17} strokeWidth={1.5} style={{ color: twoFAEnabled ? ACCENT : "var(--muted-foreground)" }}/>
          </div>
          <div className="flex-1">
            <p className="text-foreground text-sm" style={{ fontWeight:600 }}>Two-Factor Authentication</p>
            <p className="text-muted-foreground" style={{ fontSize:11 }}>{twoFAEnabled ? "Enabled — OTP required at every login" : "Disabled — your account is less secure"}</p>
          </div>
          <button
            onClick={() => twoFAEnabled ? onDisable2FA() : on2FASetup()}
            className="flex-shrink-0 w-12 h-6 rounded-full relative transition-all"
            style={{ background: twoFAEnabled ? ACCENT : "#e5e7eb", border:"none", cursor:"pointer" }}>
            <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: twoFAEnabled ? "calc(100% - 22px)" : 2 }}/>
          </button>
        </div>
        {twoFAEnabled ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <p className="flex items-center gap-1" style={{ fontSize:11, color:"#065f46" }}><Check size={10} strokeWidth={2.5}/> 2FA active. Every login will require phone OTP verification.</p>
          </div>
        ) : (
          <div className="rounded-xl px-3 py-2" style={{ background:"rgba(220,38,38,0.06)", border:"1px solid rgba(220,38,38,0.2)" }}>
            <p className="flex items-center gap-1" style={{ fontSize:11, color:"#dc2626" }}><AlertTriangle size={10}/>Enable 2FA to protect your orders and payment details.</p>
          </div>
        )}
      </div>

      {/* Sessions */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-foreground text-sm" style={{ fontWeight:600 }}>Active sessions</p>
          <button className="text-xs text-red-500" style={{ fontWeight:500 }}>Sign out all</button>
        </div>
        {[{ device:"iPhone 14 Pro", loc:"Chennai · Active now", active:true }, { device:"Chrome — MacBook", loc:"Chennai · 2 days ago", active:false }].map((s, i) => (
          <div key={i} className={`flex items-center justify-between ${i < 1 ? "mb-3 pb-3 border-b border-border" : ""}`}>
            <div>
              <p className="text-foreground text-sm" style={{ fontWeight:500 }}>{s.device}</p>
              <p className="text-muted-foreground" style={{ fontSize:11 }}>{s.loc}</p>
            </div>
            {s.active
              ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700" style={{ fontWeight:500 }}>This device</span>
              : <button className="text-xs text-red-500" style={{ fontWeight:500 }}>Remove</button>
            }
          </div>
        ))}
      </div>
    </SubScreen>
  );
}

// ─── 2FA Setup ─────────────────────────────────────────────────────────────
function TwoFASetup({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  const [step, setStep]   = useState<"intro"|"phone"|"otp"|"done">("intro");
  const [phone, setPhone] = useState("+91");
  const [otp, setOtp]     = useState(["","","","","",""]);
  const inputRefs         = useRef<(HTMLInputElement | null)[]>([]);

  function handleOtp(i: number, v: string) {
    if (!/^\d?$/.test(v)) return;
    const next = [...otp]; next[i] = v; setOtp(next);
    if (v && i < 5) inputRefs.current[i+1]?.focus();
    if (next.every(d => d !== "") && next.join("").length === 6) {
      setTimeout(() => setStep("done"), 400);
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border flex-shrink-0">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><ArrowLeft size={15} strokeWidth={1.5}/></button>
        <p className="text-foreground text-sm" style={{ fontWeight:600 }}>Set up 2FA</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 min-h-0" style={{ scrollbarWidth:"none" }}>
        {step === "intro" && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background:"rgba(200,169,126,0.15)" }}>
              <Shield size={28} strokeWidth={1.5} style={{ color: ACCENT }}/>
            </div>
            <p className="text-foreground mb-2" style={{ fontSize:18, fontWeight:700 }}>Two-Factor Authentication</p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-7">Every login will require a one-time password sent to your phone. Your orders and payments stay protected.</p>
            <div className="flex flex-col gap-3 text-left mb-8">
              {[
                { n:"1", t:"Enter your phone number",      s:"We'll send OTPs here" },
                { n:"2", t:"Verify with a 6-digit code",   s:"Confirm it's really you" },
                { n:"3", t:"2FA active on your account",   s:"Required at every login" },
              ].map(({ n, t, s }) => (
                <div key={n} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-foreground text-white flex items-center justify-center flex-shrink-0 text-xs" style={{ fontWeight:700 }}>{n}</div>
                  <div><p className="text-foreground text-sm" style={{ fontWeight:500 }}>{t}</p><p className="text-muted-foreground" style={{ fontSize:11 }}>{s}</p></div>
                </div>
              ))}
            </div>
            <button onClick={() => setStep("phone")} style={btnPrimary}>Set up now</button>
          </div>
        )}

        {step === "phone" && (
          <div>
            <p className="text-foreground mb-1" style={{ fontSize:18, fontWeight:700 }}>Verify your number</p>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">We'll send a 6-digit OTP to confirm your number is reachable.</p>
            <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Mobile number</p>
            <input value={fmtPhone(phone)}
              onChange={e => setPhone("+91" + phoneDigits(e.target.value).slice(0,10))}
              onKeyDown={e => { if ((e.key==="Backspace"||e.key==="Delete") && phoneDigits(phone).length===0) e.preventDefault(); }}
              placeholder="+91 98765 43210" inputMode="tel" maxLength={16} className={INP + " mb-4 block"} style={fnt}/>
            <button onClick={() => setStep("otp")} style={btnPrimary}>Send OTP</button>
          </div>
        )}

        {step === "otp" && (
          <div>
            <p className="text-foreground mb-1" style={{ fontSize:18, fontWeight:700 }}>Enter OTP</p>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">We sent a 6-digit code to <strong>{phone}</strong></p>

            {/* ── 6-digit OTP row — identical to the onboarding screen ── */}
            <div className="flex gap-2 justify-center mb-6">
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  value={d}
                  onChange={e => handleOtp(i, e.target.value)}
                  onKeyDown={e => { if (e.key==="Backspace" && !d && i > 0) inputRefs.current[i-1]?.focus(); }}
                  maxLength={1}
                  inputMode="numeric"
                  className="w-11 h-14 text-center text-foreground outline-none"
                  style={{
                    fontSize:22, fontWeight:700,
                    borderRadius:14,
                    border: d ? `2px solid ${DARK}` : "2px solid var(--border)",
                    background: d ? "var(--card)" : "var(--muted)",
                    fontFamily:"monospace",
                    transition:"border-color 0.15s",
                  }}
                />
              ))}
            </div>

            <p className="text-muted-foreground text-xs text-center mb-4">
              Didn't receive it?{" "}
              <button className="text-foreground" style={{ fontWeight:500, background:"none", border:"none", cursor:"pointer" }} onClick={() => setOtp(["","","","","",""])}>
                Resend OTP
              </button>
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-5">
              <Check size={28} className="text-emerald-500" strokeWidth={1.5}/>
            </div>
            <p className="text-foreground mb-2" style={{ fontSize:18, fontWeight:700 }}>2FA is active!</p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-8">
              Your account is now protected. Every login will require an OTP sent to {phone}.
            </p>
            {/* onComplete sets twoFAEnabled=true in AccountTab */}
            <button onClick={onComplete} style={btnPrimary}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Notifications Settings ───────────────────────────────────────────────────
function NotificationsSettings({ onBack }: { onBack: () => void }) {
  const [prefs, setPrefs] = useState({ quotes:true, production:true, quality:true, delivery:true, promotions:false });
  const rows = [
    { k:"quotes"     as const, label:"Quote updates",        sub:"When a quote is ready or revised" },
    { k:"production" as const, label:"Production status",    sub:"Weaving, dyeing, finishing updates" },
    { k:"quality"    as const, label:"Quality check",        sub:"Inspection started & passed" },
    { k:"delivery"   as const, label:"Shipping & delivery",  sub:"Dispatch and delivery notifications" },
    { k:"promotions" as const, label:"Offers & promotions",  sub:"Seasonal deals and new features" },
  ];
  return (
    <SubScreen title="Notifications" sub="Choose what to be notified about" onBack={onBack}>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {rows.map((r, i) => (
          <div key={r.k} className={`flex items-center px-4 py-3.5 ${i < rows.length-1 ? "border-b border-border" : ""}`}>
            <div className="flex-1">
              <p className="text-foreground text-sm" style={{ fontWeight:500 }}>{r.label}</p>
              <p className="text-muted-foreground" style={{ fontSize:11 }}>{r.sub}</p>
            </div>
            <button onClick={() => setPrefs(p => ({ ...p, [r.k]: !p[r.k] }))}
              className="flex-shrink-0 w-11 h-6 rounded-full relative transition-all"
              style={{ background: prefs[r.k] ? ACCENT : "#e5e7eb", border:"none", cursor:"pointer" }}>
              <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: prefs[r.k] ? "calc(100% - 22px)" : 2 }}/>
            </button>
          </div>
        ))}
      </div>
    </SubScreen>
  );
}

// ─── Order History + Order Detail ─────────────────────────────────────────────
const historyOrders = [
  { id:"#FL-2035", name:"Cotton Jersey — White",       qty:"100 pcs", gsm:"GSM 180", date:"Jun 10, 2025", status:"Delivered",  color:"text-emerald-700 bg-emerald-50", fabric:"100% Cotton Jersey", stitching:"Single needle stitch", packaging:"Individual poly bag" },
  { id:"#FL-2029", name:"Oxford Shirt Fabric — Sky Blue", qty:"250 pcs", gsm:"GSM 200", date:"May 20, 2025", status:"Delivered", color:"text-emerald-700 bg-emerald-50", fabric:"Oxford Cotton", stitching:"Double needle stitch", packaging:"Bulk / Loose packing" },
  { id:"#FL-2021", name:"Polyester Sports Kit",        qty:"80 pcs",  gsm:"GSM 130", date:"Apr 12, 2025", status:"Delivered",  color:"text-emerald-700 bg-emerald-50", fabric:"Dri-fit Polyester", stitching:"Flatlock stitch", packaging:"Bundle packing" },
  { id:"#FL-2018", name:"School Twill — Blue",          qty:"400 pcs", gsm:"GSM 240", date:"Mar 5, 2025",  status:"Completed", color:"text-stone-600 bg-stone-100",    fabric:"Heavy Cotton Twill", stitching:"Single needle stitch", packaging:"Bulk / Loose packing" },
];

function OrderDetail({ order, onBack, onReorder }: { order: typeof historyOrders[0]; onBack: () => void; onReorder: (id: string) => void }) {
  return (
    <SubScreen title="Order details" sub={order.id} onBack={onBack}>
      {/* Status */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-3 flex items-center justify-between">
        <div>
          <p className="text-foreground text-sm" style={{ fontWeight:600 }}>{order.name}</p>
          <p className="text-muted-foreground" style={{ fontSize:12 }}>{order.qty} · {order.gsm}</p>
          <p className="text-muted-foreground" style={{ fontSize:11, marginTop:2 }}>{order.date}</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full ${order.color}`} style={{ fontWeight:500 }}>{order.status}</span>
      </div>

      {/* Specs */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden mb-3">
        {[
          { label:"Fabric type",  value: order.fabric },
          { label:"Stitching",    value: order.stitching },
          { label:"Packaging",    value: order.packaging },
          { label:"Total pieces", value: order.qty },
          { label:"GSM weight",   value: order.gsm },
        ].map((item, i) => (
          <div key={i} className={`flex items-center justify-between px-4 py-3 ${i < 4 ? "border-b border-border" : ""}`}>
            <p className="text-muted-foreground text-xs">{item.label}</p>
            <p className="text-foreground text-sm" style={{ fontWeight:500 }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <button onClick={() => onReorder(order.id)} style={btnAccent}>
          <RotateCcw size={15} strokeWidth={1.5}/> Reorder this
        </button>
        <p className="text-muted-foreground text-xs text-center">Opens a new quote request. Mention this order ID for matching specs.</p>
      </div>
    </SubScreen>
  );
}

function OrderHistory({ onBack, onReorder }: { onBack: () => void; onReorder: (id: string) => void }) {
  const [selected, setSelected] = useState<typeof historyOrders[0] | null>(null);

  if (selected) return <OrderDetail order={selected} onBack={() => setSelected(null)} onReorder={onReorder}/>;

  return (
    <SubScreen title="Order history" sub={`${historyOrders.length} completed orders`} onBack={onBack}>
      {historyOrders.map(o => (
        <button key={o.id} onClick={() => setSelected(o)} className="w-full bg-card border border-border rounded-2xl p-4 mb-3 text-left" style={{ cursor:"pointer" }}>
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-muted-foreground" style={{ fontSize:11 }}>{o.id} · {o.date}</p>
              <p className="text-foreground text-sm mt-0.5" style={{ fontWeight:500 }}>{o.name}</p>
              <p className="text-muted-foreground" style={{ fontSize:12 }}>{o.qty} · {o.gsm}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className={`text-xs px-2 py-0.5 rounded-full ${o.color}`} style={{ fontWeight:500, fontSize:10 }}>{o.status}</span>
              <ChevronRight size={13} className="text-muted-foreground" strokeWidth={1.5}/>
            </div>
          </div>
        </button>
      ))}
    </SubScreen>
  );
}

const TICKET_STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  OPEN:        { label: "Open",        color: "#1a4a8a", bg: "#e3f2fd" },
  IN_PROGRESS: { label: "In progress", color: "#7c5419", bg: ACCENT_BG },
  RESOLVED:    { label: "Resolved",    color: "#2e7d32", bg: "#e8f5e9" },
  CLOSED:      { label: "Closed",      color: "#6b7280", bg: "#f3f4f6" },
};
function ticketTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function HelpSupportScreen({ onBack, isOrg }: { onBack: () => void; isOrg?: boolean }) {
  const queryTypes = isOrg
    ? ["Order status & tracking", "Payment or invoice", "Sample pickup / swatch box", "Quality issue", "Business or account details"]
    : ["Order status & tracking", "Payment or refund", "Sizing or fit help", "Quality issue", "Account details"];
  const [category, setCategory] = useState(queryTypes[0]);
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [raisedRef, setRaisedRef] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState<"form" | "tickets" | { thread: string }>("form");
  const [coord, setCoord] = useState<Coordinator | null>(null);
  // Open tickets already raised — used to stop the customer opening a second
  // ticket for the same thing (which showed up as duplicates on the admin side).
  const [openTickets, setOpenTickets] = useState<SupportTicket[]>([]);
  const [dupTicket, setDupTicket] = useState<SupportTicket | null>(null);

  useEffect(() => { coordinatorApi.get().then(d => setCoord(d.coordinator)).catch(() => {}); }, []);
  useEffect(() => {
    supportApi.list().then(d => setOpenTickets((d.tickets || []).filter(t => t.status === "OPEN" || t.status === "IN_PROGRESS"))).catch(() => {});
  }, [raisedRef]);

  // An existing OPEN ticket in the same category is very likely the same issue.
  function findDuplicate(): SupportTicket | null {
    const sub = subject.trim().toLowerCase();
    // pull an order ref like FL-2048 out of the subject/details, if present
    const refMatch = (subject + " " + details).match(/fl-?\s?\d{3,}/i);
    const ref = refMatch ? refMatch[0].replace(/\s/g, "").toLowerCase() : null;
    return openTickets.find(t => {
      // Strongest signal: an existing open ticket for the SAME order.
      if (ref && t.orderRef && t.orderRef.toLowerCase().replace(/\s/g, "").includes(ref.replace(/[^a-z0-9]/g, ""))) return true;
      // Same category is a likely duplicate (e.g. two "Return / damage" tickets).
      if (t.category && category && t.category === category) return true;
      // Or an identical subject line.
      if (sub && t.subject && t.subject.trim().toLowerCase() === sub) return true;
      return false;
    }) || null;
  }

  async function raise(force = false) {
    if (!subject.trim() || !details.trim()) return;
    if (!force) {
      const dup = findDuplicate();
      if (dup) { setDupTicket(dup); return; }
    }
    setBusy(true); setError(""); setDupTicket(null);
    try {
      const { ticket } = await supportApi.create({ category, subject: subject.trim(), message: details.trim() });
      setRaisedRef(ticket.ref);
      setSubject(""); setDetails("");
    } catch (e) {
      setError((e as Error).message || "Couldn't raise the ticket. Please try again.");
    } finally { setBusy(false); }
  }

  // Contact shortcuts from the coordinator config.
  const digits = (s?: string) => (s || "").replace(/[^\d+]/g, "");
  const contacts: { label: string; onClick: () => void; disabled?: boolean }[] = [
    { label: "Call coordinator", onClick: () => { if (coord?.phone) window.location.href = `tel:${digits(coord.phone)}`; }, disabled: !coord?.phone },
    { label: "WhatsApp support", onClick: () => { if (coord?.whatsapp) window.open(`https://wa.me/${digits(coord.whatsapp).replace(/^\+/, "")}`, "_blank"); }, disabled: !coord?.whatsapp },
    { label: "Email support", onClick: () => { if (coord?.email) window.location.href = `mailto:${coord.email}`; }, disabled: !coord?.email },
    { label: "Track my tickets", onClick: () => setView("tickets") },
  ];

  if (view === "tickets") return <TicketsScreen onBack={() => setView("form")} onOpen={(id) => setView({ thread: id })} />;
  if (typeof view === "object") return <TicketThreadScreen id={view.thread} onBack={() => setView("tickets")} />;

  return (
    <SubScreen title="Help & support" sub="Raise a ticket or reach your coordinator" onBack={onBack}>
      {raisedRef ? (
        <div className="bg-card border border-border rounded-2xl p-4 mb-3 text-center">
          <div className="w-11 h-11 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: "#e8f5e9" }}>
            <Check size={20} style={{ color: "#2e7d32" }}/>
          </div>
          <p className="text-foreground text-sm" style={{ fontWeight: 700 }}>Ticket raised · {raisedRef}</p>
          <p className="text-muted-foreground" style={{ fontSize: 12, marginTop: 3 }}>Our team will reply here. You'll see updates under "Track my tickets".</p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setRaisedRef("")} className="flex-1 rounded-xl border border-border py-2.5 text-sm text-foreground" style={{ fontWeight: 500 }}>Raise another</button>
            <button onClick={() => setView("tickets")} className="flex-1 rounded-xl py-2.5 text-sm" style={btnPrimary}>Track my tickets</button>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-4 mb-3">
          <p className="text-foreground text-sm mb-3" style={{ fontWeight:600 }}>Create a support ticket</p>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>What do you need help with?</p>
          <div className="relative mb-3">
            <select value={category} onChange={e => setCategory(e.target.value)} className={INP + " appearance-none pr-10"} style={{ ...fnt, cursor:"pointer" }}>
              {queryTypes.map(t => <option key={t}>{t}</option>)}
            </select>
            <ChevronDown size={15} strokeWidth={1.8} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", color:"#6b7280", pointerEvents:"none" }}/>
          </div>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Subject</p>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Change delivery address on order #FL-2046" className={INP + " mb-3 block"} style={fnt}/>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Details</p>
          <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Tell us what happened, and your order number if you have one" className={INP + " mb-3 block"} style={{ ...fnt, resize:"none", height:90 }}/>
          {error && <p style={{ fontSize: 12, color: "#b91c1c", marginBottom: 10 }}>{error}</p>}
          {dupTicket ? (
            <div className="rounded-xl p-3 mb-2" style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "#9a3412" }}>You already have an open ticket for this</p>
              <p style={{ fontSize: 11.5, color: "#9a3412", marginTop: 3, lineHeight: 1.5 }}>
                {dupTicket.ref} · “{dupTicket.subject}”. Adding your new details there keeps everything in one place and gets a faster reply.
              </p>
              <div className="flex gap-2 mt-2.5">
                <button onClick={() => setView({ thread: dupTicket._id })} className="flex-1 rounded-xl py-2.5 text-sm" style={btnPrimary}>Open that ticket</button>
                <button onClick={() => raise(true)} disabled={busy} className="flex-1 rounded-xl border border-border py-2.5 text-sm text-foreground" style={{ fontWeight: 500 }}>{busy ? "Raising…" : "Create anyway"}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => raise()} disabled={!subject.trim() || !details.trim() || busy}
              style={subject.trim() && details.trim() && !busy ? btnPrimary : { ...btnPrimary, background:"#e5e7eb", color:"#9ca3af", cursor:"not-allowed" }}>
              {busy ? "Raising…" : "Raise ticket"}
            </button>
          )}
        </div>
      )}
      <p className="text-muted-foreground mb-2" style={{ fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>Reach us directly</p>
      <div className="grid grid-cols-2 gap-2">
        {contacts.map(c => (
          <button key={c.label} onClick={c.onClick} disabled={c.disabled}
            className="rounded-2xl bg-card border border-border py-3 text-sm text-foreground" style={{ fontWeight:500, opacity: c.disabled ? 0.45 : 1, cursor: c.disabled ? "not-allowed" : "pointer" }}>{c.label}</button>
        ))}
      </div>
    </SubScreen>
  );
}

// Per-ticket "last seen message count" so we can show a NEW-reply dot until
// the customer opens the ticket. Stored locally, keyed by ticket id.
const TICKET_SEEN_KEY = "fl_ticket_seen_v1";
function ticketSeen(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(TICKET_SEEN_KEY) || "{}"); } catch { return {}; }
}
function markTicketSeen(id: string, count: number) {
  try { const m = ticketSeen(); m[id] = count; localStorage.setItem(TICKET_SEEN_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}
/** A ticket has an unread admin reply if its message count grew since last seen AND the last message is from admin. */
function ticketHasUnread(t: SupportTicket, seen: Record<string, number>): boolean {
  const last = t.messages[t.messages.length - 1];
  return !!last && last.from === "admin" && t.messages.length > (seen[t._id] ?? 0);
}

function TicketsScreen({ onBack, onOpen }: { onBack: () => void; onOpen: (id: string) => void }) {
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [seen] = useState(ticketSeen);
  useEffect(() => { supportApi.list().then(d => setTickets(d.tickets)).catch(() => setTickets([])); }, []);
  return (
    <SubScreen title="My tickets" sub="Track your support requests" onBack={onBack}>
      {tickets === null && <p className="text-muted-foreground text-xs px-1">Loading…</p>}
      {tickets !== null && tickets.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 text-center">
          <p className="text-foreground text-sm" style={{ fontWeight: 600 }}>No tickets yet</p>
          <p className="text-muted-foreground" style={{ fontSize: 12, marginTop: 3 }}>Raise a ticket from Help &amp; support and it'll show here.</p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {(tickets ?? []).map(t => {
          const s = TICKET_STATUS_LABEL[t.status] ?? TICKET_STATUS_LABEL.OPEN;
          const last = t.messages[t.messages.length - 1];
          const unread = ticketHasUnread(t, seen);
          return (
            <button key={t._id} onClick={() => onOpen(t._id)} className="text-left bg-card rounded-2xl p-3.5"
              style={{ border: unread ? "1.5px solid #C8A97E" : "1px solid var(--border)", background: unread ? "rgba(200,169,126,0.06)" : "var(--card)" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5">
                  {unread && <span style={{ width: 7, height: 7, borderRadius: 999, background: "#C8A97E", display: "inline-block" }}/>}
                  <span className="text-muted-foreground" style={{ fontSize: 11 }}>{t.ref}</span>
                  {unread && <span style={{ fontSize: 10, fontWeight: 700, color: "#7c5419" }}>New reply</span>}
                </span>
                <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 10.5, fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>
              </div>
              <p className="text-foreground text-sm" style={{ fontWeight: unread ? 700 : 600 }}>{t.subject}</p>
              {last && <p className="text-muted-foreground" style={{ fontSize: 12, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{last.from === "admin" ? "Garm: " : "You: "}{last.body}</p>}
              <p className="text-muted-foreground" style={{ fontSize: 10.5, marginTop: 3 }}>{ticketTime(t.updatedAt)}</p>
            </button>
          );
        })}
      </div>
    </SubScreen>
  );
}

function TicketThreadScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => supportApi.get(id).then(d => { setTicket(d.ticket); markTicketSeen(id, d.ticket.messages.length); }).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); /* eslint-disable-next-line */ }, [id]);
  async function send() {
    if (!reply.trim()) return;
    setBusy(true);
    try { const { ticket: t } = await supportApi.reply(id, reply.trim()); setTicket(t); setReply(""); }
    finally { setBusy(false); }
  }
  const s = ticket ? (TICKET_STATUS_LABEL[ticket.status] ?? TICKET_STATUS_LABEL.OPEN) : null;
  return (
    <SubScreen title={ticket?.ref ?? "Ticket"} sub={ticket?.subject} onBack={onBack}>
      {!ticket ? <p className="text-muted-foreground text-xs px-1">Loading…</p> : (
        <>
          {s && <div className="mb-3"><span className="px-2.5 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span></div>}
          <div className="flex flex-col gap-2 mb-3">
            {ticket.messages.map((m, i) => (
              <div key={i} className={"rounded-2xl p-3 " + (m.from === "customer" ? "self-end" : "self-start")}
                style={{ maxWidth: "85%", background: m.from === "customer" ? ACCENT_BG : "var(--card)", border: "1px solid var(--border)" }}>
                <p className="text-foreground" style={{ fontSize: 13, lineHeight: 1.5 }}>{m.body}</p>
                <p className="text-muted-foreground" style={{ fontSize: 10, marginTop: 4 }}>{m.from === "admin" ? (m.authorName || "Garm Support") : "You"} · {ticketTime(m.at)}</p>
              </div>
            ))}
          </div>
          {ticket.status !== "CLOSED" ? (
            <div className="flex gap-2 items-end">
              <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Type a reply…" className={INP + " flex-1 min-w-0"} style={{ ...fnt, resize: "none", height: 46 }}/>
              <button onClick={send} disabled={!reply.trim() || busy} className="rounded-xl px-5 text-sm flex-shrink-0"
                style={{ ...(reply.trim() && !busy ? btnPrimary : { ...btnPrimary, background: "#e5e7eb", color: "#9ca3af" }), width: "auto", height: 46 }}>Send</button>
            </div>
          ) : (
            <div className="rounded-2xl p-3 text-center" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
              <p className="text-muted-foreground" style={{ fontSize: 12 }}>This ticket is closed. Reply to reopen it, or raise a new one from Help &amp; support.</p>
            </div>
          )}
        </>
      )}
    </SubScreen>
  );
}

// Extra FAQ items that only make sense for a specific organisation type — appended to
// the shared organisation FAQ list so each org type sees a couple of questions that
// are actually relevant to how it orders, instead of one generic list for every org.
const orgTypeFaqExtras: Record<string, [string, string][]> = {
  school: [
    ["Can parents pay for their own child's uniform?", "Yes — many schools split payment per parent or per class. Ask your coordinator about setting up individual payment links."],
    ["Can we reorder for new admissions mid-year?", "Yes. Reuse your saved uniform spec from Order history any time a new student joins, without re-entering fabric and size details."],
  ],
  college: [
    ["Can different departments or clubs order separately?", "Yes — place a separate order per department, fest committee or club, each with its own delivery address and billing contact."],
    ["Is there a discount for large fresher batches?", "Volume pricing applies automatically above certain quantities — your coordinator applies it when confirming your quote."],
  ],
  corporate: [
    ["Can we get a GST invoice?", "Yes — add your company's GSTIN under Business details and it will appear on every invoice."],
    ["Can we reorder the same branded merchandise later?", "Yes. Your fabric, colours and logo placement are saved against your organisation profile for fast reorders."],
  ],
  hospital: [
    ["Do your fabrics meet hygiene and infection-control needs?", "Scrub and lab coat fabrics follow standard hospital-grade specs — mention any specific requirement (e.g. antimicrobial finish) in References and we'll confirm availability."],
    ["Can departments order separately?", "Yes — nursing, OT and housekeeping can each be set up as their own garment line or their own order."],
  ],
  industry: [
    ["Do you supply fire-retardant or hi-vis workwear?", "Yes — pick the relevant fabric under Workwear type, or note your safety standard in References and we'll confirm compliance."],
    ["Can sizes be issued per employee?", "Yes — size distribution is entered per garment, so you can match it to your workforce roster."],
  ],
  hospitality: [
    ["Can we order different uniforms per department?", "Yes — kitchen, service and housekeeping can each be added as separate garments with their own fabric and fit."],
    ["Can you match our brand colours exactly?", "Share a Pantone code or fabric swatch in References and we'll match as closely as the fabric allows."],
  ],
  sports: [
    ["Can you print player names and numbers?", "Yes — add these under Reference & sample once your jersey or kit is picked."],
    ["Is there a team discount for large squads?", "Volume pricing applies automatically above certain quantities."],
  ],
  government: [
    ["Can you support tender or procurement documentation?", "Yes — share your tender reference with your coordinator and we'll provide the paperwork needed for procurement approval."],
    ["Can an order span multiple budget cycles?", "Yes — ask your coordinator about splitting an order's billing across budget cycles."],
  ],
  ngo: [
    ["Can a donor or CSR partner be billed directly?", "Yes — share the billing party's details and we'll invoice them directly on request."],
    ["Is there pricing support for registered non-profits?", "Ask your coordinator — this is considered case by case for registered non-profits."],
  ],
};

function FAQScreen({ onBack, isOrg, orgType }: { onBack: () => void; isOrg?: boolean; orgType?: string }) {
  const orgFaqs: [string, string][] = [
    ["What's the minimum order?", "Organisation orders start at 100 pieces. Accessories start at 100 pieces per product."],
    ["What happens after I submit an order?", "Your coordinator confirms the specs, final price and timeline, then production begins. You can still request changes after submitting."],
    ["Can I order uniforms and accessories together?", "Place them as separate orders — each keeps its own fabric, colour and size specs."],
    ["Can you match our existing uniform?", "Yes. In References, choose 'Match my existing uniform' and we'll identify the fabric and GSM from your sample."],
    ["Where do I manage our organisation details?", "Account › Business details holds your organisation name, type and address."],
    ["Can I save an order and finish later?", "Yes. On the review step tap 'Save as draft', then reopen it anytime from Drafts on the home screen."],
    ["How is delivery handled?", "Add your delivery address on the review step, or tap 'Use current location' to auto-fill it."],
    ["How do I pay?", "Your coordinator shares payment details — UPI, card or bank transfer — after confirming your order."],
    ["How do I raise an issue?", "Open Help & support from Account and create a ticket with your order number."],
  ];
  const indFaqs: [string, string][] = [
    ["What's the minimum order?", "Custom orders start at 3 pieces. Accessories start at just 1 piece per product."],
    ["What happens after I submit my order?", "Your coordinator confirms the details, fit and final price, then shares payment details. You can still request changes after submitting."],
    ["Can I choose my own colours and sizes?", "Yes. Pick your colours, then set how many pieces you need per size."],
    ["How do I pay?", "Choose UPI or Card on the review step. Nothing is charged until your coordinator confirms the order."],
    ["Can you match a style I like?", "Yes. In References, upload a photo or share a style screenshot and we'll work from it."],
    ["Can I save an order and finish later?", "Yes. On the review step tap 'Save as draft', then reopen it from Drafts on the home screen."],
    ["Where do I set my delivery address?", "On the review step — type it in, or tap 'Use current location' to auto-fill it."],
    ["How do I raise an issue?", "Open Help & support from Account and create a ticket with your order number."],
  ];
  const orgLabel = orgTypeDefs.find(t => t.id === orgType)?.label;
  const faqs = isOrg ? [...orgFaqs, ...(orgTypeFaqExtras[orgType ?? ""] ?? [])] : indFaqs;
  return (
    <SubScreen title="FAQ" sub={isOrg ? `Answers for ${orgLabel ?? "organisation"} orders` : "Answers for your custom orders"} onBack={onBack}>
      {faqs.map(([q, a], i) => (
        <div key={q} className="bg-card border border-border rounded-2xl p-4 mb-3">
          <p className="text-foreground text-sm" style={{ fontWeight:600 }}>{i + 1}. {q}</p>
          <p className="text-muted-foreground mt-1" style={{ fontSize:12, lineHeight:1.55 }}>{a}</p>
        </div>
      ))}
    </SubScreen>
  );
}

// One extra, org-type-specific clause per policy document — added on top of the
// shared organisation content so schools, hospitals, government bodies and so on each
// see the one consideration that actually matters most for how they order.
const orgTypePolicyExtra: Record<string, { terms: [string, string]; payment: [string, string]; privacy: [string, string] }> = {
  school: {
    terms:   ["School orders", "Bulk uniform orders can be split for delivery by class or section — confirm groupings with your coordinator before production starts."],
    payment: ["Per-parent billing", "If individual parents are paying for their child's uniform, ask your coordinator to set up separate payment links per student."],
    privacy: ["Student data", "Where an order includes a minor's name, class or size linked to a specific student, that information is used only to fulfil the order and is not shared beyond what production and delivery require."],
  },
  college: {
    terms:   ["Departmental orders", "Different departments, fest committees or clubs can each place their own order with its own delivery address and billing contact."],
    payment: ["Volume pricing", "Large batch orders (e.g. fresher kits) may qualify for volume pricing, applied automatically when your coordinator confirms the quote."],
    privacy: ["Student & staff data", "Names, roll numbers or department details shared for sizing or delivery are used only for that order."],
  },
  corporate: {
    terms:   ["Branding approval", "Logo placement and branding are confirmed with you before production — production does not start on branded merchandise without your sign-off."],
    payment: ["GST invoicing", "Add your company's GSTIN under Business details so it appears on every invoice raised against your organisation."],
    privacy: ["Company data", "Your company's registration and billing details are used only for invoicing and order fulfilment, and are not shared with third parties."],
  },
  hospital: {
    terms:   ["Compliance requirements", "Share any fabric compliance requirement (e.g. antimicrobial finish, infection-control standard) in References — we'll confirm feasibility before production."],
    payment: ["Departmental billing", "Nursing, OT, housekeeping and other departments can be billed as separate orders if your accounting needs it."],
    privacy: ["Staff data", "Staff names or ID numbers used for uniform sizing are used only for that purpose and are not retained beyond order fulfilment and warranty support."],
  },
  industry: {
    terms:   ["Safety standards", "If your workwear must meet a specific safety standard (fire-retardant, hi-vis, etc.), confirm the standard with your coordinator before production begins."],
    payment: ["Workforce-scale billing", "Large workforce orders may use milestone billing (advance + balance) tied to production stages."],
    privacy: ["Workforce data", "Employee names or ID numbers used for size allocation are used only for that purpose."],
  },
  hospitality: {
    terms:   ["Per-department orders", "Kitchen, service and housekeeping uniforms can be ordered and delivered separately if that suits your operations."],
    payment: ["Brand colour matching", "Pantone or swatch-matching requests are confirmed before cutting fabric, since exact colour matches can affect cost."],
    privacy: ["Staff data", "Staff names used for uniform sizing are used only for that purpose."],
  },
  sports: {
    terms:   ["Player customisation", "Names and numbers are confirmed with you before printing — please double-check spellings and numbers when you submit them."],
    payment: ["Team-scale pricing", "Larger squads may qualify for volume pricing, applied automatically when your coordinator confirms the quote."],
    privacy: ["Player data", "Player names and numbers you provide are used only to produce your kit and are not shared beyond that."],
  },
  government: {
    terms:   ["Procurement documentation", "If your order requires tender or procurement paperwork, share your reference number with your coordinator — this is provided alongside the standard quote."],
    payment: ["Budget-cycle billing", "Orders can be split for billing across financial years or budget cycles where required."],
    privacy: ["Departmental data", "Department and employee details shared for sizing are used only to fulfil the order."],
  },
  ngo: {
    terms:   ["Donor-funded orders", "If a donor or CSR partner is funding the order, share their billing details up front so invoicing matches your funding agreement."],
    payment: ["Non-profit support", "Pricing support for registered non-profits is considered case by case — ask your coordinator."],
    privacy: ["Volunteer & beneficiary data", "Names used for sizing (volunteers, staff or beneficiaries) are used only to fulfil the order."],
  },
};

function PolicyScreen({ kind, onBack, isOrg, orgType }: { kind: "terms" | "payment_gateway" | "privacy"; onBack: () => void; isOrg?: boolean; orgType?: string }) {
  const extra = orgTypePolicyExtra[orgType ?? ""];
  const content = {
    terms: {
      title:"Terms & conditions",
      sub:"How orders work on Garm",
      rows:[
        ["Placing an order", "Prices shown while configuring a garment are indicative. Your coordinator confirms the final fabric, finishing, quantity and delivery timeline before production begins."],
        ["Minimum quantities", isOrg
          ? "Organisation garment orders start at 100 pieces per garment; accessories start at 100 pieces per product. Individual/custom orders are not subject to these minimums."
          : "Custom orders start at 3 pieces; accessories start at just 1 piece per product — there's no bulk minimum for individuals."],
        ["Production", isOrg
          ? "Production begins only after your coordinator has confirmed the specifications and, where applicable, an agreed advance payment has been received."
          : "Production begins after your coordinator confirms the order details and your payment is received."],
        ["Changes & cancellations", "You can request changes any time after submitting an order. Once production has started, changes or cancellations may affect cost, timeline, or may not be possible for materials already cut."],
        ["Quality assurance", "QA photos and inspection notes are shared before dispatch wherever applicable, so you can review the order before it ships."],
        ["Delivery", "Estimated delivery windows are shared once your order is confirmed. Delays caused by courier or logistics partners are communicated as soon as we're aware of them."],
        ...(extra ? [extra.terms] : []),
      ],
    },
    payment_gateway: {
      title:"Payments",
      sub:"How payment, receipts and refunds work",
      rows: [
        ...(isOrg
          ? [
              ["Methods", "Pay by UPI, card or bank transfer (NEFT/RTGS). Your coordinator shares payment details after confirming the order."],
              ["Milestones", "Bulk orders may use an advance-plus-balance structure, tied to production milestones (confirmation, production start, dispatch)."],
              ["Receipts & invoices", "Invoices and receipts are shared once payment is confirmed, and can include your organisation's GSTIN if provided under Business details."],
              ["Refunds", "Refunds depend on the order stage — full refunds are generally possible before production starts, and are assessed case by case once materials have been purchased or cut."],
            ]
          : [
              ["Methods", "Pay securely by UPI or card. Nothing is charged until your coordinator confirms the order details and final price."],
              ["Receipts", "Your receipt is shared in the app as soon as payment is confirmed, and is also available under Account → Order history."],
              ["Refunds", "Refunds depend on the order stage — generally straightforward before production starts, and assessed case by case once fabric has been cut."],
              ["Security", "Payments are processed over a secure, encrypted connection. Garm does not store your full card details."],
            ]),
        ...(isOrg && extra ? [extra.payment] : []),
      ],
    },
    privacy: {
      title:"Privacy policy",
      sub:"How we use and protect your data",
      rows:[
        ["What we collect", isOrg
          ? "Your organisation name and type, contact person, phone/email, delivery address and payment details — collected to set up and fulfil your orders."
          : "Your name, phone/email, delivery address and payment details — collected to set up and fulfil your orders."],
        ["Uploads & references", "Logos, photos and reference images you upload (for branding, colour matching, or sample matching) are used only to produce your order and are not used for any other purpose."],
        ["How it's used", "Your details are used to confirm quotes, coordinate production and QA, arrange delivery, and provide order support — nothing more."],
        ["Sharing", "We don't sell your data. Information is shared only with the production, QA and logistics partners needed to fulfil your specific order."],
        ["Account security", "OTP login and optional two-factor authentication protect your account. Please only share sensitive details (payment, address) inside the app, never over email or phone."],
        ["Your control", "You can review, update or correct your profile, delivery and payment details any time from Account. To request deletion of your data, contact Help & support."],
        ...(isOrg && extra ? [extra.privacy] : []),
      ],
    },
  }[kind];
  return (
    <SubScreen title={content.title} sub={content.sub} onBack={onBack}>
      {content.rows.map(([h, b]) => (
        <div key={h} className="bg-card border border-border rounded-2xl p-4 mb-3">
          <p className="text-foreground text-sm" style={{ fontWeight:600 }}>{h}</p>
          <p className="text-muted-foreground mt-1" style={{ fontSize:12, lineHeight:1.55 }}>{b}</p>
        </div>
      ))}
      <p className="text-muted-foreground text-xs leading-relaxed">This prototype text is for product flow review. Final legal wording should be approved before production release.</p>
    </SubScreen>
  );
}

// ─── Main Account ─────────────────────────────────────────────────────────────
export function AccountTab({ onNavigate, profile, onProfileUpdate, onSignOut }: {
  onNavigate?: (tab: string, orderId?: string) => void;
  profile?: UserProfile;
  onProfileUpdate?: (p: UserProfile) => void;
  onSignOut?: () => void;
}) {
  const [screen, setScreen]           = useState<Screen>("main");
  // Open support tickets — shown as a badge on the Help & support row so the
  // customer can see at a glance that something is active.
  const [openTicketCount, setOpenTicketCount] = useState(0);
  useEffect(() => {
    supportApi.list()
      .then(d => setOpenTicketCount((d.tickets || []).filter(t => t.status === "OPEN" || t.status === "IN_PROGRESS").length))
      .catch(() => {});
  }, [screen]);
  // 2FA is a real profile field now (persisted server-side), not local-only UI state.
  const twoFAEnabled = !!profile?.twoFAEnabled;

  const displayName   = profile?.name   ?? "Arjun Kumar";
  const displayAvatar = profile?.avatar ?? null;
  const isOrg         = profile?.accountType === "organisation";

  function handleReorder(orderId: string) {
    onNavigate?.("order", orderId);
  }

  if (screen === "profile")               return <ProfileEdit profile={{ ...profile, name: displayName, avatar: displayAvatar }} onBack={() => setScreen("main")} onSave={p => { onProfileUpdate?.(p); setScreen("main"); }}/>;
  if (screen === "business")              return <BusinessDetails profile={profile} onSave={onProfileUpdate} onBack={() => setScreen("main")} onContactSupport={() => setScreen("help_support")}/>;
  if (screen === "delivery")              return <DeliveryAddresses onBack={() => setScreen("main")}/>;
  if (screen === "security")              return <SecurityScreen onBack={() => setScreen("main")} on2FASetup={() => setScreen("two_fa_setup")} twoFAEnabled={twoFAEnabled} onDisable2FA={() => { onProfileUpdate?.({ ...profile, name: displayName, avatar: displayAvatar, twoFAEnabled: false }); }}/>;
  if (screen === "two_fa_setup")          return <TwoFASetup onBack={() => setScreen("security")} onComplete={() => { onProfileUpdate?.({ ...profile, name: displayName, avatar: displayAvatar, twoFAEnabled: true }); setScreen("security"); }}/>;
  if (screen === "notifications_settings") return <NotificationsSettings onBack={() => setScreen("main")}/>;
  if (screen === "order_history")         return <OrderHistory onBack={() => setScreen("main")} onReorder={handleReorder}/>;
  if (screen === "payment")               return <PaymentBillingScreen onBack={() => setScreen("main")}/>;
  if (screen === "help_support")          return <HelpSupportScreen isOrg={isOrg} onBack={() => setScreen("main")}/>;
  if (screen === "faq")                   return <FAQScreen isOrg={isOrg} orgType={profile?.orgType} onBack={() => setScreen("main")}/>;
  if (screen === "terms")                 return <PolicyScreen kind="terms" isOrg={isOrg} orgType={profile?.orgType} onBack={() => setScreen("main")}/>;
  if (screen === "payment_gateway")       return <PolicyScreen kind="payment_gateway" isOrg={isOrg} orgType={profile?.orgType} onBack={() => setScreen("main")}/>;
  if (screen === "privacy")               return <PolicyScreen kind="privacy" isOrg={isOrg} orgType={profile?.orgType} onBack={() => setScreen("main")}/>;
  if (screen === "tech_packs") return (
    <SubScreen title="My tech packs" sub="Saved garment specifications" onBack={() => setScreen("main")}>
      <div className="text-center py-10">
        <FileText size={32} className="text-muted-foreground mx-auto mb-3" strokeWidth={1}/>
        <p className="text-foreground text-sm" style={{ fontWeight:500 }}>No tech packs yet</p>
        <p className="text-muted-foreground text-xs mt-1">Submit an order to auto-save your specs</p>
      </div>
    </SubScreen>
  );

  // ── Main menu ──────────────────────────────────────────────────────────────
  const groups = [
    [
      // "Edit profile" used to be listed here too, but the profile card right above
      // this menu already opens the exact same screen when tapped — having both was
      // two identical entry points to one destination. Kept the card (it shows the
      // avatar/name/email at a glance) and dropped this redundant row.
      ...(isOrg ? [{ icon:<Building2 size={16} strokeWidth={1.5}/>, label:"Business details",     s:"business"              as Screen }] : []),
      ...(!isOrg ? [{ icon:<MapPin size={16} strokeWidth={1.5}/>, label:"Delivery addresses", s:"delivery" as Screen }] : []),
      { icon:<CreditCard size={16} strokeWidth={1.5}/>,label:"Payment details",       s:"payment"               as Screen },
    ],
    [
      { icon:<Clock     size={16} strokeWidth={1.5}/>, label:"Order history",        s:"order_history"         as Screen, badge:`${historyOrders.length} orders`,  bc:"text-amber-600" },
      { icon:<FileText  size={16} strokeWidth={1.5}/>, label:"My tech packs",        s:"tech_packs"            as Screen },
    ],
    [
      { icon:<Bell      size={16} strokeWidth={1.5}/>, label:"Notifications",        s:"notifications_settings" as Screen },
      { icon:<Key       size={16} strokeWidth={1.5}/>, label:"Security & 2FA",       s:"security"              as Screen, badge: twoFAEnabled ? "2FA on" : "2FA off", bc: twoFAEnabled ? "text-emerald-600" : "text-red-500" },
      { icon:<FileText  size={16} strokeWidth={1.5}/>, label:"Help & support",       s:"help_support"          as Screen, ...(openTicketCount > 0 ? { badge: `${openTicketCount} open ticket${openTicketCount > 1 ? "s" : ""}`, bc: "text-amber-600" } : {}) },
      { icon:<FileText  size={16} strokeWidth={1.5}/>, label:"FAQ",                  s:"faq"                   as Screen },
    ],
    [
      { icon:<FileText  size={16} strokeWidth={1.5}/>, label:"Terms & conditions",   s:"terms"                 as Screen },
      { icon:<CreditCard size={16} strokeWidth={1.5}/>,label:"Payment gateway",      s:"payment_gateway"       as Screen },
      { icon:<ShieldCheck size={16} strokeWidth={1.5}/>,label:"Privacy policy",      s:"privacy"               as Screen },
      { icon:<LogOut    size={16} strokeWidth={1.5}/>, label:"Sign out",             s:null, danger:true },
    ],
  ] as { icon:React.ReactNode; label:string; s:Screen|null; badge?:string; bc?:string; danger?:boolean }[][];

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4 min-h-0" style={{ scrollbarWidth:"none" }}>
      {/* Profile card */}
      <button onClick={() => setScreen("profile")} className="w-full bg-foreground rounded-2xl p-4 flex items-center gap-4 mb-5 text-left" style={{ cursor:"pointer", border:"none" }}>
        <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ background: displayAvatar ? undefined : ACCENT }}>
          {displayAvatar
            ? <img src={displayAvatar} alt="Avatar" className="w-full h-full object-cover"/>
            : <span className="text-white text-sm" style={{ fontWeight:700 }}>{displayName.split(" ").map(w=>w[0]).join("").slice(0,2)}</span>
          }
        </div>
        <div className="flex-1">
          <p className="text-white text-sm" style={{ fontWeight:600 }}>{displayName}</p>
          <p className="text-white/50" style={{ fontSize:12 }}>{profile?.email ? profile.email : "Add your email"}</p>
        </div>
        <Edit3 size={15} color="rgba(255,255,255,0.45)" strokeWidth={1.5}/>
      </button>

      {groups.map((group, gi) => (
        <div key={gi} className="bg-card border border-border rounded-2xl overflow-hidden mb-3">
          {group.map((item, ii) => (
            <button key={ii} onClick={() => item.s ? setScreen(item.s) : onSignOut?.()}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${ii < group.length-1 ? "border-b border-border" : ""}`}
              style={{ background:"transparent", border:"none", cursor:"pointer" }}>
              <span style={{ color: item.danger ? "#dc2626" : "var(--muted-foreground)" }}>{item.icon}</span>
              <span className="flex-1 text-sm" style={{ fontWeight:400, color: item.danger ? "#dc2626" : "var(--foreground)" }}>{item.label}</span>
              {item.badge && <span className={`text-xs mr-1 ${item.bc}`} style={{ fontWeight:500 }}>{item.badge}</span>}
              {!item.danger && <ChevronRight size={14} className="text-muted-foreground" strokeWidth={1.5}/>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
