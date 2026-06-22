import { useState, useRef, useEffect } from "react";
import {
  Home, PlusCircle, MapPin, MessageSquare, User, Bell, UserCircle,
  Plus, Minus, Send, Check, Truck, Package, Microscope, Scissors,
  Ruler, Palette, Tag, Layers, FileText, ChevronRight, Building2,
  CreditCard, Clock, Shield, LogOut, X, Camera, Image as ImageIcon,
  Pipette, ChevronDown, Info, Sparkles, Box, ArrowRight,
  Upload, Wand2, QrCode, RotateCcw, CheckCircle2,
  Hash, Percent, Square,
} from "lucide-react";

// ─── Tokens ───────────────────────────────────────────────────────────────────
const navy = "#1a2540";
const gold = "#c8a84b";
const goldDark = "#a8883b";
const goldText = "#412402";
const goldLight = "#e8d49a";
const goldPale = "#f7f0de";

type Tab = "home" | "order" | "track" | "chat" | "profile";
type ChatKey = "quote" | "prod";
interface Msg { from: "me" | "them"; sender: string; text: string; type?: "quote"; }

const chats: Record<ChatKey, Msg[]> = {
  quote: [
    { from: "them", sender: "Priya — Your Coordinator", text: "Hi Arjun! I've reviewed your heavy denim order for 1000 pcs. Our partner mill in Coimbatore has the right GSM stock. I've put together a quote below." },
    { from: "them", sender: "Priya — Your Coordinator", text: "Please review and approve. Production slot is held till Monday.", type: "quote" },
    { from: "me", sender: "You", text: "Thanks Priya! Can we get OEKO-TEX certification on this batch?" },
    { from: "them", sender: "Priya", text: "Yes — adds ₹1,200 and ~3 extra days for certification. Shall I update the quote?" },
  ],
  prod: [
    { from: "them", sender: "Priya — Your Coordinator", text: "Your cotton twill batch is now in active weaving. Loom setup completed without issues." },
    { from: "me", sender: "You", text: "Will the colour match the swatch I sent exactly?" },
    { from: "them", sender: "Priya", text: "Confirmed — PMS 289 C matched by the dye house. You'll receive a dyed swatch photo tomorrow for sign-off." },
  ],
};

// ─── Shared ───────────────────────────────────────────────────────────────────
const sel: React.CSSProperties = { width: "100%", fontSize: 13, border: "0.5px solid #d1d5db", borderRadius: 8, padding: "9px 11px", background: "#f9fafb", color: "#111827", outline: "none" };

// ─── Simulated logged-in user profile ─────────────────────────────────────────
// In production this would come from auth context / API
const currentUser = {
  name: "Arjun Kumar",
  org: "Sri Vidya Mandir School",
  accountType: "institution" as "institution" | "individual",
  orgType: "school" as OrgType,
  email: "arjun@sriviydamandir.edu.in",
  phone: "+91 98765 43210",
};

