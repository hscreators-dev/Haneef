import { useState, useRef, useEffect } from "react";
import {
  ChevronRight, Building2, MapPin, CreditCard, Clock, FileText,
  Bell, ShieldCheck, LogOut, ArrowLeft, Camera, Check, Eye, EyeOff,
  Navigation, Plus, Trash2, Shield, Smartphone, Key, Edit3, Pencil,
  RotateCcw, Package,
} from "lucide-react";

const ACCENT = "#C8A97E";
const DARK   = "#0D0D0D";
const INP    = "w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none";
const fnt: React.CSSProperties = { fontFamily: "DM Sans, sans-serif" };

export type UserProfile = { name: string; avatar: string | null; accountType?: "personal" | "organisation"; orgName?: string; gstNumber?: string };

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
  const [phone, setPhone]   = useState("+91 98765 43210");
  const [email, setEmail]   = useState("arjun@threadcraft.in");
  const [avatar, setAvatar] = useState<string | null>(profile.avatar);
  const fileRef             = useRef<HTMLInputElement>(null);
  const [saved, setSaved]   = useState(false);

  function handleSave() {
    onSave({ name, avatar });
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
      <input value={name} onChange={e => setName(e.target.value)} className={INP + " mb-3 block"} style={fnt}/>

      <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Mobile number</p>
      <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" className={INP + " mb-3 block"} style={fnt}/>

      <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Email address</p>
      <input value={email} onChange={e => setEmail(e.target.value)} inputMode="email" className={INP + " mb-4 block"} style={fnt}/>

      <button onClick={handleSave}
        className="w-full rounded-2xl py-3.5 flex items-center justify-center gap-2 text-sm"
        style={{ background: saved ? "#e8f5e9" : DARK, color: saved ? "#2e7d32" : "#fff", fontWeight: 500, border:"none", cursor:"pointer" }}>
        {saved ? <><Check size={15} strokeWidth={2}/> Profile updated!</> : "Save changes"}
      </button>
    </SubScreen>
  );
}

// ─── Business Details (save → view → edit) ────────────────────────────────────
const orgTypeDefs = [
  { id:"school",       emoji:"🏫", label:"School"        },
  { id:"college",      emoji:"🎓", label:"College"       },
  { id:"corporate",    emoji:"🏢", label:"Corporate"     },
  { id:"hospital",     emoji:"🏥", label:"Hospital"      },
  { id:"industry",     emoji:"🏭", label:"Industry"      },
  { id:"hospitality",  emoji:"🏨", label:"Hotel"         },
  { id:"sports",       emoji:"⚽", label:"Sports Club"   },
  { id:"government",   emoji:"🏛️", label:"Government"   },
  { id:"ngo",          emoji:"🤝", label:"NGO / Trust"   },
];

interface BizData { orgType:string; name:string; reg:string; addr1:string; addr2:string; landmark:string; location:string; city:string; pin:string; gstn:string }

// ─── Payment & Billing ────────────────────────────────────────────────────────
interface BankAccount { id:number; bankName:string; accountNo:string; ifsc:string; branch:string; default:boolean }
interface UpiMethod { id:number; provider:"gpay"|"phonepe"|"paytm"|"upi"; address:string; default:boolean }

const upiProviderDefs = {
  gpay:    { label:"Google Pay",  icon:"🟢", color:"#34a853" },
  phonepe: { label:"PhonePe",     icon:"🟣", color:"#5f259f" },
  paytm:   { label:"Paytm",       icon:"🔵", color:"#002970" },
  upi:     { label:"UPI (Other)", icon:"🟠", color:"#ff6b00" },
};

function PaymentBillingScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<"bank"|"upi">("bank");

  // Bank accounts state
  const [banks, setBanks] = useState<BankAccount[]>([
    { id:1, bankName:"HDFC Bank", accountNo:"XXXX XXXX 4521", ifsc:"HDFC0001234", branch:"T. Nagar, Chennai", default:true }
  ]);
  const [addingBank, setAddingBank] = useState(false);
  const [editBankId, setEditBankId] = useState<number|null>(null);
  const [bName, setBName] = useState("");
  const [accNo, setAccNo] = useState("");
  const [ifsc, setIfsc]   = useState("");
  const [branch, setBranch] = useState("");

  // UPI state
  const [upis, setUpis] = useState<UpiMethod[]>([]);
  const [addingUpi, setAddingUpi] = useState(false);
  const [upiProvider, setUpiProvider] = useState<UpiMethod["provider"]>("gpay");
  const [upiAddr, setUpiAddr] = useState("");

  function startEditBank(b: BankAccount) {
    setEditBankId(b.id); setBName(b.bankName); setAccNo(b.accountNo); setIfsc(b.ifsc); setBranch(b.branch); setAddingBank(true);
  }
  function saveBank() {
    if (editBankId) {
      setBanks(p => p.map(b => b.id===editBankId ? { ...b, bankName:bName, accountNo:accNo, ifsc, branch } : b));
    } else {
      setBanks(p => [...p, { id:Date.now(), bankName:bName, accountNo:accNo, ifsc, branch, default:false }]);
    }
    setAddingBank(false); setEditBankId(null); setBName(""); setAccNo(""); setIfsc(""); setBranch("");
  }

  function openAddBank() { setEditBankId(null); setBName(""); setAccNo(""); setIfsc(""); setBranch(""); setAddingBank(true); }

  function saveUpi() {
    if (!upiAddr.trim()) return;
    setUpis(p => [...p, { id:Date.now(), provider:upiProvider, address:upiAddr.trim(), default:p.length===0 }]);
    setAddingUpi(false); setUpiAddr(""); setUpiProvider("gpay");
  }

  function launchUpiApp(provider: UpiMethod["provider"]) {
    // Deep-link to UPI app — shows info in prototype
    const links: Record<string, string> = { gpay:"gpay://upi/pay", phonepe:"phonepe://pay", paytm:"paytmmp://pay", upi:"upi://pay" };
    alert(`Opening ${upiProviderDefs[provider].label} for payment…\n(In production: ${links[provider]})`);
  }

  return (
    <SubScreen title="Payment & billing" sub="Bank accounts & UPI payment methods" onBack={onBack}>
      {/* Tab switcher */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {(["bank","upi"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className="py-2.5 rounded-xl text-sm"
            style={{ background: tab===t ? DARK : "var(--muted)", color: tab===t ? "#fff" : "var(--muted-foreground)", fontWeight: tab===t ? 500 : 400, border:"none", cursor:"pointer" }}>
            {t==="bank" ? "🏦 Bank account" : "📱 UPI / Wallets"}
          </button>
        ))}
      </div>

      {tab === "bank" && (
        <>
          {banks.map(b => (
            <div key={b.id} className="bg-card border border-border rounded-2xl p-4 mb-3">
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <CreditCard size={16} strokeWidth={1.5} className="text-muted-foreground"/>
                  </div>
                  <div>
                    <p className="text-foreground text-sm" style={{ fontWeight:600 }}>{b.bankName}</p>
                    <p className="text-muted-foreground" style={{ fontSize:11 }}>A/C: {b.accountNo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {b.default && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700" style={{ fontWeight:500 }}>Default</span>}
                  <button onClick={() => startEditBank(b)}><Pencil size={13} className="text-muted-foreground" strokeWidth={1.5}/></button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-y-1">
                <p className="text-muted-foreground" style={{ fontSize:11 }}>IFSC</p>
                <p className="text-foreground" style={{ fontSize:11, fontWeight:500, fontFamily:"monospace" }}>{b.ifsc}</p>
                <p className="text-muted-foreground" style={{ fontSize:11 }}>Branch</p>
                <p className="text-foreground" style={{ fontSize:11, fontWeight:500 }}>{b.branch}</p>
              </div>
              {!b.default && (
                <button onClick={() => setBanks(p => p.map(x => ({ ...x, default: x.id===b.id })))} className="mt-2 text-xs text-foreground" style={{ fontWeight:500 }}>Set as default</button>
              )}
            </div>
          ))}
          {addingBank ? (
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-foreground text-sm" style={{ fontWeight:600 }}>{editBankId ? "Edit bank account" : "Add bank account"}</p>
                <button onClick={() => setAddingBank(false)} className="text-muted-foreground text-xs">Cancel</button>
              </div>
              <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Bank name *</p>
              <input value={bName} onChange={e => setBName(e.target.value)} placeholder="e.g. HDFC Bank, SBI, ICICI" className={INP + " mb-3 block"} style={fnt}/>
              <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Account number *</p>
              <input value={accNo} onChange={e => setAccNo(e.target.value)} placeholder="e.g. 1234 5678 9012 3456" inputMode="numeric" className={INP + " mb-3 block"} style={{ ...fnt, fontFamily:"monospace" }}/>
              <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>IFSC code *</p>
              <input value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase())} placeholder="e.g. HDFC0001234" className={INP + " mb-3 block"} style={{ ...fnt, fontFamily:"monospace", textTransform:"uppercase" }}/>
              <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Branch name</p>
              <input value={branch} onChange={e => setBranch(e.target.value)} placeholder="e.g. T. Nagar, Chennai" className={INP + " mb-4 block"} style={fnt}/>
              <button onClick={saveBank} className="w-full bg-foreground text-white rounded-2xl py-3 text-sm" style={{ fontWeight:500, cursor:"pointer" }}>
                {editBankId ? "Save changes" : "Add bank account"}
              </button>
            </div>
          ) : (
            <button onClick={openAddBank} className="w-full border border-dashed border-border rounded-2xl py-4 text-sm text-muted-foreground flex items-center justify-center gap-2" style={{ cursor:"pointer" }}>
              <Plus size={14}/> Add another bank account
            </button>
          )}
        </>
      )}

      {tab === "upi" && (
        <>
          {/* UPI app quick-launch buttons */}
          <div className="mb-4">
            <p className="text-muted-foreground mb-2" style={{ fontSize:12 }}>Pay via app</p>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(upiProviderDefs) as [UpiMethod["provider"], typeof upiProviderDefs.gpay][]).map(([key, def]) => (
                <button key={key} onClick={() => launchUpiApp(key)}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-card border border-border"
                  style={{ cursor:"pointer" }}>
                  <span style={{ fontSize:22 }}>{def.icon}</span>
                  <span style={{ fontSize:10, fontWeight:500, color:"var(--foreground)" }}>{def.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Saved UPI addresses */}
          {upis.length > 0 && (
            <div className="mb-3">
              <p className="text-muted-foreground mb-2" style={{ fontSize:12 }}>Saved UPI IDs</p>
              {upis.map(u => (
                <div key={u.id} className="bg-card border border-border rounded-2xl p-3.5 mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize:20 }}>{upiProviderDefs[u.provider].icon}</span>
                    <div>
                      <p className="text-foreground text-sm" style={{ fontWeight:500 }}>{u.address}</p>
                      <p className="text-muted-foreground" style={{ fontSize:11 }}>{upiProviderDefs[u.provider].label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.default && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700" style={{ fontWeight:500 }}>Default</span>}
                    <button onClick={() => setUpis(p => p.filter(x => x.id !== u.id))}><Trash2 size={13} className="text-muted-foreground" strokeWidth={1.5}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {addingUpi ? (
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-foreground text-sm" style={{ fontWeight:600 }}>Add UPI ID</p>
                <button onClick={() => setAddingUpi(false)} className="text-muted-foreground text-xs">Cancel</button>
              </div>
              <p className="text-muted-foreground mb-2" style={{ fontSize:12 }}>Select provider</p>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {(Object.entries(upiProviderDefs) as [UpiMethod["provider"], typeof upiProviderDefs.gpay][]).map(([key, def]) => (
                  <button key={key} onClick={() => setUpiProvider(key)}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-xl"
                    style={{ background: upiProvider===key ? "rgba(13,13,13,0.06)" : "var(--muted)", border:`1.5px solid ${upiProvider===key ? DARK : "transparent"}`, cursor:"pointer" }}>
                    <span style={{ fontSize:18 }}>{def.icon}</span>
                    <span style={{ fontSize:9, fontWeight: upiProvider===key ? 600 : 400 }}>{def.label.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
              <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>UPI ID / VPA *</p>
              <input value={upiAddr} onChange={e => setUpiAddr(e.target.value)} placeholder="e.g. arjun@okicici or 98765@ybl"
                className={INP + " mb-4 block"} style={fnt}/>
              <button onClick={saveUpi} disabled={!upiAddr.trim()} className="w-full bg-foreground text-white rounded-2xl py-3 text-sm"
                style={{ fontWeight:500, cursor:"pointer", opacity: upiAddr.trim() ? 1 : 0.5 }}>
                Save UPI ID
              </button>
            </div>
          ) : (
            <button onClick={() => setAddingUpi(true)} className="w-full border border-dashed border-border rounded-2xl py-4 text-sm text-muted-foreground flex items-center justify-center gap-2" style={{ cursor:"pointer" }}>
              <Plus size={14}/> Add UPI ID
            </button>
          )}
        </>
      )}
    </SubScreen>
  );
}

function BusinessDetails({ onBack }: { onBack: () => void }) {
  const [mode, setMode]     = useState<"edit"|"view">("edit");
  const [orgType, setOrgType] = useState("school");
  const [name, setName]     = useState("Sri Vidya Mandir School");
  const [reg, setReg]       = useState("");
  const [addr1, setAddr1]   = useState("");
  const [addr2, setAddr2]   = useState("");
  const [landmark, setLandmark] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity]     = useState("");
  const [pin, setPin]       = useState("");
  const [gstn, setGstn]     = useState("");
  const [saved, setSaved]   = useState<BizData | null>(null);

  function save() {
    const d = { orgType, name, reg, addr1, addr2, landmark, location, city, pin, gstn };
    setSaved(d); setMode("view");
  }

  const orgEmoji = orgTypeDefs.find(t => t.id === orgType)?.emoji ?? "🏢";
  const orgLabel = orgTypeDefs.find(t => t.id === orgType)?.label ?? orgType;

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
            <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center text-xl flex-shrink-0">{orgEmoji}</div>
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
          {saved.gstn && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-muted-foreground text-xs mb-1" style={{ fontWeight:500, textTransform:"uppercase", letterSpacing:"0.06em" }}>GST Number</p>
              <p className="text-foreground text-sm" style={{ fontFamily:"monospace" }}>{saved.gstn}</p>
            </div>
          )}
        </div>
      )}

      {/* EDIT mode */}
      {mode === "edit" && (
        <>
          <p className="text-foreground text-xs mb-3" style={{ fontWeight:500, letterSpacing:"0.06em", textTransform:"uppercase" }}>Organisation type</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {orgTypeDefs.map(t => (
              <button key={t.id} onClick={() => setOrgType(t.id)}
                className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-center"
                style={{ border:`1.5px solid ${orgType===t.id ? DARK : "rgba(0,0,0,0.08)"}`, background:orgType===t.id ? "rgba(13,13,13,0.04)" : "#fff", cursor:"pointer" }}>
                <span style={{ fontSize:18 }}>{t.emoji}</span>
                <span style={{ fontSize:10, fontWeight:orgType===t.id ? 600 : 400, color:orgType===t.id ? DARK : "#374151" }}>{t.label}</span>
              </button>
            ))}
          </div>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Organisation name *</p>
          <input value={name} onChange={e => setName(e.target.value)} className={INP + " mb-3 block"} style={fnt}/>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Registration / Board / Affiliation</p>
          <input value={reg} onChange={e => setReg(e.target.value)} placeholder="e.g. CBSE, NABH, CIN" className={INP + " mb-3 block"} style={fnt}/>

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
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="City" className={INP} style={fnt}/>
            </div>
            <div>
              <p className="text-muted-foreground mb-1" style={{ fontSize:11 }}>Pincode *</p>
              <input value={pin} onChange={e => setPin(e.target.value)} placeholder="6-digit PIN" inputMode="numeric" maxLength={6} className={INP} style={fnt}/>
            </div>
          </div>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>GST number (optional)</p>
          <input value={gstn} onChange={e => setGstn(e.target.value)} placeholder="e.g. 29ABCDE1234F1Z5" className={INP + " mb-4 block"} style={{ ...fnt, textTransform:"uppercase" }}/>
          <button onClick={save} className="w-full bg-foreground text-white rounded-2xl py-3.5 text-sm" style={{ fontWeight:500, cursor:"pointer" }}>
            Save business details
          </button>
        </>
      )}
    </SubScreen>
  );
}

// ─── Delivery Addresses ───────────────────────────────────────────────────────
interface Address { id:number; label:string; line1:string; city:string; pin:string; default:boolean }

function DeliveryAddresses({ onBack }: { onBack: () => void }) {
  const [addresses, setAddresses] = useState<Address[]>([
    { id:1, label:"Sri Vidya Mandir School", line1:"#12 Gandhi Nagar, T. Nagar", city:"Chennai", pin:"600017", default:true },
  ]);
  const [adding, setAdding]     = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newLine1, setNewLine1] = useState("");
  const [newCity, setNewCity]   = useState("");
  const [newPin, setNewPin]     = useState("");

  function detectGPS() {
    setGpsLoading(true);
    setTimeout(() => {
      setNewLine1("#45 Anna Salai, Guindy"); setNewCity("Chennai"); setNewPin("600032"); setNewLabel("Current location");
      setGpsLoading(false); setAdding(true);
    }, 1500);
  }
  function saveNew() {
    if (!newLine1.trim() || !newCity.trim()) return;
    setAddresses(p => [...p, { id:Date.now(), label:newLabel || "New address", line1:newLine1, city:newCity, pin:newPin, default:false }]);
    setAdding(false); setNewLabel(""); setNewLine1(""); setNewCity(""); setNewPin("");
  }

  return (
    <SubScreen title="Delivery addresses" sub="Saved delivery locations" onBack={onBack}>
      {addresses.map(a => (
        <div key={a.id} className="bg-card border border-border rounded-2xl p-4 mb-3">
          <div className="flex items-start justify-between mb-1">
            <p className="text-foreground text-sm" style={{ fontWeight:500 }}>{a.label}</p>
            <div className="flex items-center gap-2">
              {a.default && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700" style={{ fontWeight:500 }}>Default</span>}
              <button onClick={() => setAddresses(p => p.filter(x => x.id !== a.id))}><Trash2 size={13} className="text-muted-foreground" strokeWidth={1.5}/></button>
            </div>
          </div>
          <p className="text-muted-foreground" style={{ fontSize:12 }}>{a.line1}</p>
          <p className="text-muted-foreground" style={{ fontSize:12 }}>{a.city}{a.pin ? ` — ${a.pin}` : ""}</p>
          {!a.default && (
            <button onClick={() => setAddresses(p => p.map(x => ({ ...x, default: x.id===a.id })))} className="mt-1.5 text-xs text-foreground" style={{ fontWeight:500 }}>Set as default</button>
          )}
        </div>
      ))}
      {!adding ? (
        <div className="flex flex-col gap-2">
          <button onClick={detectGPS} disabled={gpsLoading} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-border bg-card text-sm" style={{ cursor:"pointer", fontWeight:500 }}>
            <Navigation size={15} strokeWidth={1.5} style={{ color: ACCENT }}/>
            {gpsLoading ? "Detecting…" : "Use current location"}
          </button>
          <button onClick={() => setAdding(true)} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-foreground text-white text-sm" style={{ cursor:"pointer", fontWeight:500 }}>
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
            <div><p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>City *</p><input value={newCity} onChange={e => setNewCity(e.target.value)} placeholder="City" className={INP} style={fnt}/></div>
            <div><p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>PIN code</p><input value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="6-digit PIN" inputMode="numeric" maxLength={6} className={INP} style={fnt}/></div>
          </div>
          <button onClick={saveNew} className="w-full bg-foreground text-white rounded-2xl py-3 text-sm" style={{ fontWeight:500, cursor:"pointer" }}>Save address</button>
        </div>
      )}
    </SubScreen>
  );
}

// ─── Security & 2FA ───────────────────────────────────────────────────────────
function SecurityScreen({ onBack, on2FASetup, twoFAEnabled, onDisable2FA }: {
  onBack: () => void; on2FASetup: () => void; twoFAEnabled: boolean; onDisable2FA: () => void;
}) {
  const [showPass, setShowPass] = useState(false);

  return (
    <SubScreen title="Security" sub="Account protection settings" onBack={onBack}>
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
            <p style={{ fontSize:11, color:"#065f46" }}>✓ 2FA active. Every login will require phone OTP verification.</p>
          </div>
        ) : (
          <div className="rounded-xl px-3 py-2" style={{ background:"rgba(220,38,38,0.06)", border:"1px solid rgba(220,38,38,0.2)" }}>
            <p style={{ fontSize:11, color:"#dc2626" }}>⚠ Enable 2FA to protect your orders and payment details.</p>
          </div>
        )}
      </div>

      {/* Change password */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-3">
        <p className="text-foreground text-sm mb-3" style={{ fontWeight:600 }}>Change password</p>
        {["Current password","New password","Confirm new password"].map((lbl, i) => (
          <div key={i} className="mb-3">
            <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>{lbl}</p>
            <div className="relative">
              <input type={showPass && i===0 ? "text" : "password"} placeholder="••••••••" className={INP} style={fnt}/>
              {i===0 && (
                <button onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPass ? <EyeOff size={14} strokeWidth={1.5}/> : <Eye size={14} strokeWidth={1.5}/>}
                </button>
              )}
            </div>
          </div>
        ))}
        <button className="w-full bg-foreground text-white rounded-xl py-2.5 text-sm" style={{ fontWeight:500, cursor:"pointer" }}>Update password</button>
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
  const [phone, setPhone] = useState("+91 98765 43210");
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
            <button onClick={() => setStep("phone")} className="w-full bg-foreground text-white rounded-2xl py-3.5 text-sm" style={{ fontWeight:500, cursor:"pointer" }}>Set up now</button>
          </div>
        )}

        {step === "phone" && (
          <div>
            <p className="text-foreground mb-1" style={{ fontSize:18, fontWeight:700 }}>Verify your number</p>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">We'll send a 6-digit OTP to confirm your number is reachable.</p>
            <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Mobile number</p>
            <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" className={INP + " mb-4 block"} style={fnt}/>
            <button onClick={() => setStep("otp")} className="w-full bg-foreground text-white rounded-2xl py-3.5 text-sm" style={{ fontWeight:500, cursor:"pointer" }}>Send OTP</button>
          </div>
        )}

        {step === "otp" && (
          <div>
            <p className="text-foreground mb-1" style={{ fontSize:18, fontWeight:700 }}>Enter OTP</p>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">We sent a 6-digit code to <strong>{phone}</strong></p>

            {/* ── Compact minimalist OTP row ── */}
            <div className="flex gap-2 justify-center mb-2">
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  value={d}
                  onChange={e => handleOtp(i, e.target.value)}
                  onKeyDown={e => { if (e.key==="Backspace" && !d && i > 0) inputRefs.current[i-1]?.focus(); }}
                  maxLength={1}
                  inputMode="numeric"
                  className="text-center rounded-xl text-foreground outline-none"
                  style={{
                    width:42, height:50, fontSize:20, fontWeight:700,
                    border:`2px solid ${d ? DARK : "rgba(0,0,0,0.1)"}`,
                    background: d ? "rgba(13,13,13,0.04)" : "var(--card)",
                    fontFamily:"DM Sans, sans-serif",
                    transition:"border-color 0.15s",
                  }}
                />
              ))}
            </div>

            {/* Auto-fill progress hint */}
            <p className="text-muted-foreground text-center mb-6" style={{ fontSize:11 }}>
              {otp.filter(d => d).length}/6 digits entered
            </p>

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
            <button onClick={onComplete} className="w-full bg-foreground text-white rounded-2xl py-3.5 text-sm" style={{ fontWeight:500, cursor:"pointer" }}>Done</button>
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
        <button
          onClick={() => onReorder(order.id)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white text-sm"
          style={{ background: ACCENT, fontWeight:500, cursor:"pointer" }}>
          <RotateCcw size={15} strokeWidth={1.5}/> Reorder this
        </button>
        <p className="text-muted-foreground text-xs text-center">Reorder opens the order form pre-filled with these specs. You can edit any detail before submitting.</p>
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

function HelpSupportScreen({ onBack }: { onBack: () => void }) {
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);
  return (
    <SubScreen title="Help & support" sub="Raise a ticket or contact support" onBack={onBack}>
      <div className="bg-card border border-border rounded-2xl p-4 mb-3">
        <p className="text-foreground text-sm mb-3" style={{ fontWeight:600 }}>Create support ticket</p>
        <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Query type</p>
        <select className={INP + " mb-3"} style={fnt}>
          <option>Quote or order status</option>
          <option>Payment or invoice</option>
          <option>Sample pickup / swatch box</option>
          <option>Quality issue</option>
          <option>Account details</option>
        </select>
        <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Subject</p>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Short title" className={INP + " mb-3 block"} style={fnt}/>
        <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Details</p>
        <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Tell us what happened" className={INP + " mb-4 block"} style={{ ...fnt, resize:"none", height:90 }}/>
        <button onClick={() => setSubmitted(true)} disabled={!subject.trim() || !details.trim()} className="w-full rounded-2xl py-3 text-sm" style={{ background: subject.trim() && details.trim() ? DARK : "#e5e7eb", color: subject.trim() && details.trim() ? "#fff" : "#9ca3af", fontWeight:500 }}>
          {submitted ? "Ticket raised · FL-SUP-1042" : "Raise ticket"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {["Call coordinator", "WhatsApp support", "Email support", "Track ticket"].map(item => (
          <button key={item} className="rounded-2xl bg-card border border-border py-3 text-sm text-foreground" style={{ fontWeight:500 }}>{item}</button>
        ))}
      </div>
    </SubScreen>
  );
}

function FAQScreen({ onBack }: { onBack: () => void }) {
  const faqs = [
    ["How fast will I receive a quote?", "Most complete requests are reviewed within 2-4 hours during business time."],
    ["What is the minimum bulk quantity?", "Minimum quantity depends on organisation type and product. Custom orders start from 10 pcs."],
    ["Can I order uniforms and accessories together?", "Yes. Select multiple categories in Organisation type, such as uniforms, sports dress, and accessories."],
    ["Can FabricLink match my existing sample?", "Yes. Use References to upload photos or request sample pickup."],
    ["Where do I add GST details?", "Use Account > Business details for organisation information. Bank and delivery address have separate sections."],
    ["Can I change contact details for one order?", "Yes. Review the final Organisation screen and tap Change before submission."],
    ["What happens after quote approval?", "Your manager confirms advance payment, production timeline, QA, and dispatch."],
    ["How do I know the correct size?", "Use the size banner and allocate quantities by kids, men, or women sizing."],
    ["Can I request a fabric swatch?", "Yes. Use the swatch option in Home or References."],
    ["How do I raise an issue?", "Open Help & support from Account and create a ticket."],
  ];
  return (
    <SubScreen title="FAQ" sub="Helpful answers for bulk and custom orders" onBack={onBack}>
      {faqs.map(([q, a], i) => (
        <div key={q} className="bg-card border border-border rounded-2xl p-4 mb-3">
          <p className="text-foreground text-sm" style={{ fontWeight:600 }}>{i + 1}. {q}</p>
          <p className="text-muted-foreground mt-1" style={{ fontSize:12, lineHeight:1.55 }}>{a}</p>
        </div>
      ))}
    </SubScreen>
  );
}

function PolicyScreen({ kind, onBack }: { kind: "terms" | "payment_gateway" | "privacy"; onBack: () => void }) {
  const content = {
    terms: {
      title:"Terms & conditions",
      sub:"Prototype terms for managed procurement",
      rows:[
        ["Quotes", "All prices are estimates until fabric availability, GST, logistics, and final specs are confirmed."],
        ["Production", "Production starts only after quote approval, required advance payment, and final sample/spec confirmation."],
        ["Changes", "Changes after production start may affect cost, timeline, and feasibility."],
        ["Quality", "QA photos and inspection notes are shared before dispatch wherever applicable."],
      ],
    },
    payment_gateway: {
      title:"Payment gateway",
      sub:"Payment, invoice and refund handling",
      rows:[
        ["Milestones", "Bulk orders may use advance, production, and final settlement milestones."],
        ["Methods", "UPI, card, bank transfer, and approved offline methods can be recorded against the order."],
        ["Receipts", "Payment receipts and invoices appear in the document vault after confirmation."],
        ["Refunds", "Refunds depend on payment status, material purchase, production stage, and gateway settlement timelines."],
      ],
    },
    privacy: {
      title:"Privacy policy",
      sub:"Data usage and account protection",
      rows:[
        ["Account data", "Contact, organisation, delivery and payment details are used to process quotes and orders."],
        ["Documents", "Uploaded logos, samples, references and invoices are used only for order fulfilment and support."],
        ["Security", "OTP login and 2FA protect account access. Sensitive fields should be shared only inside the app."],
        ["Control", "Users can update profile, delivery, billing, and organisation details from Account."],
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
  onNavigate?: (tab: string) => void;
  profile?: UserProfile;
  onProfileUpdate?: (p: UserProfile) => void;
  onSignOut?: () => void;
}) {
  const [screen, setScreen]           = useState<Screen>("main");
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  const displayName   = profile?.name   ?? "Arjun Kumar";
  const displayAvatar = profile?.avatar ?? null;
  const isOrg         = profile?.accountType === "organisation";

  function handleReorder(orderId: string) {
    onNavigate?.("order");
  }

  if (screen === "profile")               return <ProfileEdit profile={{ name: displayName, avatar: displayAvatar }} onBack={() => setScreen("main")} onSave={p => { onProfileUpdate?.(p); setScreen("main"); }}/>;
  if (screen === "business")              return <BusinessDetails onBack={() => setScreen("main")}/>;
  if (screen === "delivery")              return <DeliveryAddresses onBack={() => setScreen("main")}/>;
  if (screen === "security")              return <SecurityScreen onBack={() => setScreen("main")} on2FASetup={() => setScreen("two_fa_setup")} twoFAEnabled={twoFAEnabled} onDisable2FA={() => setTwoFAEnabled(false)}/>;
  if (screen === "two_fa_setup")          return <TwoFASetup onBack={() => setScreen("security")} onComplete={() => { setTwoFAEnabled(true); setScreen("security"); }}/>;
  if (screen === "notifications_settings") return <NotificationsSettings onBack={() => setScreen("main")}/>;
  if (screen === "order_history")         return <OrderHistory onBack={() => setScreen("main")} onReorder={handleReorder}/>;
  if (screen === "payment")               return <PaymentBillingScreen onBack={() => setScreen("main")}/>;
  if (screen === "help_support")          return <HelpSupportScreen onBack={() => setScreen("main")}/>;
  if (screen === "faq")                   return <FAQScreen onBack={() => setScreen("main")}/>;
  if (screen === "terms")                 return <PolicyScreen kind="terms" onBack={() => setScreen("main")}/>;
  if (screen === "payment_gateway")       return <PolicyScreen kind="payment_gateway" onBack={() => setScreen("main")}/>;
  if (screen === "privacy")               return <PolicyScreen kind="privacy" onBack={() => setScreen("main")}/>;
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
      { icon:<Edit3     size={16} strokeWidth={1.5}/>, label:"Edit profile",         s:"profile"               as Screen },
      ...(isOrg ? [{ icon:<Building2 size={16} strokeWidth={1.5}/>, label:"Business details",     s:"business"              as Screen }] : []),
      ...(!isOrg ? [{ icon:<MapPin size={16} strokeWidth={1.5}/>, label:"Delivery addresses", s:"delivery" as Screen }] : []),
      { icon:<CreditCard size={16} strokeWidth={1.5}/>,label:"Payment & billing",    s:"payment"               as Screen },
    ],
    [
      { icon:<Clock     size={16} strokeWidth={1.5}/>, label:"Order history",        s:"order_history"         as Screen, badge:`${historyOrders.length} orders`,  bc:"text-amber-600" },
      { icon:<FileText  size={16} strokeWidth={1.5}/>, label:"My tech packs",        s:"tech_packs"            as Screen },
    ],
    [
      { icon:<Bell      size={16} strokeWidth={1.5}/>, label:"Notifications",        s:"notifications_settings" as Screen },
      { icon:<Key       size={16} strokeWidth={1.5}/>, label:"Security & 2FA",       s:"security"              as Screen, badge: twoFAEnabled ? "2FA on" : "2FA off", bc: twoFAEnabled ? "text-emerald-600" : "text-red-500" },
      { icon:<FileText  size={16} strokeWidth={1.5}/>, label:"Help & support",       s:"help_support"          as Screen },
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
          <p className="text-white/50" style={{ fontSize:12 }}>arjun@threadcraft.in</p>
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