function StatusBar() {
  return (
    <div style={{ background: navy }} className="flex justify-between items-center px-4 pt-2.5 pb-2 text-white text-[11px] font-medium">
      <span>9:41</span>
      <div className="flex gap-1.5 items-center"><span>4G</span><span>WiFi</span><span>🔋</span></div>
    </div>
  );
}
function NavHeader({ onBell }: { onBell: () => void }) {
  return (
    <div style={{ background: navy }} className="px-4 pt-3 pb-4 flex items-center gap-2.5">
      <div style={{ background: gold }} className="w-2 h-2 rounded-full mt-0.5 shrink-0" />
      <h1 className="text-white flex-1" style={{ fontSize: 18, fontWeight: 500 }}>FabricLink</h1>
      <button onClick={onBell} className="text-white/75 p-1"><Bell size={20} /></button>
      <button className="text-white/75 p-1"><UserCircle size={20} /></button>
    </div>
  );
}
function TabBar({ active, onSelect }: { active: Tab; onSelect: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; Icon: React.ElementType }[] = [
    { id: "home", label: "Home", Icon: Home },
    { id: "order", label: "New order", Icon: PlusCircle },
    { id: "track", label: "Track", Icon: MapPin },
    { id: "chat", label: "Inbox", Icon: MessageSquare },
    { id: "profile", label: "Account", Icon: User },
  ];
  return (
    <div className="flex border-b" style={{ borderColor: "#e5e7eb", background: "#fff" }}>
      {tabs.map(({ id, label, Icon }) => (
        <button key={id} onClick={() => onSelect(id)}
          className="flex-1 py-2.5 px-1 flex flex-col items-center gap-0.5 text-[11px] transition-all"
          style={{ color: active === id ? navy : "#9ca3af", fontWeight: active === id ? 500 : 400, background: "transparent", border: "none", borderBottom: `2px solid ${active === id ? gold : "transparent"}`, cursor: "pointer" }}>
          <Icon size={20} />{label}
        </button>
      ))}
    </div>
  );
}
function Bdg({ type }: { type: "prod" | "qc" | "new" }) {
  const s = { prod: { bg: "#E1F5EE", c: "#085041", t: "In production" }, qc: { bg: "#FAEEDA", c: "#633806", t: "Quality check" }, new: { bg: goldPale, c: "#633806", t: "Quote pending" } }[type];
  return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.c }}>{s.t}</span>;
}
function Prog({ pct }: { pct: number }) {
  return <div className="h-[3px] rounded-full mt-2.5" style={{ background: "#e5e7eb" }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: gold }} /></div>;
}
function Sec({ icon: I, title, children, defaultOpen = true }: { icon: React.ElementType; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border rounded-xl mb-3 overflow-hidden" style={{ borderColor: "#e5e7eb" }}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2 px-3.5 py-3 text-left" style={{ background: "transparent", border: "none", cursor: "pointer" }}>
        <I size={18} style={{ color: gold }} />
        <span className="flex-1" style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{title}</span>
        <ChevronDown size={15} color="#9ca3af" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>
      {open && <div className="px-3.5 pb-3.5 border-t" style={{ borderColor: "#f3f4f6" }}><div className="pt-3">{children}</div></div>}
    </div>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────

function SwatchBoxModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"browse" | "address" | "done">("browse");
  const fabrics = [
    { id: "A", name: "Premium Shirt Fabric", desc: "100% Cotton Pique · 220 GSM", color: "#e8e0d0" },
    { id: "B", name: "Sports T-Shirt Fabric", desc: "Cotton-Poly Blend · 180 GSM", color: "#d4e8e0" },
    { id: "C", name: "Uniform Twill", desc: "65/35 Poly-Cotton · 240 GSM", color: "#d4dce8" },
    { id: "D", name: "Heavyweight Canvas", desc: "100% Cotton · 320 GSM", color: "#e8d4d4" },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-2xl overflow-hidden" style={{ background: "#fff" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#f3f4f6" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>Free Fabric Swatch Box</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Ships in 1–2 days · No cost</div>
          </div>
          <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", borderRadius: 20, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
        </div>

        {step === "browse" && (
          <div className="px-4 py-3">
            <div className="text-[12px] mb-3" style={{ color: "#6b7280" }}>
              Touch each fabric before you order. We'll mail you 10×10 cm swatches with clear labels — pick your favourite in the app.
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {fabrics.map(f => (
                <div key={f.id} className="rounded-xl overflow-hidden border" style={{ borderColor: "#e5e7eb" }}>
                  <div className="h-14 flex items-center justify-center text-[22px] font-bold" style={{ background: f.color, color: "rgba(0,0,0,0.15)" }}>
                    {f.id}
                  </div>
                  <div className="p-2">
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#111827" }}>{f.name}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setStep("address")} className="w-full py-3 rounded-xl text-[14px] font-medium flex items-center justify-center gap-2" style={{ background: navy, color: "#fff", border: "none", cursor: "pointer" }}>
              <Box size={16} /> Order Free Swatch Box <ArrowRight size={14} />
            </button>
          </div>
        )}

        {step === "address" && (
          <div className="px-4 py-3">
            <div className="text-[13px] font-medium mb-3" style={{ color: "#111827" }}>Delivery address</div>
            {["School / Institution name", "Street address", "City & PIN code", "Contact person name", "Phone number"].map(p => (
              <input key={p} placeholder={p} style={{ ...sel, marginBottom: 8, display: "block" }} />
            ))}
            <button onClick={() => setStep("done")} className="w-full py-3 rounded-xl text-[14px] font-medium" style={{ background: gold, color: goldText, border: "none", cursor: "pointer", marginTop: 4 }}>
              Confirm & Request Delivery
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="px-4 py-6 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#E1F5EE" }}>
              <CheckCircle2 size={28} color="#085041" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#111827", marginBottom: 6 }}>Swatch box on its way!</div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
              We'll deliver 4 fabric samples within 1–2 days. Once you've felt them, open the app and select your favourite by letter (A, B, C, or D).
            </div>
            <button onClick={onClose} className="mt-5 w-full py-2.5 rounded-xl text-[14px] font-medium" style={{ background: "#f3f4f6", color: "#374151", border: "none", cursor: "pointer" }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

function HomeSection({ onNav }: { onNav: (t: Tab) => void }) {
  const [showSwatch, setShowSwatch] = useState(false);
  return (
    <div>
      {/* Hero */}
      <div style={{ background: navy }} className="px-4 pt-5 pb-5 text-white">
        <p className="text-[12px] mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>Good morning, Arjun</p>
        <h2 style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.3 }}>Source fabrics<br />from <span style={{ color: gold }}>verified mills</span></h2>
        <div className="flex gap-2 mt-4">
          <button onClick={() => onNav("order")} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg text-[13px] font-medium" style={{ background: gold, color: goldText, border: "none", cursor: "pointer" }}>
            <Plus size={16} /> Place order
          </button>
          <button onClick={() => onNav("track")} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg text-[13px] font-medium" style={{ background: "transparent", color: "#fff", border: "1.5px solid rgba(255,255,255,0.45)", cursor: "pointer" }}>
            <MapPin size={16} /> Track orders
          </button>
        </div>
      </div>

      {/* Free Swatch Box CTA */}
      <div className="mx-4 mt-4 rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg, #1a2540 60%, #2d3d60)", border: `1px solid ${navy}` }}>
        <div className="px-4 py-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: goldPale }}>
            <Box size={20} style={{ color: goldDark }} />
          </div>
          <div className="flex-1">
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Order a Free Fabric Swatch Box</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>Feel before you order · 4 fabric types · Free delivery</div>
          </div>
          <button onClick={() => setShowSwatch(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium shrink-0" style={{ background: gold, color: goldText, border: "none", cursor: "pointer" }}>
            Order <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 px-4 pt-3">
        {[{ num: "3", lbl: "Active" }, { num: "12", lbl: "Completed" }, { num: "97%", lbl: "On-time" }].map(({ num, lbl }) => (
          <div key={lbl} className="bg-white border rounded-xl p-3 text-center" style={{ borderColor: "#e5e7eb" }}>
            <div style={{ fontSize: 18, fontWeight: 500, color: navy }}>{num}</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Orders */}
      <div className="text-[11px] font-medium px-4 pt-4 pb-2 uppercase tracking-wider" style={{ color: "#6b7280" }}>Active orders</div>
      {[
        { id: "#FL-2041", badge: "prod" as const, name: "300m Cotton Twill — Navy", meta: "500 pcs · GSM 220 · ETA Jul 14", pct: 55, go: "track" as Tab, quoteReady: false },
        { id: "#FL-2038", badge: "qc" as const, name: "Linen Blend Fabric — Ivory", meta: "200 pcs · GSM 160 · ETA Jul 8", pct: 78, go: "track" as Tab, quoteReady: false },
        { id: "#FL-2045", badge: "new" as const, name: "Heavy Denim — Washed Black", meta: "1000 pcs · GSM 360 · Awaiting approval", pct: 15, go: "chat" as Tab, quoteReady: true },
      ].map(o => (
        <div key={o.id} className="mx-4 mb-2.5 rounded-xl border bg-white overflow-hidden" style={{ borderColor: o.quoteReady ? gold : "#e5e7eb" }}>
          <div onClick={() => onNav(o.go)} className="p-3.5 cursor-pointer">
            <div className="flex justify-between items-start mb-2">
              <span style={{ fontSize: 12, color: "#9ca3af" }}>{o.id}</span>
              <Bdg type={o.badge} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#111827", marginBottom: 4 }}>{o.name}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{o.meta}</div>
            <Prog pct={o.pct} />
          </div>
          {/* Bug 9: Quote CTA directly on card */}
          {o.quoteReady && (
            <button onClick={() => onNav(o.go)} className="w-full flex items-center justify-between px-3.5 py-2.5" style={{ background: goldPale, border: "none", borderTop: `1px solid ${goldLight}`, cursor: "pointer" }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 13 }}>💰</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: goldText }}>Quote ready — ₹57,700</div>
                  <div style={{ fontSize: 10, color: "#92400e" }}>Tap to review & approve in Inbox</div>
                </div>
              </div>
              <ChevronRight size={15} style={{ color: goldDark }} />
            </button>
          )}
        </div>
      ))}

      {showSwatch && <SwatchBoxModal onClose={() => setShowSwatch(false)} />}
    </div>
  );
}

// ─── NEW ORDER — Colors ───────────────────────────────────────────────────────

interface ColorEntry { id: number; hex: string; pantone: string; label: string; position: string; }
const presets = [
  { hex: "#1a2540", label: "Navy Blue" }, { hex: "#c8a84b", label: "Golden" },
  { hex: "#f5f0e8", label: "Off White" }, { hex: "#2d5a3d", label: "Forest Green" },
  { hex: "#8b3a3a", label: "Burgundy" }, { hex: "#3a4a7a", label: "Royal Blue" },
  { hex: "#5c4a3a", label: "Chocolate" }, { hex: "#e8e0d0", label: "Ivory" },
  { hex: "#111111", label: "Black" }, { hex: "#e5e5e5", label: "Light Grey" },
  { hex: "#d4394a", label: "Red" }, { hex: "#f4a324", label: "Amber" },
];
let cid = 10;

function ColorSection() {
  const [colors, setColors] = useState<ColorEntry[]>([{ id: 1, hex: "#1a2540", pantone: "PMS 289 C", label: "Navy Blue", position: "" }]);
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState("#c8a84b");
  const [pantone, setPantone] = useState("");
  const [lbl, setLbl] = useState("");
  const [preset, setPreset] = useState<string | null>(null);
  const fRef = useRef<HTMLInputElement>(null);

  const [pos, setPos] = useState("");
  function add() {
    cid++;
    setColors(p => [...p, { id: cid, hex, pantone, label: lbl || hex, position: pos }]);
    setOpen(false); setPantone(""); setLbl(""); setPreset(null); setPos("");
  }
  function fromPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    const mocks = [["#3a5a8a", "Steel Blue"], ["#a85a3a", "Terracotta"], ["#5a8a3a", "Sage Green"]];
    const [h, l] = mocks[Math.floor(Math.random() * 3)];
    setHex(h); setLbl(l); setOpen(true); setPos("");
  }

  return (
    <div>
      <div className="text-[12px] mb-2" style={{ color: "#6b7280" }}>Colors in this order</div>
      {colors.length === 0 && <div className="text-[12px] rounded-lg py-3 text-center" style={{ color: "#9ca3af", border: "1px dashed #d1d5db" }}>No colors yet — tap + Add Color</div>}
      <div className="flex flex-col gap-2 mb-3">
        {colors.map(c => (
          <div key={c.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb" }}>
            <div className="w-7 h-7 rounded-full shrink-0 border-2 border-white shadow-sm" style={{ background: c.hex }} />
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{c.label}</div>
              {c.pantone && <div style={{ fontSize: 11, color: "#9ca3af" }}>{c.pantone}</div>}
              {c.position && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>📍 {c.position}</div>}
            </div>
            <div className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "#e5e7eb", color: "#6b7280", fontFamily: "monospace" }}>{c.hex}</div>
            <button onClick={() => setColors(p => p.filter(x => x.id !== c.id))} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={14} /></button>
          </div>
        ))}
      </div>
      {!open && (
        <div className="flex gap-2">
          <button onClick={() => setOpen(true)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-medium" style={{ background: goldPale, color: "#633806", border: `1px dashed ${gold}`, cursor: "pointer" }}>
            <Plus size={15} /> Add color
          </button>
          <button onClick={() => fRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px]" style={{ background: "#f3f4f6", color: "#374151", border: "0.5px solid #d1d5db", cursor: "pointer" }}>
            <Pipette size={15} /> From swatch photo
          </button>
          <input ref={fRef} type="file" accept="image/*" className="hidden" onChange={fromPhoto} />
        </div>
      )}
      {open && (
        <div className="rounded-xl p-3.5 mt-1" style={{ background: "#f9fafb", border: "0.5px solid #d1d5db" }}>
          <div className="text-[12px] font-medium mb-2.5" style={{ color: "#374151" }}>Choose a color</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {presets.map(s => (
              <button key={s.hex} onClick={() => { setPreset(s.hex); setHex(s.hex); setLbl(s.label); }} title={s.label}
                className="w-7 h-7 rounded-full" style={{ background: s.hex, border: preset === s.hex ? `2.5px solid ${navy}` : "2px solid #fff", boxShadow: "0 0 0 1px #d1d5db", cursor: "pointer", outline: "none" }} />
            ))}
          </div>
          <div className="flex gap-2 mb-2.5">
            <input type="color" value={hex} onChange={e => { setHex(e.target.value); setPreset(null); }} className="w-10 h-9 rounded-lg cursor-pointer" style={{ padding: 2, border: "0.5px solid #d1d5db" }} />
            <input type="text" value={hex} onChange={e => setHex(e.target.value)} style={{ ...sel, flex: 1, fontFamily: "monospace", fontSize: 13 }} />
          </div>
          <div className="flex gap-2 mb-2">
            <input type="text" value={lbl} onChange={e => setLbl(e.target.value)} placeholder="Color name" style={{ ...sel, flex: 1, fontSize: 13 }} />
            <input type="text" value={pantone} onChange={e => setPantone(e.target.value)} placeholder="Pantone (optional)" style={{ ...sel, flex: 1, fontSize: 13 }} />
          </div>
          <input type="text" value={pos} onChange={e => setPos(e.target.value)} placeholder="Position / placement (e.g. Front chest, Collar, Sleeve)" style={{ ...sel, fontSize: 13, marginBottom: 10, display: "block" }} />
          <div className="flex gap-2">
            <button onClick={add} className="flex-1 py-2 rounded-lg text-[13px] font-medium" style={{ background: gold, color: goldText, border: "none", cursor: "pointer" }}>Add to order</button>
            <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-[13px]" style={{ background: "#f3f4f6", color: "#374151", border: "0.5px solid #d1d5db", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NEW ORDER — Sizes with per-size qty ───────────────────────────────────────

type SizeCat = "mens" | "womens" | "school" | "college" | "custom";
const sizeCats: { id: SizeCat; label: string; desc: string }[] = [
  { id: "mens", label: "Men's", desc: "Adult male — chest-based" },
  { id: "womens", label: "Women's", desc: "Adult female — UK sizing" },
  { id: "school", label: "School / Kids", desc: "Age-based school sizing" },
  { id: "college", label: "College / Unisex", desc: "Relaxed campus fit" },
  { id: "custom", label: "Custom", desc: "Enter your own labels" },
];
const sizeSets: Record<SizeCat, { label: string; hint: string }[]> = {
  mens: [{ label: "XS", hint: '34"' }, { label: "S", hint: '36"' }, { label: "M", hint: '38-40"' }, { label: "L", hint: '42-44"' }, { label: "XL", hint: '46"' }, { label: "XXL", hint: '48"' }, { label: "3XL", hint: '50"' }],
  womens: [{ label: "XS", hint: "UK 6" }, { label: "S", hint: "UK 8" }, { label: "M", hint: "UK 10-12" }, { label: "L", hint: "UK 14" }, { label: "XL", hint: "UK 16" }, { label: "XXL", hint: "UK 18" }],
  school: [{ label: "3-4Y", hint: "Age 3-4" }, { label: "5-6Y", hint: "Age 5-6" }, { label: "7-8Y", hint: "Age 7-8" }, { label: "9-10Y", hint: "Age 9-10" }, { label: "11-12Y", hint: "Age 11-12" }, { label: "13-14Y", hint: "Age 13-14" }, { label: "15-16Y", hint: "Age 15-16" }],
  college: [{ label: "XS", hint: "" }, { label: "S", hint: "" }, { label: "M", hint: "" }, { label: "L", hint: "" }, { label: "XL", hint: "" }, { label: "XXL", hint: "" }, { label: "3XL", hint: "" }],
  custom: [],
};

function SizeSection({ totalQty, defaultCat = "school", step = 1, onAllocationChange }: { totalQty: number; defaultCat?: SizeCat; step?: number; onAllocationChange?: (allocated: number) => void }) {
  const [cat, setCat] = useState<SizeCat>(defaultCat);
  const [showCat, setShowCat] = useState(false);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [customSizes, setCustomSizes] = useState<string[]>([]);
  const [customIn, setCustomIn] = useState("");
  const [mode, setMode] = useState<"qty" | "pct">("qty");

  // Sync category and reset qtys when the group type changes externally
  useEffect(() => {
    setCat(defaultCat);
    setQtys({});
    setShowCat(false);
  }, [defaultCat]);

  const sizes = cat === "custom" ? customSizes.map(l => ({ label: l, hint: "" })) : sizeSets[cat];
  const distributed = Object.values(qtys).reduce((a, b) => a + b, 0);
  const remaining = totalQty - distributed;
  const over = remaining < 0;
  const catMeta = sizeCats.find(c => c.id === cat)!;

  useEffect(() => { onAllocationChange?.(distributed); }, [distributed]);

  function setQty(label: string, val: number) {
    setQtys(prev => ({ ...prev, [label]: Math.max(0, val) }));
  }
  function addCustom() {
    const v = customIn.trim(); if (!v || customSizes.includes(v)) return;
    setCustomSizes(p => [...p, v]); setCustomIn("");
  }
  function removeCustom(s: string) {
    setCustomSizes(p => p.filter(x => x !== s));
    setQtys(prev => { const n = { ...prev }; delete n[s]; return n; });
  }

  // Distribute evenly
  function distributeEvenly() {
    const active = sizes.map(s => s.label);
    if (!active.length) return;
    const each = Math.floor(totalQty / active.length);
    const rem = totalQty - each * active.length;
    const next: Record<string, number> = {};
    active.forEach((l, i) => { next[l] = each + (i === 0 ? rem : 0); });
    setQtys(next);
  }

  return (
    <div>
      {/* Category picker */}
      <div className="mb-3">
        <div className="text-[12px] mb-1.5" style={{ color: "#6b7280" }}>Who is this garment for?</div>
        <button onClick={() => setShowCat(v => !v)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[14px]" style={{ background: "#f9fafb", border: "0.5px solid #d1d5db", color: "#111827", cursor: "pointer" }}>
          <span style={{ fontWeight: 500 }}>{catMeta.label}</span>
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 12, color: "#9ca3af" }}>{catMeta.desc}</span>
            <ChevronDown size={14} color="#9ca3af" style={{ transform: showCat ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </div>
        </button>
        {showCat && (
          <div className="mt-1 rounded-xl overflow-hidden" style={{ border: "0.5px solid #d1d5db", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
            {sizeCats.map(c => (
              <button key={c.id} onClick={() => { setCat(c.id); setQtys({}); setShowCat(false); }} className="w-full flex items-center justify-between px-3 py-2.5 border-b last:border-b-0 transition-colors" style={{ background: cat === c.id ? goldPale : "#fff", borderColor: "#f3f4f6", cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: cat === c.id ? "#633806" : "#111827" }}>{c.label}</span>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>{c.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Custom size adder */}
      {cat === "custom" && (
        <div className="mb-3">
          <div className="flex gap-2 mb-2">
            <input value={customIn} onChange={e => setCustomIn(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustom()} placeholder='e.g. 38, 40, XL' style={{ ...sel, flex: 1, fontSize: 13 }} />
            <button onClick={addCustom} className="px-3 rounded-lg text-[13px] font-medium" style={{ background: navy, color: "#fff", border: "none", cursor: "pointer" }}>Add</button>
          </div>
        </div>
      )}

      {/* Size-by-size quantity */}
      {sizes.length > 0 && (
        <>
          {/* Header row */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px]" style={{ color: "#6b7280" }}>Quantity per size</div>
            <div className="flex gap-1">
              <button onClick={() => setMode("qty")} className="px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: mode === "qty" ? navy : "#f3f4f6", color: mode === "qty" ? "#fff" : "#6b7280", border: "none", cursor: "pointer" }}>
                <Hash size={10} style={{ display: "inline", marginRight: 2 }} />pcs
              </button>
              <button onClick={() => setMode("pct")} className="px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: mode === "pct" ? navy : "#f3f4f6", color: mode === "pct" ? "#fff" : "#6b7280", border: "none", cursor: "pointer" }}>
                <Percent size={10} style={{ display: "inline", marginRight: 2 }} />%
              </button>
              <button onClick={distributeEvenly} className="px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-0.5" style={{ background: goldPale, color: "#633806", border: "none", cursor: "pointer" }}>
                <RotateCcw size={10} /> Even
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mb-3">
            {sizes.map(s => {
              const q = qtys[s.label] ?? 0;
              const pct = totalQty > 0 ? Math.round((q / totalQty) * 100) : 0;
              return (
                <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb" }}>
                  {/* Size label */}
                  <div className="shrink-0" style={{ width: 54 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{s.label}</div>
                    {s.hint && <div style={{ fontSize: 10, color: "#9ca3af" }}>{s.hint}</div>}
                  </div>
                  {/* Progress bar */}
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: q > 0 ? gold : "#e5e7eb" }} />
                  </div>
                  {/* Quantity control */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setQty(s.label, q - (mode === "pct" ? Math.round(totalQty * 0.05) : step))} className="w-6 h-6 rounded flex items-center justify-center" style={{ background: "#e5e7eb", border: "none", cursor: "pointer" }}>
                      <Minus size={11} color="#374151" />
                    </button>
                    <div className="text-center" style={{ width: 54, fontSize: 13, fontWeight: 500, color: "#111827" }}>
                      {mode === "pct" ? `${pct}%` : `${q}`}
                    </div>
                    <button onClick={() => setQty(s.label, q + (mode === "pct" ? Math.round(totalQty * 0.05) : step))} className="w-6 h-6 rounded flex items-center justify-center" style={{ background: "#e5e7eb", border: "none", cursor: "pointer" }}>
                      <Plus size={11} color="#374151" />
                    </button>
                  </div>
                  {/* Remove for custom */}
                  {cat === "custom" && <button onClick={() => removeCustom(s.label)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={13} /></button>}
                </div>
              );
            })}
          </div>

          {/* Running total */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: over ? "#FFF1F2" : remaining === 0 ? "#E1F5EE" : "#f9fafb", border: `0.5px solid ${over ? "#fca5a5" : remaining === 0 ? "#6ee7b7" : "#e5e7eb"}` }}>
            <div>
              <div style={{ fontSize: 12, color: over ? "#dc2626" : remaining === 0 ? "#065f46" : "#6b7280" }}>
                {over ? "Over-allocated" : remaining === 0 ? "Perfectly allocated ✓" : "Allocated so far"}
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
                {over ? `${Math.abs(remaining)} pcs too many` : remaining === 0 ? "All sizes filled" : `${remaining} pcs unassigned`}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: over ? "#dc2626" : remaining === 0 ? "#065f46" : navy }}>{distributed} / {totalQty}</div>
              <div style={{ fontSize: 10, color: "#9ca3af" }}>pcs total</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── NEW ORDER — Reference Images (Assisted) ──────────────────────────────────

type DigiStatus = "pending" | "processing" | "done";
interface RefImg {
  id: number;
  url: string;
  name: string;
  size: number;
  caption: string;
  tag: "logo" | "fabric" | "garment" | "other";
  digiStatus?: DigiStatus;
  needsDigi?: boolean;
}

let imgId = 0;

function isLikelyLowRes(file: File) {
  // Heuristic: if file < 80 KB, likely low-res or compressed JPEG
  return file.size < 80_000;
}

function DigiStatusChip({ status }: { status: DigiStatus }) {
  if (status === "pending") return (
    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "#FAEEDA", color: "#633806" }}>
      <Wand2 size={9} /> Awaiting digitization
    </div>
  );
  if (status === "processing") return (
    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "#E0F0FF", color: "#1a4a8a" }}>
      <Sparkles size={9} /> Digitizing…
    </div>
  );
  return (
    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "#E1F5EE", color: "#085041" }}>
      <CheckCircle2 size={9} /> Vector ready ✓
    </div>
  );
}

const tagOpts: { id: RefImg["tag"]; label: string }[] = [
  { id: "logo", label: "Logo / Crest" },
  { id: "fabric", label: "Fabric close-up" },
  { id: "garment", label: "Garment reference" },
  { id: "other", label: "Other" },
];

// ─── Courier Modal (Match My Existing Uniform) ────────────────────────────────
function CourierModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"info" | "schedule" | "done">("info");
  const [date, setDate] = useState("Tomorrow, 10 Jun");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-2xl overflow-hidden" style={{ background: "#fff" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#f3f4f6" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>Match My Existing Uniform</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>We'll pick up your sample & identify the fabric</div>
          </div>
          <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", borderRadius: 20, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
        </div>

        {step === "info" && (
          <div className="px-4 py-4">
            <div className="flex flex-col gap-3 mb-4">
              {[
                { n: "1", t: "Put your old uniform in an envelope or bag", sub: "Any shirt or t-shirt you want us to match" },
                { n: "2", t: "Stick the printed label on it", sub: "We'll email you the label after scheduling" },
                { n: "3", t: "Our courier picks it up tomorrow", sub: "Free pickup from your location" },
                { n: "4", t: "We identify the fabric & update your order", sub: "GSM, blend, weave — confirmed within 24h" },
              ].map(({ n, t, sub }) => (
                <div key={n} className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold" style={{ background: navy, color: "#fff" }}>{n}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{t}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setStep("schedule")} className="w-full py-3 rounded-xl text-[14px] font-medium flex items-center justify-center gap-2" style={{ background: navy, color: "#fff", border: "none", cursor: "pointer" }}>
              <Truck size={16} /> Schedule Pickup <ArrowRight size={14} />
            </button>
          </div>
        )}

        {step === "schedule" && (
          <div className="px-4 py-4">
            <div className="text-[13px] font-medium mb-3" style={{ color: "#111827" }}>Pickup address</div>
            {["School / Institution name", "Street address", "City & PIN code", "Contact number"].map(p => (
              <input key={p} placeholder={p} style={{ ...sel, marginBottom: 8, display: "block" }} />
            ))}
            <div className="text-[13px] font-medium mb-2" style={{ color: "#111827" }}>Preferred pickup slot</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {["Tomorrow, 10 Jun", "Thu, 11 Jun", "Fri, 12 Jun", "Sat, 13 Jun"].map(d => (
                <button key={d} onClick={() => setDate(d)} className="py-2 rounded-lg text-[12px] font-medium" style={{ background: date === d ? navy : "#f3f4f6", color: date === d ? "#fff" : "#374151", border: "none", cursor: "pointer" }}>{d}</button>
              ))}
            </div>
            <button onClick={() => setStep("done")} className="w-full py-3 rounded-xl text-[14px] font-medium" style={{ background: gold, color: goldText, border: "none", cursor: "pointer" }}>
              Confirm Pickup for {date}
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="px-4 py-6 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#E1F5EE" }}>
              <CheckCircle2 size={28} color="#085041" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#111827", marginBottom: 6 }}>Pickup scheduled!</div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, marginBottom: 8 }}>
              Check your email for the shipping label. Stick it on the package — our courier arrives <strong>{date}</strong> between 10am–6pm.
            </div>
            <div className="rounded-xl p-3 text-left mb-4" style={{ background: "#f9fafb", border: "1px dashed #d1d5db" }}>
              <div className="flex items-center gap-2 mb-1">
                <QrCode size={28} color={navy} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: navy }}>FABRICLINK SAMPLE · #SP-0821</div>
                  <div style={{ fontSize: 10, color: "#9ca3af" }}>FabricLink Pvt. Ltd., Coimbatore 641001</div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: "#9ca3af" }}>Scan at pickup · Handle with care</div>
            </div>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl text-[14px] font-medium" style={{ background: "#f3f4f6", color: "#374151", border: "none", cursor: "pointer" }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Buyer Persona ────────────────────────────────────────────────────────────

type Persona = "organisation" | "individual";
type OrgType = "school" | "college" | "corporate" | "hospital" | "industry" | "hospitality" | "sports" | "government" | "ngo";

interface PersonaDef {
  id: Persona;
  emoji: string;
  label: string;
  sub: string;
  accent: string;
  accentBg: string;
}

const personas: PersonaDef[] = [
  { id: "organisation", emoji: "🏛️", label: "Organisation", sub: "School, corporate, hospital & more", accent: "#1a4a8a", accentBg: "#E0F0FF" },
  { id: "individual",   emoji: "👤", label: "Individual",    sub: "Custom garment · Min 4 pcs",         accent: "#374151", accentBg: "#f3f4f6" },
];

// ── Organisation type definitions ──────────────────────────────────────────────
interface OrgTypeDef {
  id: OrgType;
  emoji: string;
  label: string;
  sub: string;
}

const orgTypes: OrgTypeDef[] = [
  { id: "school",       emoji: "🏫", label: "School",             sub: "K-12 uniforms & sportswear" },
  { id: "college",      emoji: "🎓", label: "College / University", sub: "Batch wear & campus events" },
  { id: "corporate",    emoji: "🏢", label: "Corporate",           sub: "Office wear & branded apparel" },
  { id: "hospital",     emoji: "🏥", label: "Hospital / Clinic",   sub: "Scrubs, lab coats & patient wear" },
  { id: "industry",     emoji: "🏭", label: "Industry / Factory",  sub: "Workwear, safety & uniforms" },
  { id: "hospitality",  emoji: "🏨", label: "Hotel / Hospitality", sub: "Staff uniforms & aprons" },
  { id: "sports",       emoji: "⚽", label: "Sports Club / Team",  sub: "Jerseys, tracksuits & kits" },
  { id: "government",   emoji: "🏛️", label: "Government / PSU",   sub: "Formal & department uniforms" },
  { id: "ngo",          emoji: "🤝", label: "NGO / Trust",         sub: "Volunteer tees & event wear" },
];

// ── Organisation sub-configs ───────────────────────────────────────────────────
const orgConfig: Record<OrgType, {
  minQty: number; defaultQty: number; qtyStep: number;
  defaultSizeCat: SizeCat;
  fabricLabel: string; fabricOptions: string[];
  gsmOptions: string[]; weaveOptions: string[];
  nameLabel: string; namePlaceholder: string;
  regLabel: string; regPlaceholder: string;
}> = {
  school: {
    minQty: 50, defaultQty: 200, qtyStep: 50, defaultSizeCat: "school",
    fabricLabel: "Fabric type",
    fabricOptions: ["100% Cotton Pique", "Cotton-Poly Blend", "100% Polyester", "Linen Blend", "Heavy Cotton Twill"],
    gsmOptions: ["160–180 GSM (polo shirts)", "180–220 GSM (shirts)", "240–280 GSM (jackets)"],
    weaveOptions: ["Plain", "Pique", "Twill", "Oxford"],
    nameLabel: "School name", namePlaceholder: "e.g. St. Mary's High School",
    regLabel: "Board / Affiliation", regPlaceholder: "e.g. CBSE, ICSE, State Board",
  },
  college: {
    minQty: 100, defaultQty: 500, qtyStep: 50, defaultSizeCat: "college",
    fabricLabel: "Fabric type",
    fabricOptions: ["Cotton-Poly Blend (Dri-fit)", "100% Cotton", "Fleece / Sweatshirt", "Micro Pique", "Heavy GSM for Hoodies"],
    gsmOptions: ["160–180 GSM (tees)", "200–240 GSM (sweatshirts)", "280–320 GSM (hoodies)"],
    weaveOptions: ["Plain", "Pique", "French Terry", "Fleece"],
    nameLabel: "College / University name", namePlaceholder: "e.g. PSG College of Technology",
    regLabel: "Affiliated under", regPlaceholder: "e.g. Anna University, Autonomous",
  },
  corporate: {
    minQty: 50, defaultQty: 300, qtyStep: 50, defaultSizeCat: "mens",
    fabricLabel: "Fabric type",
    fabricOptions: ["Oxford Cotton (formal shirts)", "Cotton-Poly Blend (polo)", "Premium Pique", "Linen Blend", "Dri-fit (branded tees)"],
    gsmOptions: ["120–140 GSM (summer wear)", "180–200 GSM (formal shirts)", "220–260 GSM (polos & jackets)"],
    weaveOptions: ["Oxford", "Plain", "Pique", "Twill"],
    nameLabel: "Company name", namePlaceholder: "e.g. Tata Consultancy Services",
    regLabel: "Industry / Sector", regPlaceholder: "e.g. IT, Finance, Manufacturing",
  },
  hospital: {
    minQty: 50, defaultQty: 150, qtyStep: 25, defaultSizeCat: "mens",
    fabricLabel: "Garment type",
    fabricOptions: ["Medical scrubs (Cotton-Poly)", "Lab coats (100% Cotton)", "Patient gowns (soft cotton)", "OT wear (poly-cotton)", "Nurse uniforms (Pique cotton)"],
    gsmOptions: ["130–160 GSM (patient gowns)", "180–200 GSM (scrubs & lab coats)", "220–240 GSM (OT wear)"],
    weaveOptions: ["Plain weave", "Twill", "Ripstop"],
    nameLabel: "Hospital / Clinic name", namePlaceholder: "e.g. Apollo Hospitals, City Clinic",
    regLabel: "Registration / NABH no. (optional)", regPlaceholder: "e.g. NABH-2024-XXXX",
  },
  industry: {
    minQty: 100, defaultQty: 500, qtyStep: 100, defaultSizeCat: "mens",
    fabricLabel: "Workwear type",
    fabricOptions: ["Heavy cotton twill (workwear)", "Poly-Cotton Ripstop (durable)", "FR Cotton (fire-retardant)", "100% Polyester (hi-vis)", "Denim (heavy duty)"],
    gsmOptions: ["240–280 GSM (standard workwear)", "300–340 GSM (heavy duty)", "360+ GSM (protective wear)"],
    weaveOptions: ["Twill", "Ripstop", "Plain", "Canvas"],
    nameLabel: "Company / Factory name", namePlaceholder: "e.g. Mahindra Industries, XYZ Pvt Ltd",
    regLabel: "Industry type", regPlaceholder: "e.g. Automotive, Textile, Construction",
  },
  hospitality: {
    minQty: 30, defaultQty: 100, qtyStep: 25, defaultSizeCat: "mens",
    fabricLabel: "Fabric type",
    fabricOptions: ["Premium Cotton-Poly (staff shirts)", "Cotton Twill (trousers & aprons)", "Pique knit (polo uniforms)", "Chef coat cotton", "Spandex blend (front-desk wear)"],
    gsmOptions: ["160–180 GSM (shirts)", "200–240 GSM (aprons)", "260–300 GSM (chef coats)"],
    weaveOptions: ["Plain", "Twill", "Pique", "Oxford"],
    nameLabel: "Hotel / Restaurant name", namePlaceholder: "e.g. Taj Hotels, The Grand Brasserie",
    regLabel: "Property type", regPlaceholder: "e.g. 5-star hotel, Restaurant chain, Resort",
  },
  sports: {
    minQty: 20, defaultQty: 100, qtyStep: 20, defaultSizeCat: "college",
    fabricLabel: "Sports fabric",
    fabricOptions: ["Dri-fit Polyester (jerseys)", "Mesh knit (ventilated kits)", "Compression spandex blend", "Fleece (tracksuits)", "Microfibre (performance wear)"],
    gsmOptions: ["100–130 GSM (jerseys & singlets)", "160–180 GSM (training wear)", "280–320 GSM (tracksuits)"],
    weaveOptions: ["Knit (jersey)", "Mesh", "Interlock", "Fleece"],
    nameLabel: "Club / Team name", namePlaceholder: "e.g. Chennai Super Kings, ABC FC",
    regLabel: "Sport / League", regPlaceholder: "e.g. Cricket, Football, Basketball",
  },
  government: {
    minQty: 100, defaultQty: 500, qtyStep: 100, defaultSizeCat: "mens",
    fabricLabel: "Fabric type",
    fabricOptions: ["Heavy Cotton Twill (uniforms)", "Poly-Cotton Blend (formal)", "100% Cotton (summer wear)", "Wool Blend (winter formal)", "100% Polyester (ceremonial)"],
    gsmOptions: ["180–220 GSM (standard uniform)", "240–280 GSM (formal & ceremonial)", "300–340 GSM (winter wear)"],
    weaveOptions: ["Twill", "Plain", "Serge", "Oxford"],
    nameLabel: "Department / Organisation name", namePlaceholder: "e.g. Tamil Nadu Police, TNEB",
    regLabel: "Department code / Ministry", regPlaceholder: "e.g. Home Dept., Ministry of Health",
  },
  ngo: {
    minQty: 20, defaultQty: 100, qtyStep: 20, defaultSizeCat: "college",
    fabricLabel: "Fabric type",
    fabricOptions: ["100% Cotton (tees & polos)", "Organic Cotton (eco-friendly)", "Cotton-Poly Blend", "Recycled Polyester", "Bamboo Blend (sustainable)"],
    gsmOptions: ["140–160 GSM (lightweight tees)", "180–200 GSM (standard)", "220–240 GSM (polo & jackets)"],
    weaveOptions: ["Plain", "Pique", "Jersey knit"],
    nameLabel: "NGO / Trust name", namePlaceholder: "e.g. Teach For India, HelpAge India",
    regLabel: "Registration number (optional)", regPlaceholder: "e.g. 80G / FCRA no.",
  },
};

// ── Custom order config (unified Individual) ──────────────────────────────────
type GarmentType = "school_uniform" | "tshirt" | "shirt" | "polo" | "hoodie" | "sportswear" | "dress" | "formal";
type GroupType   = "kids" | "students" | "family" | "friends" | "personal" | "event";

interface CustomOrderDetails {
  garmentType: GarmentType;
  groupType: GroupType;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  pin: string;
}

const garmentTypes: { id: GarmentType; emoji: string; label: string }[] = [
  { id: "school_uniform", emoji: "🏫", label: "Uniform" },
  { id: "tshirt",         emoji: "👕", label: "T-shirt design" },
  { id: "shirt",          emoji: "👔", label: "Shirt design" },
  { id: "polo",           emoji: "🧵", label: "Polo / Collar" },
  { id: "hoodie",         emoji: "🧥", label: "Hoodie / Sweatshirt" },
  { id: "sportswear",     emoji: "⚽", label: "Sportswear / Kit" },
  { id: "dress",          emoji: "👗", label: "Dress / Frock" },
  { id: "formal",         emoji: "🤵", label: "Formal wear" },
];

const groupTypes: { id: GroupType; emoji: string; label: string; sub: string }[] = [
  { id: "kids",     emoji: "👶", label: "Kids",     sub: "Age 3–14 · School sizing" },
  { id: "students", emoji: "🎒", label: "Students", sub: "College / teen sizing" },
  { id: "family",   emoji: "👨‍👩‍👧‍👦", label: "Family",   sub: "Mixed ages, all sizes" },
  { id: "friends",  emoji: "👫", label: "Friends",  sub: "Group / gang order" },
  { id: "personal", emoji: "👤", label: "Personal", sub: "Just for me" },
  { id: "event",    emoji: "🎉", label: "Event",    sub: "Party, reunion, sports day" },
];

const garmentFabricMap: Record<GarmentType, { fabricOptions: string[]; gsmOptions: string[] }> = {
  school_uniform: { fabricOptions: ["100% Cotton Pique", "Cotton-Poly Blend", "Oxford Cotton", "100% Polyester"], gsmOptions: ["160–180 GSM (polo)", "180–220 GSM (shirts)", "240–280 GSM (blazers)"] },
  tshirt:         { fabricOptions: ["Soft 100% Cotton", "Cotton-Poly Blend", "Dri-fit Polyester", "Slub Cotton", "Bamboo Blend"], gsmOptions: ["140–160 GSM (lightweight)", "180–200 GSM (standard)", "220–240 GSM (premium)"] },
  shirt:          { fabricOptions: ["Oxford Cotton", "Poplin Cotton", "Linen Blend", "Cotton-Poly (easy care)", "Rayon / Viscose"], gsmOptions: ["120–140 GSM (summer)", "160–180 GSM (standard)", "200–220 GSM (formal)"] },
  polo:           { fabricOptions: ["100% Cotton Pique", "Dri-fit Pique", "Micro Pique", "Cotton-Poly Pique"], gsmOptions: ["170–190 GSM (lightweight polo)", "200–220 GSM (standard)", "240–260 GSM (premium)"] },
  hoodie:         { fabricOptions: ["Fleece (80/20 cotton-poly)", "French Terry", "Heavy GSM Fleece", "Sherpa lined fleece"], gsmOptions: ["240–280 GSM (light hoodie)", "300–340 GSM (standard)", "360–400 GSM (heavyweight)"] },
  sportswear:     { fabricOptions: ["Dri-fit Polyester", "Mesh knit", "Compression spandex blend", "Microfibre performance", "Recycled Polyester"], gsmOptions: ["100–130 GSM (jersey / singlet)", "160–180 GSM (training wear)", "200–240 GSM (track pants)"] },
  dress:          { fabricOptions: ["100% Cotton", "Linen Blend", "Rayon / Viscose", "Georgette", "Cotton-Spandex"], gsmOptions: ["100–130 GSM (light summer)", "140–160 GSM (standard)", "180–200 GSM (structured)"] },
  formal:         { fabricOptions: ["Wool Blend", "100% Polyester (suit)", "Oxford Cotton (shirt)", "Satin-finish poly", "Linen Blend"], gsmOptions: ["180–200 GSM (shirts)", "240–280 GSM (trousers)", "300–360 GSM (blazers / suits)"] },
};

const groupSizeCatMap: Record<GroupType, SizeCat> = {
  kids: "school", students: "college", family: "mens", friends: "mens", personal: "custom", event: "college",
};

// ── Shared persona config (used by PersonaOrderForm) ──────────────────────────
type PersonaFormConfig = {
  minQty: number; defaultQty: number; qtyStep: number;
  defaultSizeCat: SizeCat;
  fabricLabel: string; fabricOptions: string[];
  gsmOptions: string[] | null; weaveOptions: string[] | null;
  refConfig: { showLogo: boolean; showCourier: boolean; showSwatch: boolean; showInspiration: boolean; inspLabel: string; };
};

const orgRefConfig = { showLogo: true, showCourier: true, showSwatch: true, showInspiration: true, inspLabel: "Style inspiration, logo or brand reference" };
const individualRefConfig  = { showLogo: true, showCourier: true, showSwatch: true, showInspiration: true, inspLabel: "Sketch, inspiration photo, or reference" };

// ─── Persona Selector ─────────────────────────────────────────────────────────

function PersonaSelector({ onSelect }: { onSelect: (p: Persona) => void }) {
  return (
    <div className="p-4">
      <div className="mb-6">
        <div style={{ fontSize: 20, fontWeight: 700, color: navy, marginBottom: 6 }}>Place a new order</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>Choose the type of order to get started.</div>
      </div>

      <div className="flex flex-col gap-3 mb-5">
        {/* Organisation Order */}
        <button onClick={() => onSelect("organisation")}
          className="w-full text-left rounded-2xl overflow-hidden active:scale-[0.98] transition-all"
          style={{ border: `2px solid ${navy}`, cursor: "pointer", background: "#fff" }}>
          <div className="px-4 py-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[26px]" style={{ background: "#E0F0FF" }}>🏛️</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: navy }}>Organisation Order</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>School · College · Corporate · Hospital & more</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["Bulk quantity", "GSM & fabric specs", "Logo digitisation", "Courier sample pickup", "Size distribution"].map(t => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#E0F0FF", color: "#1a4a8a" }}>{t}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ background: navy }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>Minimum 50 pcs · Bulk pricing</span>
            <ChevronRight size={16} color="rgba(255,255,255,0.7)" />
          </div>
        </button>

        {/* Custom Order */}
        <button onClick={() => onSelect("individual")}
          className="w-full text-left rounded-2xl overflow-hidden active:scale-[0.98] transition-all"
          style={{ border: `2px solid ${gold}`, cursor: "pointer", background: "#fff" }}>
          <div className="px-4 py-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[26px]" style={{ background: goldPale }}>👤</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#412402" }}>Custom Order</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>Parent · Student · Family · Friends · Personal</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["From 1 pc", "Any garment type", "Kids to adults", "Style inspiration", "Personal fit"].map(t => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: goldPale, color: goldText }}>{t}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ background: gold }}>
            <span style={{ fontSize: 12, color: goldText }}>No minimum · Fully personalised</span>
            <ChevronRight size={16} color={goldText} />
          </div>
        </button>
      </div>

      <div className="flex gap-2 px-3 py-2.5 rounded-xl" style={{ background: goldPale, border: `0.5px solid ${goldLight}` }}>
        <Info size={14} style={{ color: goldDark, marginTop: 1, flexShrink: 0 }} />
        <p style={{ fontSize: 12, color: "#633806", lineHeight: 1.5 }}>
          Your coordinator is a real person — they'll review and confirm every detail before production begins.
        </p>
      </div>
    </div>
  );
}

// ─── References & Samples — single unified option picker ──────────────────────

type RefOption = "upload_logo" | "inspiration" | "match_uniform" | "swatch_box" | "describe_later";

interface RefOptionDef {
  id: RefOption;
  emoji: string;
  label: string;
  sub: string;
  badge?: string;
  badgeColor?: string;
  badgeBg?: string;
}

// Per-persona available options (order matters — first = default highlight)
const personaRefOptions: Record<Persona, RefOption[]> = {
  organisation: ["upload_logo", "inspiration", "match_uniform", "swatch_box", "describe_later"],
  individual:  ["upload_logo", "inspiration", "match_uniform", "swatch_box", "describe_later"],
};

const allRefOptions: RefOptionDef[] = [
  { id: "upload_logo",    emoji: "🖼️", label: "Upload logo / design file",    sub: "Any photo works — we digitise it for free",       badge: "Free digitise", badgeColor: "#412402", badgeBg: goldPale },
  { id: "inspiration",    emoji: "📸", label: "Share a style photo",           sub: "Screenshot, Instagram, Pinterest — anything" },
  { id: "match_uniform",  emoji: "👕", label: "Match my existing uniform",     sub: "Send us a sample — we identify fabric & GSM",    badge: "Recommended",   badgeColor: "#1a4a8a", badgeBg: "#E0F0FF" },
  { id: "swatch_box",     emoji: "📦", label: "Send me a fabric swatch box",   sub: "Feel the fabrics before you commit",             badge: "Free",          badgeColor: "#085041", badgeBg: "#E1F5EE" },
  { id: "describe_later", emoji: "✏️", label: "I'll describe it in notes",     sub: "Your coordinator will follow up to confirm" },
];

function RefImagesSection({ persona }: { persona: Persona }) {
  const availableIds = personaRefOptions[persona];
  const options = availableIds.map(id => allRefOptions.find(o => o.id === id)!);

  const [chosen, setChosen] = useState<RefOption | null>(null);

  // Upload states
  const [logoFiles, setLogoFiles] = useState<RefImg[]>([]);
  const [showDigiBanner, setShowDigiBanner] = useState(false);
  const [inspirationFiles, setInspirationFiles] = useState<RefImg[]>([]);
  const [showCourier, setShowCourier] = useState(false);
  const [showSwatchModal, setShowSwatchModal] = useState(false);

  const logoCamRef = useRef<HTMLInputElement>(null);
  const logoGalRef = useRef<HTMLInputElement>(null);
  const inspCamRef = useRef<HTMLInputElement>(null);
  const inspGalRef = useRef<HTMLInputElement>(null);

  function selectOption(id: RefOption) {
    setChosen(id);
    if (id === "match_uniform") setShowCourier(true);
    if (id === "swatch_box") setShowSwatchModal(true);
  }

  function processLogoFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    imgId++;
    setLogoFiles([{ id: imgId, url: URL.createObjectURL(file), name: file.name, size: file.size, caption: "", tag: "logo", needsDigi: isLikelyLowRes(file), digiStatus: isLikelyLowRes(file) ? "pending" : undefined }]);
    if (isLikelyLowRes(file)) setShowDigiBanner(true);
  }

  function processInspirationFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).slice(0, 4 - inspirationFiles.length).forEach(f => {
      imgId++;
      setInspirationFiles(p => [...p, { id: imgId, url: URL.createObjectURL(f), name: f.name, size: f.size, caption: "", tag: "garment" }]);
    });
  }

  function acceptDigi() {
    setLogoFiles(p => p.map(f => ({ ...f, digiStatus: "processing" as DigiStatus })));
    setShowDigiBanner(false);
    setTimeout(() => setLogoFiles(p => p.map(f => ({ ...f, digiStatus: "done" as DigiStatus }))), 3000);
  }

  return (
    <div>
      <p className="mb-3" style={{ fontSize: 12, color: "#6b7280" }}>Pick <strong>one</strong> option — whichever is easiest for you.</p>

      {/* Unified single-choice list */}
      <div className="flex flex-col gap-2">
        {options.map(opt => {
          const isChosen = chosen === opt.id;
          const isModal = opt.id === "match_uniform" || opt.id === "swatch_box";

          return (
            <div key={opt.id}>
              {/* Option row */}
              <button
                onClick={() => selectOption(opt.id)}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all"
                style={{
                  border: `1.5px solid ${isChosen ? navy : "#e5e7eb"}`,
                  background: isChosen ? "#f0f4fb" : "#fff",
                  cursor: "pointer",
                  borderRadius: isChosen && !isModal ? "12px 12px 0 0" : 12,
                }}>
                {/* Radio circle */}
                <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ border: `2px solid ${isChosen ? navy : "#d1d5db"}`, background: isChosen ? navy : "#fff" }}>
                  {isChosen && <div className="w-2 h-2 rounded-full" style={{ background: "#fff" }} />}
                </div>
                <span style={{ fontSize: 19, lineHeight: 1 }}>{opt.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{opt.sub}</div>
                </div>
                {opt.badge && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: opt.badgeBg, color: opt.badgeColor }}>
                    {opt.badge}
                  </span>
                )}
              </button>

              {/* Expanded panel — only for non-modal options */}
              {isChosen && !isModal && opt.id !== "describe_later" && (
                <div className="rounded-b-xl px-3.5 pb-3.5 pt-3" style={{ background: "#f7f9ff", border: "1.5px solid", borderColor: navy, borderTop: "none" }}>

                  {/* ── Upload logo panel ── */}
                  {opt.id === "upload_logo" && (
                    <div>
                      {logoFiles.length > 0 ? (
                        <div className="rounded-xl overflow-hidden relative mb-3" style={{ border: "0.5px solid #e5e7eb" }}>
                          <img src={logoFiles[0].url} alt="Logo" className="w-full object-cover" style={{ height: 100 }} />
                          {logoFiles[0].digiStatus === "processing" && (
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(26,37,64,0.6)" }}>
                              <div className="text-center"><Sparkles size={20} color={gold} style={{ margin: "0 auto 3px" }} /><div style={{ fontSize: 11, color: "#fff" }}>Digitizing…</div></div>
                            </div>
                          )}
                          {logoFiles[0].digiStatus === "done" && (
                            <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "#E1F5EE", color: "#085041" }}>
                              <CheckCircle2 size={9} /> Vector ready ✓
                            </div>
                          )}
                          <button onClick={() => { setLogoFiles([]); setShowDigiBanner(false); }} className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)", border: "none", cursor: "pointer" }}><X size={11} color="#fff" /></button>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <button onClick={() => logoCamRef.current?.click()} className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-medium" style={{ border: "1px solid #d1d5db", background: "#fff", color: "#374151", cursor: "pointer" }}>
                              <Camera size={14} /> Take photo
                            </button>
                            <button onClick={() => logoGalRef.current?.click()} className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-medium" style={{ border: "1px solid #d1d5db", background: "#fff", color: "#374151", cursor: "pointer" }}>
                              <ImageIcon size={14} /> Gallery
                            </button>
                          </div>
                          <button onClick={() => logoGalRef.current?.click()} className="w-full flex flex-col items-center gap-1 py-4 rounded-xl mb-2" style={{ border: "1.5px dashed #d1d5db", background: "#fafafa", cursor: "pointer" }}>
                            <Upload size={16} color="#9ca3af" />
                            <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>Drop or tap to upload</span>
                            <span style={{ fontSize: 11, color: "#9ca3af" }}>JPG, PNG, PDF, AI — any quality</span>
                          </button>
                        </>
                      )}
                      {/* Digi offer */}
                      {showDigiBanner && (
                        <div className="rounded-xl" style={{ background: goldPale, border: `1px solid ${gold}` }}>
                          <div className="px-3 py-2.5 flex gap-2 items-start">
                            <Wand2 size={14} style={{ color: goldDark, marginTop: 1, flexShrink: 0 }} />
                            <div className="flex-1">
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#412402", marginBottom: 2 }}>Don't have a crisp logo file?</div>
                              <div style={{ fontSize: 11, color: "#633806", lineHeight: 1.5 }}>Upload any photo — even blurry. Our team digitises it into a vector for free.</div>
                              <div className="flex gap-2 mt-2">
                                <button onClick={acceptDigi} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium" style={{ background: navy, color: "#fff", border: "none", cursor: "pointer" }}><Wand2 size={10} /> Digitise free</button>
                                <button onClick={() => setShowDigiBanner(false)} className="px-2.5 py-1 rounded-lg text-[11px]" style={{ background: "rgba(0,0,0,0.08)", color: "#633806", border: "none", cursor: "pointer" }}>Keep as-is</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {!showDigiBanner && logoFiles.length === 0 && (
                        <div className="flex gap-1.5 px-2.5 py-2 rounded-lg" style={{ background: goldPale, border: `0.5px solid ${goldLight}` }}>
                          <Info size={12} style={{ color: goldDark, flexShrink: 0, marginTop: 1 }} />
                          <p style={{ fontSize: 11, color: "#633806", lineHeight: 1.5 }}>Blurry photo? No problem — we'll trace it into a crisp vector for free before printing.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Style inspiration panel ── */}
                  {opt.id === "inspiration" && (
                    <div>
                      {inspirationFiles.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          {inspirationFiles.map(img => (
                            <div key={img.id} className="rounded-xl overflow-hidden relative" style={{ border: "0.5px solid #e5e7eb", height: 88 }}>
                              <img src={img.url} alt="Inspiration" className="w-full h-full object-cover" />
                              <button onClick={() => setInspirationFiles(p => p.filter(x => x.id !== img.id))} className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)", border: "none", cursor: "pointer" }}><X size={11} color="#fff" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                      {inspirationFiles.length < 4 && (
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <button onClick={() => inspCamRef.current?.click()} className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-medium" style={{ border: "1px solid #d1d5db", background: "#fff", color: "#374151", cursor: "pointer" }}>
                            <Camera size={14} /> Take photo
                          </button>
                          <button onClick={() => inspGalRef.current?.click()} className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-medium" style={{ border: "1.5px dashed #d1d5db", background: "#fafafa", color: "#374151", cursor: "pointer" }}>
                            <ImageIcon size={14} /> Upload
                          </button>
                        </div>
                      )}
                      <div className="flex gap-1.5 px-2.5 py-2 rounded-lg" style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb" }}>
                        <Info size={12} style={{ color: "#9ca3af", marginTop: 1, flexShrink: 0 }} />
                        <p style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>Screenshot from Instagram, Pinterest, or WhatsApp — your coordinator will study the cut, colour, and feel.</p>
                      </div>
                    </div>
                  )}

                  {/* ── Describe later panel ── */}
                  {opt.id === "describe_later" && (
                    <div className="flex gap-1.5 px-2.5 py-2 rounded-lg" style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb" }}>
                      <Info size={12} style={{ color: "#9ca3af", marginTop: 1, flexShrink: 0 }} />
                      <p style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>Use the notes box below to describe what you have in mind. Your coordinator will reach out within 24 hours to confirm the details.</p>
                    </div>
                  )}

                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hidden file inputs */}
      <input ref={logoCamRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => processLogoFiles(e.target.files)} />
      <input ref={logoGalRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => processLogoFiles(e.target.files)} />
      <input ref={inspCamRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => processInspirationFiles(e.target.files)} />
      <input ref={inspGalRef} type="file" accept="image/*" multiple className="hidden" onChange={e => processInspirationFiles(e.target.files)} />

      {showCourier && <CourierModal onClose={() => setShowCourier(false)} />}
      {showSwatchModal && <SwatchBoxModal onClose={() => setShowSwatchModal(false)} />}
    </div>
  );
}


// ─── Stitching & Packaging ────────────────────────────────────────────────────

const stitchingOptions = [
  { id: "single_needle", label: "Single needle stitch", sub: "Standard flat seam", cost: "" },
  { id: "double_needle", label: "Double needle stitch", sub: "Reinforced hems & cuffs", cost: "+₹2/pc" },
  { id: "flatlock",      label: "Flatlock stitch",      sub: "Sportswear, no chafe seam", cost: "+₹3/pc" },
  { id: "overlock",      label: "Overlock / Serger",    sub: "Clean edge finishing", cost: "+₹1.5/pc" },
  { id: "chain",         label: "Chain stitch",         sub: "Heavy-duty workwear", cost: "+₹2.5/pc" },
];

const packagingOptions = [
  { id: "bulk_loose",   label: "Bulk / Loose packing",        sub: "Pieces folded in a box · Economy", cost: "" },
  { id: "poly_bag",     label: "Individual poly bag",         sub: "Each piece in a sealed bag", cost: "+₹3/pc" },
  { id: "poly_cardboard", label: "Poly bag + cardboard",      sub: "Rigid cardboard insert inside bag", cost: "+₹6/pc" },
  { id: "ironing_poly", label: "Ironing + poly bag",          sub: "Pressed flat & individually bagged", cost: "+₹8/pc" },
  { id: "bundle",       label: "Bundle packing",              sub: "Grouped by size, rubber-banded", cost: "+₹1/pc" },
  { id: "hangtag_hanger", label: "Hangtag + hanger",         sub: "Retail-ready on hanger with tag", cost: "+₹15/pc" },
  { id: "gift_box",     label: "Gift box packing",            sub: "Premium box with tissue paper", cost: "+₹25/pc" },
];

function PackagingSection() {
  const [stitch, setStitch] = useState<string>("single_needle");
  const [packing, setPacking] = useState<string>("bulk_loose");

  const selectedPacking = packagingOptions.find(p => p.id === packing);
  const selectedStitch  = stitchingOptions.find(s => s.id === stitch);

  return (
    <div>
      {/* Stitching */}
      <div className="mb-4">
        <div className="text-[12px] font-medium mb-2" style={{ color: "#6b7280" }}>Stitching type</div>
        <div className="flex flex-col gap-1.5">
          {stitchingOptions.map(opt => (
            <button key={opt.id} onClick={() => setStitch(opt.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
              style={{ border: `1.5px solid ${stitch === opt.id ? navy : "#e5e7eb"}`, background: stitch === opt.id ? "#f0f4fb" : "#fff", cursor: "pointer" }}>
              <div className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center" style={{ border: `2px solid ${stitch === opt.id ? navy : "#d1d5db"}`, background: stitch === opt.id ? navy : "#fff" }}>
                {stitch === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div className="flex-1">
                <div style={{ fontSize: 13, fontWeight: 500, color: stitch === opt.id ? navy : "#111827" }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{opt.sub}</div>
              </div>
              {opt.cost && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: "#f3f4f6", color: "#374151" }}>{opt.cost}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Packaging */}
      <div className="mb-3">
        <div className="text-[12px] font-medium mb-2" style={{ color: "#6b7280" }}>Packaging type</div>
        <div className="flex flex-col gap-1.5">
          {packagingOptions.map(opt => (
            <button key={opt.id} onClick={() => setPacking(opt.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
              style={{ border: `1.5px solid ${packing === opt.id ? navy : "#e5e7eb"}`, background: packing === opt.id ? "#f0f4fb" : "#fff", cursor: "pointer" }}>
              <div className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center" style={{ border: `2px solid ${packing === opt.id ? navy : "#d1d5db"}`, background: packing === opt.id ? navy : "#fff" }}>
                {packing === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div className="flex-1">
                <div style={{ fontSize: 13, fontWeight: 500, color: packing === opt.id ? navy : "#111827" }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{opt.sub}</div>
              </div>
              {opt.cost && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: goldPale, color: goldText }}>{opt.cost}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Summary chip */}
      {(selectedStitch?.cost || selectedPacking?.cost) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: goldPale, border: `0.5px solid ${goldLight}` }}>
          <Info size={13} style={{ color: goldDark, flexShrink: 0 }} />
          <p style={{ fontSize: 11, color: "#633806", lineHeight: 1.5 }}>
            Finishing add-ons: {[selectedStitch?.cost, selectedPacking?.cost].filter(Boolean).join(" + ")} per piece. Final cost confirmed in your quote.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Organisation Details Card ────────────────────────────────────────────────

interface OrgDetails {
  type: OrgType;
  name: string;
  board: string;
  address: string;
  city: string;
  pin: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

function OrgDetailsForm({ onContinue, onBack, switchBanner }: {
  onContinue: (d: OrgDetails) => void;
  onBack?: () => void;
  switchBanner?: React.ReactNode;
}) {
  const [orgType, setOrgType] = useState<OrgType>(currentUser.orgType);
  const [name, setName] = useState(currentUser.org);
  const [board, setBoard] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pin, setPin] = useState("");
  const [contactName, setContactName] = useState(currentUser.name);
  const [contactPhone, setContactPhone] = useState(currentUser.phone);
  const [contactEmail, setContactEmail] = useState(currentUser.email);

  const [errors, setErrors] = useState<string[]>([]);

  function handleContinue() {
    const errs: string[] = [];
    if (!name.trim()) errs.push("Organisation name is required");
    if (!address.trim()) errs.push("Street address is required");
    if (!city.trim()) errs.push("City is required");
    if (!pin.trim() || !/^\d{6}$/.test(pin.trim())) errs.push("Valid 6-digit PIN code is required");
    if (!contactName.trim()) errs.push("Contact person name is required");
    if (!contactPhone.trim() || contactPhone.trim().replace(/\D/g, "").length < 10) errs.push("Valid phone number is required");
    setErrors(errs); if (errs.length > 0) return;
    onContinue({ type: orgType, name, board, address, city, pin, contactName, contactPhone, contactEmail });
  }

  return (
    <div className="p-4">
      {/* Switch banner (escape hatch for institution users) */}
      {switchBanner}
      {/* Back — only shown for non-auto-routed users */}
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1.5 mb-4 text-[13px]" style={{ background: "transparent", border: "none", cursor: "pointer", color: "#6b7280" }}>
          <ChevronDown size={14} style={{ transform: "rotate(90deg)" }} /> Back
        </button>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[18px]" style={{ background: "#E0F0FF" }}>🏛️</div>
        <div className="flex-1">
          <div style={{ fontSize: 17, fontWeight: 600, color: navy }}>Organisation details</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Tell us about your organisation</div>
        </div>
        <div className="text-[11px] px-2.5 py-1 rounded-lg font-semibold" style={{ background: goldPale, color: goldText }}>Step 1 of 2</div>
      </div>

      {/* Validation errors */}
      {errors.length > 0 && (
        <div className="mb-3 rounded-xl px-3 py-2.5" style={{ background: "#FFF1F2", border: "1px solid #fca5a5" }}>
          {errors.map(e => <div key={e} className="flex items-center gap-1.5 text-[12px]" style={{ color: "#dc2626" }}><span>•</span>{e}</div>)}
        </div>
      )}

      {/* Organisation type — 3×3 grid */}
      <Sec icon={Building2} title="Organisation type" defaultOpen={true}>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {orgTypes.map(t => (
            <button key={t.id} onClick={() => { setOrgType(t.id); setName(""); setBoard(""); }}
              className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-center transition-all"
              style={{ border: `1.5px solid ${orgType === t.id ? navy : "#e5e7eb"}`, background: orgType === t.id ? "#f0f4fb" : "#fff", cursor: "pointer" }}>
              <span style={{ fontSize: 22 }}>{t.emoji}</span>
              <span style={{ fontSize: 10, fontWeight: orgType === t.id ? 700 : 400, color: orgType === t.id ? navy : "#374151", lineHeight: 1.3 }}>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 px-2.5 py-2 rounded-lg" style={{ background: "#E0F0FF", border: "0.5px solid #bfdbfe" }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>{orgTypes.find(t => t.id === orgType)?.emoji}</span>
          <p style={{ fontSize: 11, color: "#1a4a8a", lineHeight: 1.5 }}>
            <strong>{orgTypes.find(t => t.id === orgType)?.label}</strong> — {orgTypes.find(t => t.id === orgType)?.sub}
          </p>
        </div>
      </Sec>

      {/* Organisation name — labels & placeholders adapt per type */}
      <Sec icon={Building2} title="Organisation name" defaultOpen={true}>
        <div className="mb-3">
          <div className="text-[12px] mb-1.5" style={{ color: "#6b7280" }}>{orgConfig[orgType].nameLabel}</div>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder={orgConfig[orgType].namePlaceholder}
            style={{ ...sel, display: "block" }} />
        </div>
        <div>
          <div className="text-[12px] mb-1.5" style={{ color: "#6b7280" }}>{orgConfig[orgType].regLabel}</div>
          <input value={board} onChange={e => setBoard(e.target.value)}
            placeholder={orgConfig[orgType].regPlaceholder}
            style={{ ...sel, display: "block" }} />
        </div>
      </Sec>

      {/* Address */}
      <Sec icon={MapPin} title="Address details" defaultOpen={true}>
        <div className="mb-2.5">
          <div className="text-[12px] mb-1.5" style={{ color: "#6b7280" }}>Street address</div>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Building, street, area" style={{ ...sel, display: "block" }} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[12px] mb-1.5" style={{ color: "#6b7280" }}>City</div>
            <input value={city} onChange={e => setCity(e.target.value)} placeholder="City" style={{ ...sel }} />
          </div>
          <div>
            <div className="text-[12px] mb-1.5" style={{ color: "#6b7280" }}>PIN code</div>
            <input value={pin} onChange={e => setPin(e.target.value)} placeholder="6-digit PIN" inputMode="numeric" maxLength={6} style={{ ...sel }} />
          </div>
        </div>
      </Sec>

      {/* Contact */}
      <Sec icon={User} title="Contact details" defaultOpen={true}>
        <div className="mb-2.5">
          <div className="text-[12px] mb-1.5" style={{ color: "#6b7280" }}>Contact person name</div>
          <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Purchase officer / Admin / Manager" style={{ ...sel, display: "block" }} />
        </div>
        <div className="mb-2.5">
          <div className="text-[12px] mb-1.5" style={{ color: "#6b7280" }}>Phone number</div>
          <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+91 98765 43210" inputMode="tel" style={{ ...sel, display: "block" }} />
        </div>
        <div>
          <div className="text-[12px] mb-1.5" style={{ color: "#6b7280" }}>Email address</div>
          <input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="procurement@yourorg.in" inputMode="email" style={{ ...sel, display: "block" }} />
        </div>
      </Sec>

      <button onClick={handleContinue} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-medium" style={{ background: navy, color: "#fff", border: "none", cursor: "pointer" }}>
        Continue · Step 2: Order details <ArrowRight size={16} />
      </button>
    </div>
  );
}

// ─── Individual Details Form ──────────────────────────────────────────────────

// ─── Custom Order Form (Individual) ──────────────────────────────────────────

function CustomOrderForm({ onContinue, onBack }: { onContinue: (d: CustomOrderDetails) => void; onBack: () => void }) {
  const [garmentType, setGarmentType] = useState<GarmentType | null>(null);
  const [groupType, setGroupType] = useState<GroupType | null>(null);
  const [qty, setQty] = useState(1);
  // Kids fields
  const [schoolName, setSchoolName] = useState("");
  const [parentName, setParentName] = useState("");
  // Students fields
  const [institutionName, setInstitutionName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  // Other groups field
  const [groupNotes, setGroupNotes] = useState("");
  // Contact & address
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pin, setPin] = useState("");

  const [sizeAllocated, setSizeAllocated] = useState(0);
  const [pendingGroupChange, setPendingGroupChange] = useState<GroupType | null>(null);
  const sizeCat = groupType ? groupSizeCatMap[groupType] : "custom";
  const isKids     = groupType === "kids";
  const isStudents = groupType === "students";
  const isOther    = groupType && !isKids && !isStudents;
  const sizeOk = qty === 0 || sizeAllocated === qty;
  const canContinue = !!(garmentType && groupType && name.trim() && phone.trim() && address.trim() && sizeOk);

  function handleContinue() {
    if (!garmentType || !groupType) return;
    onContinue({ garmentType, groupType, name, phone, email, address, city, pin });
  }

  return (
    <div className="p-4">
      <button onClick={onBack} className="flex items-center gap-1.5 mb-4 text-[13px]" style={{ background: "transparent", border: "none", cursor: "pointer", color: "#6b7280" }}>
        <ChevronDown size={14} style={{ transform: "rotate(90deg)" }} /> Back
      </button>

      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[18px]" style={{ background: "#f3f4f6" }}>👤</div>
        <div className="flex-1">
          <div style={{ fontSize: 17, fontWeight: 600, color: navy }}>Custom order</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Fully personalised · From 1 pc</div>
        </div>
        <div className="px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background: goldPale, color: goldText }}>Step 1 of 2</div>
      </div>

      {/* Garment type */}
      <Sec icon={Scissors} title="What would you like?" defaultOpen={true}>
        <div className="grid grid-cols-4 gap-2">
          {garmentTypes.map(g => (
            <button key={g.id} onClick={() => setGarmentType(g.id)}
              className="flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl text-center"
              style={{ border: `1.5px solid ${garmentType === g.id ? navy : "#e5e7eb"}`, background: garmentType === g.id ? "#f0f4fb" : "#fff", cursor: "pointer" }}>
              <span style={{ fontSize: 22 }}>{g.emoji}</span>
              <span style={{ fontSize: 9.5, fontWeight: garmentType === g.id ? 700 : 400, color: garmentType === g.id ? navy : "#374151", lineHeight: 1.3 }}>{g.label}</span>
            </button>
          ))}
        </div>
        {garmentType && (
          <div className="mt-2 flex gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: "#f3f4f6" }}>
            <span style={{ fontSize: 13 }}>{garmentTypes.find(g => g.id === garmentType)?.emoji}</span>
            <span style={{ fontSize: 11, color: "#374151" }}><strong>{garmentTypes.find(g => g.id === garmentType)?.label}</strong> selected</span>
          </div>
        )}
      </Sec>

      {/* Who is it for — Kids & Students (detailed) vs Others (notes) */}
      <div className="bg-white border rounded-xl mb-3 overflow-hidden" style={{ borderColor: "#e5e7eb" }}>
        <div className="flex items-center gap-2 px-3.5 py-3 border-b" style={{ borderColor: "#f3f4f6" }}>
          <User size={18} style={{ color: gold }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>Who is it for?</span>
        </div>
        <div className="px-3.5 pt-3 pb-1">

          {/* Kids & Students — featured row (uniform only) */}
          {garmentType === "school_uniform" && <div className="text-[11px] mb-1.5 font-medium uppercase tracking-wide" style={{ color: "#9ca3af" }}>School & college</div>}
          {garmentType === "school_uniform" && <div className="grid grid-cols-2 gap-2 mb-2">
            {[
              { id: "kids" as GroupType,     emoji: "👶", label: "Kids",     sub: "Age 3–16 · School sizing", accent: "#1a4a8a", accentBg: "#E0F0FF" },
              { id: "students" as GroupType, emoji: "🎒", label: "Students", sub: "College / Teen wear",        accent: "#92400e", accentBg: "#fef3c7" },
            ].map(g => {
              const sel2 = groupType === g.id;
              return (
                <button key={g.id}
                  onClick={() => { if (sizeAllocated > 0 && g.id !== groupType) { setPendingGroupChange(g.id); } else { setGroupType(g.id); setSchoolName(""); setParentName(""); setInstitutionName(""); setStudentClass(""); setGroupNotes(""); } }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left"
                  style={{ border: `2px solid ${sel2 ? g.accent : "#e5e7eb"}`, background: sel2 ? g.accentBg : "#fafafa", cursor: "pointer" }}>
                  <span style={{ fontSize: 22 }}>{g.emoji}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: sel2 ? g.accent : "#111827" }}>{g.label}</div>
                    <div style={{ fontSize: 10, color: sel2 ? g.accent : "#9ca3af", marginTop: 1 }}>{g.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>}

          {/* Kids fields — only for uniform orders */}
          {isKids && garmentType === "school_uniform" && (
            <div className="mb-3 rounded-xl overflow-hidden" style={{ border: "1.5px solid #bfdbfe" }}>
              <div className="px-3 py-2" style={{ background: "#E0F0FF" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#1a4a8a" }}>👶 Kids order details</div>
                <div style={{ fontSize: 10, color: "#3b82f6", marginTop: 1 }}>We need school & parent info to coordinate the order</div>
              </div>
              <div className="px-3 py-3 flex flex-col gap-2.5" style={{ background: "#fff" }}>
                <div>
                  <div className="text-[11px] mb-1 font-medium" style={{ color: "#374151" }}>School name <span style={{ color: "#ef4444" }}>*</span></div>
                  <input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="e.g. St. Mary's Primary School" style={{ ...sel }} />
                </div>
                <div>
                  <div className="text-[11px] mb-1 font-medium" style={{ color: "#374151" }}>Class / Grade</div>
                  <input value={studentClass} onChange={e => setStudentClass(e.target.value)} placeholder="e.g. Grade 3, Class 5B" style={{ ...sel }} />
                </div>
                <div>
                  <div className="text-[11px] mb-1 font-medium" style={{ color: "#374151" }}>Parent / Guardian name <span style={{ color: "#ef4444" }}>*</span></div>
                  <input value={parentName} onChange={e => setParentName(e.target.value)} placeholder="Full name of parent or guardian" style={{ ...sel }} />
                </div>
              </div>
            </div>
          )}

          {/* Students fields — only for uniform orders */}
          {isStudents && garmentType === "school_uniform" && (
            <div className="mb-3 rounded-xl overflow-hidden" style={{ border: "1.5px solid #fde68a" }}>
              <div className="px-3 py-2" style={{ background: "#fef3c7" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#92400e" }}>🎒 Student order details</div>
                <div style={{ fontSize: 10, color: "#b45309", marginTop: 1 }}>Share your college so we can match the right style & sizing</div>
              </div>
              <div className="px-3 py-3 flex flex-col gap-2.5" style={{ background: "#fff" }}>
                <div>
                  <div className="text-[11px] mb-1 font-medium" style={{ color: "#374151" }}>College / School name <span style={{ color: "#ef4444" }}>*</span></div>
                  <input value={institutionName} onChange={e => setInstitutionName(e.target.value)} placeholder="e.g. PSG College of Technology" style={{ ...sel }} />
                </div>
                <div>
                  <div className="text-[11px] mb-1 font-medium" style={{ color: "#374151" }}>Department / Course <span style={{ color: "#9ca3af" }}>(optional)</span></div>
                  <input value={studentClass} onChange={e => setStudentClass(e.target.value)} placeholder="e.g. B.Tech CSE, MBA Batch 2025" style={{ ...sel }} />
                </div>
              </div>
            </div>
          )}

          {/* Others — simple secondary row + notes */}
          <div className="text-[11px] mb-1.5 mt-1 font-medium uppercase tracking-wide" style={{ color: "#9ca3af" }}>{garmentType === "school_uniform" ? "Personal & group orders" : "Who is this for?"}</div>
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {[
              { id: "family"   as GroupType, emoji: "👨‍👩‍👧‍👦", label: "Family"   },
              { id: "friends"  as GroupType, emoji: "👫",  label: "Friends"  },
              { id: "personal" as GroupType, emoji: "👤",  label: "Personal" },
              { id: "event"    as GroupType, emoji: "🎉",  label: "Event"    },
            ].map(g => {
              const sel2 = groupType === g.id;
              return (
                <button key={g.id}
                  onClick={() => { if (sizeAllocated > 0 && g.id !== groupType) { setPendingGroupChange(g.id); } else { setGroupType(g.id); setSchoolName(""); setParentName(""); setInstitutionName(""); setStudentClass(""); setGroupNotes(""); } }}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-center"
                  style={{ border: `1.5px solid ${sel2 ? navy : "#e5e7eb"}`, background: sel2 ? "#f0f4fb" : "#fafafa", cursor: "pointer" }}>
                  <span style={{ fontSize: 18 }}>{g.emoji}</span>
                  <span style={{ fontSize: 10, fontWeight: sel2 ? 700 : 400, color: sel2 ? navy : "#6b7280" }}>{g.label}</span>
                </button>
              );
            })}
          </div>

          {/* Notes for other groups */}
          {isOther && (
            <div className="mb-3">
              <div className="text-[11px] mb-1.5 font-medium" style={{ color: "#374151" }}>
                Describe your order <span style={{ color: "#ef4444" }}>*</span>
              </div>
              <textarea value={groupNotes} onChange={e => setGroupNotes(e.target.value)}
                placeholder={
                  groupType === "family"   ? "e.g. Family reunion tees — 2 adults, 3 kids. Same print, different sizes. Preferred colour: navy." :
                  groupType === "friends"  ? "e.g. Trip tees for 8 friends. Fun print on back, everyone's name." :
                  groupType === "personal" ? "e.g. Custom shirt for my wedding. Linen blend, ivory. Measurements in notes below." :
                                             "e.g. Sports day jerseys for 30 kids. Numbers on back, school logo on front."
                }
                rows={3}
                style={{ ...sel, resize: "none", fontFamily: "inherit", lineHeight: 1.6 }} />
            </div>
          )}

        </div>
      </div>

      {/* Quantity & Size distribution */}
      <Sec icon={Layers} title="Quantity & size distribution" defaultOpen={true}>
        {/* Qty stepper */}
        <div className="mb-1">
          <div className="text-[12px] mb-2" style={{ color: "#6b7280" }}>Total pieces (minimum 1)</div>
          <div className="flex items-center gap-2.5 mb-1">
            <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: "0.5px solid #d1d5db", background: "#f9fafb", cursor: "pointer" }}>
              <Minus size={16} color="#374151" />
            </button>
            <div className="flex-1 text-center" style={{ fontSize: 16, fontWeight: 500, color: "#111827" }}>{qty} pcs</div>
            <button onClick={() => setQty(q => q + 1)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: "0.5px solid #d1d5db", background: "#f9fafb", cursor: "pointer" }}>
              <Plus size={16} color="#374151" />
            </button>
          </div>
        </div>

        <div className="my-3" style={{ borderTop: "0.5px solid #f0f0f0" }} />

        {/* Size distribution — always uses per-size qty controls */}
        <div>
          <div className="text-[12px] font-medium mb-2.5" style={{ color: "#374151" }}>
            Size distribution
          </div>
          {groupType ? (
            <SizeSection totalQty={qty} defaultCat={sizeCat} onAllocationChange={setSizeAllocated} />
          ) : (
            <div className="text-[12px] py-3 text-center rounded-lg" style={{ color: "#9ca3af", border: "1px dashed #d1d5db" }}>
              Select "Who is it for?" above to see size options
            </div>
          )}
        </div>
      </Sec>

      {/* Address */}
      <Sec icon={MapPin} title="Delivery address" defaultOpen={true}>
        <div className="mb-2.5">
          <div className="text-[12px] mb-1.5" style={{ color: "#6b7280" }}>Street address <span style={{ color: "#ef4444" }}>*</span></div>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Building, street, area" style={{ ...sel, display: "block" }} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[12px] mb-1.5" style={{ color: "#6b7280" }}>City</div>
            <input value={city} onChange={e => setCity(e.target.value)} placeholder="City" style={{ ...sel }} />
          </div>
          <div>
            <div className="text-[12px] mb-1.5" style={{ color: "#6b7280" }}>PIN code</div>
            <input value={pin} onChange={e => setPin(e.target.value)} placeholder="6-digit PIN" inputMode="numeric" maxLength={6} style={{ ...sel }} />
          </div>
        </div>
      </Sec>

      {/* Contact */}
      <Sec icon={User} title="Contact details" defaultOpen={true}>
        <div className="mb-2.5">
          <div className="text-[12px] mb-1.5" style={{ color: "#6b7280" }}>Your name <span style={{ color: "#ef4444" }}>*</span></div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" style={{ ...sel, display: "block" }} />
        </div>
        <div className="mb-2.5">
          <div className="text-[12px] mb-1.5" style={{ color: "#6b7280" }}>Phone number <span style={{ color: "#ef4444" }}>*</span></div>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" inputMode="tel" style={{ ...sel, display: "block" }} />
        </div>
        <div>
          <div className="text-[12px] mb-1.5" style={{ color: "#6b7280" }}>Email (optional)</div>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" inputMode="email" style={{ ...sel, display: "block" }} />
        </div>
      </Sec>

      {!sizeOk && qty > 0 && (
        <div className="mb-2 flex gap-1.5 px-3 py-2 rounded-lg" style={{ background: "#FFF1F2", border: "1px solid #fca5a5" }}>
          <span style={{ fontSize: 12, color: "#dc2626" }}>⚠ Please allocate all {qty} pcs across sizes before continuing ({sizeAllocated} / {qty} assigned)</span>
        </div>
      )}

      {/* Fix C: Confirm before wiping size quantities on group change */}
      {pendingGroupChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5" style={{ background: "rgba(0,0,0,0.45)" }}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Reset size distribution?</div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, marginBottom: 16 }}>
              Changing the group will reset the size category and clear your current quantity distribution ({sizeAllocated} pcs assigned).
            </div>
            <div className="flex gap-2">
              <button onClick={() => {
                const g = pendingGroupChange;
                setGroupType(g); setSchoolName(""); setParentName(""); setInstitutionName(""); setStudentClass(""); setGroupNotes(""); setSizeAllocated(0);
                setPendingGroupChange(null);
              }} className="flex-1 py-2.5 rounded-xl text-[13px] font-medium" style={{ background: "#fee2e2", color: "#dc2626", border: "none", cursor: "pointer" }}>
                Yes, reset
              </button>
              <button onClick={() => setPendingGroupChange(null)} className="flex-1 py-2.5 rounded-xl text-[13px] font-medium" style={{ background: navy, color: "#fff", border: "none", cursor: "pointer" }}>
                Keep current
              </button>
            </div>
          </div>
        </div>
      )}
      <button onClick={handleContinue} disabled={!canContinue}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-medium"
        style={{ background: canContinue ? navy : "#e5e7eb", color: canContinue ? "#fff" : "#9ca3af", border: "none", cursor: canContinue ? "pointer" : "not-allowed" }}>
        Continue · Step 2: Order details <ArrowRight size={16} />
      </button>
    </div>
  );
}

// ─── Switch-to-Individual Confirmation Modal ─────────────────────────────────

function SwitchConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden bg-white p-5" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#f3f4f6" }}>
          <span style={{ fontSize: 22 }}>👤</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", textAlign: "center", marginBottom: 6 }}>
          Making a personal purchase?
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 1.6, marginBottom: 4 }}>
          You are currently logged in as
        </div>
        <div className="mb-4 px-3 py-2 rounded-xl text-center" style={{ background: "#E0F0FF" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1a4a8a" }}>🏛️ {currentUser.org}</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Organisation account · Bulk ordering</div>
        </div>
        <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginBottom: 16, lineHeight: 1.5 }}>
          Individual orders are for personal use with smaller quantities. Continue only if this is a personal purchase.
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={onConfirm} className="w-full py-2.5 rounded-xl text-[13px] font-medium" style={{ background: "#f3f4f6", color: "#374151", border: "0.5px solid #d1d5db", cursor: "pointer" }}>
            Continue to Individual Order
          </button>
          <button onClick={onCancel} className="w-full py-2.5 rounded-xl text-[13px] font-medium" style={{ background: navy, color: "#fff", border: "none", cursor: "pointer" }}>
            Back to Organisation Bulk Order
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── NEW ORDER — auto-routing based on account type ───────────────────────────

function NewOrderSection({ onSubmit }: { onSubmit: () => void }) {
  // Solution 1: auto-detect account type, skip PersonaSelector for institution users
  const isInstAccount = currentUser.accountType === "institution";

  const [showPersonaSelector, setShowPersonaSelector] = useState(!isInstAccount);
  const [persona, setPersona] = useState<Persona | null>(isInstAccount ? "organisation" : null);
  const [orgDetails, setOrgDetails] = useState<OrgDetails | null>(null);
  const [customDetails, setCustomDetails] = useState<CustomOrderDetails | null>(null);
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);

  // Organisation user escape hatch banner — shown at top of OrgDetailsForm
  const switchBanner = isInstAccount && persona === "organisation" && (
    <div className="flex items-center justify-between px-3 py-2.5 mb-4 rounded-xl" style={{ background: "#f0f4fb", border: `1px solid ${navy}22` }}>
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 13 }}>💡</span>
        <span style={{ fontSize: 12, color: "#374151" }}>Buying for <strong>yourself</strong> instead?</span>
      </div>
      <button onClick={() => setShowSwitchConfirm(true)} className="text-[12px] font-medium px-2.5 py-1 rounded-lg" style={{ background: "#fff", color: navy, border: `0.5px solid ${navy}44`, cursor: "pointer" }}>
        Switch to Individual
      </button>
    </div>
  );

  // Manual persona selector (for individual accounts or after back)
  if (showPersonaSelector) {
    return <PersonaSelector onSelect={p => { setPersona(p); setShowPersonaSelector(false); }} />;
  }

  if (persona === "organisation" && !orgDetails) {
    return (
      <div>
        {showSwitchConfirm && (
          <SwitchConfirmModal
            onConfirm={() => { setShowSwitchConfirm(false); setCustomDetails(null); setPersona("individual"); }}
            onCancel={() => setShowSwitchConfirm(false)}
          />
        )}
        <OrgDetailsForm
          switchBanner={switchBanner}
          onContinue={setOrgDetails}
          onBack={isInstAccount ? undefined : () => setShowPersonaSelector(true)}
        />
      </div>
    );
  }

  if (persona === "individual" && !customDetails) {
    return <CustomOrderForm onContinue={setCustomDetails} onBack={() => { setPersona(isInstAccount ? "organisation" : null); if (!isInstAccount) setShowPersonaSelector(true); }} />;
  }

  const p = personas.find(x => x.id === persona)!;
  const subLabel = orgDetails ? `${orgTypes.find(o => o.id === orgDetails.type)?.emoji} ${orgTypes.find(o => o.id === orgDetails.type)?.label}`
                 : customDetails ? `${garmentTypes.find(g => g.id === customDetails.garmentType)?.emoji} ${garmentTypes.find(g => g.id === customDetails.garmentType)?.label}`
                 : p.label;
  const subName  = orgDetails?.name ?? (customDetails ? `${groupTypes.find(g => g.id === customDetails.groupType)?.emoji} ${groupTypes.find(g => g.id === customDetails.groupType)?.label}` : undefined);

  const cfg: PersonaFormConfig = persona === "organisation" && orgDetails
    ? { ...orgConfig[orgDetails.type], refConfig: orgRefConfig }
    : customDetails
    ? {
        minQty: 1, defaultQty: 1, qtyStep: 1,
        defaultSizeCat: groupSizeCatMap[customDetails.groupType],
        fabricLabel: "Fabric type",
        fabricOptions: garmentFabricMap[customDetails.garmentType].fabricOptions,
        gsmOptions: garmentFabricMap[customDetails.garmentType].gsmOptions,
        weaveOptions: ["Plain", "Twill", "Jersey knit", "Custom"],
        refConfig: individualRefConfig,
      }
    : { minQty: 1, defaultQty: 1, qtyStep: 1, defaultSizeCat: "custom", fabricLabel: "Fabric", fabricOptions: [], gsmOptions: null, weaveOptions: null, refConfig: individualRefConfig };

  return <PersonaOrderForm
    persona={persona!} personaDef={p} cfg={cfg}
    subLabel={subLabel} subName={subName}
    customDetails={customDetails}
    onSubmit={onSubmit}
    onChangePersona={() => {
      if (persona === "individual") {
        // Go back to CustomOrderForm to edit garment/group/address/contact
        setCustomDetails(null);
      } else {
        // Go back to OrgDetailsForm to edit org type/name/address/contact
        setOrgDetails(null);
        // Non-inst-account users chose org manually — keep persona="organisation" so OrgDetailsForm shows
      }
    }}
  />;
}

function PersonaOrderForm({
  persona, personaDef, cfg, subLabel, subName, customDetails, onSubmit, onChangePersona,
}: {
  persona: Persona;
  personaDef: PersonaDef;
  cfg: PersonaFormConfig;
  subLabel: string;
  subName?: string;
  customDetails?: CustomOrderDetails | null;
  onSubmit: () => void;
  onChangePersona: () => void;
}) {
  const [qty, setQty] = useState(cfg.defaultQty);
  const [orgSizeAllocated, setOrgSizeAllocated] = useState(0);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showConfirmChange, setShowConfirmChange] = useState(false);
  // School/college uniform: DB has fabric & colour data — hide Material, Colors, Stitching
  const isUniformOrder = customDetails?.garmentType === "school_uniform" &&
    (customDetails.groupType === "kids" || customDetails.groupType === "students");
  const [fabricSource, setFabricSource] = useState<"fresh" | "surplus">("fresh");

  return (
    <div className="p-4">
      {/* ── Persona pill + change ── */}
      <div className="flex items-center justify-between mb-4 px-3 py-2.5 rounded-xl" style={{ background: personaDef.accentBg, border: `0.5px solid ${personaDef.accent}22` }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 18 }}>{personaDef.emoji}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: personaDef.accent }}>{subLabel}</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>{subName || personaDef.sub}</div>
          </div>
        </div>
        <button onClick={() => setShowConfirmChange(true)} className="text-[12px] px-2.5 py-1 rounded-lg" style={{ background: "#fff", color: "#374151", border: "0.5px solid #d1d5db", cursor: "pointer" }}>
          Change
        </button>
      </div>

      {/* ── Material ── */}
      {!isUniformOrder && <Sec icon={Ruler} title="Material">
        {/* Surplus / Fresh toggle */}
        <div className="mb-3">
          <div className="text-[12px] mb-1.5" style={{ color: "#6b7280" }}>Fabric source</div>
          <div className="grid grid-cols-2 gap-2">
            {([["fresh", "🆕", "Fresh fabric", "New production run"], ["surplus", "♻️", "Surplus fabric", "Mill leftover stock · Discounted"]] as const).map(([id, emoji, label, sub]) => (
              <button key={id} onClick={() => setFabricSource(id)}
                className="flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl text-left"
                style={{ border: `1.5px solid ${fabricSource === id ? navy : "#e5e7eb"}`, background: fabricSource === id ? "#f0f4fb" : "#fff", cursor: "pointer" }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ border: `2px solid ${fabricSource === id ? navy : "#d1d5db"}`, background: fabricSource === id ? navy : "#fff" }}>
                    {fabricSource === id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: fabricSource === id ? navy : "#111827" }}>{emoji} {label}</span>
                </div>
                <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 22 }}>{sub}</span>
              </button>
            ))}
          </div>
          {fabricSource === "surplus" && (
            <div className="mt-2 flex gap-1.5 px-2.5 py-2 rounded-lg" style={{ background: "#E1F5EE", border: "0.5px solid #6ee7b7" }}>
              <span style={{ fontSize: 12 }}>♻️</span>
              <p style={{ fontSize: 11, color: "#065f46", lineHeight: 1.5 }}>Surplus fabric is leftover mill stock — same quality, up to 30% cheaper. Availability varies; your coordinator will confirm before production.</p>
            </div>
          )}
        </div>
        <div className="mb-3">
          <div className="text-[12px] mb-1.5" style={{ color: "#6b7280" }}>{cfg.fabricLabel}</div>
          <select style={sel}>
            {cfg.fabricOptions.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        {cfg.gsmOptions && (
          <div className="mb-3">
            <div className="text-[12px] mb-1.5" style={{ color: "#6b7280" }}>GSM weight</div>
            <select style={sel}>
              {cfg.gsmOptions.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        )}
        {cfg.weaveOptions && (
          <div>
            <div className="text-[12px] mb-1.5" style={{ color: "#6b7280" }}>Weave</div>
            <select style={sel}>
              {cfg.weaveOptions.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        )}
        {/* Simplified note for non-technical personas */}
        {!cfg.gsmOptions && (
          <div className="mt-2 flex gap-1.5 px-2.5 py-2 rounded-lg" style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb" }}>
            <Info size={12} style={{ color: "#9ca3af", marginTop: 1, flexShrink: 0 }} />
            <p style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>Not sure about fabric specs? That's fine — your coordinator will recommend the best match and confirm with you before production.</p>
          </div>
        )}
      </Sec>}

      {/* ── Colors ── */}
      {!isUniformOrder && <Sec icon={Palette} title="Colors"><ColorSection /></Sec>}

      {/* ── Quantity & Size Distribution (org only — individual collects this in CustomOrderForm) ── */}
      {persona !== "individual" && <Sec icon={Layers} title="Quantity & size distribution">
        {/* Quantity stepper */}
        <div className="mb-1">
          <div className="text-[12px] mb-2" style={{ color: "#6b7280" }}>
            {`Total pieces (minimum ${cfg.minQty})`}
          </div>
          <div className="flex items-center gap-2.5 mb-1">
            <button onClick={() => setQty(q => Math.max(cfg.minQty, q - cfg.qtyStep))} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: "0.5px solid #d1d5db", background: "#f9fafb", cursor: "pointer" }}>
              <Minus size={16} color="#374151" />
            </button>
            <div className="flex-1 text-center" style={{ fontSize: 16, fontWeight: 500, color: "#111827" }}>{qty} pcs</div>
            <button onClick={() => setQty(q => q + cfg.qtyStep)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: "0.5px solid #d1d5db", background: "#f9fafb", cursor: "pointer" }}>
              <Plus size={16} color="#374151" />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="my-3" style={{ borderTop: "0.5px solid #f0f0f0" }} />

        {/* Size section — always per-size qty controls */}
        <div>
          <div className="text-[12px] font-medium mb-2.5" style={{ color: "#374151" }}>Size distribution</div>
          <SizeSection totalQty={qty} defaultCat={cfg.defaultSizeCat} step={10} onAllocationChange={setOrgSizeAllocated} />
        </div>

        {/* Divider */}
        <div className="my-3" style={{ borderTop: "0.5px solid #f0f0f0" }} />

        {/* Notes */}
        <div>
          <div className="text-[12px] font-medium mb-2" style={{ color: "#374151" }}>Additional notes</div>
          <textarea
            placeholder={
              persona === "organisation" ? `${subLabel} — department, special finishing, branding or OEKO-TEX requirements…`
              : "Any special requests or customisation details…"
            }
            style={{ ...sel, resize: "none", height: 72, fontFamily: "inherit" }} />
        </div>
      </Sec>}

      {/* ── Uniform DB banner — shown instead of Material/Colors/Stitching for school & college uniforms ── */}
      {isUniformOrder && (
        <div className="bg-white border rounded-xl p-4 mb-3" style={{ borderColor: "#e5e7eb" }}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} style={{ color: gold }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Fabric, colour & stitching on record</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "#E1F5EE", color: "#085041" }}>Auto-filled ✓</span>
          </div>
          <div className="rounded-xl p-3 mb-3" style={{ background: "#f0f4fb", border: `1px solid ${navy}22` }}>
            <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
              Since you've shared the school/college details, we already have the <strong>fabric type, GSM, weave, standard colours,</strong> and <strong>stitching specs</strong> for this uniform in our database. Your coordinator will confirm everything before production.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[["Fabric", "From DB"], ["Colours", "Standard"], ["Stitching", "Uniform spec"]].map(([label, val]) => (
              <div key={label} className="rounded-lg px-2.5 py-2" style={{ background: "#f9fafb", border: "0.5px solid #e5e7eb" }}>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>{label}</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#374151" }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stitching & Packaging ── */}
      {!isUniformOrder && <Sec icon={Package} title="Stitching & packaging">
        <PackagingSection />
      </Sec>}

      {/* ── References & Samples ── */}
      <Sec icon={ImageIcon} title="References & samples">
        <RefImagesSection persona={persona} />
      </Sec>

      {/* ── Submit ── */}
      {/* Org over-allocation warning */}
      {persona !== "individual" && qty > 0 && orgSizeAllocated !== qty && (
        <div className="mb-2 flex gap-1.5 px-3 py-2 rounded-lg" style={{ background: "#FFF1F2", border: "1px solid #fca5a5" }}>
          <span style={{ fontSize: 12, color: "#dc2626" }}>⚠ Size distribution incomplete — {orgSizeAllocated} of {qty} pcs assigned. Please allocate all pieces before submitting.</span>
        </div>
      )}
      <button
        onClick={() => setShowConfirmSubmit(true)}
        disabled={persona !== "individual" && qty > 0 && orgSizeAllocated !== qty}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[15px] font-medium"
        style={{ background: (persona !== "individual" && qty > 0 && orgSizeAllocated !== qty) ? "#e5e7eb" : gold, color: (persona !== "individual" && qty > 0 && orgSizeAllocated !== qty) ? "#9ca3af" : goldText, border: "none", cursor: (persona !== "individual" && qty > 0 && orgSizeAllocated !== qty) ? "not-allowed" : "pointer" }}>
        <Send size={18} /> Review & submit for quotation
      </button>

      {/* Submit confirmation modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setShowConfirmSubmit(false)}>
          <div className="w-full max-w-sm rounded-t-2xl bg-white px-5 py-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: goldPale }}>
              <Send size={22} style={{ color: gold }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", textAlign: "center", marginBottom: 6 }}>Submit for quotation?</div>
            <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 1.6, marginBottom: 20 }}>
              Your coordinator will review the order and send you a quote within 24 hours. You can still request changes after receiving the quote.
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => { setShowConfirmSubmit(false); onSubmit(); }} className="w-full py-3 rounded-xl text-[14px] font-medium flex items-center justify-center gap-2" style={{ background: gold, color: goldText, border: "none", cursor: "pointer" }}>
                <Check size={16} /> Yes, submit order
              </button>
              <button onClick={() => setShowConfirmSubmit(false)} className="w-full py-2.5 rounded-xl text-[13px]" style={{ background: "#f3f4f6", color: "#374151", border: "none", cursor: "pointer" }}>
                Go back and review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change confirmation modal — BUG 7 */}
      {showConfirmChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setShowConfirmChange(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Clear order details?</div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, marginBottom: 16 }}>
              Going back will clear all the order details you've filled in. This cannot be undone.
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowConfirmChange(false); onChangePersona(); }} className="flex-1 py-2.5 rounded-xl text-[13px] font-medium" style={{ background: "#fee2e2", color: "#dc2626", border: "none", cursor: "pointer" }}>
                Yes, go back
              </button>
              <button onClick={() => setShowConfirmChange(false)} className="flex-1 py-2.5 rounded-xl text-[13px] font-medium" style={{ background: navy, color: "#fff", border: "none", cursor: "pointer" }}>
                Keep editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Single-size picker for Parent persona
function ParentSizeBtn({ label, hint }: { label: string; hint: string }) {
  const [selected, setSelected] = useState(false);
  return (
    <button onClick={() => setSelected(v => !v)} className="rounded-xl py-2.5 px-1 text-center transition-all"
      style={{ border: "0.5px solid", borderColor: selected ? navy : "#d1d5db", background: selected ? navy : "#f9fafb", cursor: "pointer" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: selected ? "#fff" : "#111827" }}>{label}</div>
      <div style={{ fontSize: 10, color: selected ? "rgba(255,255,255,0.65)" : "#9ca3af", marginTop: 2 }}>{hint}</div>
    </button>
  );
}

// ─── TRACK ────────────────────────────────────────────────────────────────────

interface Milestone { state: "done" | "active" | "pending"; icon: React.ElementType; label: string; date: string; }

function MsRow({ ms, isLast }: { ms: Milestone; isLast: boolean }) {
  const st = ms.state === "done" ? { background: "#E1F5EE", color: "#085041" } : ms.state === "active" ? { background: goldPale, color: "#633806" } : { background: "#f9fafb", color: "#9ca3af", border: "0.5px solid #e5e7eb" };
  return (
    <div className="flex items-start gap-3 py-2 relative">
      {!isLast && <div className="absolute left-[15px] top-8 w-px" style={{ height: "calc(100% - 12px)", background: "#e5e7eb" }} />}
      <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 z-10" style={st}><ms.icon size={15} /></div>
      <div className="pt-1">
        <div style={{ fontSize: 13, fontWeight: ms.state === "pending" ? 400 : 500, color: ms.state === "pending" ? "#9ca3af" : "#111827" }}>{ms.label}</div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{ms.date}</div>
      </div>
    </div>
  );
}

function TrackerCard({ id, badge, name, milestones, eta, defaultOpen = true }: { id: string; badge: "prod" | "qc"; name: string; milestones: Milestone[]; eta: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const activeMilestone = milestones.find(m => m.state === "active");
  return (
    <div className="bg-white border rounded-xl mb-3 overflow-hidden" style={{ borderColor: "#e5e7eb" }}>
      {/* Header — always visible, tap to expand/collapse */}
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left" style={{ background: "transparent", border: "none", cursor: "pointer" }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span style={{ fontSize: 12, color: "#9ca3af" }}>{id}</span>
            <Bdg type={badge} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{name}</div>
          {!open && activeMilestone && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: gold }} />
              <span style={{ fontSize: 11, color: "#6b7280" }}>{activeMilestone.label}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!open && <span style={{ fontSize: 11, fontWeight: 500, color: navy }}>{eta}</span>}
          <ChevronDown size={16} color="#9ca3af" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: "#f3f4f6" }}>
          <div className="pt-3">
            {milestones.map((ms, i) => <MsRow key={ms.label} ms={ms} isLast={i === milestones.length - 1} />)}
          </div>
          <div className="flex justify-between items-center mt-3 pt-3 border-t" style={{ borderColor: "#e5e7eb" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Estimated delivery</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: navy }}>{eta}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function TrackSection() {
  const o1: Milestone[] = [
    { state: "done", icon: Check, label: "Order placed", date: "Jun 2, 2025" },
    { state: "done", icon: Check, label: "Sourcing material", date: "Jun 5, 2025" },
    { state: "active", icon: Scissors, label: "In production", date: "Started Jun 10 · ~40% done" },
    { state: "pending", icon: Microscope, label: "Quality check", date: "Est. Jul 8" },
    { state: "pending", icon: Truck, label: "Shipped", date: "Est. Jul 11" },
    { state: "pending", icon: Package, label: "Delivered", date: "Est. Jul 14" },
  ];
  const o2: Milestone[] = [
    { state: "done", icon: Check, label: "Order placed", date: "May 20, 2025" },
    { state: "done", icon: Check, label: "Material sourced", date: "May 25, 2025" },
    { state: "done", icon: Check, label: "Production complete", date: "Jun 8, 2025" },
    { state: "active", icon: Microscope, label: "Quality check", date: "In progress" },
    { state: "pending", icon: Truck, label: "Shipped", date: "Est. Jul 6" },
    { state: "pending", icon: Package, label: "Delivered", date: "Est. Jul 8" },
  ];
  return (
    <div className="p-4">
      <TrackerCard id="#FL-2041" badge="prod" name="300m Cotton Twill — Navy" milestones={o1} eta="14 July 2025" defaultOpen={true} />
      <TrackerCard id="#FL-2038" badge="qc" name="Linen Blend Fabric — Ivory" milestones={o2} eta="8 July 2025" defaultOpen={false} />
    </div>
  );
}

// ─── CHAT ─────────────────────────────────────────────────────────────────────

function ChatSection() {
  const [key, setKey] = useState<ChatKey>("quote");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [quoteVis, setQuoteVis] = useState(false);
  const [inp, setInp] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setMsgs(chats[key].filter(m => m.type !== "quote")); setQuoteVis(key === "quote"); setTimeout(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, 50); }, [key]);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [msgs]);

  function send() {
    const t = inp.trim(); if (!t) return;
    setMsgs(p => [...p, { from: "me", sender: "You", text: t }]); setInp("");
    setTimeout(() => setMsgs(p => [...p, { from: "them", sender: "Priya", text: "Got it! I'll check with the mill and update you shortly." }]), 800);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 bg-white border-b flex items-center gap-2 text-[13px]" style={{ color: "#6b7280", borderColor: "#e5e7eb" }}>
        <MessageSquare size={16} />
        Order:
        <select value={key} onChange={e => setKey(e.target.value as ChatKey)} style={{ fontSize: 13, border: "none", background: "transparent", color: navy, fontWeight: 500, outline: "none", cursor: "pointer" }}>
          <option value="quote">#FL-2045 — Heavy Denim (Quote pending)</option>
          <option value="prod">#FL-2041 — Cotton Twill</option>
        </select>
      </div>
      <div ref={ref} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5" style={{ minHeight: 240 }}>
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[82%] px-3 py-2.5 rounded-xl text-[13px] leading-relaxed ${m.from === "me" ? "self-end" : "self-start"}`}
            style={{ background: m.from === "me" ? navy : "#fff", color: m.from === "me" ? "#fff" : "#111827", border: m.from === "them" ? "0.5px solid #e5e7eb" : "none", borderBottomRightRadius: m.from === "me" ? 3 : 12, borderBottomLeftRadius: m.from === "them" ? 3 : 12 }}>
            <div style={{ fontSize: 11, marginBottom: 3, color: m.from === "me" ? "rgba(255,255,255,0.5)" : "#9ca3af" }}>{m.sender}</div>
            {m.text}
          </div>
        ))}
      </div>
      {quoteVis && (
        <>
          <div className="mx-4 mb-2 p-2.5 rounded-xl border" style={{ background: "#f9fafb", borderColor: "#e5e7eb", borderLeft: `3px solid ${gold}` }}>
            <div className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "#6b7280" }}>Quotation #Q-2045</div>
            {[["Fabric (1000 pcs)", "₹48,000"], ["Dyeing & finishing", "₹6,500"], ["FabricLink service fee", "₹3,200"]].map(([k, v]) => (
              <div key={k} className="flex justify-between text-[13px] py-0.5" style={{ color: "#111827" }}><span>{k}</span><span>{v}</span></div>
            ))}
            <div className="flex justify-between mt-1.5 pt-1.5 border-t" style={{ fontSize: 15, fontWeight: 500, color: navy, borderColor: "#e5e7eb" }}><span>Total</span><span>₹57,700</span></div>
          </div>
          <div className="flex gap-2 px-4 pb-2">
            <button onClick={() => { setQuoteVis(false); setMsgs(p => [...p, { from: "them", sender: "Priya", text: "Quote approved! Order #FL-2045 is now active. Expected delivery: July 28." }]); }} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-medium" style={{ background: gold, color: goldText, border: "none", cursor: "pointer" }}>
              <Check size={14} /> Approve & confirm
            </button>
            <button onClick={() => { setQuoteVis(false); setMsgs(p => [...p, { from: "me", sender: "You", text: "Can we get a better rate for this MOQ?" }]); setTimeout(() => setMsgs(p => [...p, { from: "them", sender: "Priya", text: "Understood! Let me negotiate with the mill — back to you in 4 hours." }]), 600); }} className="flex-1 py-2.5 rounded-lg text-[13px] font-medium" style={{ background: "transparent", color: "#6b7280", border: "0.5px solid #d1d5db", cursor: "pointer" }}>
              Request revision
            </button>
          </div>
        </>
      )}
      <div className="px-3 py-2.5 bg-white border-t flex items-center gap-2" style={{ borderColor: "#e5e7eb" }}>
        <input value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Message your coordinator…" className="flex-1 text-[13px] rounded-full px-3.5 py-2" style={{ border: "0.5px solid #d1d5db", background: "#f9fafb", color: "#111827", outline: "none" }} />
        <button onClick={send} className="w-[34px] h-[34px] rounded-full flex items-center justify-center shrink-0" style={{ background: gold, border: "none", cursor: "pointer" }}>
          <Send size={15} color={goldText} />
        </button>
      </div>
    </div>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────

function ProfileSection() {
  function PR({ Icon, label, badge, danger }: { Icon: React.ElementType; label: string; badge?: string; danger?: boolean }) {
    return (
      <div className="flex items-center gap-3 px-3.5 py-3 border-b last:border-b-0 cursor-pointer" style={{ borderColor: "#f3f4f6" }}>
        <Icon size={18} color="#6b7280" />
        <div className="flex-1 text-[14px]" style={{ color: danger ? "#ef4444" : "#111827" }}>{label}</div>
        {badge && <span style={{ fontSize: 12, color: goldDark, fontWeight: 500 }}>{badge}</span>}
        {!danger && <ChevronRight size={16} color="#9ca3af" />}
      </div>
    );
  }
  const groups = [
    [{ Icon: Building2, label: "Business details" }, { Icon: MapPin, label: "Delivery addresses" }, { Icon: CreditCard, label: "Payment & billing" }],
    [{ Icon: Clock, label: "Order history", badge: "12 orders" }, { Icon: FileText, label: "My tech packs" }],
    [{ Icon: Bell, label: "Notifications" }, { Icon: Shield, label: "KYC & verification", badge: "Verified" }, { Icon: LogOut, label: "Sign out", danger: true }],
  ] as { Icon: React.ElementType; label: string; badge?: string; danger?: boolean }[][];

  return (
    <div className="p-4">
      <div className="rounded-xl p-5 flex items-center gap-3.5 mb-4" style={{ background: navy }}>
        <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center shrink-0 text-[20px] font-medium" style={{ background: gold, color: goldText }}>AK</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, color: "#fff" }}>Arjun Kumar</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>arjun@threadcraft.in</div>
        </div>
      </div>
      {groups.map((g, gi) => (
        <div key={gi} className="bg-white border rounded-xl mb-3 overflow-hidden" style={{ borderColor: "#e5e7eb" }}>
          {g.map(r => <PR key={r.label} {...r} />)}
        </div>
      ))}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function App() {
  {/* MARKER-MAKE-KIT-DISCOVERY-READ */}
  const [tab, setTab] = useState<Tab>("home");
  const [notif, setNotif] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#e5e7eb" }}>
      <div className="w-full flex flex-col overflow-hidden rounded-3xl shadow-2xl" style={{ maxWidth: 380, background: "#f9fafb", border: "0.5px solid #d1d5db", minHeight: 720 }}>
        <StatusBar />
        <NavHeader onBell={() => setNotif(v => !v)} />
        {notif && (
          <div className="mx-3 mt-2 px-3 py-2.5 rounded-xl flex items-center gap-2 text-[12px]" style={{ background: goldPale, border: `0.5px solid ${goldLight}`, color: "#633806" }}>
            <Bell size={14} style={{ color: goldDark }} />
            <div><strong>Quote ready:</strong> #FL-2045 Heavy Denim — ₹57,700 total. Review in Inbox.</div>
          </div>
        )}
        <TabBar active={tab} onSelect={setTab} />
        <div className="flex-1 overflow-y-auto">
          {tab === "home" && <HomeSection onNav={setTab} />}
          {tab === "order" && <NewOrderSection onSubmit={() => setTab("home")} />}
          {tab === "track" && <TrackSection />}
          {tab === "chat" && <ChatSection />}
          {tab === "profile" && <ProfileSection />}
        </div>
      </div>
    </div>
  );
}
