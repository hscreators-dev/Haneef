import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronDown, ChevronUp, Plus, Minus, ArrowRight, X, Check,
  Send, AlertTriangle, CheckCircle2, Upload, Camera, Image as ImageIcon,
  Wand2, Sparkles, Info, QrCode, Truck, Box, Layers, Ruler,
  Palette, Scissors, MapPin, User, Building2, Package, RotateCcw,
  Hash, Percent, ChevronRight, GraduationCap, BookOpen, Factory,
  Landmark, Trophy, Utensils, Heart, Shirt, Dumbbell, Users, Briefcase,
  Award, Smartphone, Gift, Star, Navigation, Loader2, ChevronLeft, FileText,
  Wallet, ReceiptText, ShieldCheck, Mars, Venus, Lightbulb,
} from "lucide-react";
import { UpiLogo, upiProviderDefs, type UpiProvider } from "./AccountTab";
import { tryon as tryonApi } from "../../lib/api";
import { useCatalogAvailability, adminStylesFor, adminMaterialsFor, adminPaletteFor, adminGarmentPrice } from "../../lib/useCatalogAvailability";
import { useOrderFormConfig, calcServiceFee, surplusDiscountPct } from "../../lib/useOrderFormConfig";

const ACCENT      = "#C8A97E";
const ACCENT_BG   = "rgba(200,169,126,0.12)";
const ACCENT_TEXT = "#7C5419";
const DARK        = "#0D0D0D";
const INP = "w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none";
// Shared button styles — identical to App.tsx / TrackTab / AccountTab
const btnPrimary: React.CSSProperties = {
  width:"100%", background:DARK, color:"#fff",
  borderRadius:20, padding:"14px 20px", fontSize:14,
  fontWeight:500, border:"none", cursor:"pointer",
  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
};
const btnPrimaryDisabled: React.CSSProperties = { ...btnPrimary, background:"#E5E7EB", color:"#9CA3AF", cursor:"not-allowed" };
const btnAccent: React.CSSProperties = { ...btnPrimary, background:ACCENT };
const btnSecondary: React.CSSProperties = {
  ...btnPrimary, background:"var(--muted)", color:"var(--foreground)", border:"1px solid var(--border)",
};

// Reusable select with properly aligned custom chevron
function SelectField({ options, className, extraStyle, value, onChange, priceFor }: { options: string[]; className?: string; extraStyle?: React.CSSProperties; value?: string; onChange?: (v: string) => void; priceFor?: (o: string) => string }) {
  return (
    <div className="relative">
      <select
        {...(value !== undefined ? { value, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange?.(e.target.value) } : {})}
        className={`w-full appearance-none bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none pr-10 ${className ?? ""}`}
        style={{ fontFamily: "DM Sans, sans-serif", cursor: "pointer", ...extraStyle }}
      >
        {options.map(o => <option key={o} value={o}>{o}{priceFor ? priceFor(o) : ""}</option>)}
      </select>
      <ChevronDown size={15} strokeWidth={1.8} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#6b7280", pointerEvents: "none" }} />
    </div>
  );
}
const fnt: React.CSSProperties = { fontFamily: "DM Sans, sans-serif" };

// ─── Accessories business rule ────────────────────────────────────────────────
// Accessory minimum order quantity differs by persona.
const ORG_ACCESSORY_MOQ  = 100; // organisation accessories minimum per product
const ORG_ACCESSORY_STEP = 10;  // organisation accessories increment
const IND_ACCESSORY_MOQ  = 1;   // individual accessories minimum per product
const IND_ACCESSORY_STEP = 1;   // individual accessories increment

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

// ─── Payment helpers (no real charge — captured for the coordinator's link) ───
const validateUpi = (v: string) => /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(v.trim());
const formatCardNum = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
const formatExpiry  = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length >= 3 ? d.slice(0, 2) + "/" + d.slice(2) : d; };
const maskCardNum   = (v: string) => { const d = v.replace(/\D/g, ""); return d.length >= 4 ? "•••• " + d.slice(-4) : d; };
const validExpiry   = (v: string) => { const m = v.match(/^(\d{2})\/(\d{2})$/); if (!m) return false; const mo = +m[1]; return mo >= 1 && mo <= 12; };

// ─── Validation helpers ───────────────────────────────────────────────────────

/** Keep +91 prefix locked, only digits after it, max 10 mobile digits */
function sanitizePhone(raw: string): string {
  const after = raw.replace(/^\+91\s*/, "").replace(/\D/g, "").slice(0, 10);
  return "+91" + after;
}
/** Format a canonical "+91XXXXXXXXXX" number for display as "+91 98765 43210" */
function fmtPhone(canonical: string): string {
  const d = canonical.replace(/^\+91/, "").replace(/\D/g, "").slice(0, 10);
  const a = d.slice(0, 5), b = d.slice(5, 10);
  return "+91" + (a ? " " + a : "") + (b ? " " + b : "");
}
/** Validate exactly 10 Indian mobile digits after +91 */
function isPhoneValid(v: string): boolean {
  return /^[6-9]\d{9}$/.test(v.replace(/^\+91\s*/, "").replace(/\D/g, ""));
}

/** City names in India are alphabetic — strip digits and stray symbols as the user types. */
const sanitizeCity = (v: string) => v.replace(/[^A-Za-z\s.'-]/g, "");

// Quantity fields pre-fill a minimum (e.g. "100") and the user is expected to replace it
// by typing a new number. `.select()` on type="number" inputs is unreliable on some mobile
// browsers (it silently no-ops), which is what causes "100" + typed "200" to become
// "100200" instead of replacing. Deferring the select to the next frame, and pairing this
// with type="text" + inputMode="numeric" on the field, fixes it reliably everywhere.
function selectAllOnFocus(e: React.FocusEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  requestAnimationFrame(() => el.select());
}
// The real reason the deferred .select() above still got undone: the native "mouseup"
// that follows the same tap/click which focused the input fires its own default action
// right after — repositioning/collapsing the selection to the click point. That happens
// after our rAF-deferred select() runs, so it silently wins and leaves the caret in place
// instead of a full selection, and the next keystroke inserts instead of replacing.
// Pair with onMouseUp={preventSelectionCollapse} on every quantity input to stop that
// default action from undoing the selection.
function preventSelectionCollapse(e: React.MouseEvent<HTMLInputElement>) {
  e.preventDefault();
}
/** Keep only digits as the user types a quantity — used with type="text" quantity inputs. */
const digitsOnly = (v: string) => v.replace(/\D/g, "");

// A small, dismissible contextual tip for a specific step. Persisted in localStorage
// by key so once someone's read it and closed it, it doesn't nag them again on every
// visit to that step — but it's easy to re-surface (e.g. from Help & Support) since
// it's driven by data, not a one-time flag baked into the flow itself.
function TipBanner({ tipKey, children }: { tipKey: string; children: React.ReactNode }) {
  const storageKey = `fl_tip_dismissed_${tipKey}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(storageKey) === "1"; } catch { return false; }
  });
  if (dismissed) return null;
  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(storageKey, "1"); } catch { /* ignore */ }
  }
  return (
    <div className="flex items-start gap-2.5 mb-4 px-3.5 py-3 rounded-xl" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
      <Lightbulb size={15} strokeWidth={1.75} style={{ color: "#B45309", flexShrink: 0, marginTop: 1 }}/>
      <p style={{ fontSize: 12, lineHeight: 1.5, color: "#92400E", flex: 1 }}>{children}</p>
      <button onClick={dismiss} aria-label="Dismiss tip" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#B45309", flexShrink: 0 }}>
        <X size={14}/>
      </button>
    </div>
  );
}

// ─── First-login coach-mark spotlight ──────────────────────────────────────────
// One-shot "tap here, this is next" pointer at a real control, shown only the very
// first time someone reaches this step (tracked by a one-time localStorage flag,
// never reset). Polls continuously (not just once on mount) via rAF so it reliably
// finds its target even if this step is still finishing its first render.
function Coachmark({ storageKey, targetId, title, body, placement }: {
  storageKey: string; targetId: string; title: string; body: string; placement?: "above" | "below";
}) {
  const [done, setDone] = useState(() => {
    try { return localStorage.getItem(storageKey) === "1"; } catch { return false; }
  });
  const [frame, setFrame] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [rect, setRect]   = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (done) return;
    let raf = 0;
    const tick = () => {
      const frameEl  = document.getElementById("garm-phone-frame");
      const targetEl = document.getElementById(targetId);
      if (frameEl && targetEl) {
        const f = frameEl.getBoundingClientRect();
        const t = targetEl.getBoundingClientRect();
        setFrame({ top: f.top, left: f.left, width: f.width, height: f.height });
        setRect({ top: t.top - f.top, left: t.left - f.left, width: t.width, height: t.height });
      } else {
        setRect(null);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [done, targetId]);

  if (done || !rect || !frame) return null;

  function dismiss() {
    setDone(true);
    try { localStorage.setItem(storageKey, "1"); } catch { /* ignore */ }
  }

  const pad = 6;
  const hole = { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  const placeBelow = placement ? placement === "below" : hole.top < frame.height * 0.55;
  const bubbleTop = placeBelow ? Math.min(hole.top + hole.height + 12, frame.height - 140) : undefined;
  const bubbleBottom = !placeBelow ? Math.max(frame.height - hole.top + 12, 12) : undefined;

  return (
    <div style={{ position: "fixed", top: frame.top, left: frame.left, width: frame.width, height: frame.height, zIndex: 9999, overflow: "hidden", borderRadius: 44, pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: Math.max(0, hole.top), background: "rgba(13,13,13,0.68)" }}/>
      <div style={{ position: "absolute", top: hole.top + hole.height, left: 0, right: 0, bottom: 0, background: "rgba(13,13,13,0.68)" }}/>
      <div style={{ position: "absolute", top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height, background: "rgba(13,13,13,0.68)" }}/>
      <div style={{ position: "absolute", top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height, background: "rgba(13,13,13,0.68)" }}/>
      <div style={{ position: "absolute", top: hole.top, left: hole.left, width: hole.width, height: hole.height, borderRadius: 16, border: `2px solid ${ACCENT}`, boxShadow: "0 0 0 3px rgba(200,169,126,0.25)" }}/>
      <div style={{
          position: "absolute", top: bubbleTop, bottom: bubbleBottom, left: 20, right: 20,
          background: "var(--background)", borderRadius: 16, padding: 16,
          boxShadow: "0 12px 28px rgba(0,0,0,0.22)", border: "1px solid var(--border)",
          pointerEvents: "auto",
        }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 4 }}>{title}</p>
        <p className="text-muted-foreground mb-3" style={{ fontSize: 12, lineHeight: 1.5 }}>{body}</p>
        <div className="flex justify-end">
          <button onClick={dismiss} className="flex items-center gap-1 px-3.5 py-2 rounded-xl" style={{ background: DARK, color: "#fff", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
            Got it <ArrowRight size={13} strokeWidth={2}/>
          </button>
        </div>
      </div>
    </div>
  );
}

const VALIDATORS = {
  email:    (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "Enter a valid email address",
  city:     (v: string) => !v.trim() ? "" : /^[A-Za-z\s.'-]+$/.test(v.trim()) ? "" : "City can only contain letters",
  phone:    (v: string) => isPhoneValid(v) ? "" : "Enter 10 digits after +91 (start with 6-9)",
  name:     (v: string) => v.trim().length < 2 ? "Name must be at least 2 characters" : /\d/.test(v) ? "Name cannot contain numbers" : "",
  pin:      (v: string) => /^\d{6}$/.test(v.trim()) ? "" : "PIN code must be exactly 6 digits",
  orgName:  (v: string) => v.trim().length >= 3 ? "" : "Organisation name must be at least 3 characters",
  gst:      (v: string) => !v.trim() || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v.trim().toUpperCase()) ? "" : "Invalid GST number format",
  pan:      (v: string) => !v.trim() || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v.trim().toUpperCase()) ? "" : "Invalid PAN number format (e.g. ABCDE1234F)",
};

function FieldError({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="flex items-center gap-1 mt-1">
      <AlertTriangle size={10} style={{ color:"#dc2626", flexShrink:0 }}/>
      <p style={{ fontSize:10, color:"#dc2626" }}>{msg}</p>
    </div>
  );
}

// ─── Current-location picker (shared by individual & org delivery editors) ──────
// Detects the device location, reverse-geocodes it, lets the user confirm on a
// map, then calls back so the caller can auto-fill its address fields.
function GeoLocate({ onResolved }: { onResolved: (r: { address: string; city: string; pin: string }) => void }) {
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [coords, setCoords]     = useState<{ lat: number; lng: number } | null>(null);
  const [resolved, setResolved] = useState<{ address: string; city: string; pin: string } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [showMap, setShowMap]   = useState(false);

  async function reverseGeocode(lat: number, lng: number) {
    setResolving(true);
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
      setResolved({ address: road || data.display_name?.split(",")[0] || "", city: cityVal, pin: postcode });
    } catch { setResolved(null); }
    setResolving(false);
  }

  function handleUse() {
    if (!navigator.geolocation) { setError("Geolocation not supported on this device."); return; }
    setLoading(true); setError("");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(pt); reverseGeocode(pt.lat, pt.lng); setShowMap(true); setLoading(false);
      },
      err => {
        setLoading(false);
        setError(err.code === 1 ? "Location access denied — enable it in browser settings." : "Couldn't get your location. Enter the address manually.");
      },
      { timeout: 12000, enableHighAccuracy: true }
    );
  }

  function confirm() {
    if (resolved) onResolved(resolved);
    setShowMap(false);
  }

  return (
    <>
      <button onClick={handleUse} disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl mb-2"
        style={{ border: `1.5px dashed ${DARK}`, background: "rgba(13,13,13,0.04)", color: DARK, cursor: loading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13 }}>
        {loading ? <Loader2 size={14} className="animate-spin"/> : <Navigation size={14} strokeWidth={2}/>}
        {loading ? "Getting your location…" : "Use current location"}
      </button>
      {error && <p style={{ fontSize: 11, color: "#dc2626", marginBottom: 6 }}>{error}</p>}

      {showMap && coords && (
        <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "var(--background)", borderRadius: 44, overflow: "hidden" }}>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
            <button onClick={() => setShowMap(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <ChevronLeft size={20} style={{ color: DARK }}/>
            </button>
            <div className="flex-1">
              <p style={{ fontSize: 15, fontWeight: 700, color: DARK }}>Choose delivery location</p>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Pin shows your detected spot</p>
            </div>
          </div>
          <div className="relative flex-shrink-0" style={{ height: 300 }}>
            <iframe
              title="Delivery map"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.008},${coords.lat - 0.008},${coords.lng + 0.008},${coords.lat + 0.008}&layer=mapnik&marker=${coords.lat},${coords.lng}`}
              className="w-full h-full" style={{ border: "none" }}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <MapPin size={36} strokeWidth={2} style={{ color: DARK, marginBottom: 28, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.35))" }}/>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pt-4">
            <div className="rounded-2xl border border-border bg-card p-4 mb-3">
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Detected address</p>
              {resolving ? (
                <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Locating…</p>
              ) : resolved ? (
                <>
                  <p style={{ fontSize: 14, fontWeight: 600, color: DARK, lineHeight: 1.4 }}>{resolved.address}</p>
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{resolved.city}{resolved.pin ? ` — ${resolved.pin}` : ""}</p>
                </>
              ) : (
                <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Couldn't detect — edit manually after confirming.</p>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 px-4 py-3 border-t border-border">
            <button onClick={confirm} disabled={resolving} style={{ ...(resolving ? btnPrimaryDisabled : btnPrimary) }}>
              <Check size={15}/> Confirm this location
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Persona    = "organisation" | "individual";
type OrgType    = "school" | "college" | "corporate" | "hospital" | "industry" | "hospitality" | "sports" | "government" | "ngo";
type OrgService = "uniform" | "sports" | "accessories" | "lab_dress" | "formal" | "tshirt" | "workwear" | "scrubs" | "apron" | "jersey" | "custom";
type OrgServiceOption = { id: OrgService; label: string; sub: string; accessories?: string[] };
type CustomAudience = "kids" | "men" | "women";
type SizeCat    = "mens" | "womens" | "school" | "college" | "custom";
type GarmentType = "school_uniform" | "tshirt" | "shirt" | "polo" | "hoodie" | "sportswear" | "dress" | "formal";
type GroupType  = "kids" | "students" | "family" | "friends" | "personal" | "event";
type RefOption  = "upload_logo" | "inspiration" | "match_uniform" | "swatch_box";
type DigiStatus = "pending" | "processing" | "done";

interface ColorEntry { id: number; hex: string; pantone: string; label: string; position: string }
interface RefImg { id: number; url: string; name: string; size: number; caption: string; tag: string; digiStatus?: DigiStatus; needsDigi?: boolean; dataUrl?: string }

// Read an uploaded reference file as a base64 data URL so it can travel with
// the order to the backend — the admin team downloads it from the portal's
// order Documents card. Files over 4MB are kept name-only (too big to embed).
const REF_FILE_MAX = 4 * 1024 * 1024;
function refFileToDataUrl(file: File): Promise<string | undefined> {
  if (file.size > REF_FILE_MAX) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

// Fallback demo profile — overwritten with the real onboarding profile (name, org
// name/type, phone, email, saved default delivery address) at the top of
// NewOrderTab() on every mount, so the rest of this file can keep reading
// `currentUser.X` as a simple, always-in-scope default.
let currentUser = {
  name: "", org: "",
  accountType: "institution" as "institution" | "individual",
  orgType: "school" as OrgType,
  email: "", phone: "",
  address: "", city: "", pin: "",
};

// ─── Org configs ──────────────────────────────────────────────────────────────

const orgTypeDefs = [
  { id: "school" as OrgType,       Icon: BookOpen,    label: "School",           sub: "K-12 uniforms & sportswear",       iconBg:"#EFF6FF", iconColor:"#1d4ed8" },
  { id: "college" as OrgType,      Icon: GraduationCap, label: "College",        sub: "Batch wear & campus events",       iconBg:"#F5F3FF", iconColor:"#6d28d9" },
  { id: "corporate" as OrgType,    Icon: Building2,   label: "Corporate",        sub: "Office wear & branded apparel",    iconBg:"#F0F9FF", iconColor:"#0369a1" },
  { id: "hospital" as OrgType,     Icon: Heart,       label: "Hospital",         sub: "Scrubs, lab coats & patient wear", iconBg:"#FFF1F2", iconColor:"#be123c" },
  { id: "industry" as OrgType,     Icon: Factory,     label: "Industry",         sub: "Workwear, safety & uniforms",      iconBg:"#FFF7ED", iconColor:"#c2410c" },
  { id: "hospitality" as OrgType,  Icon: Utensils,    label: "Hotel",            sub: "Staff uniforms & aprons",          iconBg:"#F0FDF4", iconColor:"#15803d" },
  { id: "sports" as OrgType,       Icon: Trophy,      label: "Sports Club",      sub: "Jerseys, tracksuits & kits",       iconBg:"#FFFBEB", iconColor:"#b45309" },
  { id: "government" as OrgType,   Icon: Landmark,    label: "Government",       sub: "Formal & department uniforms",     iconBg:"#F8FAFC", iconColor:"#334155" },
  { id: "ngo" as OrgType,          Icon: Users,       label: "NGO / Trust",      sub: "Volunteer tees & event wear",      iconBg:"#FDF4FF", iconColor:"#7e22ce" },
];

// ─── Universal Accessory Catalog ─────────────────────────────────────────────
// All org types share the same full catalog, organized into categories.
// Each category has items; user picks category first, then items + qty.

type AccessoryCategory = {
  id: string;
  emoji: string;
  label: string;
  sub: string;
  items: string[];
};

const universalAccessoryCategories: AccessoryCategory[] = [
  {
    id: "bottles_mugs",    emoji: "bottles", label: "Bottles & Mugs",
    sub: "Water bottles, steel bottles, coffee mugs, travel mugs, photo mugs",
    items: ["Water Bottles","Steel Bottles","Coffee Mugs","Travel Mugs","Photo Mugs","Name Mugs"],
  },
  {
    id: "id_lanyards",     emoji: "id", label: "ID & Lanyards",
    sub: "ID cards, ID tags, name badges, lanyards, wrist bands",
    items: ["ID Cards","ID Tags / Name Badges","Lanyards","Wrist Bands","Event Passes","Badges"],
  },
  {
    id: "office_essentials", emoji: "office", label: "Office Essentials",
    sub: "Pens, notebooks, diaries, desk calendars, name plates",
    items: ["Pens","Notebooks","Diaries","Desk Calendars","Name Plates","USB Drives","Power Banks"],
  },
  {
    id: "bags",            emoji: "bags", label: "Bags & Carry",
    sub: "Tote bags, backpacks, laptop sleeves, conference kits",
    items: ["Tote Bags","Backpacks","Laptop Sleeves","Laptop Skins","Conference Kits","Employee Welcome Kits"],
  },
  {
    id: "awards",          emoji: "awards", label: "Awards & Recognition",
    sub: "Medals, trophies, certificates, plaques, acrylic frames",
    items: ["Medals","Trophies","Certificates","Awards & Plaques","Acrylic Frames","Crystal Gifts","Wooden Engraved Gifts"],
  },
  {
    id: "event_promo",     emoji: "event", label: "Event & Promo",
    sub: "Banners, standees, stickers, keychains, whistles",
    items: ["Banners","Standees","Stickers","Keychains","Whistles","Corporate Gift Kits","Promotional Gift Sets"],
  },
  {
    id: "photo_personal",  emoji: "photo", label: "Photo & Personal Gifts",
    sub: "Photo frames, cushions, fridge magnets, LED boards, passport covers",
    items: ["Photo Frames","LED Photo Frames","Cushions","Fridge Magnets","Wall Clocks","LED Name Boards","Wooden Name Boards","Passport Covers","Photo Keychains","Name Keychains","Gift Boxes","Personalised Lamps"],
  },
  {
    id: "mobile_tech",     emoji: "mobile", label: "Mobile & Tech",
    sub: "Mobile cases, laptop skins, car/bike stickers, helmet stickers",
    items: ["Mobile Cases","Car Stickers","Bike Stickers","Helmet Stickers","Wallets"],
  },
];

// ─── Accessory Category Specs ─────────────────────────────────────────────────
// Each accessory category has its own spec fields shown in the Specs step.
// No fabric/GSM/weave — these are product-specific material choices.

type AccessoryCategorySpec = {
  categoryIds: string[];            // which accessory category ids this applies to
  fields: {
    label: string;
    options: string[];
    hint?: string;
  }[];
};

const accessoryCategorySpecs: AccessoryCategorySpec[] = [
  {
    categoryIds: ["bottles_mugs"],
    fields: [
      { label: "Material", options: ["Stainless Steel (double-wall)", "Plastic (BPA-free)", "Ceramic", "Borosilicate Glass", "Aluminium", "Copper"], hint: "Choose based on usage — steel for insulation, ceramic for mugs" },
      { label: "Finish", options: ["Matte powder coat", "Glossy lacquer", "Brushed steel", "Transparent / Clear", "Frosted"] },
      { label: "Print / Branding method", options: ["Laser engraving", "UV printing", "Screen printing", "Sublimation transfer", "Embossed logo"] },
    ],
  },
  {
    categoryIds: ["id_lanyards"],
    fields: [
      { label: "ID card material", options: ["PVC (standard)", "PET (eco-friendly)", "Teslin / Synthetic paper", "Laminated paper card", "Metal card (premium)"], hint: "PVC is most common; Teslin is writable & eco" },
      { label: "Card finish", options: ["Gloss laminate", "Matte laminate", "Holographic overlay", "Plain (no laminate)"] },
      { label: "Lanyard material", options: ["Polyester (standard)", "Nylon (premium)", "Cotton (eco-friendly)", "Tubular polyester", "Not required"] },
      { label: "Attachment type", options: ["Bulldog clip", "Retractable reel", "Safety breakaway buckle", "Key ring", "Swivel hook"] },
    ],
  },
  {
    categoryIds: ["office_essentials"],
    fields: [
      { label: "Pen type", options: ["Ball point", "Gel ink", "Roller ball", "Felt tip", "Not ordering pens"] },
      { label: "Notebook / Diary cover", options: ["Hard cover (PU leatherette)", "Soft cover (PU)", "Kraft paper cover", "Cloth / Fabric cover", "Not ordering notebooks"] },
      { label: "Branding method", options: ["Debossed logo", "UV spot printing", "Full-colour cover print", "Foil stamping", "Silkscreen print"] },
    ],
  },
  {
    categoryIds: ["bags"],
    fields: [
      { label: "Bag material", options: ["Canvas (cotton)", "Non-woven PP", "Jute", "Ripstop nylon", "Polyester 600D", "Recycled PET fabric", "Genuine / PU leather"], hint: "Canvas & jute for eco branding; nylon for durability" },
      { label: "Stitching & finishing", options: ["Single-needle flat seam", "Double-needle reinforced", "Heat-sealed seams", "Overlock finish"] },
      { label: "Closure type", options: ["Zip closure", "Magnetic snap", "Button snap", "Open top (tote)", "Drawstring"] },
      { label: "Branding method", options: ["Screen printing", "Embroidery patch", "Woven label", "Sublimation print", "Heat transfer"] },
    ],
  },
  {
    categoryIds: ["awards"],
    fields: [
      { label: "Award material", options: ["Crystal / K9 glass", "Acrylic", "Metal (zinc alloy)", "Wooden (teak / MDF)", "Marble / Stone resin", "Glass"], hint: "Crystal for premium events; acrylic for budget-friendly" },
      { label: "Engraving / Print method", options: ["Laser engraving", "UV colour printing", "Gold / Silver foiling", "Sand blasting", "Embossed plate"] },
      { label: "Base / Stand type", options: ["Wooden base", "Metal base", "Integrated (no separate base)", "Acrylic base"] },
    ],
  },
  {
    categoryIds: ["event_promo"],
    fields: [
      { label: "Primary item type", options: ["Flex / Vinyl banner", "Fabric pull-up standee", "Stickers (vinyl)", "Stickers (paper)", "Keychain (metal)", "Keychain (acrylic)", "Gift kit assembly"] },
      { label: "Print method", options: ["Digital solvent print", "UV flatbed print", "Sublimation", "Screen print", "Offset print"] },
      { label: "Keychain material (if applicable)", options: ["Zinc alloy / Die-cast metal", "Acrylic", "Rubber / PVC", "Genuine leather", "Not ordering keychains"] },
    ],
  },
  {
    categoryIds: ["photo_personal"],
    fields: [
      { label: "Primary item", options: ["Photo frame (wooden)", "Photo frame (acrylic)", "LED photo frame", "Cushion (sublimated)", "Wall clock (acrylic)", "LED name board", "Wooden name board", "Fridge magnet"] },
      { label: "Print / Branding method", options: ["Sublimation transfer", "UV direct print", "Laser engraving", "Screen print"] },
      { label: "Photo source", options: ["We'll provide digital photos", "Need photographer / design help", "Template design only"] },
    ],
  },
  {
    categoryIds: ["mobile_tech"],
    fields: [
      { label: "Primary item", options: ["Mobile case (hard shell)", "Mobile case (soft TPU)", "Laptop skin (vinyl)", "Car sticker (vinyl)", "Bike / Helmet sticker"] },
      { label: "Print method", options: ["UV direct print", "Sublimation", "Digital cut vinyl", "Screen print"] },
      { label: "Device specification", options: ["Provide device model list separately", "Standard sizes (A5 / A4 sheets)", "Coordinator to confirm sizes"] },
    ],
  },
  {
    categoryIds: ["textiles"],
    fields: [
      { label: "Fabric type", options: ["100% Cotton (soft)", "Cotton-Poly blend (durable)", "Dri-fit polyester (sports)", "Fleece / Sweatshirt GSM", "Pique knit (polo)"] },
      { label: "GSM weight", options: ["140–160 GSM (lightweight)", "180–200 GSM (standard)", "220–250 GSM (heavy)"] },
      { label: "Print / Branding", options: ["Screen printing", "Embroidery", "Sublimation (all-over)", "DTF transfer print", "Heat transfer"] },
    ],
  },
];

function getAccessoryCategorySpecs(categoryId: string | null): AccessoryCategorySpec | null {
  if (!categoryId) return null;
  return accessoryCategorySpecs.find(s => s.categoryIds.includes(categoryId)) ?? null;
}

function parseAccessoryQtyKey(key: string): { categoryId: string; itemName: string } {
  const dashIdx = key.indexOf("-");
  if (dashIdx === -1) return { categoryId: "", itemName: key };
  return { categoryId: key.slice(0, dashIdx), itemName: key.slice(dashIdx + 1) };
}

function getAccessoryCategoriesFromQty(accessoryQty: Record<string, number>): string[] {
  const ids = new Set<string>();
  for (const [key, q] of Object.entries(accessoryQty)) {
    if (q > 0) {
      const { categoryId } = parseAccessoryQtyKey(key);
      if (categoryId) ids.add(categoryId);
    }
  }
  return [...ids];
}

function countAccessoryQtyForCategory(categoryId: string, accessoryQty: Record<string, number>): number {
  let total = 0;
  for (const [key, q] of Object.entries(accessoryQty)) {
    if (q > 0 && parseAccessoryQtyKey(key).categoryId === categoryId) total += q;
  }
  return total;
}

// Organisations now pick between ordering garments (chosen from the catalog in the
// next step — filtered to what's relevant for the org type) or browsing accessories.
// The specific garment types are no longer a middle step; the catalog handles that.
const orgGarmentSub: Partial<Record<OrgType, string>> = {
  school:      "Uniforms, shirts, pants, skirts, sports tees & more",
  college:     "Campus tees, hoodies, department & lab wear",
  corporate:   "Formal shirts, polos, blazers & branded tees",
  hospital:    "Scrubs, lab coats, aprons & staff wear",
  industry:    "Workwear, safety uniforms & protective wear",
  hospitality: "Staff shirts, aprons, waistcoats & service wear",
  sports:      "Jerseys, tracksuits, training & fan wear",
  government:  "Department uniforms, formal & ceremonial wear",
  ngo:         "Volunteer tees, field wear & campaign apparel",
};
const orgServiceOptions: Record<OrgType, OrgServiceOption[]> = Object.fromEntries(
  orgTypeDefs.map(t => [t.id, [
    { id: "uniform" as OrgService, label: "Garments", sub: orgGarmentSub[t.id] ?? "Choose garments from the catalog in the next step" },
    { id: "accessories" as OrgService, label: "Accessories", sub: "Browse full catalog — bottles, bags, awards, ID & more" },
  ]])
) as Record<OrgType, OrgServiceOption[]>;

function activeServiceLabel(type: OrgType, id: OrgService) {
  return orgServiceOptions[type].find(o => o.id === id)?.label ?? id;
}

const orgCfg: Record<OrgType, { minQty: number; defaultQty: number; qtyStep: number; defaultSizeCat: SizeCat; fabricLabel: string; fabricOptions: string[]; gsmOptions: string[]; weaveOptions: string[]; nameLabel: string; namePlaceholder: string; regLabel: string; regPlaceholder: string }> = {
  school:      { minQty: 100, defaultQty: 200, qtyStep: 50, defaultSizeCat: "school",  fabricLabel: "Fabric type",    fabricOptions: ["100% Cotton Pique","Cotton-Poly Blend","100% Polyester","Linen Blend","Heavy Cotton Twill"],                  gsmOptions: ["160–180 GSM (polo shirts)","180–220 GSM (shirts)","240–280 GSM (jackets)"],          weaveOptions: ["Plain","Pique","Twill","Oxford"],                nameLabel: "School name",                namePlaceholder: "e.g. St. Mary's High School",      regLabel: "Board / Affiliation",                        regPlaceholder: "e.g. CBSE, ICSE, State Board" },
  college:     { minQty: 100, defaultQty: 500, qtyStep: 50,  defaultSizeCat: "college", fabricLabel: "Fabric type",    fabricOptions: ["Cotton-Poly Blend (Dri-fit)","100% Cotton","Fleece / Sweatshirt","Micro Pique","Heavy GSM for Hoodies"],     gsmOptions: ["160–180 GSM (tees)","200–240 GSM (sweatshirts)","280–320 GSM (hoodies)"],          weaveOptions: ["Plain","Pique","French Terry","Fleece"],         nameLabel: "College / University name",  namePlaceholder: "e.g. PSG College of Technology",   regLabel: "Affiliated under",                           regPlaceholder: "e.g. Anna University, Autonomous" },
  corporate:   { minQty: 100, defaultQty: 300, qtyStep: 50, defaultSizeCat: "mens",   fabricLabel: "Fabric type",    fabricOptions: ["Oxford Cotton (formal shirts)","Cotton-Poly Blend (polo)","Premium Pique","Linen Blend","Dri-fit (branded tees)"], gsmOptions: ["120–140 GSM (summer wear)","180–200 GSM (formal shirts)","220–260 GSM (polos)"],  weaveOptions: ["Oxford","Plain","Pique","Twill"],                nameLabel: "Company name",               namePlaceholder: "e.g. Tata Consultancy Services",   regLabel: "Industry / Sector",                          regPlaceholder: "e.g. IT, Finance, Manufacturing" },
  hospital:    { minQty: 100, defaultQty: 150, qtyStep: 25, defaultSizeCat: "mens",   fabricLabel: "Garment type",   fabricOptions: ["Medical scrubs (Cotton-Poly)","Lab coats (100% Cotton)","Patient gowns (soft cotton)","OT wear (poly-cotton)"], gsmOptions: ["130–160 GSM (patient gowns)","180–200 GSM (scrubs & lab coats)","220–240 GSM"], weaveOptions: ["Plain weave","Twill","Ripstop"],                  nameLabel: "Hospital / Clinic name",     namePlaceholder: "e.g. Apollo Hospitals, City Clinic", regLabel: "Registration / NABH no.",                    regPlaceholder: "e.g. NABH-2024-XXXX" },
  industry:    { minQty: 100, defaultQty: 500, qtyStep: 100, defaultSizeCat: "mens",   fabricLabel: "Workwear type",  fabricOptions: ["Heavy cotton twill (workwear)","Poly-Cotton Ripstop (durable)","FR Cotton (fire-retardant)","100% Polyester (hi-vis)"], gsmOptions: ["240–280 GSM (standard workwear)","300–340 GSM (heavy duty)","360+ GSM (protective)"], weaveOptions: ["Twill","Ripstop","Plain","Canvas"],             nameLabel: "Company / Factory name",     namePlaceholder: "e.g. Mahindra Industries",         regLabel: "Industry type",                              regPlaceholder: "e.g. Automotive, Textile, Construction" },
  hospitality: { minQty: 100, defaultQty: 100, qtyStep: 25, defaultSizeCat: "mens",   fabricLabel: "Fabric type",    fabricOptions: ["Premium Cotton-Poly (staff shirts)","Cotton Twill (trousers & aprons)","Pique knit (polo uniforms)","Chef coat cotton"], gsmOptions: ["160–180 GSM (shirts)","200–240 GSM (aprons)","260–300 GSM (chef coats)"], weaveOptions: ["Plain","Twill","Pique","Oxford"],                nameLabel: "Hotel / Restaurant name",    namePlaceholder: "e.g. Taj Hotels, The Grand Brasserie", regLabel: "Property type",                              regPlaceholder: "e.g. 5-star hotel, Restaurant chain" },
  sports:      { minQty: 100, defaultQty: 100, qtyStep: 20, defaultSizeCat: "college",fabricLabel: "Sports fabric",  fabricOptions: ["Dri-fit Polyester (jerseys)","Mesh knit (ventilated kits)","Compression spandex blend","Fleece (tracksuits)"], gsmOptions: ["100–130 GSM (jerseys & singlets)","160–180 GSM (training wear)","280–320 GSM (tracksuits)"], weaveOptions: ["Knit (jersey)","Mesh","Interlock","Fleece"],   nameLabel: "Club / Team name",           namePlaceholder: "e.g. Chennai Super Kings, ABC FC",  regLabel: "Sport / League",                             regPlaceholder: "e.g. Cricket, Football, Basketball" },
  government:  { minQty: 100, defaultQty: 500, qtyStep: 100, defaultSizeCat: "mens",   fabricLabel: "Fabric type",    fabricOptions: ["Heavy Cotton Twill (uniforms)","Poly-Cotton Blend (formal)","100% Cotton (summer wear)","Wool Blend (winter formal)"], gsmOptions: ["180–220 GSM (standard uniform)","240–280 GSM (formal & ceremonial)","300–340 GSM (winter)"], weaveOptions: ["Twill","Plain","Serge","Oxford"],            nameLabel: "Department / Organisation name", namePlaceholder: "e.g. Tamil Nadu Police, TNEB",  regLabel: "Department code / Ministry",                 regPlaceholder: "e.g. Home Dept., Ministry of Health" },
  ngo:         { minQty: 100, defaultQty: 100, qtyStep: 20, defaultSizeCat: "college",fabricLabel: "Fabric type",    fabricOptions: ["100% Cotton (tees & polos)","Organic Cotton (eco-friendly)","Cotton-Poly Blend","Recycled Polyester","Bamboo Blend"], gsmOptions: ["140–160 GSM (lightweight tees)","180–200 GSM (standard)","220–240 GSM (polo & jackets)"], weaveOptions: ["Plain","Pique","Jersey knit"],              nameLabel: "NGO / Trust name",           namePlaceholder: "e.g. Teach For India, HelpAge India", regLabel: "Registration number (optional)",              regPlaceholder: "e.g. 80G / FCRA no." },
};

// One practical, org-type-specific tip shown at the start of an organisation's order —
// replaces what used to just restate the org type back at the user (already shown at
// onboarding and editable from Account → Business details, so repeating it here added
// nothing).
const orderStartTipByOrgType: Record<string, string> = {
  school:      "You can order uniforms and accessories — like ID cards or bags — together. Sizes are entered per age group in the next step, so one order covers the whole school.",
  college:     "Ordering for a fest, fresher's kit or club? Combine T-shirts, hoodies and accessories in a single order — sizes are set per garment.",
  corporate:   "Add your logo placement under \"Reference & sample\" for each garment once it's picked — our team applies it exactly where you specify.",
  hospital:    "Scrubs, lab coats and patient gowns can all go in one order, each with its own fabric and GSM — no need to place separate orders per department.",
  industry:    "Workwear orders qualify for better per-piece pricing above 500 pcs — quantities across sizes and colours all count toward that total.",
  hospitality: "Ordering for multiple departments (kitchen, service, housekeeping)? Add each as a separate garment — every one gets its own fit and fabric.",
  sports:      "Add player names or numbers under \"Reference & sample\" once you've picked your jersey or kit.",
  government:  "Set up seasonal or ceremonial variants as separate garments in the next step — each can have a different fabric and finish.",
  ngo:         "Branded T-shirts or kits for volunteers? Add your logo under \"Reference & sample\" once the garment is picked.",
  default:     "You can mix garments and accessories — like T-shirts, ID cards and water bottles — in a single order, and we'll consolidate delivery.",
};

const sizeSets: Record<SizeCat, { label: string; hint: string }[]> = {
  mens:    [{ label:"XS",hint:'34"' },{ label:"S",hint:'36"' },{ label:"M",hint:'38-40"' },{ label:"L",hint:'42-44"' },{ label:"XL",hint:'46"' },{ label:"XXL",hint:'48"' },{ label:"3XL",hint:'50"' }],
  womens:  [{ label:"XS",hint:"UK 6" },{ label:"S",hint:"UK 8" },{ label:"M",hint:"UK 10-12" },{ label:"L",hint:"UK 14" },{ label:"XL",hint:"UK 16" },{ label:"XXL",hint:"UK 18" }],
  school:  [{ label:"3-4Y",hint:"Age 3-4" },{ label:"5-6Y",hint:"Age 5-6" },{ label:"7-8Y",hint:"Age 7-8" },{ label:"9-10Y",hint:"Age 9-10" },{ label:"11-12Y",hint:"Age 11-12" },{ label:"13-14Y",hint:"Age 13-14" },{ label:"15-16Y",hint:"Age 15-16" }],
  college: [{ label:"XS",hint:"" },{ label:"S",hint:"" },{ label:"M",hint:"" },{ label:"L",hint:"" },{ label:"XL",hint:"" },{ label:"XXL",hint:"" },{ label:"3XL",hint:"" }],
  custom:  [],
};

// ── Bottom-wear sizes by waist — jeans aren't bought in S/M/L ─────────────────
const waistSizeSets: { mens: { label: string; hint: string }[]; womens: { label: string; hint: string }[] } = {
  mens:   [28, 30, 32, 34, 36, 38, 40].map(w => ({ label: `${w}"`, hint: "waist" })),
  womens: [26, 28, 30, 32, 34, 36].map(w => ({ label: `${w}"`, hint: "waist" })),
};
function isBottomWearGarment(name: string): boolean {
  return /jean|chino|trouser|\bpant|jogger|legging|palazzo|short|track/i.test(name);
}

const sizeCats = [
  { id:"mens" as SizeCat,    label:"Men's",           desc:"Adult male — chest-based" },
  { id:"womens" as SizeCat,  label:"Women's",         desc:"Adult female — UK sizing" },
  { id:"school" as SizeCat,  label:"School / Kids",   desc:"Age-based school sizing" },
  { id:"college" as SizeCat, label:"College / Unisex",desc:"Relaxed campus fit" },
  { id:"custom" as SizeCat,  label:"Custom",          desc:"Enter your own labels" },
];

const garmentTypes = [
  { id:"school_uniform" as GarmentType, Icon: BookOpen,  label:"Uniform" },
  { id:"tshirt"         as GarmentType, Icon: Shirt,     label:"T-shirt" },
  { id:"shirt"          as GarmentType, Icon: Shirt,     label:"Shirt" },
  { id:"polo"           as GarmentType, Icon: Layers,    label:"Polo" },
  { id:"hoodie"         as GarmentType, Icon: Package,   label:"Hoodie" },
  { id:"sportswear"     as GarmentType, Icon: Dumbbell,  label:"Sportswear" },
  { id:"dress"          as GarmentType, Icon: Award,     label:"Dress" },
  { id:"formal"         as GarmentType, Icon: Briefcase, label:"Formal" },
];

const garmentFabricMap: Record<GarmentType, { fabricOptions: string[]; gsmOptions: string[] }> = {
  school_uniform: { fabricOptions:["100% Cotton Pique","Cotton-Poly Blend","Oxford Cotton","100% Polyester"], gsmOptions:["160–180 GSM (polo)","180–220 GSM (shirts)","240–280 GSM (blazers)"] },
  tshirt:  { fabricOptions:["Soft 100% Cotton","Cotton-Poly Blend","Dri-fit Polyester","Slub Cotton","Bamboo Blend"], gsmOptions:["140–160 GSM (lightweight)","180–200 GSM (standard)","220–240 GSM (premium)"] },
  shirt:   { fabricOptions:["Oxford Cotton","Poplin Cotton","Linen Blend","Cotton-Poly (easy care)","Rayon / Viscose"], gsmOptions:["120–140 GSM (summer)","160–180 GSM (standard)","200–220 GSM (formal)"] },
  polo:    { fabricOptions:["100% Cotton Pique","Dri-fit Pique","Micro Pique","Cotton-Poly Pique"], gsmOptions:["170–190 GSM (lightweight polo)","200–220 GSM (standard)","240–260 GSM (premium)"] },
  hoodie:  { fabricOptions:["Fleece (80/20 cotton-poly)","French Terry","Heavy GSM Fleece","Sherpa lined fleece"], gsmOptions:["240–280 GSM (light hoodie)","300–340 GSM (standard)","360–400 GSM (heavyweight)"] },
  sportswear: { fabricOptions:["Dri-fit Polyester","Mesh knit","Compression spandex blend","Microfibre performance"], gsmOptions:["100–130 GSM (jersey / singlet)","160–180 GSM (training wear)","200–240 GSM (track pants)"] },
  dress:   { fabricOptions:["100% Cotton","Linen Blend","Rayon / Viscose","Georgette","Cotton-Spandex"], gsmOptions:["100–130 GSM (light summer)","140–160 GSM (standard)","180–200 GSM (structured)"] },
  formal:  { fabricOptions:["Wool Blend","100% Polyester (suit)","Oxford Cotton (shirt)","Satin-finish poly","Linen Blend"], gsmOptions:["180–200 GSM (shirts)","240–280 GSM (trousers)","300–360 GSM (blazers)"] },
};

const groupSizeCatMap: Record<GroupType, SizeCat> = {
  kids:"school", students:"college", family:"mens", friends:"mens", personal:"custom", event:"college",
};

const colorPresets = [
  { hex:"#1a2540", label:"Navy Blue" }, { hex:"#c8a84b", label:"Golden" },
  { hex:"#f5f0e8", label:"Off White" }, { hex:"#2d5a3d", label:"Forest Green" },
  { hex:"#8b3a3a", label:"Burgundy"  }, { hex:"#3a4a7a", label:"Royal Blue" },
  { hex:"#5c4a3a", label:"Chocolate" }, { hex:"#e8e0d0", label:"Ivory" },
  { hex:"#111111", label:"Black"     }, { hex:"#e5e5e5", label:"Light Grey" },
  { hex:"#d4394a", label:"Red"       }, { hex:"#f4a324", label:"Amber" },
];

const stitchingOpts = [
  { id:"single_needle", label:"Single needle stitch",  sub:"Standard flat seam",               cost:"" },
  { id:"double_needle", label:"Double needle stitch",  sub:"Reinforced hems & cuffs",          cost:"+₹2/pc" },
  { id:"flatlock",      label:"Flatlock stitch",       sub:"Sportswear, no chafe seam",        cost:"+₹3/pc" },
  { id:"overlock",      label:"Overlock / Serger",     sub:"Clean edge finishing",             cost:"+₹1.5/pc" },
  { id:"chain",         label:"Chain stitch",          sub:"Heavy-duty workwear",              cost:"+₹2.5/pc" },
];
const packagingOpts = [
  { id:"bulk_loose",      label:"Bulk / Loose packing",   sub:"Pieces folded in a box · Economy",         cost:"" },
  { id:"poly_bag",        label:"Individual poly bag",    sub:"Each piece in a sealed bag",               cost:"+₹3/pc" },
  { id:"poly_cardboard",  label:"Poly bag + cardboard",   sub:"Rigid cardboard insert inside bag",        cost:"+₹6/pc" },
  { id:"ironing_poly",    label:"Ironing + poly bag",     sub:"Pressed flat & individually bagged",       cost:"+₹8/pc" },
  { id:"bundle",          label:"Bundle packing",         sub:"Grouped by size, rubber-banded",           cost:"+₹1/pc" },
  { id:"hangtag_hanger",  label:"Hangtag + hanger",       sub:"Retail-ready on hanger with tag",          cost:"+₹15/pc" },
  { id:"gift_box",        label:"Gift box packing",       sub:"Premium box with tissue paper",            cost:"+₹25/pc" },
];

// Parse the per-piece add-on (₹) from a stitching/packaging cost label like "+₹2/pc" or "+₹1.5/pc".
const perPcCost = (cost?: string): number => {
  const m = cost?.match(/₹\s*([\d.]+)/);
  return m ? parseFloat(m[1]) : 0;
};

// ─── Indicative pricing model (₹/piece) ───────────────────────────────────────
// All sensible defaults — tweak the numbers here in one place. Garment price is
// derived from the chosen fabric + weave so the total updates with each selection.
function fabricRatePerPc(fabric?: string): number {
  const f = (fabric || "").toLowerCase();
  if (!f) return 180;
  if (/\bfr\b|fire|retardant|hi-?vis|protective/.test(f)) return 320; // safety / industrial
  if (/wool|fleece|hoodie|sweatshirt|french terry|chef|coat/.test(f)) return 300;
  if (/linen|oxford|premium|organic|bamboo/.test(f))                  return 260;
  if (/canvas|denim|workwear|heavy|ripstop|twill/.test(f))            return 240;
  if (/pique|polo|interlock|jersey|knit/.test(f))                     return 210;
  if (/cotton/.test(f))                                               return 190;
  if (/poly|polyester|mesh|dri-?fit|blend/.test(f))                   return 170;
  return 180;
}
function weaveAddOnPerPc(weave?: string): number {
  const w = (weave || "").toLowerCase();
  if (/fleece|french terry|interlock/.test(w)) return 30;
  if (/twill|oxford|serge|canvas/.test(w))     return 20;
  if (/pique|mesh|ripstop/.test(w))            return 12;
  if (/jersey|knit/.test(w))                   return 10;
  return 0; // plain / standard weave
}
// Base garment rate (fabric + weave) per piece — before stitching/packaging add-ons.
function garmentRatePerPc(fabric?: string, weave?: string): number {
  return fabricRatePerPc(fabric) + weaveAddOnPerPc(weave);
}

// ─── Garment catalog (what kind of dress) ─────────────────────────────────────
// A specific garment now drives the base price; the chosen fabric/material then
// scales it (premium fabrics cost more, basic ones less) and the weave adds on top.
// Prices are indicative ₹/piece at the DEFAULT fabric — a coordinator confirms finals.
export type GarmentCategoryId = "mens" | "womens" | "kids";
export interface CatalogGarment { name: string; basePrice: number; gender?: "boy" | "girl" }
export interface CatalogCategory { id: GarmentCategoryId; label: string; emoji: string; items: CatalogGarment[] }

const garmentCatalog: CatalogCategory[] = [
  { id: "mens", label: "Men's Wear", emoji: "👔", items: [
    { name: "T-Shirts", basePrice: 190 }, { name: "Polo T-Shirts", basePrice: 230 },
    { name: "Round Neck T-Shirts", basePrice: 190 }, { name: "Oversized T-Shirts", basePrice: 240 },
    { name: "Hoodies", basePrice: 480 }, { name: "Sweatshirts", basePrice: 420 },
    { name: "Shirts (Formal)", basePrice: 360 }, { name: "Shirts (Casual)", basePrice: 330 },
    { name: "Denim Shirts", basePrice: 460 }, { name: "Jackets", basePrice: 650 },
    { name: "Blazers", basePrice: 1100 }, { name: "Waistcoats", basePrice: 520 },
    { name: "Trousers", basePrice: 420 }, { name: "Chinos", basePrice: 480 },
    { name: "Jeans", basePrice: 560 }, { name: "Shorts", basePrice: 260 },
    { name: "Track Pants", basePrice: 360 }, { name: "Joggers", basePrice: 390 },
    { name: "Uniforms", basePrice: 350 }, { name: "Lab Coats", basePrice: 420 },
    { name: "Safety Jackets", basePrice: 480 }, { name: "Aprons", basePrice: 240 },
  ]},
  { id: "womens", label: "Women's Wear", emoji: "👗", items: [
    { name: "T-Shirts", basePrice: 190 }, { name: "Polo T-Shirts", basePrice: 230 },
    { name: "Shirts", basePrice: 330 }, { name: "Kurtis", basePrice: 380 },
    { name: "Kurtas", basePrice: 420 }, { name: "Leggings", basePrice: 220 },
    { name: "Palazzo Pants", basePrice: 320 }, { name: "Sarees", basePrice: 750 },
    { name: "Blouses", basePrice: 260 }, { name: "Salwar Suits", basePrice: 720 },
    { name: "Churidar Sets", basePrice: 680 }, { name: "Co-ord Sets", basePrice: 620 },
    { name: "Tunics", basePrice: 340 }, { name: "Tops", basePrice: 260 },
    { name: "Dresses", basePrice: 520 }, { name: "Maxi Dresses", basePrice: 620 },
    { name: "Gowns", basePrice: 1200 }, { name: "Hoodies", basePrice: 480 },
    { name: "Sweatshirts", basePrice: 420 }, { name: "Jackets", basePrice: 620 },
    { name: "Uniforms", basePrice: 350 }, { name: "Lab Coats", basePrice: 420 },
    { name: "Aprons", basePrice: 240 },
  ]},
  { id: "kids", label: "Kids Wear", emoji: "🧒", items: [
    { name: "T-Shirts", basePrice: 150 }, { name: "Polo T-Shirts", basePrice: 180 },
    { name: "Shirts", basePrice: 240 }, { name: "Frocks", basePrice: 360, gender: "girl" },
    { name: "Dresses", basePrice: 340, gender: "girl" }, { name: "Shorts", basePrice: 170 },
    { name: "Track Pants", basePrice: 260 }, { name: "Joggers", basePrice: 280 },
    { name: "Hoodies", basePrice: 360 }, { name: "Sweatshirts", basePrice: 320 },
    { name: "Jackets", basePrice: 440 }, { name: "Night Suits", basePrice: 320 },
    { name: "Rompers", basePrice: 280 }, { name: "Onesies", basePrice: 260 },
    { name: "Lehenga / Skirt Sets", basePrice: 520, gender: "girl" }, { name: "Ethnic Wear (Girls)", basePrice: 420, gender: "girl" },
    { name: "Kurta Sets (Boys)", basePrice: 460, gender: "boy" }, { name: "Ethnic Wear (Boys)", basePrice: 420, gender: "boy" },
  ]},
];

// A selected garment, carried through the order. categoryId+name identify it; basePrice
// is the catalog price at the default fabric, before the fabric multiplier + weave add-on.
export interface SelectedGarment { categoryId: GarmentCategoryId; name: string; basePrice: number; style?: string }

// Fabric changes the garment price: premium fabrics cost more, basic ones less.
// Returns a multiplier applied to the garment's catalog base price.
function fabricPriceMultiplier(fabric?: string): number {
  const f = (fabric || "").toLowerCase();
  if (!f) return 1;
  // Order matters — the MORE SPECIFIC / premium keyword must be tested first.
  // Previously every Polo fabric ("100% Cotton Pique", "Dri-fit Pique",
  // "Micro Pique", "Cotton-Poly Pique") matched the generic "pique" rule and
  // collapsed to ONE price. Now the distinguishing word (dri-fit, micro,
  // poly-blend, cotton) is checked before the generic knit rule, so each fabric
  // in a garment gets its own price.
  if (/\bfr\b|fire|retardant|hi-?vis|protective/.test(f))   return 1.6;   // technical safety
  if (/wool/.test(f))                                       return 1.5;
  if (/sherpa|heavyweight|heavy gsm|heavy.*fleece/.test(f)) return 1.45;
  if (/fleece|french terry|chef|coat/.test(f))              return 1.4;
  if (/gown|silk|satin/.test(f))                            return 1.35;
  if (/micro ?pique/.test(f))                               return 1.3;   // premium polo knit
  if (/linen|rayon|viscose|georgette/.test(f))              return 1.28;
  if (/organic|bamboo/.test(f))                             return 1.24;
  if (/oxford/.test(f))                                     return 1.22;
  if (/premium|slub|poplin/.test(f))                        return 1.18;
  if (/compression|spandex|microfibre|performance/.test(f)) return 1.16;
  if (/canvas|denim|ripstop|workwear/.test(f))             return 1.15;
  if (/heavy|twill/.test(f))                                return 1.12;
  if (/dri-?fit/.test(f))                                   return 1.1;   // performance knit (before generic pique/poly)
  if (/pique/.test(f) && /poly|blend/.test(f))              return 1.02;  // cotton-poly pique
  if (/pique|interlock/.test(f))                            return 1.06;  // cotton / plain pique
  if (/mesh|jersey|knit/.test(f))                           return 1.0;
  if (/cotton/.test(f) && /poly|blend/.test(f))             return 0.96;  // cotton-poly blend
  if (/cotton/.test(f))                                     return 1.0;
  if (/poly|polyester|blend/.test(f))                       return 0.9;
  return 1;
}
// Per-piece garment price. FIRST preference: the admin's per-option prices
// (base + fabric/GSM/weave/style ₹ deltas set in the Catalog) so the admin fully
// controls pricing. If the admin hasn't priced this product's options, fall back
// to the built-in catalog base × fabric multiplier + weave add-on.
function garmentPriceForFabric(garment: SelectedGarment | null, fabric?: string, weave?: string, source?: "fresh" | "surplus", gsm?: string, audience?: "B2C" | "B2B"): number {
  let base: number;
  const admin = garment ? adminGarmentPrice(garment.name, { fabric, gsm, weave, style: garment.style }, audience) : null;
  if (admin != null) {
    base = admin;
  } else {
    base = !garment
      ? garmentRatePerPc(fabric, weave)
      : Math.round(garment.basePrice * fabricPriceMultiplier(fabric)) + weaveAddOnPerPc(weave);
  }
  // Surplus (mill leftover) fabric is genuinely cheaper — apply the discount
  // set in the Garm Admin Portal (Settings → Order Form → Service Fee).
  return source === "surplus" ? Math.max(1, Math.round(base * (1 - surplusDiscountPct() / 100))) : base;
}

// ─── Garment style options ────────────────────────────────────────────────────
// Each garment can have a "style" (round-neck vs collared tee, formal vs printed
// shirt, leggings vs jeans, …). Chosen per product inside the garment card.
// Keyword-matched against the catalog item name so it works across men/women/kids.
function garmentStyleOptions(name: string): string[] {
  // Admin-managed Style list for this product (Garm Admin Portal → Catalog).
  // Present ⇒ it replaces the built-in list below; missing/empty/server
  // unreachable ⇒ the app's own hardcoded options keep working unchanged.
  const admin = adminStylesFor(name);
  if (admin) return admin;
  const n = name.toLowerCase();
  // ── Tops ──
  if (/polo/.test(n))                        return ["Classic collar", "Tipped collar", "Zip placket", "Mandarin collar"];
  if (/oversized/.test(n))                   return ["Drop shoulder", "Boxy fit", "Longline"];
  if (/round neck/.test(n))                  return ["Round neck", "Crew neck", "Raglan sleeve"];
  if (/t-?shirt|tee\b/.test(n))              return ["Round neck", "V-neck", "Henley", "Collared (polo)", "Raglan sleeve"];
  if (/denim shirt/.test(n))                 return ["Plain", "Washed", "Double pocket"];
  if (/formal.*shirt|shirt.*formal/.test(n)) return ["Slim fit", "Regular fit", "Full sleeve", "Half sleeve", "Cutaway collar", "Mandarin collar"];
  if (/casual.*shirt|shirt.*casual/.test(n)) return ["Plain", "Printed", "Checked", "Korean fit (boxy)", "Half sleeve", "Mandarin collar"];
  if (/night suit/.test(n))                  return ["Shirt + pyjama", "Tee + shorts", "Full sleeve set"];
  if (/\bshirt|blouse/.test(n))              return ["Formal", "Semi-formal", "Slim fit", "Regular fit", "Printed", "Plain"];
  if (/\btops?\b/.test(n))                   return ["Regular fit", "Crop", "Peplum", "Sleeveless"];
  // ── Bottoms — fits ──
  if (/jeans/.test(n))                       return ["Slim fit", "Straight fit", "Regular fit", "Relaxed fit", "Skinny", "Baggy / wide leg", "Korean fit (tapered)"];
  if (/chino|trouser/.test(n))               return ["Formal", "Slim fit", "Regular fit", "Korean fit (tapered)", "Baggy / relaxed", "Pleated", "Flat front"];
  if (/legging/.test(n))                     return ["Ankle length", "Full length", "Churidar"];
  if (/short/.test(n))                       return ["Regular fit", "Cargo", "Bermuda", "Baggy fit"];
  if (/track ?pant|jogger/.test(n))          return ["Regular fit", "Slim fit", "Cuffed ankle", "Baggy fit"];
  if (/palazzo/.test(n))                     return ["Flared", "Straight", "Culotte"];
  // ── Layers ──
  if (/hoodie/.test(n))                      return ["Pullover", "Zip-up", "Oversized fit"];
  if (/sweatshirt/.test(n))                  return ["Crew neck", "Hooded", "Oversized fit"];
  if (/safety jacket/.test(n))               return ["Sleeveless vest", "Full sleeve", "With hood"];
  if (/blazer|waistcoat/.test(n))            return ["Single-breasted", "Double-breasted", "Slim fit", "Regular fit"];
  if (/jacket/.test(n))                      return ["Bomber", "Denim", "Windcheater", "Varsity"];
  // ── Ethnic & occasion ──
  if (/saree/.test(n))                       return ["Plain", "Zari border", "Printed", "Embroidered"];
  if (/salwar/.test(n))                      return ["Straight cut", "A-line", "Anarkali"];
  if (/churidar/.test(n))                    return ["Classic", "Anarkali", "Straight cut"];
  if (/kurta set/.test(n))                   return ["Kurta + pyjama", "Kurta + churidar", "With jacket"];
  if (/ethnic.*girl/.test(n))                return ["Lehenga choli", "Anarkali", "Sharara set"];
  if (/ethnic.*boy/.test(n))                 return ["Kurta pyjama", "Sherwani style", "Dhoti set"];
  if (/kurti|kurta|tunic/.test(n))           return ["Straight", "A-line", "Anarkali"];
  if (/lehenga|skirt/.test(n))               return ["Flared", "A-line", "Layered"];
  if (/gown/.test(n))                        return ["A-line", "Ball gown", "Mermaid", "Straight"];
  if (/frock/.test(n))                       return ["A-line", "Twirl", "Party frock"];
  if (/maxi|dress/.test(n))                  return ["A-line", "Fit & flare", "Bodycon", "Shift"];
  if (/romper|onesie/.test(n))               return ["Half sleeve", "Full sleeve", "Sleeveless"];
  if (/co-?ord/.test(n))                     return ["Casual set", "Formal set", "Lounge set"];
  // ── Workwear ──
  if (/uniform/.test(n))                     return ["Regular fit", "Comfort fit", "Slim fit"];
  if (/lab coat/.test(n))                    return ["Full sleeve", "Half sleeve", "Knee length"];
  if (/apron/.test(n))                       return ["Bib apron", "Waist apron", "Cross-back"];
  return [];
}

// ── Multi-piece sets — what's included, so buyers aren't guessing ─────────────
// First piece wears the line's main colour; the rest get their own colour pick.
function garmentSetPieces(name: string): string[] | null {
  const n = name.toLowerCase();
  if (/salwar/.test(n))            return ["Kurta", "Salwar", "Dupatta"];
  if (/churidar set/.test(n))      return ["Kurta", "Churidar", "Dupatta"];
  if (/co-?ord/.test(n))           return ["Top", "Bottom"];
  if (/night suit/.test(n))        return ["Top", "Pyjama"];
  if (/kurta set/.test(n))         return ["Kurta", "Pyjama"];
  if (/lehenga|skirt set/.test(n)) return ["Choli (top)", "Lehenga / skirt"];
  if (/ethnic.*girl/.test(n))      return ["Top", "Bottom", "Dupatta"];
  if (/ethnic.*boy/.test(n))       return ["Kurta", "Bottom"];
  return null;
}
// Single-piece garments buyers often assume are sets — flag them clearly.
function garmentTopOnly(name: string): boolean {
  return /kurti|kurtas?\b|tunic|blouse/i.test(name) && !/set/i.test(name);
}

// ─── Per-org-type garment relevance ──────────────────────────────────────────
// Different organisation types buy different garments. Keyword-matched against
// the catalog item name so a school sees uniforms/pinafores while a corporate
// sees formal shirts/blazers. Types not listed fall through to the full catalog.
const orgGarmentFilter: Partial<Record<OrgType, RegExp>> = {
  school:      /t-?shirt|polo|shirt|short|track|trouser|pinafore|frock|skirt|uniform|sweatshirt|jacket|blazer/i,
  college:     /t-?shirt|polo|oversized|hoodie|sweatshirt|shirt|jacket|track|jogger|kurti|kurta/i,
  corporate:   /t-?shirt|polo|shirt|blazer|waistcoat|trouser|chino|jacket|kurti|kurta/i,
  hospital:    /lab coat|apron|uniform|scrub|coat|t-?shirt|trouser/i,
  industry:    /uniform|safety|jacket|trouser|apron|coat|t-?shirt/i,
  hospitality: /shirt|waistcoat|apron|trouser|polo|t-?shirt|blazer|jacket/i,
  sports:      /t-?shirt|polo|round neck|track|jogger|short|hoodie|sweatshirt|jacket|jersey/i,
  government:  /uniform|shirt|trouser|blazer|jacket|waistcoat|t-?shirt/i,
  ngo:         /t-?shirt|polo|round neck|hoodie|sweatshirt|jacket|shirt|kurti|kurta/i,
};
function garmentAllowedForOrg(orgType: OrgType | undefined, name: string): boolean {
  if (!orgType) return true;
  const re = orgGarmentFilter[orgType];
  return re ? re.test(name) : true;
}

// ─── Per-garment fabric options (individual multi-garment orders) ─────────────
// Maps a catalog item name to a sensible fabric/GSM set so a T-shirt and a shirt
// in the same order each get their own material choices.
function materialOptionsForGarment(name: string): { fabricOptions: string[]; gsmOptions: string[]; weaveOptions: string[] } {
  // Admin-managed Fabric/GSM/Weave lists for this product (Garm Admin Portal →
  // Catalog) override the built-in mapping below — list by list, so an admin
  // can customise just the fabrics and keep the app's GSM/weave defaults.
  // Missing/empty/server unreachable ⇒ built-in lists, exactly as before.
  const admin = adminMaterialsFor(name);
  const withAdmin = (built: { fabricOptions: string[]; gsmOptions: string[]; weaveOptions: string[] }) => ({
    fabricOptions: admin.fabricOptions ?? built.fabricOptions,
    gsmOptions: admin.gsmOptions ?? built.gsmOptions,
    weaveOptions: admin.weaveOptions ?? built.weaveOptions,
  });
  const n = name.toLowerCase();
  const weave = ["Plain", "Twill", "Jersey knit", "Pique", "Custom"];
  const pick = (k: keyof typeof garmentFabricMap) => withAdmin({ ...garmentFabricMap[k], weaveOptions: weave });
  if (/hoodie|sweatshirt/.test(n))                 return pick("hoodie");
  if (/polo/.test(n))                              return pick("polo");
  if (/t-?shirt|tee\b|oversized|round neck/.test(n)) return pick("tshirt");
  if (/blazer|waistcoat|formal|trouser|chino/.test(n)) return pick("formal");
  if (/shirt|blouse/.test(n))                      return pick("shirt");
  if (/track|jogger|jersey|short|legging/.test(n)) return pick("sportswear");
  if (/dress|frock|gown|kurti|kurta|saree|tunic|top|palazzo/.test(n)) return pick("dress");
  if (/uniform|lab coat|apron|scrub|safety/.test(n)) return pick("school_uniform");
  return withAdmin({ fabricOptions: garmentFabricMap.tshirt.fabricOptions, gsmOptions: garmentFabricMap.tshirt.gsmOptions, weaveOptions: weave });
}

// ─── Garment glyph icons ──────────────────────────────────────────────────────
// One consistent line-icon set (matching the app's stroke style) so every garment
// in the catalog shows a recognisable picture — tee, hoodie, shirt, trousers, …
// Replaces the emoji category markers for a single, on-brand icon language.
type GarmentIconKey = "tshirt" | "polo" | "shirt" | "hoodie" | "sweatshirt" | "jacket" | "pants" | "shorts" | "dress" | "apron";
function garmentIconKey(name: string): GarmentIconKey {
  const n = name.toLowerCase();
  if (/hoodie/.test(n))                                   return "hoodie";
  if (/sweatshirt/.test(n))                               return "sweatshirt";
  if (/polo/.test(n))                                     return "polo";
  if (/blazer|waistcoat|jacket|coat|safety jacket/.test(n)) return "jacket";
  if (/lab coat|apron|scrub|uniform|pinafore/.test(n))    return "apron";
  if (/jeans|chino|trouser|legging|track ?pant|jogger|palazzo|salwar|churidar|pant/.test(n)) return "pants";
  if (/short/.test(n))                                    return "shorts";
  if (/dress|frock|gown|kurti|kurta|saree|tunic|lehenga|co-?ord|blouse|top|romper|onesie|night/.test(n)) return "dress";
  if (/shirt/.test(n))                                    return "shirt";
  return "tshirt"; // t-shirts, round neck, oversized, tees, jerseys
}
function GarmentIcon({ name, size = 26, color = DARK, strokeWidth = 1.4 }: { name: string; size?: number; color?: string; strokeWidth?: number }) {
  const p = { fill: "none", stroke: color, strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const svg = (children: React.ReactNode) => (
    <svg width={size} height={size} viewBox="0 0 24 24">{children}</svg>
  );
  const tee = <path {...p} d="M8 3 L4 6 L6 9 L8 8 L8 21 L16 21 L16 8 L18 9 L20 6 L16 3 C14.5 5 9.5 5 8 3 Z"/>;
  switch (garmentIconKey(name)) {
    case "tshirt": return svg(tee);
    case "polo": return svg(<>{tee}<path {...p} d="M10 3 L12 6 L14 3"/><path {...p} d="M12 6 L12 10"/></>);
    case "shirt": return svg(<>{tee}<path {...p} d="M10.3 3 L12 5.5 L13.7 3"/><path {...p} d="M12 5.5 L12 20"/><circle cx="12" cy="9" r="0.5" fill={color} stroke="none"/><circle cx="12" cy="12" r="0.5" fill={color} stroke="none"/><circle cx="12" cy="15" r="0.5" fill={color} stroke="none"/></>);
    case "sweatshirt": return svg(<>{tee}<path {...p} d="M9.7 3.4 C10.7 5.4 13.3 5.4 14.3 3.4"/></>);
    case "jacket": return svg(<>{tee}<path {...p} d="M9.2 3 L12 9 L14.8 3"/><path {...p} d="M12 9 L12 21"/></>);
    case "hoodie": return svg(<>
      <path {...p} d="M8 5 L4 8 L6 11 L8 10 L8 21 L16 21 L16 10 L18 11 L20 8 L16 5 C15 8 9 8 8 5 Z"/>
      <path {...p} d="M10 5.2 C10.8 7.5 13.2 7.5 14 5.2"/>
      <path {...p} d="M11 7.6 L11 11 M13 7.6 L13 11"/>
      <path {...p} d="M9.5 15 L14.5 15 L14.5 18 L9.5 18 Z"/>
    </>);
    case "pants": return svg(<path {...p} d="M7.5 3 L16.5 3 L15.6 21 L12.8 21 L12 9.5 L11.2 21 L8.4 21 Z"/>);
    case "shorts": return svg(<path {...p} d="M7.5 4 L16.5 4 L15.7 13 L12.9 13 L12 8.8 L11.1 13 L8.3 13 Z"/>);
    case "dress": return svg(<>
      <path {...p} d="M9 3 L7 6 L9 7.5 M15 3 L17 6 L15 7.5"/>
      <path {...p} d="M9 3 C10.2 5 13.8 5 15 3 L15.4 9 L18 21 L6 21 L8.6 9 Z"/>
    </>);
    case "apron": return svg(<>
      <path {...p} d="M9.5 3 L8 7 L8 19 L16 19 L16 7 L14.5 3"/>
      <path {...p} d="M9.5 3 C9.5 5.2 14.5 5.2 14.5 3"/>
      <path {...p} d="M8 11 L16 11"/>
    </>);
    default: return svg(tee);
  }
}
// Category marker icon (Men's / Women's / Kids) — matches the same Kids/Men/Women
// icon set used for the individual "Who needs this?" picker (Users/User/Heart), so the
// two flows read consistently instead of switching to garment-silhouette glyphs here.
function GarmentCategoryIcon({ id, size = 22, color = DARK }: { id: GarmentCategoryId; size?: number; color?: string }) {
  const Icon = id === "womens" ? Heart : id === "kids" ? Users : User;
  return <Icon size={size} strokeWidth={1.5} style={{ color }}/>;
}

// ─── Garment product photos (front / back / left / right) ─────────────────────
// Real photos live in  public/garments/<slug>/<view>.jpg  (e.g. garments/hoodies/front.jpg).
// Any photo that isn't supplied yet falls back to the line glyph, so the gallery
// works immediately and fills in as photos are added.
const GARMENT_VIEWS = [
  { id: "front", label: "Front" },
  { id: "back",  label: "Back" },
  { id: "left",  label: "Left" },
  { id: "right", label: "Right" },
] as const;
type GarmentView = typeof GARMENT_VIEWS[number]["id"];
function garmentSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function garmentImageUrl(name: string, view: GarmentView): string {
  return `${import.meta.env.BASE_URL}garments/${garmentSlug(name)}/${view}.jpg`;
}
// One photo with graceful fallback to the garment glyph when the file is missing.
function GarmentPhoto({ name, view, className, style, iconSize = 48 }: { name: string; view: GarmentView; className?: string; style?: React.CSSProperties; iconSize?: number }) {
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [name, view]);
  if (err) {
    return (
      <div className={className} style={{ ...style, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, background:"var(--muted)" }}>
        <GarmentIcon name={name} size={iconSize} color="#9ca3af"/>
        {/* Caption only where there's room — tiny list thumbs just show the icon */}
        {iconSize >= 40 && <span style={{ fontSize:10, color:"#9ca3af" }}>Photo coming soon</span>}
      </div>
    );
  }
  return <img src={garmentImageUrl(name, view)} alt={`${name} — ${view}`} onError={() => setErr(true)} className={className} style={{ objectFit:"cover", ...style }}/>;
}
// Full multi-angle product gallery (opens over the garment list, Flipkart-style).
function GarmentGallery({ name, onClose }: { name: string; onClose: () => void }) {
  const [view, setView] = useState<GarmentView>("front");
  return (
    <Overlay onClose={onClose}>
      <div className="bg-background rounded-t-3xl overflow-hidden" style={{ display:"flex", flexDirection:"column", maxHeight:"92%" }}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <div className="min-w-0">
            <p style={{ fontSize:15, fontWeight:700, color:DARK, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</p>
            <p style={{ fontSize:11, color:"var(--muted-foreground)" }}>Front · Back · Left · Right</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0" style={{ border:"none", cursor:"pointer" }}><X size={18}/></button>
        </div>
        <div className="px-5 pt-4 flex-shrink-0">
          <GarmentPhoto name={name} view={view} iconSize={72} className="w-full rounded-2xl border border-border" style={{ aspectRatio:"3 / 4", background:"var(--muted)" }}/>
        </div>
        <div className="px-5 py-4 grid grid-cols-4 gap-2 flex-shrink-0">
          {GARMENT_VIEWS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)} className="rounded-xl overflow-hidden text-center" style={{ border:`2px solid ${view===v.id ? DARK : "var(--border)"}`, background:"var(--card)", cursor:"pointer", padding:0 }}>
              <GarmentPhoto name={name} view={v.id} iconSize={26} className="w-full" style={{ aspectRatio:"1 / 1" }}/>
              <span style={{ display:"block", fontSize:10.5, fontWeight: view===v.id?700:500, color: view===v.id?DARK:"#6b7280", padding:"3px 0" }}>{v.label}</span>
            </button>
          ))}
        </div>
      </div>
    </Overlay>
  );
}

// Small tappable garment thumbnail that opens the photo gallery (used in list rows).
function GarmentThumb({ name, size = 44, onOpen }: { name: string; size?: number; onOpen: (name: string) => void }) {
  return (
    <div role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onOpen(name); }}
      className="flex items-center justify-center flex-shrink-0 relative"
      style={{ width:size, height:size, borderRadius:10, background:"var(--muted)", border:"1px solid var(--border)", cursor:"pointer", overflow:"hidden" }}>
      <GarmentPhoto name={name} view="front" iconSize={size >= 40 ? 24 : 20} className="w-full h-full"/>
      <div className="absolute" style={{ right:2, bottom:2, width:14, height:14, borderRadius:7, background:"rgba(13,13,13,0.72)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21 L16 16"/></svg>
      </div>
    </div>
  );
}

// Accessory price per piece — per-category base, nudged by item keywords (premium vs basic).
const accessoryCategoryRate: Record<string, number> = {
  bottles_mugs: 220, id_lanyards: 60, office_essentials: 90, bags: 350,
  awards: 280, event_promo: 120, photo_personal: 260, mobile_tech: 240, textiles: 200,
};
function accessoryRatePerPc(categoryId: string, itemName?: string): number {
  const base = accessoryCategoryRate[categoryId] ?? 150;
  const n = (itemName || "").toLowerCase();
  if (/steel|travel mug|power bank|usb|backpack|laptop|crystal|trophy|wooden|led|conference|welcome kit|gift box|gift set|gift kit|lamp|engraved/.test(n))
    return Math.round(base * 1.6);                       // premium items
  if (/sticker|keychain|magnet|badge|wrist band|whistle|\bpen\b|certificate|pass|fridge/.test(n))
    return Math.max(25, Math.round(base * 0.45));        // small / low-cost items
  return base;
}
// The chosen material (the first spec field) changes the price — premium materials
// cost more, basic ones less. Multiplier is keyword-based so it covers every option.
function accessoryMaterialMultiplier(materialValue?: string): number {
  const m = (materialValue || "").toLowerCase();
  if (!m) return 1;
  if (/crystal|k9|\bmetal\b|steel|copper|leather|wooden|teak|marble|nylon|\bled\b|genuine|premium|600d/.test(m)) return 1.5;
  if (/plastic|pvc|paper|non-?woven|acrylic|rubber|kraft|vinyl|aluminium|jute/.test(m)) return 0.8;
  return 1;
}
// Per-piece price for an accessory item, factoring in the selected material spec.
// The catalog base price is treated as the price for the DEFAULT material (first option),
// so picking a premium material costs more and a basic one less — relative to that default.
function accessoryItemRate(categoryId: string, itemName: string, accSpec?: Record<string, string>): number {
  const base = accessoryRatePerPc(categoryId, itemName);
  const specs = getAccessoryCategorySpecs(categoryId);
  const matLabel = specs?.fields[0]?.label;
  const defaultMat = specs?.fields[0]?.options[0];
  const chosenMat = (matLabel ? accSpec?.[matLabel] : undefined) ?? defaultMat;
  const rel = accessoryMaterialMultiplier(chosenMat) / accessoryMaterialMultiplier(defaultMat);
  return Math.round(base * rel);
}
// Total ₹ for a map of accessory selections (key = "categoryId-itemName" → qty).
// Pass accSpecState to price by the chosen material; without it, default materials are used.
function accessoryOrderTotal(accessoryQty: Record<string, number>, accSpecState?: Record<string, Record<string, string>>): number {
  let total = 0;
  for (const [key, q] of Object.entries(accessoryQty)) {
    if (q > 0) {
      const { categoryId, itemName } = parseAccessoryQtyKey(key);
      total += q * accessoryItemRate(categoryId, itemName, accSpecState?.[key]);
    }
  }
  return total;
}

const refOptDefs = [
  { id:"upload_logo"    as RefOption, Icon: Upload,  label:"Upload logo / design file",   sub:"Any photo works — we digitise it for free",    badge:null, badgeCls:"" },
  { id:"inspiration"    as RefOption, Icon: Camera,  label:"Share a style photo",          sub:"Screenshot, Instagram, Pinterest — anything",  badge:null, badgeCls:"" },
  { id:"match_uniform"  as RefOption, Icon: Shirt,   label:"Match my existing uniform",    sub:"Send us a sample — we identify fabric & GSM",  badge:null, badgeCls:"" },
  { id:"swatch_box"     as RefOption, Icon: Box,     label:"Send me a fabric swatch box",  sub:"Feel the fabrics before you commit",           badge:null, badgeCls:"" },
];

// Helper: render accessory category icon
function AccCatIcon({ id, size = 18 }: { id: string; size?: number }) {
  const icons: Record<string, React.ElementType> = {
    bottles_mugs: Package, id_lanyards: Award, office_essentials: Briefcase,
    bags: Package, awards: Trophy, event_promo: Star, photo_personal: ImageIcon, mobile_tech: Smartphone,
  };
  const Ic = icons[id] ?? Gift;
  return <Ic size={size} strokeWidth={1.5}/>;
}

// ─── Small shared UI ──────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children, defaultOpen = true }: { title: string; icon?: React.ElementType; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card border border-border rounded-2xl mb-3 overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2 px-4 py-3.5 text-left" style={{ background:"transparent", border:"none", cursor:"pointer" }}>
        {Icon && <Icon size={16} style={{ color: ACCENT, flexShrink: 0 }}/>}
        <span className="flex-1 text-foreground text-sm" style={{ fontWeight: 500 }}>{title}</span>
        <ChevronDown size={14} className="text-muted-foreground" strokeWidth={1.5} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}/>
      </button>
      {open && <div className="px-4 pb-4 border-t border-border"><div className="pt-3">{children}</div></div>}
    </div>
  );
}

function RadioRow({ label, sub, cost, selected, onSelect }: { label: string; sub: string; cost?: string; selected: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left mb-2 transition-all" style={{ border: `1.5px solid ${selected ? DARK : "var(--border)"}`, background: selected ? "rgba(13,13,13,0.03)" : "var(--card)", cursor:"pointer" }}>
      <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ border: `2px solid ${selected ? DARK : "#d1d5db"}`, background: selected ? DARK : "var(--card)" }}>
        {selected && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-foreground text-sm" style={{ fontWeight: selected ? 500 : 400 }}>{label}</p>
        <p className="text-muted-foreground" style={{ fontSize: 11 }}>{sub}</p>
      </div>
      {cost && <span className="text-muted-foreground flex-shrink-0" style={{ fontSize: 11, fontWeight: 500 }}>{cost}</span>}
    </button>
  );
}

const sizeCharts = {
  kids: [
    { size:"3-4Y", chest:"52-54cm", height:"98-104cm", age:"3-4 yrs" },
    { size:"5-6Y", chest:"55-57cm", height:"110-116cm", age:"5-6 yrs" },
    { size:"7-8Y", chest:"58-62cm", height:"122-128cm", age:"7-8 yrs" },
    { size:"9-10Y", chest:"63-67cm", height:"134-140cm", age:"9-10 yrs" },
    { size:"11-12Y", chest:"68-72cm", height:"146-152cm", age:"11-12 yrs" },
    { size:"13-14Y", chest:"73-78cm", height:"158-163cm", age:"13-14 yrs" },
  ],
  mens: [
    { size:"XS", chest:'34"', waist:'28"', hip:'36"' },
    { size:"S",  chest:'36"', waist:'30"', hip:'38"' },
    { size:"M",  chest:'38-40"', waist:'32-34"', hip:'40-42"' },
    { size:"L",  chest:'42-44"', waist:'36-38"', hip:'44-46"' },
    { size:"XL", chest:'46"', waist:'40"', hip:'48"' },
    { size:"XXL",chest:'48-50"', waist:'42-44"', hip:'50-52"' },
  ],
  womens: [
    { size:"XS",  chest:'32"', waist:'24"', hip:'34"', uk:"UK 6" },
    { size:"S",   chest:'34"', waist:'26"', hip:'36"', uk:"UK 8" },
    { size:"M",   chest:'36"', waist:'28"', hip:'38"', uk:"UK 10-12" },
    { size:"L",   chest:'38"', waist:'30"', hip:'40"', uk:"UK 14" },
    { size:"XL",  chest:'40"', waist:'32"', hip:'42"', uk:"UK 16" },
    { size:"XXL", chest:'42"', waist:'34"', hip:'44"', uk:"UK 18" },
  ],
};

function SizeGuideModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"kids"|"mens"|"womens">("mens");
  return (
    <Overlay onClose={onClose}>
      <div className="bg-background rounded-t-3xl overflow-hidden">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-1"/>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <p className="text-foreground text-sm" style={{ fontWeight:600 }}>Size Guide</p>
            <p className="text-muted-foreground" style={{ fontSize:11 }}>Standard measurements — coordinator confirms before cutting</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"><X size={13} strokeWidth={2}/></button>
        </div>
        <div className="px-5 pt-3">
          <div className="flex gap-1.5 mb-4 p-1 rounded-xl bg-muted">
            {(["kids","mens","womens"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 py-1.5 rounded-lg text-xs transition-all"
                style={{ background: tab===t ? DARK : "transparent", color: tab===t ? "#fff" : "#6b7280", border:"none", cursor:"pointer", fontWeight: tab===t ? 600 : 400 }}>
                {t === "kids" ? "Kids" : t === "mens" ? "Men's" : "Women's"}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-border mb-5">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ background:"var(--muted)" }}>
                  {tab === "kids" && ["Size","Chest","Height","Age"].map(h => <th key={h} className="px-3 py-2 text-left text-foreground" style={{ fontWeight:600, whiteSpace:"nowrap", borderBottom:"1px solid var(--border)" }}>{h}</th>)}
                  {tab === "mens" && ["Size","Chest","Waist","Hip"].map(h => <th key={h} className="px-3 py-2 text-left text-foreground" style={{ fontWeight:600, whiteSpace:"nowrap", borderBottom:"1px solid var(--border)" }}>{h}</th>)}
                  {tab === "womens" && ["Size","Chest","Waist","Hip","UK"].map(h => <th key={h} className="px-3 py-2 text-left text-foreground" style={{ fontWeight:600, whiteSpace:"nowrap", borderBottom:"1px solid var(--border)" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {tab === "kids" && sizeCharts.kids.map((r,i) => (
                  <tr key={r.size} style={{ background: i%2===0 ? "var(--card)" : "var(--muted)" }}>
                    <td className="px-3 py-2 font-semibold text-foreground">{r.size}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.chest}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.height}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.age}</td>
                  </tr>
                ))}
                {tab === "mens" && sizeCharts.mens.map((r,i) => (
                  <tr key={r.size} style={{ background: i%2===0 ? "var(--card)" : "var(--muted)" }}>
                    <td className="px-3 py-2 font-semibold text-foreground">{r.size}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.chest}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.waist}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.hip}</td>
                  </tr>
                ))}
                {tab === "womens" && sizeCharts.womens.map((r,i) => (
                  <tr key={r.size} style={{ background: i%2===0 ? "var(--card)" : "var(--muted)" }}>
                    <td className="px-3 py-2 font-semibold text-foreground">{r.size}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.chest}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.waist}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.hip}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.uk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function SizeInfoBanner({ minQty }: { minQty?: number }) {
  const [showChart, setShowChart] = useState(false);
  return (
    <>
      <div className="rounded-2xl p-3 mb-3" style={{ background:"#EFF6FF", border:"1px solid #BFDBFE" }}>
        <div className="flex items-start gap-2">
          <Ruler size={13} style={{ color:"#1a4a8a", flexShrink:0, marginTop:2 }}/>
          <div className="flex-1">
            <p style={{ fontSize:12, color:"#1a4a8a", fontWeight:700 }}>Size guide before production</p>
            <p style={{ fontSize:11, color:"#315f8f", lineHeight:1.55, marginTop:3 }}>
              Kids use age sizes, men use chest sizes, women use UK sizes. Your coordinator confirms measurements before cutting.
            </p>
            {minQty && <p style={{ fontSize:11, color:"#1a4a8a", fontWeight:600, marginTop:5 }}>Minimum quantity: {minQty} pcs</p>}
            <button onClick={() => setShowChart(true)}
              className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-xl"
              style={{ background:"#1d4ed8", color:"#fff", fontSize:12, fontWeight:600, padding:"9px 14px", border:"none", cursor:"pointer" }}>
              <Ruler size={13}/> View size chart
            </button>
          </div>
        </div>
      </div>
      {showChart && <SizeGuideModal onClose={() => setShowChart(false)}/>}
    </>
  );
}

// ─── Modal overlay (covers full phone frame since phone has position:relative) ─

function Overlay({ children, onClose, center }: { children: React.ReactNode; onClose?: () => void; center?: boolean }) {
  return (
    <div className={`absolute inset-0 z-50 flex flex-col ${center ? "items-center justify-center px-5" : "justify-end"}`}
      style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="w-full" style={{ maxWidth: center ? 340 : "100%" }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ─── Courier Modal ────────────────────────────────────────────────────────────

function CourierModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"info" | "schedule" | "done">("info");
  const [date, setDate] = useState("Tomorrow, 10 Jun");
  return (
    <Overlay onClose={onClose}>
      <div className="bg-background rounded-t-3xl overflow-hidden">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-1"/>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <p className="text-foreground text-sm" style={{ fontWeight: 600 }}>Match My Existing Uniform</p>
            <p className="text-muted-foreground" style={{ fontSize: 11 }}>We'll pick up your sample & identify the fabric</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"><X size={13} strokeWidth={2}/></button>
        </div>

        {step === "info" && (
          <div className="px-5 py-4">
            {[
              { n:"1", t:"Put your old uniform in an envelope or bag", sub:"Any shirt or t-shirt you want us to match" },
              { n:"2", t:"Stick the printed label on it", sub:"We'll email you the label after scheduling" },
              { n:"3", t:"Our courier picks it up tomorrow", sub:"Free pickup from your location" },
              { n:"4", t:"We identify the fabric & update your order", sub:"GSM, blend, weave — confirmed within 24h" },
            ].map(({ n, t, sub }) => (
              <div key={n} className="flex gap-3 items-start mb-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs bg-foreground text-white" style={{ fontWeight: 700 }}>{n}</div>
                <div>
                  <p className="text-foreground text-sm" style={{ fontWeight: 500 }}>{t}</p>
                  <p className="text-muted-foreground" style={{ fontSize: 11, marginTop: 2 }}>{sub}</p>
                </div>
              </div>
            ))}
            <button onClick={() => setStep("schedule")} className="w-full bg-foreground text-white rounded-2xl py-3.5 flex items-center justify-center gap-2 text-sm mt-1" style={{ fontWeight: 500 }}>
              <Truck size={15}/> Schedule Pickup <ArrowRight size={13}/>
            </button>
            <div style={{ height: 16 }}/>
          </div>
        )}

        {step === "schedule" && (
          <div className="px-5 py-4">
            <p className="text-foreground text-sm mb-3" style={{ fontWeight: 500 }}>Pickup address</p>
            {["School / Institution name", "Street address", "City & PIN code", "Contact number"].map(p => (
              <input key={p} placeholder={p} className={INP + " mb-2 block"} style={fnt}/>
            ))}
            <p className="text-foreground text-sm mb-2 mt-3" style={{ fontWeight: 500 }}>Preferred pickup slot</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {["Tomorrow, 10 Jun","Thu, 11 Jun","Fri, 12 Jun","Sat, 13 Jun"].map(d => (
                <button key={d} onClick={() => setDate(d)} className="py-2.5 rounded-xl text-xs" style={{ background: date===d ? DARK : "var(--muted)", color: date===d ? "#fff" : "var(--foreground)", border:"none", cursor:"pointer", fontWeight: date===d ? 600 : 400 }}>{d}</button>
              ))}
            </div>
            <button onClick={() => setStep("done")} className="w-full py-3.5 rounded-2xl text-sm" style={{ background: ACCENT, color: "#fff", border:"none", cursor:"pointer", fontWeight: 500 }}>
              Confirm Pickup for {date}
            </button>
            <div style={{ height: 16 }}/>
          </div>
        )}

        {step === "done" && (
          <div className="px-5 py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} className="text-emerald-500" strokeWidth={1.5}/>
            </div>
            <p className="text-foreground mb-2" style={{ fontSize: 16, fontWeight: 600 }}>Pickup scheduled!</p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              Check your email for the shipping label. Courier arrives <strong>{date}</strong> between 10am–6pm.
            </p>
            <div className="rounded-xl p-3 text-left mb-4 bg-muted border border-dashed border-border">
              <div className="flex items-center gap-2 mb-1">
                <QrCode size={26} style={{ color: DARK }}/>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: DARK }}>GARM SAMPLE · #SP-0821</p>
                  <p style={{ fontSize: 10, color: "#9ca3af" }}>Garm Pvt. Ltd., Coimbatore 641001</p>
                </div>
              </div>
              <p style={{ fontSize: 10, color: "#9ca3af" }}>Scan at pickup · Handle with care</p>
            </div>
            <button onClick={onClose} className="w-full py-3 rounded-2xl bg-muted text-foreground text-sm" style={{ fontWeight: 500 }}>Done</button>
            <div style={{ height: 16 }}/>
          </div>
        )}
      </div>
    </Overlay>
  );
}

// ─── Swatch Box Modal ─────────────────────────────────────────────────────────

const swatchFabrics = [
  { id:"A", name:"Premium Shirt Fabric",  desc:"100% Cotton Pique · 220 GSM", bg:"#e8e0d0" },
  { id:"B", name:"Sports T-Shirt Fabric", desc:"Cotton-Poly Blend · 180 GSM",  bg:"#d4e8e0" },
  { id:"C", name:"Uniform Twill",         desc:"65/35 Poly-Cotton · 240 GSM",  bg:"#d4dce8" },
  { id:"D", name:"Heavyweight Canvas",    desc:"100% Cotton · 320 GSM",        bg:"#e8d4d4" },
];
function SwatchModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"browse" | "address" | "done">("browse");
  return (
    <Overlay onClose={onClose}>
      <div className="bg-background rounded-t-3xl overflow-hidden">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-1"/>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <p className="text-foreground text-sm" style={{ fontWeight: 600 }}>Free Fabric Swatch Box</p>
            <p className="text-muted-foreground" style={{ fontSize: 11 }}>Ships in 1–2 days · No cost</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"><X size={13} strokeWidth={2}/></button>
        </div>
        {step === "browse" && (
          <div className="px-5 py-4">
            <p className="text-muted-foreground text-xs leading-relaxed mb-4">Touch each fabric before you order. We'll mail you 10×10 cm swatches with clear labels.</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {swatchFabrics.map(f => (
                <div key={f.id} className="rounded-xl overflow-hidden border border-border">
                  <div className="h-12 flex items-center justify-center text-2xl font-bold" style={{ background: f.bg, color:"rgba(0,0,0,0.12)" }}>{f.id}</div>
                  <div className="p-2">
                    <p className="text-foreground" style={{ fontSize: 12, fontWeight: 500 }}>{f.name}</p>
                    <p className="text-muted-foreground" style={{ fontSize: 10, marginTop: 2 }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setStep("address")} className="w-full bg-foreground text-white rounded-2xl py-3.5 flex items-center justify-center gap-2 text-sm" style={{ fontWeight: 500 }}>
              <Box size={15}/> Order Free Swatch Box <ArrowRight size={13}/>
            </button>
            <div style={{ height: 16 }}/>
          </div>
        )}
        {step === "address" && (
          <div className="px-5 py-4">
            <p className="text-foreground text-sm mb-3" style={{ fontWeight: 500 }}>Delivery address</p>
            {["School / Institution name", "Street address", "City & PIN code", "Contact person name", "Phone number"].map(p => (
              <input key={p} placeholder={p} className={INP + " mb-2 block"} style={fnt}/>
            ))}
            <button onClick={() => setStep("done")} className="w-full py-3.5 rounded-2xl text-sm mt-1" style={{ background: ACCENT, color: "#fff", border:"none", cursor:"pointer", fontWeight: 500 }}>
              Confirm & Request Delivery
            </button>
            <div style={{ height: 16 }}/>
          </div>
        )}
        {step === "done" && (
          <div className="px-5 py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
              <Check size={26} className="text-emerald-500" strokeWidth={1.5}/>
            </div>
            <p className="text-foreground mb-2" style={{ fontSize: 16, fontWeight: 600 }}>Swatch box on its way!</p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-5">We'll deliver 4 fabric samples within 1–2 days.</p>
            <button onClick={onClose} className="w-full py-3 rounded-2xl bg-muted text-foreground text-sm" style={{ fontWeight: 500 }}>Done</button>
            <div style={{ height: 16 }}/>
          </div>
        )}
      </div>
    </Overlay>
  );
}

// ─── Individual Color Section (8 preset swatches, no HEX/RGB editing) ─────────

const individualColorPresets = [
  { hex:"#111111", label:"Black"       },
  { hex:"#ffffff", label:"White"       },
  { hex:"#e5e5e5", label:"Light Grey"  },
  { hex:"#1a2540", label:"Navy Blue"   },
  { hex:"#d4394a", label:"Red"         },
  { hex:"#2d5a3d", label:"Forest Green"},
  { hex:"#c8a84b", label:"Golden"      },
  { hex:"#8b3a3a", label:"Burgundy"    },
];

// Palette for one garment: the admin's colour swatches for that product when
// configured (Garm Admin Portal → Catalog), otherwise the 8 presets above.
// Fails open — server missing/unreachable ⇒ presets, exactly as before.
function individualPaletteFor(name: string): { hex: string; label: string }[] {
  return adminPaletteFor(name) ?? individualColorPresets;
}

function IndividualColorSection({ onStateChange, initial, paletteOnly }: { onStateChange?: (s: { selected: string[]; desc: string; qtys: Record<string, number> }) => void; initial?: { selected: string[]; desc: string; qtys?: Record<string, number> }; paletteOnly?: boolean }) {
  const [selected, setSelected] = useState<string[]>(initial?.selected ?? []);
  const [desc, setDesc]         = useState(initial?.desc ?? "");
  // Per-color quantity (hex → pieces). Defaults to 1 when a color is first picked.
  const [qtys, setQtys]         = useState<Record<string, number>>(initial?.qtys ?? {});

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onStateChange?.({ selected, desc, qtys }); }, [selected, desc, qtys]);

  function toggle(hex: string) {
    setSelected(p => {
      if (p.includes(hex)) {
        setQtys(q => { const n = { ...q }; delete n[hex]; return n; });
        return p.filter(h => h !== hex);
      }
      setQtys(q => ({ ...q, [hex]: q[hex] && q[hex] > 0 ? q[hex] : 1 }));
      return [...p, hex];
    });
  }
  function setQtyFor(hex: string, val: number) {
    setQtys(q => ({ ...q, [hex]: Math.max(1, val) }));
  }
  const totalPcs = selected.reduce((sum, h) => sum + (qtys[h] ?? 1), 0);

  return (
    <div>
      <p className="text-muted-foreground mb-3" style={{ fontSize: 12 }}>{paletteOnly ? "Select the colours for your order" : "Select your colors, then set how many pieces of each"}</p>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {individualColorPresets.map(c => {
          const isSelected = selected.includes(c.hex);
          return (
            <button key={c.hex} onClick={() => toggle(c.hex)}
              className="flex flex-col items-center gap-1.5"
              style={{ background:"none", border:"none", cursor:"pointer" }}>
              <div className="w-12 h-12 rounded-full relative"
                style={{ background: c.hex, border: isSelected ? `3px solid #0D0D0D` : `2px solid rgba(0,0,0,0.12)`, boxShadow: isSelected ? "0 0 0 2px white, 0 0 0 4px #0D0D0D" : "none", transition:"all 0.15s" }}>
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check size={16} strokeWidth={2.5} color={c.hex === "#ffffff" || c.hex === "#e5e5e5" || c.hex === "#c8a84b" ? "#000" : "#fff"}/>
                  </div>
                )}
              </div>
              <span className="text-foreground text-center" style={{ fontSize: 10, fontWeight: isSelected ? 600 : 400, lineHeight: 1.3 }}>{c.label}</span>
            </button>
          );
        })}
      </div>
      {/* Palette mode (multi-garment orders): colours apply to the whole order, no per-colour qty. */}
      {paletteOnly && selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selected.map(h => {
            const c = individualColorPresets.find(p => p.hex === h);
            return (
              <div key={h} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted">
                <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: h, border:"1px solid rgba(0,0,0,0.12)" }}/>
                <span style={{ fontSize: 11, fontWeight: 500 }}>{c?.label ?? h}</span>
                <button onClick={() => toggle(h)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af" }}><X size={12}/></button>
              </div>
            );
          })}
        </div>
      )}

      {/* Per-color quantity steppers — only when each colour carries its own quantity. */}
      {!paletteOnly && selected.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {selected.map(h => {
            const c = individualColorPresets.find(p => p.hex === h);
            const q = qtys[h] ?? 1;
            return (
              <div key={h} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-border bg-muted">
                <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: h, border:"1px solid rgba(0,0,0,0.12)" }}/>
                <span className="flex-1" style={{ fontSize: 12.5, fontWeight: 500 }}>{c?.label ?? h}</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setQtyFor(h, q - 1)} className="w-6 h-6 rounded-full border border-border bg-card flex items-center justify-center" style={{ cursor:"pointer" }}><Minus size={11}/></button>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={q}
                    onChange={e => setQtyFor(h, parseInt(digitsOnly(e.target.value)) || 1)}
                    onFocus={selectAllOnFocus} onClick={selectAllOnFocus} onMouseUp={preventSelectionCollapse}
                    className="text-center bg-card border border-border rounded-lg" style={{ width: 46, fontSize: 13, fontWeight: 600, outline:"none", padding:"3px 4px" }}/>
                  <button onClick={() => setQtyFor(h, q + 1)} className="w-6 h-6 rounded-full border border-border bg-card flex items-center justify-center" style={{ cursor:"pointer" }}><Plus size={11}/></button>
                  <button onClick={() => toggle(h)} className="ml-0.5" style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af" }}><X size={13}/></button>
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background:"#EFF6FF", border:"1px solid #BFDBFE" }}>
            <span style={{ fontSize: 12, color:"#1a4a8a", fontWeight: 600 }}>Total pieces</span>
            <span style={{ fontSize: 14, color:"#1a4a8a", fontWeight: 700 }}>{totalPcs} pcs</span>
          </div>
        </div>
      )}
      <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Color description (optional)</p>
      <textarea value={desc} onChange={e => setDesc(e.target.value)}
        placeholder="e.g. Navy with white trim on collar, golden embroidery on chest…"
        className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none resize-none h-16"
        style={{ fontFamily:"DM Sans, sans-serif" }}/>
    </div>
  );
}

// ─── Garment Catalog (what kind of dress) ─────────────────────────────────────

function GarmentCatalog({ selected, onSelect, lockedCategory, allowedCategories, orgType }: { selected: SelectedGarment | null; onSelect: (g: SelectedGarment) => void; lockedCategory?: GarmentCategoryId; allowedCategories?: GarmentCategoryId[]; orgType?: OrgType }) {
  // Which categories/items are currently orderable (admin-controlled availability).
  const { isCategoryActive, isItemActive, isItemInStock, extraItemsForCategory } = useCatalogAvailability();
  // Admin-controlled order-form sections (style options can be switched off).
  const orderFormCfg = useOrderFormConfig();
  // Which category tabs to show (e.g. organisations hide Kids unless they're a school).
  const cats = garmentCatalog.filter(c => (!allowedCategories || allowedCategories.includes(c.id)) && isCategoryActive(c.label));
  const firstCat = lockedCategory ?? selected?.categoryId ?? cats[0]?.id ?? "mens";
  const [cat, setCat] = useState<GarmentCategoryId>(firstCat);
  // When the audience is already known, keep the catalog locked to that category.
  useEffect(() => { if (lockedCategory) setCat(lockedCategory); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lockedCategory]);
  // If the active category is no longer allowed (org type changed), fall back to the first allowed one.
  useEffect(() => { if (!cats.some(c => c.id === cat)) setCat(cats[0]?.id ?? "mens"); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [allowedCategories]);
  const active = garmentCatalog.find(c => c.id === cat)!;
  // For kids, split by Boys / Girls so gendered items (frocks, kurta sets…) are clear.
  const [kidGender, setKidGender] = useState<"boy" | "girl">("boy");
  // Different org types buy different garments — filter the list to what's relevant.
  const genderItems = cat === "kids" ? active.items.filter(it => !it.gender || it.gender === kidGender) : active.items;
  const visibleItems = genderItems.filter(it => garmentAllowedForOrg(orgType, it.name) && isItemActive(it.name));
  // Products the admin added to this category in the portal (not in the
  // hand-built list) — shown with the admin-set price.
  const adminExtras = extraItemsForCategory(active.label, active.items.map(i => i.name), "GARMENT").filter(e => isItemActive(e.name));
  const allItems = [...visibleItems, ...adminExtras.map(e => ({ name: e.name, basePrice: e.price || 190 } as CatalogGarment))];
  // When a garment is picked, default its style to the first available style option.
  function selectGarment(it: CatalogGarment) {
    const styleOpts = garmentStyleOptions(it.name);
    onSelect({ categoryId: cat, name: it.name, basePrice: it.basePrice, ...(styleOpts[0] ? { style: styleOpts[0] } : {}) });
  }
  const selectedStyleOpts = selected ? garmentStyleOptions(selected.name) : [];
  return (
    <div>
      <p className="text-muted-foreground mb-3" style={{ fontSize: 12, lineHeight: 1.5 }}>
        Pick the garment you want made. The price shown is the starting ₹/piece — your chosen fabric below adjusts it.
      </p>

      {cat === "kids" && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {([["boy", "Boys", Mars, "#1a4a8a"], ["girl", "Girls", Venus, "#9d3a5d"]] as const).map(([g, lbl, Icon, tint]) => (
            <button key={g} onClick={() => setKidGender(g)}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl"
              style={{ border:`1.5px solid ${kidGender===g ? DARK : "var(--border)"}`, background: kidGender===g ? "rgba(13,13,13,0.04)" : "var(--card)", cursor:"pointer", fontSize: 12.5, fontWeight: kidGender===g ? 700 : 500, color: kidGender===g ? DARK : "#374151" }}>
              <Icon size={15} strokeWidth={1.8} style={{ color: kidGender===g ? tint : "#9ca3af" }}/> {lbl}
            </button>
          ))}
        </div>
      )}

      {/* Category tabs (only the allowed ones), hidden when the audience is already fixed */}
      {!lockedCategory && cats.length > 1 && (
        <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: `repeat(${cats.length}, minmax(0, 1fr))` }}>
          {cats.map(c => (
            <button key={c.id} onClick={() => setCat(c.id)}
              className="flex flex-col items-center gap-0.5 py-2 rounded-xl"
              style={{ border:`1.5px solid ${cat===c.id ? DARK : "var(--border)"}`, background: cat===c.id ? "rgba(13,13,13,0.04)" : "var(--card)", cursor:"pointer" }}>
              <GarmentCategoryIcon id={c.id}/>
              <span style={{ fontSize: 10.5, fontWeight: cat===c.id ? 700 : 500, color: cat===c.id ? DARK : "#374151" }}>{c.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Card list — same design as the individual picker, single-select.
          Out-of-stock items (toggled live from the admin portal) stay visible
          but greyed out and can't be selected. */}
      <div className="flex flex-col gap-2">
        {allItems.map(it => {
          const isSel = !!selected && selected.categoryId === cat && selected.name === it.name;
          const inStock = isItemInStock(it.name);
          return (
            <button key={it.name} onClick={() => inStock && selectGarment(it)} disabled={!inStock}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left"
              style={{ border:`1.5px solid ${isSel ? DARK : "var(--border)"}`, background: isSel ? "rgba(13,13,13,0.04)" : "var(--card)", cursor: inStock ? "pointer" : "not-allowed", opacity: inStock ? 1 : 0.45 }}>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 13, fontWeight: isSel ? 700 : 500, color: isSel ? DARK : "#111827", lineHeight: 1.3 }}>{it.name}</p>
                {inStock
                  ? <p style={{ fontSize: 11, color: isSel ? "#1a4a8a" : "#9ca3af", fontWeight: isSel ? 600 : 400 }}>From {inr(it.basePrice)}/pc</p>
                  : <p style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>Out of stock — back soon</p>}
              </div>
              <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center" style={{ border:`2px solid ${isSel ? DARK : "#d1d5db"}`, background: isSel ? DARK : "var(--card)" }}>
                {isSel && <Check size={12} strokeWidth={3} color="#fff"/>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Style — round neck / collared, formal / printed, leggings / jeans …
          (hidden entirely when the admin switches Style options off) */}
      {!!selected && selectedStyleOpts.length > 0 && orderFormCfg.style && (
        <div className="mt-3">
          <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Style</p>
          <SelectField
            options={selectedStyleOpts}
            value={selected.style ?? selectedStyleOpts[0]}
            onChange={v => onSelect({ ...selected, style: v })}/>
        </div>
      )}

      {!!selected && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background:"#EFF6FF", border:"1px solid #BFDBFE" }}>
          <Check size={13} style={{ color:"#1a4a8a", flexShrink:0 }}/>
          <p style={{ fontSize: 12, color:"#1a4a8a" }}>
            Selected: <strong>{selected.name}</strong>{selected.style ? ` · ${selected.style}` : ""} · base {inr(selected.basePrice)}/pc
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Garment Cart (individuals: pick several garments, qty each) ──────────────
// e.g. 1 Hoodie + 1 Shirt. Each garment is a line with its own quantity stepper.
// A garment line is now colour-aware: the SAME garment in a different colour is a
// SEPARATE line with its own quantity. So "1 black hoodie" + "1 white hoodie" = 2 pcs.
type GarmentLine = SelectedGarment & {
  qty: number; colorHex: string; colorLabel: string;
  sizes?: Record<string, number>; gender?: "boy" | "girl"; style?: string;
  // Per-piece colours for set garments (Salwar, Dupatta…) — absent = matches the main colour.
  pieceColors?: Record<string, { hex: string; label: string }>;
};
// Colour summary including set pieces — "Navy Blue · Salwar: White · Dupatta: Gold".
function lineColourSummary(g: GarmentLine): string {
  const pieces = g.pieceColors
    ? Object.entries(g.pieceColors).map(([p, c]) => `${p}: ${c.label}`).join(" · ")
    : "";
  return pieces ? `${g.colorLabel} · ${pieces}` : g.colorLabel;
}
function GarmentCart({ cart, onChange, lockedCategory, onViewPhotos }: { cart: GarmentLine[]; onChange: (next: GarmentLine[]) => void; lockedCategory?: GarmentCategoryId; onViewPhotos?: (name: string) => void }) {
  const [cat, setCat] = useState<GarmentCategoryId>(lockedCategory ?? "mens");
  useEffect(() => { if (lockedCategory) setCat(lockedCategory); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lockedCategory]);
  const active = garmentCatalog.find(c => c.id === cat)!;
  // Individual flow is B2C — consult the admin's Catalog so products the admin
  // added (e.g. a new "Towel" under Men's Wear) appear here too, deactivated
  // ones are hidden, and out-of-stock ones show greyed out. Fails open: until
  // the admin data loads (or if the backend is unreachable) nothing is hidden
  // and no extras show — the built-in list keeps working exactly as before.
  const { isItemActive, isItemInStock, extraItemsForCategory } = useCatalogAvailability({ audience: "B2C" });
  // For kids, split the catalog by Boys / Girls so it's clear which item is which.
  const [kidGender, setKidGender] = useState<"boy" | "girl">("boy");
  const baseItems = (cat === "kids" ? active.items.filter(it => !it.gender || it.gender === kidGender) : active.items)
    .filter(it => isItemActive(it.name));
  // New garment products the admin added to THIS category in the portal.
  const adminExtras = extraItemsForCategory(active.label, active.items.map(i => i.name), "GARMENT")
    .filter(e => isItemActive(e.name))
    .map(e => ({ name: e.name, basePrice: e.price || 190 } as CatalogGarment));
  const visibleItems = [...baseItems, ...adminExtras];
  // Which garment card is expanded. One open at a time → finished cards collapse to a summary.
  const [openItem, setOpenItem] = useState<string | null>(null);

  // ── "Add more order" (individual flow) ──────────────────────────────────────
  // The catalog starts locked to the audience picked on the previous screen, but the
  // user can add more audiences to the SAME order (e.g. kids + wife + himself).
  // Categories already present in the cart stay enabled, so drafts resume correctly.
  const [extraCats, setExtraCats] = useState<GarmentCategoryId[]>(() =>
    lockedCategory ? Array.from(new Set(cart.map(g => g.categoryId))).filter(c => c !== lockedCategory) : []);
  const enabledCats: GarmentCategoryId[] = lockedCategory ? [lockedCategory, ...extraCats] : garmentCatalog.map(c => c.id);
  const remainingCats = garmentCatalog.map(c => c.id).filter(c => !enabledCats.includes(c));
  const [showAddAudience, setShowAddAudience] = useState(false);
  function addAudienceCat(c: GarmentCategoryId) {
    setExtraCats(prev => (prev.includes(c) ? prev : [...prev, c]));
    setCat(c);
    setOpenItem(null);
    setShowAddAudience(false);
  }
  const pcsInCat = (cid: GarmentCategoryId) => cart.filter(g => g.categoryId === cid).reduce((s, g) => s + g.qty, 0);
  const audienceName = (cid: GarmentCategoryId) => (cid === "mens" ? "Men" : cid === "womens" ? "Women" : "Kids");
  // Warm, human labels for the "who else?" picker — easier to connect with than category names.
  const audiencePersona = (cid: GarmentCategoryId) =>
    cid === "mens"   ? { Icon: User,  title: "For him",      sub: "Shirts, tees & more · chest sizes" } :
    cid === "womens" ? { Icon: Heart, title: "For her",      sub: "Kurtis, tees & more · UK sizes" } :
                       { Icon: Users, title: "For the kids", sub: "Boys & girls · age-based sizes" };

  // For kids, lines are scoped per gender so a Boys T-shirt and a Girls T-shirt are
  // separate selections (and don't appear selected under the other tab).
  const lineGender = cat === "kids" ? kidGender : undefined;
  const sameLine = (g: GarmentLine, name: string) =>
    g.categoryId === cat && g.name === name && (cat !== "kids" || g.gender === lineGender);

  // All cart lines for a given catalog item in the active category (+ gender for kids).
  const linesFor = (name: string) => cart.filter(g => sameLine(g, name));

  // Add the garment in the first colour not already used for it (so each tap adds a new colour line).
  function addGarment(it: CatalogGarment) {
    const used = new Set(linesFor(it.name).map(l => l.colorHex));
    const palette = individualPaletteFor(it.name);
    const preset = palette.find(p => !used.has(p.hex)) ?? palette[0];
    const styleOpts = garmentStyleOptions(it.name);
    const style = linesFor(it.name)[0]?.style ?? styleOpts[0];
    onChange([...cart, { categoryId: cat, name: it.name, basePrice: it.basePrice, qty: 1, colorHex: preset.hex, colorLabel: preset.label, ...(lineGender ? { gender: lineGender } : {}), ...(style ? { style } : {}) }]);
    setOpenItem(it.name);
  }
  // Style is a per-product choice — apply it to every colour line of that garment.
  function setGarmentStyle(name: string, style: string) {
    onChange(cart.map(g => (sameLine(g, name) ? { ...g, style } : g)));
  }
  // Operate on a specific line by its identity (category + name + gender + colour).
  function lineIndex(name: string, colorHex: string) {
    return cart.findIndex(g => sameLine(g, name) && g.colorHex === colorHex);
  }
  function setLineQty(name: string, colorHex: string, q: number) {
    const idx = lineIndex(name, colorHex);
    if (idx < 0) return;
    const next = cart.slice();
    if (q <= 0) next.splice(idx, 1);
    else next[idx] = { ...next[idx], qty: q };
    onChange(next);
  }
  function setLineColor(name: string, fromHex: string, hex: string, label: string) {
    if (fromHex === hex) return;
    // Don't allow two lines of the same garment to share a colour — merge instead.
    if (linesFor(name).some(l => l.colorHex === hex)) return;
    const idx = lineIndex(name, fromHex);
    if (idx < 0) return;
    const next = cart.slice();
    next[idx] = { ...next[idx], colorHex: hex, colorLabel: label };
    onChange(next);
  }
  function removeLine(name: string, colorHex: string) {
    onChange(cart.filter(g => !(sameLine(g, name) && g.colorHex === colorHex)));
  }
  // Colour for one piece of a set (Salwar, Dupatta…) — null resets to "match".
  function setLinePieceColor(name: string, colorHex: string, piece: string, hex: string | null, label?: string) {
    const idx = lineIndex(name, colorHex);
    if (idx < 0) return;
    const next = cart.slice();
    const cur = { ...(next[idx].pieceColors ?? {}) };
    if (hex === null) delete cur[piece];
    else cur[piece] = { hex, label: label ?? "" };
    next[idx] = { ...next[idx], pieceColors: cur };
    onChange(next);
  }

  const totalPcs = cart.reduce((s, g) => s + g.qty, 0);

  return (
    <div>
      <p className="text-muted-foreground mb-3" style={{ fontSize: 12, lineHeight: 1.5 }}>
        Tap <strong>Add</strong> on a garment, then pick its colour and quantity. Every colour is its own piece.
      </p>

      {/* ── Add more order — a warm "who else?" invitation, kept above the fold ── */}
      {lockedCategory && remainingCats.length > 0 && (
        showAddAudience ? (
          <div className="mb-3 rounded-2xl p-3.5" style={{ border:`1.5px solid ${ACCENT}`, background: ACCENT_BG }}>
            <p style={{ fontSize:13, fontWeight:700, color:"#7c5419", marginBottom:2 }}>Who else are you dressing?</p>
            <p style={{ fontSize:11, color:ACCENT_TEXT, marginBottom:10 }}>They join this same order — one payment, one delivery.</p>
            <div className="flex flex-col gap-2 mb-2">
              {remainingCats.map(cid => {
                const p = audiencePersona(cid);
                return (
                  <button key={cid} onClick={() => addAudienceCat(cid)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                    style={{ border:"1.5px solid var(--border)", background:"var(--card)", cursor:"pointer" }}>
                    <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: ACCENT_BG, border:`1.5px solid ${ACCENT}` }}>
                      <p.Icon size={15} strokeWidth={1.8} style={{ color:"#7c5419" }}/>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block" style={{ fontSize:13, fontWeight:700, color:DARK }}>{p.title}</span>
                      <span className="block" style={{ fontSize:11, color:"#9ca3af" }}>{p.sub}</span>
                    </span>
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ background: DARK, color:"#fff", fontSize:11, fontWeight:600 }}>
                      <Plus size={11}/> Add
                    </span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setShowAddAudience(false)}
              style={{ background:"none", border:"none", cursor:"pointer", fontSize:11.5, fontWeight:600, color:"#9ca3af", padding:0 }}>
              Not now
            </button>
          </div>
        ) : (
          <button onClick={() => setShowAddAudience(true)}
            className="mb-3 w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left"
            style={{ border:`1.5px dashed ${ACCENT}`, background: ACCENT_BG, cursor:"pointer" }}>
            {/* Overlapping mini avatars — instantly reads as "more people" */}
            <span className="flex flex-shrink-0" aria-hidden="true">
              {remainingCats.slice(0, 3).map((cid, i) => {
                const p = audiencePersona(cid);
                return (
                  <span key={cid} className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background:"var(--card)", border:`1.5px solid ${ACCENT}`, marginLeft: i ? -8 : 0, zIndex: 3 - i, position:"relative" }}>
                    <p.Icon size={13} strokeWidth={1.8} style={{ color:"#7c5419" }}/>
                  </span>
                );
              })}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block" style={{ fontSize:13, fontWeight:700, color:"#7c5419" }}>Ordering for someone else too?</span>
              <span className="block" style={{ fontSize:11, color:ACCENT_TEXT }}>Add {remainingCats.map(audienceName).join(" or ")} to this same order</span>
            </span>
            <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background:"#7c5419" }}>
              <Plus size={13} style={{ color:"#fff" }}/>
            </span>
          </button>
        )
      )}

      {/* Category tabs — always shown when the audience isn't pre-chosen (organisation
          reuse); for individuals they appear once "Add more order" enables a 2nd audience */}
      {(!lockedCategory || enabledCats.length > 1) && (
        <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: `repeat(${lockedCategory ? enabledCats.length : garmentCatalog.length}, minmax(0, 1fr))` }}>
          {garmentCatalog.filter(c => !lockedCategory || enabledCats.includes(c.id)).map(c => {
            const pcs = pcsInCat(c.id);
            return (
              <button key={c.id} onClick={() => setCat(c.id)}
                className="flex flex-col items-center gap-0.5 py-2 rounded-xl"
                style={{ border:`1.5px solid ${cat===c.id ? DARK : "var(--border)"}`, background: cat===c.id ? "rgba(13,13,13,0.04)" : "var(--card)", cursor:"pointer" }}>
                <GarmentCategoryIcon id={c.id}/>
                <span style={{ fontSize: 10.5, fontWeight: cat===c.id ? 700 : 500, color: cat===c.id ? DARK : "#374151" }}>{c.label}{pcs > 0 ? ` · ${pcs}` : ""}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Boys / Girls toggle — only for kids, so gendered items (frocks, kurta sets…) are clear */}
      {cat === "kids" && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {([["boy", "Boys", Mars, "#1a4a8a"], ["girl", "Girls", Venus, "#9d3a5d"]] as const).map(([g, lbl, Icon, tint]) => (
            <button key={g} onClick={() => setKidGender(g)}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl"
              style={{ border:`1.5px solid ${kidGender===g ? DARK : "var(--border)"}`, background: kidGender===g ? "rgba(13,13,13,0.04)" : "var(--card)", cursor:"pointer", fontSize: 12.5, fontWeight: kidGender===g ? 700 : 500, color: kidGender===g ? DARK : "#374151" }}>
              <Icon size={15} strokeWidth={1.8} style={{ color: kidGender===g ? tint : "#9ca3af" }}/> {lbl}
            </button>
          ))}
        </div>
      )}

      {/* Garment list — each garment can have multiple colour lines, each with its own qty */}
      <div className="flex flex-col gap-2">
        {visibleItems.map(it => {
          const lines = linesFor(it.name);
          const added = lines.length > 0;
          const usedHexes = new Set(lines.map(l => l.colorHex));
          const palette = individualPaletteFor(it.name);
          const canAddColor = palette.some(p => !usedHexes.has(p.hex));
          const setPieces = garmentSetPieces(it.name);
          const topOnly = garmentTopOnly(it.name);
          // Out-of-stock (admin toggle): visible but greyed out and not orderable.
          const inStock = isItemInStock(it.name);
          return (
            <div key={it.name} className="px-3.5 py-2.5 rounded-xl transition-colors"
              style={{
                border:`1.5px solid ${added ? ACCENT : "var(--border)"}`,
                background: added ? "rgba(200,169,126,0.06)" : "var(--card)",
                boxShadow: added ? "0 2px 8px rgba(200,169,126,0.15)" : "none",
                opacity: inStock ? 1 : 0.5,
              }}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { if (added) setOpenItem(openItem === it.name ? null : it.name); }}
                  className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                  style={{ background:"none", border:"none", padding:0, cursor: added ? "pointer" : "default" }}>
                  <GarmentThumb name={it.name} size={40} onOpen={n => onViewPhotos?.(n)}/>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: added ? 700 : 500, color: added ? DARK : "#111827", lineHeight: 1.3 }}>{it.name}</p>
                    {added && openItem !== it.name
                      ? <p style={{ fontSize: 11, color:"#7c5419", fontWeight: 600 }}>{lines[0]?.style ? `${lines[0].style} · ` : ""}{lines.length} colour{lines.length !== 1 ? "s" : ""} · {lines.reduce((s, l) => s + l.qty, 0)} pcs</p>
                      : <p style={{ fontSize: 11, color: added ? "#7c5419" : "#9ca3af", fontWeight: added ? 600 : 400 }}>
                          From {inr(it.basePrice)}/pc{setPieces ? ` · ${setPieces.length}-piece set` : topOnly ? " · top only" : ""}
                        </p>}
                  </div>
                  {added && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {openItem !== it.name && lines.map(l => (
                        <span key={l.colorHex} className="w-4 h-4 rounded-full" style={{ background: l.colorHex, border:"1px solid rgba(0,0,0,0.15)" }}/>
                      ))}
                      <ChevronDown size={15} className="text-muted-foreground" style={{ transform: openItem === it.name ? "rotate(180deg)" : "none", transition:"transform 0.2s" }}/>
                    </div>
                  )}
                </button>
                {added && (
                  <RemoveChip title={`Remove ${it.name} from this order`}
                    onRemove={() => {
                      onChange(cart.filter(g => !sameLine(g, it.name)));
                      if (openItem === it.name) setOpenItem(null);
                    }}/>
                )}
                {!added && inStock && (
                  <button onClick={() => addGarment(it)} className="flex items-center gap-1 px-3 py-1.5 rounded-full flex-shrink-0"
                    style={{ border:`1px solid ${DARK}`, background:"var(--card)", color:DARK, cursor:"pointer", fontSize:12, fontWeight:600 }}>
                    <Plus size={13}/> Add
                  </button>
                )}
                {!added && !inStock && (
                  <span className="px-3 py-1.5 rounded-full flex-shrink-0" style={{ border:"1px solid var(--border)", color:"#9ca3af", fontSize:11, fontWeight:600 }}>Out of stock</span>
                )}
              </div>

              {/* Colour lines for this garment */}
              {added && openItem === it.name && (
                <div className="mt-2.5 flex flex-col gap-2">
                  {/* What's in the box — full set vs top only, so nobody has to guess */}
                  {(setPieces || topOnly) && (
                    <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-2 rounded-lg" style={{ background: ACCENT_BG, border: "0.5px solid rgba(200,169,126,0.5)" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#7c5419" }}>{setPieces ? "Full set includes:" : "Top only"}</span>
                      {setPieces?.map(p => (
                        <span key={p} className="px-2 py-0.5 rounded-full" style={{ background: "var(--card)", border: "1px solid rgba(200,169,126,0.5)", fontSize: 10.5, fontWeight: 600, color: "#374151" }}>{p}</span>
                      ))}
                      {topOnly && <span style={{ fontSize: 10.5, color: "#92400e" }}>— bottom &amp; dupatta not included</span>}
                    </div>
                  )}

                  {/* Style — round neck / collared, formal / printed, leggings / jeans … */}
                  {garmentStyleOptions(it.name).length > 0 && (
                    <div>
                      <p className="text-muted-foreground mb-1" style={{ fontSize: 11, fontWeight: 500 }}>Style</p>
                      <SelectField
                        options={garmentStyleOptions(it.name)}
                        value={lines[0]?.style ?? garmentStyleOptions(it.name)[0]}
                        onChange={v => setGarmentStyle(it.name, v)}/>
                    </div>
                  )}
                  {lines.map(line => (
                    <div key={line.colorHex} className="flex flex-col gap-1.5 px-2.5 py-2 rounded-xl" style={{ background: "var(--card)", boxShadow: "0 1px 3px rgba(13,13,13,0.05)" }}>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: line.colorHex, border:"1px solid rgba(0,0,0,0.15)" }}/>
                        <span className="flex-1" style={{ fontSize: 12, fontWeight: 600, color: DARK }}>{line.colorLabel}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => setLineQty(it.name, line.colorHex, line.qty - 1)} className="w-6 h-6 rounded-full border border-border bg-card flex items-center justify-center" style={{ cursor:"pointer" }}><Minus size={11}/></button>
                          <input type="text" inputMode="numeric" pattern="[0-9]*" value={line.qty}
                            onChange={e => setLineQty(it.name, line.colorHex, parseInt(digitsOnly(e.target.value)) || 0)}
                            onFocus={selectAllOnFocus} onClick={selectAllOnFocus} onMouseUp={preventSelectionCollapse}
                            className="text-center bg-card border border-border rounded-lg" style={{ width: 40, fontSize: 12, fontWeight: 600, outline:"none", padding:"2px 3px" }}/>
                          <button onClick={() => setLineQty(it.name, line.colorHex, line.qty + 1)} className="w-6 h-6 rounded-full border border-border bg-card flex items-center justify-center" style={{ cursor:"pointer" }}><Plus size={11}/></button>
                          <button onClick={() => removeLine(it.name, line.colorHex)} className="ml-0.5" style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af" }}><X size={13}/></button>
                        </div>
                      </div>
                      {/* Colour swatches to change this line's colour */}
                      {setPieces && (
                        <p className="pl-7" style={{ fontSize: 10.5, fontWeight: 600, color: "#6b7280" }}>{setPieces[0]} colour</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 pl-7">
                        {palette.map(p => {
                          const isThis = p.hex === line.colorHex;
                          const takenByOther = usedHexes.has(p.hex) && !isThis;
                          return (
                            <button key={p.hex} title={takenByOther ? `${p.label} already added` : p.label}
                              onClick={() => setLineColor(it.name, line.colorHex, p.hex, p.label)}
                              disabled={takenByOther}
                              className="w-5 h-5 rounded-full"
                              style={{ background: p.hex, border: isThis ? `2.5px solid ${DARK}` : "1.5px solid rgba(0,0,0,0.12)", opacity: takenByOther ? 0.3 : 1, cursor: takenByOther ? "not-allowed" : "pointer" }}/>
                          );
                        })}
                      </div>

                      {/* Per-piece colours for sets — salwar, dupatta, pyjama… */}
                      {setPieces && setPieces.length > 1 && (
                        <div className="flex flex-col gap-2 pl-7 pt-1.5 mt-0.5" style={{ borderTop: "1px dashed var(--border)" }}>
                          {setPieces.slice(1).map(piece => {
                            const sel = line.pieceColors?.[piece];
                            return (
                              <div key={piece}>
                                <p style={{ fontSize: 10.5, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>{piece} colour</p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button onClick={() => setLinePieceColor(it.name, line.colorHex, piece, null)}
                                    className="px-2 py-0.5 rounded-full"
                                    style={{
                                      fontSize: 10, fontWeight: 600, cursor: "pointer",
                                      border: `1.5px solid ${!sel ? DARK : "var(--border)"}`,
                                      background: !sel ? "rgba(13,13,13,0.05)" : "var(--card)",
                                      color: !sel ? DARK : "#9ca3af",
                                    }}>
                                    Match {setPieces[0].toLowerCase()}
                                  </button>
                                  {palette.map(p => (
                                    <button key={p.hex} title={p.label}
                                      onClick={() => setLinePieceColor(it.name, line.colorHex, piece, p.hex, p.label)}
                                      className="w-5 h-5 rounded-full"
                                      style={{ background: p.hex, border: sel?.hex === p.hex ? `2.5px solid ${DARK}` : "1.5px solid rgba(0,0,0,0.12)", cursor: "pointer" }}/>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                  {canAddColor && (
                    <button onClick={() => addGarment(it)} className="flex items-center gap-1 self-start px-2.5 py-1 rounded-full"
                      style={{ border:`1px dashed ${ACCENT}`, background: ACCENT_BG, color:"#7c5419", cursor:"pointer", fontSize:11, fontWeight:600 }}>
                      <Plus size={11}/> Add another colour
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalPcs > 0 && (
        <div className="mt-3 flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: ACCENT_BG, border: `1px solid rgba(200,169,126,0.4)` }}>
          <span style={{ fontSize: 12, color:"#7c5419", fontWeight: 600 }}>{cart.length} line{cart.length !== 1 ? "s" : ""} · {totalPcs} pcs total</span>
          <Check size={14} style={{ color:"#7c5419", flexShrink:0 }}/>
        </div>
      )}
    </div>
  );
}

// ─── Color Section ────────────────────────────────────────────────────────────

const COLORS_PER_PAGE = 5;
let cid = 10;
function ColorSection({ onStateChange, initial }: { onStateChange?: (colors: ColorEntry[]) => void; initial?: ColorEntry[] }) {
  const [colors, setColors] = useState<ColorEntry[]>(initial ?? [{ id:1, hex:"#1a2540", pantone:"PMS 289 C", label:"Navy Blue", position:"" }]);
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState("#c8a84b");
  const [pantone, setPantone] = useState("");
  const [lbl, setLbl] = useState("");
  const [pos, setPos] = useState("");
  const [preset, setPreset] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [dupError, setDupError] = useState("");
  const fRef = useRef<HTMLInputElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onStateChange?.(colors); }, [colors]);

  const totalPages = Math.ceil(colors.length / COLORS_PER_PAGE);
  const pagedColors = colors.slice(page * COLORS_PER_PAGE, (page + 1) * COLORS_PER_PAGE);

  function add() {
    const normalizedHex = hex.toLowerCase();
    if (colors.some(c => c.hex.toLowerCase() === normalizedHex)) {
      setDupError(`${lbl || hex} is already in your list — colors must be unique.`);
      return;
    }
    cid++;
    const newColors = [...colors, { id: cid, hex, pantone, label: lbl || hex, position: pos }];
    setColors(newColors);
    // Jump to last page on add
    setPage(Math.floor((newColors.length - 1) / COLORS_PER_PAGE));
    setOpen(false); setPantone(""); setLbl(""); setPreset(null); setPos(""); setDupError("");
  }

  function removeColor(id: number) {
    const next = colors.filter(x => x.id !== id);
    setColors(next);
    const newTotalPages = Math.ceil(next.length / COLORS_PER_PAGE);
    if (page >= newTotalPages && newTotalPages > 0) setPage(newTotalPages - 1);
  }

  function fromPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    const mocks = [["#3a5a8a","Steel Blue"],["#a85a3a","Terracotta"],["#5a8a3a","Sage Green"]];
    const [h, l] = mocks[Math.floor(Math.random() * 3)];
    setHex(h); setLbl(l); setOpen(true); setPos(""); setDupError("");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-muted-foreground" style={{ fontSize: 12 }}>Colors in this order</p>
        {colors.length > 0 && <span className="text-muted-foreground" style={{ fontSize:11 }}>{colors.length} color{colors.length !== 1 ? "s" : ""}</span>}
      </div>
      {colors.length === 0 && (
        <div className="text-xs text-muted-foreground rounded-xl py-3 text-center border border-dashed border-border mb-3">No colors yet — tap + Add color</div>
      )}

      {/* Paginated color list */}
      {colors.length > 0 && (
        <>
          <div className="flex flex-col gap-2 mb-2">
            {pagedColors.map(c => (
              <div key={c.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted border border-border">
                <div className="w-7 h-7 rounded-full flex-shrink-0 border-2 border-white shadow-sm" style={{ background: c.hex }}/>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground" style={{ fontSize: 13, fontWeight: 500 }}>{c.label}</p>
                  {c.pantone && <p className="text-muted-foreground" style={{ fontSize: 11 }}>{c.pantone}</p>}
                  {c.position && <p className="text-muted-foreground" style={{ fontSize: 11 }}><MapPin size={9} style={{ display:"inline", marginRight:2 }}/>{c.position}</p>}
                </div>
                <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-card border border-border" style={{ fontFamily:"monospace" }}>{c.hex}</span>
                <button onClick={() => removeColor(c.id)} style={{ background:"transparent", border:"none", cursor:"pointer", color:"#9ca3af" }}><X size={14}/></button>
              </div>
            ))}
          </div>

          {/* Pagination controls (only if more than 5 colors) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mb-3 px-1">
              <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}
                className="w-7 h-7 rounded-full border border-border bg-card flex items-center justify-center"
                style={{ cursor: page===0 ? "not-allowed" : "pointer", opacity: page===0 ? 0.4 : 1 }}>
                <ChevronLeft size={13}/>
              </button>
              <div className="flex gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i===page ? DARK : "#d1d5db" }}/>
                ))}
              </div>
              <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page >= totalPages-1}
                className="w-7 h-7 rounded-full border border-border bg-card flex items-center justify-center"
                style={{ cursor: page>=totalPages-1 ? "not-allowed" : "pointer", opacity: page>=totalPages-1 ? 0.4 : 1 }}>
                <ChevronRight size={13}/>
              </button>
            </div>
          )}
        </>
      )}

      {/* Duplicate error */}
      {dupError && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 border border-red-200 mb-2">
          <AlertTriangle size={11} style={{ color:"#dc2626", flexShrink:0 }}/>
          <p style={{ fontSize:11, color:"#dc2626" }}>{dupError}</p>
        </div>
      )}

      {!open ? (
        <div className="flex gap-2 mb-1">
          <button onClick={() => { setOpen(true); setDupError(""); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs border border-dashed" style={{ background: ACCENT_BG, color:"#7c5419", borderColor: ACCENT, cursor:"pointer", fontWeight: 500 }}>
            <Plus size={14}/> Add color
          </button>
          <button onClick={() => fRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs bg-muted border border-border" style={{ color:"#374151", cursor:"pointer" }}>
            <Sparkles size={13}/> From swatch photo
          </button>
          <input ref={fRef} type="file" accept="image/*" className="hidden" onChange={fromPhoto}/>
        </div>
      ) : (
        <div className="rounded-xl p-3.5 bg-muted border border-border">
          <p className="text-foreground text-xs mb-2.5" style={{ fontWeight: 500 }}>Choose a color</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {colorPresets.map(s => (
              <button key={s.hex} onClick={() => { setPreset(s.hex); setHex(s.hex); setLbl(s.label); setDupError(""); }} title={s.label}
                className="w-7 h-7 rounded-full" style={{ background: s.hex, border: preset===s.hex ? `2.5px solid ${DARK}` : "2px solid #fff", boxShadow:"0 0 0 1px #d1d5db", cursor:"pointer", outline:"none" }}/>
            ))}
          </div>
          <div className="flex gap-2 mb-2.5">
            <div className="relative w-10 h-9 rounded-xl border border-border overflow-hidden flex-shrink-0" style={{ background: hex }}>
              <input type="color" value={hex} onChange={e => { setHex(e.target.value); setPreset(null); setDupError(""); }} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
            </div>
            <input type="text" value={hex} onChange={e => { setHex(e.target.value); setDupError(""); }} className={INP + " flex-1"} style={{ ...fnt, fontFamily:"monospace" }}/>
          </div>
          <div className="flex gap-2 mb-2">
            <input type="text" value={lbl} onChange={e => setLbl(e.target.value)} placeholder="Color name" className={INP + " flex-1"} style={fnt}/>
            <input type="text" value={pantone} onChange={e => setPantone(e.target.value)} placeholder="Pantone (optional)" className={INP + " flex-1"} style={fnt}/>
          </div>
          <input type="text" value={pos} onChange={e => setPos(e.target.value)} placeholder="Placement (e.g. Front chest, Collar, Sleeve)" className={INP + " mb-3 block"} style={fnt}/>
          <div className="flex gap-2">
            <button onClick={add} className="flex-1 py-2.5 rounded-xl text-sm" style={{ background: DARK, color:"#fff", border:"none", cursor:"pointer", fontWeight: 500 }}>Add to order</button>
            <button onClick={() => { setOpen(false); setDupError(""); }} className="px-4 py-2 rounded-xl text-sm bg-card border border-border text-muted-foreground" style={{ cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Size Section ─────────────────────────────────────────────────────────────

function SizeSection({ totalQty, defaultCat = "school", step = 1, onAllocationChange, onStateChange, initialCat, initialQtys, hideCategory }: { totalQty: number; defaultCat?: SizeCat; step?: number; onAllocationChange?: (n: number) => void; onStateChange?: (s: { cat: SizeCat; qtys: Record<string, number> }) => void; initialCat?: SizeCat; initialQtys?: Record<string, number>; hideCategory?: boolean }) {
  const [cat, setCat] = useState<SizeCat>(initialCat ?? defaultCat);
  const [showCat, setShowCat] = useState(false);
  const [qtys, setQtys] = useState<Record<string, number>>(initialQtys ?? {});
  const [customSizes, setCustomSizes] = useState<string[]>([]);
  const [customIn, setCustomIn] = useState("");
  const [mode, setMode] = useState<"qty" | "pct">("qty");

  // Reset on group/category change — but skip the very first mount so a resumed
  // draft keeps its restored category & quantities.
  const didMountSize = useRef(false);
  useEffect(() => {
    if (!didMountSize.current) { didMountSize.current = true; return; }
    setCat(defaultCat); setQtys({}); setShowCat(false);
  }, [defaultCat]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onStateChange?.({ cat, qtys }); }, [cat, qtys]);

  const sizes = cat === "custom" ? customSizes.map(l => ({ label: l, hint: "" })) : sizeSets[cat];
  const distributed = Object.values(qtys).reduce((a, b) => a + b, 0);
  const remaining = totalQty - distributed;
  const over = remaining < 0;
  const catMeta = sizeCats.find(c => c.id === cat)!;

  useEffect(() => { onAllocationChange?.(distributed); }, [distributed]);

  function setQtyFor(label: string, val: number) { setQtys(p => ({ ...p, [label]: Math.max(0, val) })); }
  function addCustom() { const v = customIn.trim(); if (!v || customSizes.includes(v)) return; setCustomSizes(p => [...p, v]); setCustomIn(""); }
  function removeCustom(s: string) { setCustomSizes(p => p.filter(x => x !== s)); setQtys(p => { const n = {...p}; delete n[s]; return n; }); }
  function distributeEvenly() {
    const active = sizes.map(s => s.label);
    if (!active.length) return;
    const each = Math.floor(totalQty / active.length);
    const rem = totalQty - each * active.length;
    const next: Record<string, number> = {};
    active.forEach((l, i) => { next[l] = each + (i < rem ? 1 : 0); });
    setQtys(next);
  }

  return (
    <div>
      {!hideCategory && (
        <>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Who is this garment for?</p>
          <button onClick={() => setShowCat(v => !v)} className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-card border border-border mb-2">
            <span className="text-foreground text-sm" style={{ fontWeight: 500 }}>{catMeta.label}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground" style={{ fontSize: 11 }}>{catMeta.desc}</span>
              <ChevronDown size={13} className="text-muted-foreground" strokeWidth={1.5} style={{ transform: showCat ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}/>
            </div>
          </button>
          {showCat && (
            <div className="mb-2 rounded-xl overflow-hidden border border-border shadow-sm">
              {sizeCats.map(c => (
                <button key={c.id} onClick={() => { setCat(c.id); setQtys({}); setShowCat(false); }} className="w-full flex items-center justify-between px-3.5 py-2.5 border-b border-border last:border-0 text-left" style={{ background: cat===c.id ? ACCENT_BG : "var(--card)", cursor:"pointer" }}>
                  <span className="text-foreground text-sm" style={{ fontWeight: 500, color: cat===c.id ? "#7c5419" : DARK }}>{c.label}</span>
                  <span className="text-muted-foreground" style={{ fontSize: 11 }}>{c.desc}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {cat === "custom" && (
        <div className="flex gap-2 mb-3">
          <input value={customIn} onChange={e => setCustomIn(e.target.value)} onKeyDown={e => e.key==="Enter" && addCustom()} placeholder="e.g. 38, 40, XL" className={INP + " flex-1"} style={fnt}/>
          <button onClick={addCustom} className="px-3 rounded-xl text-sm bg-foreground text-white" style={{ cursor:"pointer", fontWeight: 500 }}>Add</button>
        </div>
      )}

      {sizes.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-2">
            <p className="text-muted-foreground" style={{ fontSize: 12 }}>Quantity per size</p>
            <div className="flex gap-1">
              <button onClick={() => setMode("qty")} className="px-2 py-0.5 rounded text-xs flex items-center gap-0.5" style={{ background: mode==="qty" ? DARK : "var(--muted)", color: mode==="qty" ? "#fff" : "var(--muted-foreground)", border:"none", cursor:"pointer", fontWeight: mode==="qty" ? 500 : 400 }}>
                <Hash size={9}/> pcs
              </button>
              <button onClick={() => setMode("pct")} className="px-2 py-0.5 rounded text-xs flex items-center gap-0.5" style={{ background: mode==="pct" ? DARK : "var(--muted)", color: mode==="pct" ? "#fff" : "var(--muted-foreground)", border:"none", cursor:"pointer", fontWeight: mode==="pct" ? 500 : 400 }}>
                <Percent size={9}/> %
              </button>
              <button onClick={distributeEvenly} className="px-2 py-0.5 rounded text-xs flex items-center gap-0.5" style={{ background: ACCENT_BG, color:"#7c5419", border:"none", cursor:"pointer" }}>
                <RotateCcw size={9}/> Even
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mb-3">
            {sizes.map(s => {
              const q = qtys[s.label] ?? 0;
              const pct = totalQty > 0 ? Math.round((q / totalQty) * 100) : 0;
              return (
                <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted border border-border">
                  <div className="flex-shrink-0" style={{ width: 52 }}>
                    <p className="text-foreground" style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</p>
                    {s.hint && <p className="text-muted-foreground" style={{ fontSize: 10 }}>{s.hint}</p>}
                  </div>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-card border border-border">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: q > 0 ? ACCENT : "transparent" }}/>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setQtyFor(s.label, q - (mode==="pct" ? Math.round(totalQty*0.05) : step))} className="w-6 h-6 rounded flex items-center justify-center bg-card border border-border" style={{ cursor:"pointer" }}><Minus size={10}/></button>
                    {mode === "pct" ? (
                      <div className="text-center text-foreground" style={{ width: 50, fontSize: 12, fontWeight: 500 }}>{pct}%</div>
                    ) : (
                      <input
                        type="text" inputMode="numeric" pattern="[0-9]*"
                        value={q === 0 ? "" : q}
                        onChange={e => setQtyFor(s.label, Math.max(0, parseInt(digitsOnly(e.target.value)) || 0))}
                        onFocus={selectAllOnFocus} onClick={selectAllOnFocus} onMouseUp={preventSelectionCollapse}
                        className="text-center text-foreground bg-card border border-border rounded"
                        style={{ width: 46, fontSize: 12, fontWeight: 500, outline:"none", padding:"2px 4px" }}
                        placeholder="0"
                      />
                    )}
                    <button onClick={() => setQtyFor(s.label, q + (mode==="pct" ? Math.round(totalQty*0.05) : step))} className="w-6 h-6 rounded flex items-center justify-center bg-card border border-border" style={{ cursor:"pointer" }}><Plus size={10}/></button>
                  </div>
                  {cat==="custom" && <button onClick={() => removeCustom(s.label)} style={{ background:"transparent", border:"none", cursor:"pointer", color:"#9ca3af" }}><X size={12}/></button>}
                </div>
              );
            })}
          </div>

          <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${over ? "bg-red-50 border-red-200" : remaining===0 ? "bg-emerald-50 border-emerald-200" : "bg-muted border-border"}`}>
            <div>
              <p style={{ fontSize: 12, color: over ? "#dc2626" : remaining===0 ? "#065f46" : "#6b7280" }}>
                {over ? "Over-allocated" : remaining===0 ? "Perfectly allocated ✓" : "Allocated so far"}
              </p>
              <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
                {over ? `${Math.abs(remaining)} pcs too many` : remaining===0 ? "All sizes filled" : `${remaining} pcs unassigned`}
              </p>
            </div>
            <div className="text-right">
              <p style={{ fontSize: 15, fontWeight: 600, color: over ? "#dc2626" : remaining===0 ? "#065f46" : DARK }}>{distributed} / {totalQty}</p>
              <p style={{ fontSize: 10, color: "#9ca3af" }}>pcs total</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Per-colour size allocator (Individual flow) ──────────────────────────────
// Each colour line distributes its OWN quantity across the age/size set, so the
// size↔colour pairing is captured at input time (no ambiguity later).
// Draped / one-size garments never ask for a size chart — sarees don't come in XS–XXL.
function isFreeSizeGarment(name: string): boolean {
  return /saree|dupatta|stole|shawl|scarf|apron/i.test(name);
}

// Two-tap remove chip — × arms into "Remove?", auto-resets if left alone.
function RemoveChip({ onRemove, title }: { onRemove: () => void; title?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2600);
    return () => clearTimeout(t);
  }, [armed]);
  return armed ? (
    <button onClick={onRemove} className="px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>
      Remove?
    </button>
  ) : (
    <button onClick={() => setArmed(true)} title={title ?? "Remove"}
      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer" }}>
      <X size={13}/>
    </button>
  );
}

function PerColourSize({ line, cat, audienceLabel, onChange, onRemove }: { line: GarmentLine; cat: SizeCat; audienceLabel?: string; onChange: (sizes: Record<string, number>) => void; onRemove?: () => void }) {
  // Bottom-wear uses waist sizes for adults; kids stay age-based for everything.
  const bottoms = isBottomWearGarment(line.name);
  const sizes = bottoms && (cat === "mens" || cat === "womens")
    ? waistSizeSets[cat]
    : (sizeSets[cat] ?? sizeSets.mens);
  const sizeSystem = bottoms && (cat === "mens" || cat === "womens") ? "Waist in inches"
    : cat === "mens" ? "Chest-based sizes"
    : cat === "womens" ? "UK sizes"
    : cat === "school" ? "Age-based sizes" : "";
  const [qtys, setQtys] = useState<Record<string, number>>(line.sizes ?? {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onChange(qtys); }, [qtys]);
  const freeSize = isFreeSizeGarment(line.name);
  // Free-size garments auto-allocate all pieces — nothing for the user to do.
  useEffect(() => {
    if (freeSize) setQtys({ "Free size": line.qty });
  }, [freeSize, line.qty]);
  // Two-tap remove — first tap arms "Remove?", auto-resets if left alone.
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => {
    if (!confirmRemove) return;
    const t = setTimeout(() => setConfirmRemove(false), 2600);
    return () => clearTimeout(t);
  }, [confirmRemove]);
  const removeBtn = onRemove ? (
    confirmRemove ? (
      <button onClick={onRemove} className="px-2 py-1 rounded-full flex-shrink-0"
        style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>
        Remove?
      </button>
    ) : (
      <button onClick={() => setConfirmRemove(true)} title="Remove this garment from the order"
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer" }}>
        <X size={14}/>
      </button>
    )
  ) : null;
  const allocated = Object.values(qtys).reduce((a, b) => a + b, 0);
  const remaining = line.qty - allocated;
  const over = remaining < 0;
  const done = remaining === 0 && allocated > 0;
  function setQ(label: string, v: number) { setQtys(p => ({ ...p, [label]: Math.max(0, v) })); }
  function even() {
    if (!sizes.length) return;
    const each = Math.floor(line.qty / sizes.length);
    const rem = line.qty - each * sizes.length;
    const next: Record<string, number> = {};
    sizes.forEach((s, i) => { next[s.label] = each + (i < rem ? 1 : 0); });
    setQtys(next);
  }
  const pct = line.qty > 0 ? Math.min(100, Math.round((allocated / line.qty) * 100)) : 0;

  // ── Free-size garments (sarees, aprons…) — nothing to allocate, just confirm ──
  if (freeSize) {
    return (
      <div className="rounded-2xl bg-card p-3.5" style={{ border: "1px solid #86efac" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full flex-shrink-0" style={{ background: line.colorHex, boxShadow: "0 0 0 2px var(--card), 0 0 0 3px rgba(0,0,0,0.10)" }}/>
          <div className="min-w-0 flex-1">
            <p className="text-foreground" style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.2 }}>
              {line.name}{audienceLabel ? <span style={{ fontSize: 10.5, fontWeight: 600, marginLeft: 6, padding: "1px 6px", borderRadius: 999, background: "var(--muted)", color: "#6b7280" }}>{audienceLabel}</span> : null}
            </p>
            <p className="text-muted-foreground" style={{ fontSize: 11.5 }}>{line.colorLabel} · {line.qty} pc{line.qty !== 1 ? "s" : ""}</p>
          </div>
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full flex-shrink-0" style={{ fontSize: 11, fontWeight: 600, background: "#ecfdf5", color: "#047857" }}>
            <Check size={11}/> Free size
          </span>
          {removeBtn}
        </div>
        <p className="text-muted-foreground mt-2" style={{ fontSize: 10.5, lineHeight: 1.5 }}>
          Draped / one-size garment — no size chart needed.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card p-3.5" style={{ border: `1px solid ${done ? "#86efac" : over ? "#fca5a5" : "var(--border)"}` }}>
      {/* Header — colour identity + live count */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-full flex-shrink-0" style={{ background: line.colorHex, boxShadow: "0 0 0 2px var(--card), 0 0 0 3px rgba(0,0,0,0.10)" }}/>
        <div className="min-w-0 flex-1">
          <p className="text-foreground" style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.2 }}>
            {line.name}{line.gender ? <span style={{ fontSize: 10.5, fontWeight: 600, marginLeft: 6, padding: "1px 6px", borderRadius: 999, background: line.gender === "boy" ? "#E0F0FF" : "#fce7f0", color: line.gender === "boy" ? "#1a4a8a" : "#9d3a5d" }}>{line.gender === "boy" ? "Boys" : "Girls"}</span> : null}{audienceLabel ? <span style={{ fontSize: 10.5, fontWeight: 600, marginLeft: 6, padding: "1px 6px", borderRadius: 999, background: "var(--muted)", color: "#6b7280" }}>{audienceLabel}</span> : null}
          </p>
          <p className="text-muted-foreground" style={{ fontSize: 11.5 }}>{line.colorLabel}</p>
        </div>
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full flex-shrink-0" style={{ fontSize: 11, fontWeight: 600, background: done ? "#ecfdf5" : over ? "#fef2f2" : "var(--muted)", color: done ? "#047857" : over ? "#dc2626" : "#6b7280" }}>
          {done && <Check size={11}/>}{allocated} / {line.qty}
        </span>
        {removeBtn}
      </div>

      {/* Progress + quick-fill */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: done ? "#10b981" : over ? "#ef4444" : ACCENT }}/>
        </div>
        <button onClick={even} className="flex items-center gap-1 flex-shrink-0" style={{ background: "none", border: "none", cursor: "pointer", color: "#7c5419", fontSize: 11, fontWeight: 600 }}>
          <RotateCcw size={10}/> Even
        </button>
      </div>

      {/* Size chips — tap a size to add a piece; each chip shows its measurement */}
      <p className="text-muted-foreground mb-1.5" style={{ fontSize: 10.5 }}>
        {remaining > 0 ? `Tap a size to place ${remaining} remaining piece${remaining !== 1 ? "s" : ""}` : done ? "All pieces sized ✓" : "Tap a size to add a piece"}
        {sizeSystem ? <span style={{ color: "#7c5419", fontWeight: 600 }}> · {sizeSystem}</span> : null}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sizes.map(s => {
          const q = qtys[s.label] ?? 0;
          const on = q > 0;
          const canAdd = remaining > 0;
          // Hide the hint when it just repeats the label (kids "5-6Y" vs "Age 5-6", waist chips).
          const showHint = !!s.hint && cat !== "school" && s.hint !== "waist";
          return (
            <button key={s.label} title={s.hint || s.label}
              onClick={() => { if (canAdd) setQ(s.label, q + 1); }}
              className="flex flex-col items-center px-3 py-1 rounded-2xl transition-colors"
              style={{
                border: `1.5px solid ${on ? ACCENT : "var(--border)"}`,
                background: on ? ACCENT_BG : "var(--card)",
                cursor: canAdd ? "pointer" : "default",
              }}>
              <span className="flex items-center gap-1" style={{ fontSize: 12, fontWeight: on ? 700 : 500, color: on ? "#7c5419" : canAdd ? DARK : "#c4c4c4" }}>
                {s.label}{on && <span className="px-1.5 rounded-full" style={{ background: ACCENT, color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: "15px" }}>{q}</span>}
              </span>
              {showHint && (
                <span style={{ fontSize: 8.5, lineHeight: 1.2, color: on ? ACCENT_TEXT : canAdd ? "#9ca3af" : "#d4d4d4" }}>{s.hint}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Chosen sizes — small adjust rows, only for what's actually picked */}
      {sizes.some(s => (qtys[s.label] ?? 0) > 0) && (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {sizes.filter(s => (qtys[s.label] ?? 0) > 0).map(s => {
            const q = qtys[s.label] ?? 0;
            return (
              <div key={s.label} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: "var(--muted)" }}>
                <span className="text-foreground" style={{ fontSize: 12, fontWeight: 700, minWidth: 34 }}>{s.label}</span>
                {s.hint && <span className="text-muted-foreground flex-1 min-w-0" style={{ fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.hint}</span>}
                {!s.hint && <span className="flex-1"/>}
                <button onClick={() => setQ(s.label, q - 1)} className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", cursor: "pointer" }}><Minus size={11}/></button>
                <span className="text-center" style={{ minWidth: 18, fontSize: 13, fontWeight: 700, color: "#7c5419" }}>{q}</span>
                <button onClick={() => { if (remaining > 0) setQ(s.label, q + 1); }} className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: remaining > 0 ? DARK : "#E5E7EB", border: "none", cursor: remaining > 0 ? "pointer" : "default", color: remaining > 0 ? "#fff" : "#9CA3AF" }}><Plus size={11}/></button>
              </div>
            );
          })}
        </div>
      )}

      {over && <p className="mt-2 text-red-600" style={{ fontSize: 10.5 }}>{Math.abs(remaining)} too many — remove some.</p>}
    </div>
  );
}

// ─── Organisation multi-garment cart (ORGANISATION FLOW ONLY) ─────────────────
// Completely separate from the individual GarmentCart. Organisations can add
// several garments across Men's / Women's / Kids in one order; each garment is
// self-contained: its own style, material, brand (Pantone) colours, quantity
// (minimum 100 pcs each) and size distribution. Kids split into Boys / Girls.
export const ORG_GARMENT_MOQ  = 100;
export const ORG_GARMENT_STEP = 10;

export interface OrgGarmentLine {
  id: number;
  categoryId: GarmentCategoryId;
  name: string;
  basePrice: number;
  gender?: "boy" | "girl";
  style?: string;
  material: { fabric: string; gsm: string; weave: string };
  colors: ColorEntry[];
  qty: number;
  sizeCat: SizeCat;
  sizes: Record<string, number>;
  // Stitching/packaging and reference & sample are set per garment — each product
  // can need different finishing and a different logo/sample.
  packaging: { stitch: string; packing: string };
  refChosen: RefOption | null;
  refLogoNames: string[];
  refInspNames: string[];
  // Embedded reference files (base64) so they travel with the order to the
  // admin portal, where the team downloads them from the Documents card.
  refFiles?: { name: string; dataUrl: string }[];
}

function orgSizeCatFor(categoryId: GarmentCategoryId): SizeCat {
  return categoryId === "womens" ? "womens" : categoryId === "kids" ? "school" : "mens";
}
// Human audience label for a garment line — Men's / Women's / Kids (Boys|Girls).
function orgAudienceLabel(categoryId: GarmentCategoryId, gender?: "boy" | "girl"): string {
  if (categoryId === "mens") return "Men's";
  if (categoryId === "womens") return "Women's";
  return gender ? `Kids · ${gender === "boy" ? "Boys" : "Girls"}` : "Kids";
}
const orgLineAllocated = (l: OrgGarmentLine) => Object.values(l.sizes ?? {}).reduce((a, b) => a + b, 0);

function OrgGarmentCart({ cart, onChange, orgType, allowedCategories, onViewPhotos, view, onViewChange, fabricSource }: {
  cart: OrgGarmentLine[];
  onChange: (next: OrgGarmentLine[]) => void;
  orgType?: OrgType;
  fabricSource?: "fresh" | "surplus";
  allowedCategories?: GarmentCategoryId[];
  onViewPhotos?: (name: string) => void;
  // Two pages: "add" = pick garments; "list" = configure each garment (its own page
  // so the order doesn't become one long confusing scroll). Lifted to the parent
  // so the always-visible "Next" CTA can live in the true sticky footer instead of
  // being buried inside this scrollable card.
  view: "add" | "list";
  onViewChange: (v: "add" | "list") => void;
}) {
  const { isCategoryActive, isItemActive, isItemInStock, extraItemsForCategory } = useCatalogAvailability();
  const cats = garmentCatalog.filter(c => (!allowedCategories || allowedCategories.includes(c.id)) && isCategoryActive(c.label));
  const [cat, setCat] = useState<GarmentCategoryId>(cats[0]?.id ?? "mens");
  const [kidGender, setKidGender] = useState<"boy" | "girl">("boy");
  const [openId, setOpenId] = useState<number | null>(null);
  // "Added" pill un-select — first tap arms "Remove?", auto-resets if left alone.
  const [armRemove, setArmRemove] = useState<string | null>(null);
  useEffect(() => {
    if (!armRemove) return;
    const t = setTimeout(() => setArmRemove(null), 2600);
    return () => clearTimeout(t);
  }, [armRemove]);
  useEffect(() => { if (!cats.some(c => c.id === cat)) setCat(cats[0]?.id ?? "mens"); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [allowedCategories]);
  const active = garmentCatalog.find(c => c.id === cat)!;
  const lineGender = cat === "kids" ? kidGender : undefined;
  const genderItems = cat === "kids" ? active.items.filter(it => !it.gender || it.gender === kidGender) : active.items;
  const visibleItems = genderItems.filter(it => garmentAllowedForOrg(orgType, it.name) && isItemActive(it.name));
  // Products the admin added to this category in the portal (not in the
  // hand-built list) — shown with the admin-set price.
  const adminExtras = extraItemsForCategory(active.label, active.items.map(i => i.name), "GARMENT").filter(e => isItemActive(e.name));
  const allItems = [...visibleItems, ...adminExtras.map(e => ({ name: e.name, basePrice: e.price || 190 } as CatalogGarment))];

  const sameLine = (l: OrgGarmentLine, name: string) => l.categoryId === cat && l.name === name && (cat !== "kids" || l.gender === lineGender);
  const isAdded = (name: string) => cart.some(l => sameLine(l, name));

  function addGarment(it: CatalogGarment) {
    const styleOpts = garmentStyleOptions(it.name);
    const mo = materialOptionsForGarment(it.name);
    // Unique id derived from the current cart so lines never collide (even after resume).
    const line: OrgGarmentLine = {
      id: cart.reduce((m, l) => Math.max(m, l.id), 0) + 1,
      categoryId: cat, name: it.name, basePrice: it.basePrice,
      ...(lineGender ? { gender: lineGender } : {}),
      ...(styleOpts[0] ? { style: styleOpts[0] } : {}),
      material: { fabric: mo.fabricOptions[0], gsm: mo.gsmOptions[0], weave: mo.weaveOptions[0] },
      colors: [],
      qty: ORG_GARMENT_MOQ,
      sizeCat: orgSizeCatFor(cat),
      sizes: {},
      packaging: { stitch: stitchingOpts[0].id, packing: packagingOpts[0].id },
      refChosen: null,
      refLogoNames: [],
      refInspNames: [],
    };
    onChange([...cart, line]);
    setOpenId(line.id);
  }
  function updateLine(id: number, patch: Partial<OrgGarmentLine>) {
    onChange(cart.map(l => (l.id === id ? { ...l, ...patch } : l)));
  }
  function setLineQty(id: number, q: number) {
    updateLine(id, { qty: Math.max(ORG_GARMENT_MOQ, q) });
  }
  function removeLine(id: number) {
    onChange(cart.filter(l => l.id !== id));
    if (openId === id) setOpenId(null);
  }

  const totalPcs = cart.reduce((s, l) => s + l.qty, 0);

  // ── Page 1: pick garments ──────────────────────────────────────────────────
  if (view === "add") {
    return (
      <div>
        <p className="text-muted-foreground mb-3" style={{ fontSize: 12, lineHeight: 1.5 }}>
          Add each garment you need — across Men's, Women's and Kids. You'll set fabric, colours, quantity and sizes for each on the next page. <strong>Minimum {ORG_GARMENT_MOQ} pcs per garment.</strong>
          {cart.length > 0 && " Ready? Use the button in the footer below to continue."}
        </p>

        {/* Category tabs (filtered to what this org type orders) */}
        {cats.length > 1 && (
          <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: `repeat(${cats.length}, minmax(0, 1fr))` }}>
            {cats.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)}
                className="flex flex-col items-center gap-0.5 py-2 rounded-xl"
                style={{ border:`1.5px solid ${cat===c.id ? DARK : "var(--border)"}`, background: cat===c.id ? "rgba(13,13,13,0.04)" : "var(--card)", cursor:"pointer" }}>
                <GarmentCategoryIcon id={c.id}/>
                <span style={{ fontSize: 10.5, fontWeight: cat===c.id ? 700 : 500, color: cat===c.id ? DARK : "#374151" }}>{c.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Boys / Girls toggle for kids */}
        {cat === "kids" && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {([["boy", "Boys", Mars, "#1a4a8a"], ["girl", "Girls", Venus, "#9d3a5d"]] as const).map(([g, lbl, Icon, tint]) => (
              <button key={g} onClick={() => setKidGender(g)}
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl"
                style={{ border:`1.5px solid ${kidGender===g ? DARK : "var(--border)"}`, background: kidGender===g ? "rgba(13,13,13,0.04)" : "var(--card)", cursor:"pointer", fontSize: 12.5, fontWeight: kidGender===g ? 700 : 500, color: kidGender===g ? DARK : "#374151" }}>
                <Icon size={15} strokeWidth={1.8} style={{ color: kidGender===g ? tint : "#9ca3af" }}/> {lbl}
              </button>
            ))}
          </div>
        )}

        {/* Add-garment list for the active category/gender. Out-of-stock items
            stay visible but greyed out (admin-controlled, live). */}
        <div className="flex flex-col gap-1.5">
          {allItems.map(it => {
            const added = isAdded(it.name);
            const inStock = isItemInStock(it.name);
            return (
              <div key={it.name} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-colors"
                style={{
                  border:`1.5px solid ${added ? "#1a4a8a" : "var(--border)"}`,
                  background: added ? "#F5F9FF" : "var(--card)",
                  boxShadow: added ? "0 2px 8px rgba(26,74,138,0.10)" : "none",
                  opacity: inStock || added ? 1 : 0.45,
                }}>
                <GarmentThumb name={it.name} size={40} onOpen={n => onViewPhotos?.(n)}/>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 13, fontWeight: added ? 700 : 500, color: added ? DARK : "#111827", lineHeight: 1.3 }}>{it.name}</p>
                  {inStock || added
                    ? <p style={{ fontSize: 11, color: added ? "#1a4a8a" : "#9ca3af", fontWeight: added ? 600 : 400 }}>From {inr(it.basePrice)}/pc</p>
                    : <p style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>Out of stock — back soon</p>}
                </div>
                {added ? (
                  armRemove === `${cat}-${lineGender ?? ""}-${it.name}` ? (
                    <button onClick={() => { onChange(cart.filter(l => !sameLine(l, it.name))); setArmRemove(null); }}
                      className="px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ background:"#fef2f2", border:"1px solid #fecaca", color:"#dc2626", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                      Remove?
                    </button>
                  ) : (
                    <button onClick={() => setArmRemove(`${cat}-${lineGender ?? ""}-${it.name}`)}
                      title="Tap to remove this garment"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ background:"#EFF6FF", border:"none", color:"#1a4a8a", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                      <Check size={12}/> Added <X size={11} style={{ opacity: 0.6 }}/>
                    </button>
                  )
                ) : (
                  <button onClick={() => inStock && addGarment(it)} disabled={!inStock} className="flex items-center gap-1 px-3 py-1.5 rounded-full flex-shrink-0" style={{ border:"1px solid #1a4a8a", background:"var(--card)", color:"#1a4a8a", cursor: inStock ? "pointer" : "not-allowed", fontSize:12, fontWeight:600 }}><Plus size={13}/> Add</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Page 2: configure each garment ─────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-foreground" style={{ fontSize: 13, fontWeight: 700 }}>Your garments ({cart.length})</p>
        <button onClick={() => onViewChange("add")} className="flex items-center gap-1 px-3 py-1.5 rounded-full" style={{ border:"1.5px dashed #1a4a8a", background:"#F5F9FF", color:"#1a4a8a", cursor:"pointer", fontSize:12, fontWeight:600 }}>
          <Plus size={13}/> Add more
        </button>
      </div>
      <p className="text-muted-foreground mb-3" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
        Tap a garment to set its style, fabric, colours, quantity (min {ORG_GARMENT_MOQ}) and sizes. Each garment is independent.
      </p>

      <div className="flex flex-col gap-2">
        {cart.map(l => {
          const open = openId === l.id;
          const mo = materialOptionsForGarment(l.name);
          const rate = garmentPriceForFabric({ categoryId: l.categoryId, name: l.name, basePrice: l.basePrice, style: l.style }, l.material.fabric, l.material.weave, fabricSource, l.material.gsm, "B2B");
          const allocated = orgLineAllocated(l);
          const sizeDone = allocated === l.qty;
          const catLabel = garmentCatalog.find(c => c.id === l.categoryId)?.label ?? "";
          return (
            <div key={l.id} className="rounded-xl overflow-hidden transition-colors"
              style={{
                border:`1.5px solid ${open ? "#1a4a8a" : "var(--border)"}`,
                boxShadow: open ? "0 3px 12px rgba(26,74,138,0.12)" : "0 1px 3px rgba(13,13,13,0.04)",
              }}>
              {/* Card header */}
              <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ background: open ? "#F5F9FF" : "var(--muted)" }}>
                <button onClick={() => setOpenId(open ? null : l.id)} className="flex-1 min-w-0 flex items-center gap-2.5 text-left" style={{ background:"none", border:"none", padding:0, cursor:"pointer" }}>
                  <GarmentThumb name={l.name} size={36} onOpen={n => onViewPhotos?.(n)}/>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 700, color: DARK, lineHeight: 1.3 }}>{l.name} · {orgAudienceLabel(l.categoryId, l.gender)}</p>
                    <p style={{ fontSize: 11, color: sizeDone ? "#1a4a8a" : "#c2410c", fontWeight: 600 }}>
                      {l.style ? `${l.style} · ` : ""}{l.qty} pcs · {l.colors.length} colour{l.colors.length !== 1 ? "s" : ""}
                      {!sizeDone ? " · sizes pending" : " ✓"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {l.colors.slice(0, 5).map((c, i) => <span key={c.hex + i} className="w-4 h-4 rounded-full" style={{ background: c.hex, border:"1px solid rgba(0,0,0,0.15)" }}/>)}
                    <ChevronDown size={15} className="text-muted-foreground" style={{ transform: open ? "rotate(180deg)" : "none", transition:"transform 0.2s" }}/>
                  </div>
                </button>
                <button onClick={() => removeLine(l.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af", flexShrink:0 }}><X size={15}/></button>
              </div>

              {open && (
                <div className="px-3.5 py-3 flex flex-col gap-3 bg-card">
                  {/* Style */}
                  {garmentStyleOptions(l.name).length > 0 && (
                    <div>
                      <p className="text-muted-foreground mb-1" style={{ fontSize: 11.5, fontWeight: 500 }}>Style</p>
                      <SelectField options={garmentStyleOptions(l.name)} value={l.style ?? garmentStyleOptions(l.name)[0]} onChange={v => updateLine(l.id, { style: v })}/>
                    </div>
                  )}

                  {/* Material */}
                  <div>
                    <p className="text-muted-foreground mb-1" style={{ fontSize: 11.5, fontWeight: 500 }}>Fabric</p>
                    <div className="mb-2"><SelectField options={mo.fabricOptions} value={mo.fabricOptions.includes(l.material.fabric) ? l.material.fabric : mo.fabricOptions[0]} onChange={v => updateLine(l.id, { material: { ...l.material, fabric: v } })}/></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-muted-foreground mb-1" style={{ fontSize: 11.5 }}>GSM weight</p>
                        <SelectField options={mo.gsmOptions} value={mo.gsmOptions.includes(l.material.gsm) ? l.material.gsm : mo.gsmOptions[0]} onChange={v => updateLine(l.id, { material: { ...l.material, gsm: v } })}/>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1" style={{ fontSize: 11.5 }}>Weave</p>
                        <SelectField options={mo.weaveOptions} value={mo.weaveOptions.includes(l.material.weave) ? l.material.weave : mo.weaveOptions[0]} onChange={v => updateLine(l.id, { material: { ...l.material, weave: v } })}/>
                      </div>
                    </div>
                    <p className="text-right mt-1" style={{ fontSize: 11, color:"#1a4a8a", fontWeight: 600 }}>{inr(rate)}/pc · subtotal {inr(rate * l.qty)}</p>
                  </div>

                  {/* Brand / Pantone colours */}
                  <div>
                    <p className="text-muted-foreground mb-1" style={{ fontSize: 11.5, fontWeight: 500 }}>Brand colours</p>
                    <ColorSection key={`col-${l.id}`} initial={l.colors} onStateChange={cols => updateLine(l.id, { colors: cols })}/>
                  </div>

                  {/* Quantity (min 100) */}
                  <div>
                    <p className="text-muted-foreground mb-1" style={{ fontSize: 11.5, fontWeight: 500 }}>Quantity · min {ORG_GARMENT_MOQ}</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setLineQty(l.id, l.qty - ORG_GARMENT_STEP)} className="w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center" style={{ cursor:"pointer" }}><Minus size={13}/></button>
                      <input type="text" inputMode="numeric" pattern="[0-9]*" value={l.qty}
                        onChange={e => setLineQty(l.id, parseInt(digitsOnly(e.target.value)) || ORG_GARMENT_MOQ)}
                        onFocus={selectAllOnFocus} onClick={selectAllOnFocus} onMouseUp={preventSelectionCollapse}
                        className="text-center bg-card border border-border rounded-lg" style={{ width: 72, fontSize: 13, fontWeight: 700, outline:"none", padding:"6px 4px" }}/>
                      <button onClick={() => setLineQty(l.id, l.qty + ORG_GARMENT_STEP)} className="w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center" style={{ cursor:"pointer" }}><Plus size={13}/></button>
                      <span className="text-muted-foreground" style={{ fontSize: 11 }}>pcs</span>
                    </div>
                  </div>

                  {/* Size distribution for this garment (chart fixed to this garment's audience) */}
                  <div>
                    <p className="text-muted-foreground mb-1" style={{ fontSize: 11.5, fontWeight: 500 }}>Size distribution — {catLabel}{l.gender ? ` (${l.gender === "boy" ? "Boys" : "Girls"})` : ""}</p>
                    <SizeSection key={`size-${l.id}`} totalQty={l.qty} defaultCat={l.sizeCat} step={ORG_GARMENT_STEP} hideCategory
                      initialCat={l.sizeCat} initialQtys={l.sizes}
                      onStateChange={s => updateLine(l.id, { sizes: s.qtys, sizeCat: s.cat })}/>
                    <p className="mt-1" style={{ fontSize: 11, fontWeight: 600, color: sizeDone ? "#059669" : "#dc2626" }}>
                      {allocated} of {l.qty} pcs assigned{sizeDone ? " ✓" : ""}
                    </p>
                  </div>

                  {/* Stitching & packaging — set per garment, right below its size split */}
                  <div className="pt-1 border-t border-border">
                    <p className="text-foreground mt-2 mb-1.5 flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700 }}>
                      <Package size={13} style={{ color: ACCENT }}/> Stitching & packaging for this {l.name}
                    </p>
                    <PackagingSection key={`pack-${l.id}`} initial={l.packaging}
                      onStateChange={s => updateLine(l.id, { packaging: s })}/>
                  </div>

                  {/* Reference & sample — also per garment, so it's obvious which logo/sample goes with which product */}
                  <div className="pt-1 border-t border-border">
                    <p className="text-foreground mt-2 mb-1.5 flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700 }}>
                      <ImageIcon size={13} style={{ color: ACCENT }}/> Reference & sample for this {l.name}
                    </p>
                    <RefImagesSection key={`ref-${l.id}`} persona="organisation"
                      initialChosen={l.refChosen} previewMaterial={l.material.fabric}
                      onStateChange={s => updateLine(l.id, { refChosen: s.chosen, refLogoNames: s.logoNames, refInspNames: s.inspNames, refFiles: s.files })}/>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalPcs > 0 && (
        <div className="mt-3 flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background:"#EFF6FF", border:"1px solid #BFDBFE" }}>
          <span style={{ fontSize: 12, color:"#1a4a8a", fontWeight: 600 }}>{cart.length} garment{cart.length !== 1 ? "s" : ""} · {totalPcs} pcs total</span>
          <Check size={14} style={{ color:"#1a4a8a", flexShrink:0 }}/>
        </div>
      )}
    </div>
  );
}

// ─── Packaging Section ────────────────────────────────────────────────────────

function PackagingSection({ onStateChange, initial }: { onStateChange?: (s: { stitch: string; packing: string }) => void; initial?: { stitch: string; packing: string } }) {
  const [stitch, setStitch] = useState(initial?.stitch ?? "single_needle");
  const [packing, setPacking] = useState(initial?.packing ?? "bulk_loose");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onStateChange?.({ stitch, packing }); }, [stitch, packing]);
  const selStitch = stitchingOpts.find(s => s.id === stitch);
  const selPack   = packagingOpts.find(p => p.id === packing);
  return (
    <div>
      <p className="text-muted-foreground mb-2" style={{ fontSize: 12, fontWeight: 500 }}>Stitching type</p>
      {stitchingOpts.map(o => <RadioRow key={o.id} label={o.label} sub={o.sub} cost={o.cost} selected={stitch===o.id} onSelect={() => setStitch(o.id)}/>)}
      <p className="text-muted-foreground mb-2 mt-4" style={{ fontSize: 12, fontWeight: 500 }}>Packaging type</p>
      {packagingOpts.map(o => <RadioRow key={o.id} label={o.label} sub={o.sub} cost={o.cost} selected={packing===o.id} onSelect={() => setPacking(o.id)}/>)}
      {(selStitch?.cost || selPack?.cost) && (
        <div className="flex gap-1.5 px-3 py-2.5 rounded-xl mt-2" style={{ background: ACCENT_BG, border: `0.5px solid ${ACCENT}` }}>
          <Info size={12} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }}/>
          <p style={{ fontSize: 11, color: "#7c5419", lineHeight: 1.5 }}>
            Finishing add-ons: {[selStitch?.cost, selPack?.cost].filter(Boolean).join(" + ")} per piece. Final cost confirmed in your quote.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Ref Images Section ───────────────────────────────────────────────────────

let imgId = 0;
// ─── Live mockup preview (Individual flow) ────────────────────────────────────
// Flat garment silhouette tinted to the chosen colour, with the uploaded design
// composited at a chosen placement. Deterministic, instant, no external API.
type PreviewLine = { name: string; colorHex: string; colorLabel: string };
const PREVIEW_PLACEMENTS: { id: string; label: string; view: "front" | "back"; x: number; y: number; w: number; h: number }[] = [
  { id: "left_chest",   label: "Left chest",   view: "front", x: 116, y: 86,  w: 30, h: 30 },
  { id: "center_front", label: "Front centre", view: "front", x: 82,  y: 98,  w: 56, h: 66 },
  { id: "right_sleeve", label: "Right sleeve", view: "front", x: 28,  y: 74,  w: 26, h: 24 },
  { id: "center_back",  label: "Back centre",  view: "back",  x: 78,  y: 80,  w: 64, h: 74 },
];

// Quick perceived-brightness check — picks a readable icon colour on any swatch.
function isLightHex(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

// ── Silhouette per garment family — a polo gets its collar, a hoodie its hood ──
type PreviewShape = "tee" | "polo" | "shirt" | "hoodie" | "dress" | "pants" | "saree";
function previewShapeFor(name: string): PreviewShape {
  const n = name.toLowerCase();
  if (/saree|dupatta|stole|shawl|scarf/.test(n)) return "saree";
  if (/polo/.test(n)) return "polo";
  if (/t-shirt|tshirt|\btee\b|oversized|\btop\b|tops/.test(n)) return "tee";
  if (/hoodie|sweatshirt|sweater/.test(n)) return "hoodie";
  if (/shirt|blouse|kurta|kurti|jacket|blazer|waistcoat|coat/.test(n)) return "shirt";
  if (/dress|frock|gown|maxi|lehenga|skirt|onesie|romper|churidar|salwar|tunic/.test(n)) return "dress";
  if (/jean|chino|jogger|legging|palazzo|trouser|pant|short|pyjama|track/.test(n)) return "pants";
  return "tee";
}
// Placement options differ per family — pants have thighs and pockets, not chests.
const PLACEMENTS_BY_SHAPE: Record<PreviewShape, typeof PREVIEW_PLACEMENTS> = {
  tee:   PREVIEW_PLACEMENTS,
  polo:  PREVIEW_PLACEMENTS,
  shirt: PREVIEW_PLACEMENTS,
  hoodie: [
    { id: "left_chest",   label: "Left chest",   view: "front", x: 114, y: 88,  w: 28, h: 28 },
    { id: "front_centre", label: "Front centre", view: "front", x: 82,  y: 94,  w: 56, h: 46 },
    { id: "right_sleeve", label: "Right sleeve", view: "front", x: 26,  y: 78,  w: 26, h: 24 },
    { id: "hood_back",    label: "Hood (back)",  view: "back",  x: 82,  y: 18,  w: 36, h: 26 },
  ],
  dress: [
    { id: "chest",        label: "Chest",        view: "front", x: 82, y: 56,  w: 36, h: 28 },
    { id: "front_centre", label: "Front centre", view: "front", x: 78, y: 100, w: 44, h: 52 },
    { id: "hem",          label: "Hem border",   view: "front", x: 78, y: 166, w: 44, h: 26 },
    { id: "back_centre",  label: "Back centre",  view: "back",  x: 78, y: 80,  w: 44, h: 52 },
  ],
  pants: [
    { id: "right_thigh", label: "Right thigh",  view: "front", x: 70,  y: 104, w: 24, h: 28 },
    { id: "left_thigh",  label: "Left thigh",   view: "front", x: 106, y: 104, w: 24, h: 28 },
    { id: "hip",         label: "Hip / pocket", view: "front", x: 108, y: 56,  w: 22, h: 20 },
    { id: "back_pocket", label: "Back pocket",  view: "back",  x: 72,  y: 58,  w: 22, h: 20 },
  ],
  saree: [], // drape — free drag only, no named spots
};

const PREVIEW_SHAPES: Record<PreviewShape, string> = {
  tee:    "M82,30 Q100,23 118,30 L142,38 L166,64 L154,86 L134,76 C137,120 137,164 134,206 Q100,212 66,206 C63,164 63,120 66,76 L46,86 L34,64 L58,38 Z",
  polo:   "M82,30 Q100,23 118,30 L142,38 L166,64 L154,86 L134,76 C137,120 137,164 134,206 Q100,212 66,206 C63,164 63,120 66,76 L46,86 L34,64 L58,38 Z",
  shirt:  "M82,30 Q100,23 118,30 L142,38 L166,64 L154,86 L134,76 C137,120 137,164 134,206 Q100,212 66,206 C63,164 63,120 66,76 L46,86 L34,64 L58,38 Z",
  hoodie: "M78,32 Q100,25 122,32 L148,42 L172,70 L157,92 L138,82 C140,118 140,155 138,188 Q100,196 62,188 C60,155 60,118 62,82 L43,92 L28,70 L52,42 Z",
  dress:  "M82,30 Q100,23 118,30 L142,38 L164,62 L152,84 L133,75 C140,120 152,168 156,206 Q100,216 44,206 C48,168 60,120 67,75 L48,84 L36,62 L58,38 Z",
  pants:  "M70,40 L130,40 L134,60 L129,206 Q120,211 111,207 L103,96 L97,96 L89,207 Q80,211 71,206 L66,60 Z",
  saree:  "M70,26 Q100,19 130,26 L133,198 Q100,210 67,198 Z",
};
// Family-specific detailing drawn over the shaded body (collars, plackets, hoods…).
function previewShapeDetails(shape: PreviewShape, view: "front" | "back", colorHex: string) {
  switch (shape) {
    case "polo": return (
      <>
        <path d="M82,30 Q100,25 118,30 L114,35 Q100,30 86,35 Z" fill="rgba(0,0,0,0.14)"/>
        <path d="M86,32 L95,47 L100,38 Z" fill="rgba(0,0,0,0.22)"/>
        <path d="M114,32 L105,47 L100,38 Z" fill="rgba(0,0,0,0.22)"/>
        <rect x="97.6" y="38" width="4.8" height="21" rx="1.6" fill="rgba(0,0,0,0.10)"/>
        <circle cx="100" cy="45" r="1.3" fill="rgba(255,255,255,0.65)"/>
        <circle cx="100" cy="52" r="1.3" fill="rgba(255,255,255,0.65)"/>
      </>
    );
    case "shirt": return (
      <>
        <path d="M84,30 L93,45 L100,36 Z" fill="rgba(0,0,0,0.22)"/>
        <path d="M116,30 L107,45 L100,36 Z" fill="rgba(0,0,0,0.22)"/>
        <path d="M84,30 Q100,26 116,30 L113,33 Q100,29 87,33 Z" fill="rgba(0,0,0,0.14)"/>
        <line x1="100" y1="36" x2="100" y2="202" stroke="rgba(0,0,0,0.13)" strokeWidth="1"/>
        {[52, 76, 100, 124, 148, 172].map(y => (
          <circle key={y} cx="100" cy={y} r="1.4" fill="rgba(255,255,255,0.55)" stroke="rgba(0,0,0,0.2)" strokeWidth="0.4"/>
        ))}
        <path d="M74,88 h15 v13 l-7.5,4 l-7.5,-4 Z" fill="rgba(0,0,0,0.07)" stroke="rgba(0,0,0,0.14)" strokeWidth="0.8"/>
      </>
    );
    case "hoodie": return (
      <>
        {/* hood — sits behind the shoulders, opening shadow in front */}
        <path d="M78,34 Q76,13 100,11 Q124,13 122,34 Q112,46 100,47 Q88,46 78,34 Z"
          fill={colorHex} stroke="rgba(0,0,0,0.24)" strokeWidth="1.2" style={{ transition: "fill .45s ease" }}/>
        <path d="M83,32 Q100,44 117,32 Q111,40 100,41 Q89,40 83,32 Z" fill="rgba(0,0,0,0.30)"/>
        <path d="M78,34 Q76,13 100,11 Q124,13 122,34" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.4"/>
        {/* drawstrings */}
        <path d="M94,45 q-2,10 0,17" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M106,45 q2,10 0,17" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="94" cy="63" r="1.5" fill="rgba(0,0,0,0.35)"/>
        <circle cx="106" cy="63" r="1.5" fill="rgba(0,0,0,0.35)"/>
        {/* kangaroo pocket */}
        <path d="M80,146 L120,146 L125,181 L75,181 Z" fill="rgba(0,0,0,0.07)" stroke="rgba(0,0,0,0.13)" strokeWidth="1"/>
        {/* ribbed hem band */}
        <path d="M62.4,182 Q100,190 137.6,182 L138,188 Q100,196 62,188 Z" fill="rgba(0,0,0,0.10)"/>
      </>
    );
    case "saree": return (
      <>
        {/* top fold over the hanger */}
        <path d="M70,26 Q100,18 130,26 L130,35 Q100,27 70,35 Z" fill="rgba(0,0,0,0.13)"/>
        {/* pleats falling down the drape */}
        <path d="M84,31 L81,199" stroke="rgba(0,0,0,0.11)" strokeWidth="1"/>
        <path d="M94,29 L93,203" stroke="rgba(0,0,0,0.09)" strokeWidth="1"/>
        <path d="M106,29 L107,203" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
        <path d="M116,31 L119,201" stroke="rgba(0,0,0,0.11)" strokeWidth="1"/>
        {/* zari border — gold band along the hem and edge */}
        <path d="M67.3,189 L132.7,189 L133,198 Q100,210 67,198 Z" fill="rgba(200,169,126,0.92)"/>
        <path d="M67.2,184 L132.8,184" stroke="rgba(200,169,126,0.75)" strokeWidth="1.6"/>
        <path d="M128,27 L131,188" stroke="rgba(200,169,126,0.85)" strokeWidth="2.4"/>
      </>
    );
    case "dress": return (
      <>
        <path d="M84,30 Q100,50 116,30 Q100,37 84,30 Z" fill="rgba(0,0,0,0.16)"/>
        <path d="M84,30 Q100,48 116,30" fill="none" stroke="rgba(255,255,255,0.26)" strokeWidth="1.5"/>
        <path d="M70,112 Q100,120 130,112" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1" strokeDasharray="3 2"/>
      </>
    );
    case "pants": return (
      <>
        <line x1="68" y1="49" x2="132" y2="49" stroke="rgba(0,0,0,0.18)" strokeWidth="1.2"/>
        <circle cx="100" cy="45" r="1.6" fill="rgba(255,255,255,0.6)" stroke="rgba(0,0,0,0.2)" strokeWidth="0.4"/>
        <path d="M100,50 L100,90" stroke="rgba(0,0,0,0.15)" strokeWidth="1" strokeDasharray="2.5 2"/>
        <path d="M72,53 Q82,67 89,56" fill="none" stroke="rgba(0,0,0,0.14)" strokeWidth="1"/>
        <path d="M128,53 Q118,67 111,56" fill="none" stroke="rgba(0,0,0,0.14)" strokeWidth="1"/>
      </>
    );
    default: return view === "front" ? (
      <>
        <path d="M82,30 Q100,48 118,30 Q100,36 82,30 Z" fill="rgba(0,0,0,0.16)"/>
        <path d="M82,30 Q100,46 118,30" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.6"/>
      </>
    ) : (
      <>
        <path d="M82,30 Q100,38 118,30 Q100,33 82,30 Z" fill="rgba(0,0,0,0.12)"/>
        <path d="M82,30 Q100,37 118,30" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.4"/>
      </>
    );
  }
}
function GarmentPreview({ lines, audience, designUrl, material }: { lines: PreviewLine[]; audience?: string; designUrl?: string; material?: string }) {
  const [mode, setMode] = useState<"preview" | "picture">("preview");
  const [ci, setCi] = useState(0);
  const [placement, setPlacement] = useState("left_chest");
  // Live picture (selfie try-on) state
  const selfieRef = useRef<HTMLInputElement>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [gen, setGen] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<string | null>(null);
  const [genMsg, setGenMsg] = useState("");
  function onSelfie(files: FileList | null) {
    const f = files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { setSelfie(reader.result as string); setResult(null); setGen("idle"); setGenMsg(""); };
    reader.readAsDataURL(f);
  }
  async function generate() {
    if (!selfie || !colour) return;
    setGen("loading"); setGenMsg("");
    try {
      const r = await tryonApi.generate({
        selfie, garment: colour.name, colour: colour.colorLabel, colourHex: colour.colorHex,
        material, designUrl, audience, placement: custom ? "chosen spot" : pl.label,
      });
      setResult(r.imageUrl); setGen("done");
    } catch (e: unknown) {
      setGen("error"); setGenMsg(e instanceof Error ? e.message : "Could not generate the try-on.");
    }
  }
  const colour = lines[ci] ?? lines[0];
  // Placement options follow the garment family (pants ≠ shirts ≠ dresses).
  const previewShape: PreviewShape = colour ? previewShapeFor(colour.name) : "tee";
  const placements = PLACEMENTS_BY_SHAPE[previewShape];
  const pl = placements.find(p => p.id === placement) ?? placements[0] ?? PREVIEW_PLACEMENTS[0];
  if (!colour) return null;
  const view = pl.view;
  // Hand-positioning: drag the design anywhere on the garment.
  const svgRef = useRef<SVGSVGElement>(null);
  const [custom, setCustom] = useState<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState(false);
  // Sarees are a drape, not a top — the design defaults to the centre of the panel.
  const isDrape = previewShape === "saree";
  const box = custom ? { x: custom.x, y: custom.y, w: 40, h: 40 }
    : isDrape ? { x: 80, y: 104, w: 40, h: 40 }
    : { x: pl.x, y: pl.y, w: pl.w, h: pl.h };
  function moveTo(e: React.PointerEvent) {
    const svg = svgRef.current; if (!svg) return;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 200;
    const py = ((e.clientY - r.top) / r.height) * 244;
    setCustom({ x: Math.min(150 - 40, Math.max(30, px - 20)), y: Math.min(196 - 40, Math.max(38, py - 20)) });
  }
  const fitLabel = audience === "kids" ? "Kids fit" : audience === "women" ? "Women's fit" : audience === "men" ? "Men's fit" : "Custom fit";
  // "Stitch-on" moment — plays once when a design first lands on the garment.
  const [stitchAnim, setStitchAnim] = useState(false);
  const prevDesign = useRef<string | undefined>(undefined);
  useEffect(() => {
    const was = prevDesign.current;
    prevDesign.current = designUrl;
    if (designUrl && !was) {
      setStitchAnim(true);
      const t = setTimeout(() => setStitchAnim(false), 1900);
      return () => clearTimeout(t);
    }
  }, [designUrl]);
  // Silhouette follows the garment family — tee, polo, shirt, hoodie, dress or pants.
  const shapeId = previewShape;
  const bodyPath = PREVIEW_SHAPES[shapeId];
  return (
    <div className="rounded-2xl border border-border bg-card p-3 mb-4">
      {/* Live picture (selfie try-on) removed — preview only. */}

      {mode === "preview" && (
      <>
      <div className="flex items-center justify-end mb-2">
        <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 600, background: "var(--muted)", color: "#6b7280" }}>{fitLabel} · live mockup</span>
      </div>

      {/* Studio-style product shot — hanging garment with real fabric shading */}
      <div className="rounded-xl mb-2.5 flex items-center justify-center relative overflow-hidden"
        style={{ background: "linear-gradient(180deg, #ECE9E1 0%, #F7F5EF 52%, #E5E1D6 100%)", padding: "8px 0 4px" }}>
        {/* soft studio vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 34%, rgba(255,255,255,0.55) 0%, transparent 62%)" }}/>
        <svg ref={svgRef} viewBox="0 0 200 244" width="184" height="224" role="img" aria-label={`${colour.name} in ${colour.colorLabel}, ${custom ? "custom position" : pl.label}`} style={{ touchAction: "none", position: "relative" }}>
          <defs>
            <clipPath id="fl-body"><path d={bodyPath}/></clipPath>
            <linearGradient id="fl-sideL" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#000" stopOpacity="0.18"/><stop offset="0.45" stopColor="#000" stopOpacity="0"/>
            </linearGradient>
            <linearGradient id="fl-sideR" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0" stopColor="#000" stopOpacity="0.15"/><stop offset="0.45" stopColor="#000" stopOpacity="0"/>
            </linearGradient>
            <radialGradient id="fl-chest" cx="0.5" cy="0.26" r="0.6">
              <stop offset="0" stopColor="#fff" stopOpacity="0.20"/><stop offset="1" stopColor="#fff" stopOpacity="0"/>
            </radialGradient>
            <pattern id="fl-knit" width="4" height="4" patternUnits="userSpaceOnUse">
              <path d="M0 4 L4 0" stroke="rgba(0,0,0,0.045)" strokeWidth="0.7"/>
            </pattern>
            <linearGradient id="fl-sheenGrad" x1="0" y1="0" x2="1" y2="0.35">
              <stop offset="0" stopColor="#fff" stopOpacity="0"/>
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.16"/>
              <stop offset="1" stopColor="#fff" stopOpacity="0"/>
            </linearGradient>
            <filter id="fl-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6"/></filter>
          </defs>

          {/* clothes rail */}
          <line x1="16" y1="7" x2="184" y2="7" stroke="rgba(0,0,0,0.20)" strokeWidth="3" strokeLinecap="round"/>

          {/* floor shadow (static — the garment sways above it) */}
          <ellipse cx="100" cy="228" rx="54" ry="7" fill="rgba(0,0,0,0.13)" filter="url(#fl-soft)"/>

          {/* Everything below sways gently on the hanger */}
          <g className="magic-anim" style={{ animation: "flSwing 6s ease-in-out infinite", transformOrigin: "100px 8px" }}>

            {/* wooden hanger */}
            <path d="M100 22 Q93 22 93 15.5 Q93 10 98 10 Q102 10 102 13.5" fill="none" stroke="#8A7250" strokeWidth="2.2" strokeLinecap="round"/>
            <path d="M100 22 L60 37 M100 22 L140 37" stroke="#A98E63" strokeWidth="4" strokeLinecap="round"/>

            {/* garment body — colour crossfades when you switch swatches */}
            <path d={bodyPath} fill={colour.colorHex} stroke="rgba(0,0,0,0.24)" strokeWidth="1.2" style={{ transition: "fill .45s ease" }}/>

            {/* fabric shading & texture — all clipped to the garment */}
            <g clipPath="url(#fl-body)">
              <rect x="28" y="18" width="144" height="210" fill="url(#fl-sideL)"/>
              <rect x="28" y="18" width="144" height="210" fill="url(#fl-sideR)"/>
              <rect x="28" y="18" width="144" height="210" fill="url(#fl-chest)"/>
              <rect x="28" y="18" width="144" height="210" fill="url(#fl-knit)"/>
              {/* soft drape folds */}
              <g filter="url(#fl-soft)" fill="none" strokeWidth="2.4">
                <path d="M80 116 q6 30 2 66" stroke="rgba(0,0,0,0.09)"/>
                <path d="M120 112 q-5 34 -1 70" stroke="rgba(0,0,0,0.09)"/>
                <path d="M101 148 q3 24 1 50" stroke="rgba(0,0,0,0.07)"/>
                <path d="M87 120 q4 28 1 60" stroke="rgba(255,255,255,0.09)"/>
                <path d="M113 118 q-3 30 0 62" stroke="rgba(255,255,255,0.08)"/>
              </g>
              {/* armhole seams */}
              <path d="M66,76 Q60,56 58,40" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.1"/>
              <path d="M134,76 Q140,56 142,40" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.1"/>
              {/* hem & sleeve stitching */}
              <path d="M68 201 L132 201" stroke="rgba(0,0,0,0.18)" strokeWidth="0.9" strokeDasharray="2.5 2"/>
              <path d="M44 82 L35 66" stroke="rgba(0,0,0,0.16)" strokeWidth="0.9" strokeDasharray="2.5 2"/>
              <path d="M156 82 L165 66" stroke="rgba(0,0,0,0.16)" strokeWidth="0.9" strokeDasharray="2.5 2"/>
              {/* light sheen sweeping across the fabric */}
              <rect x="-70" y="0" width="42" height="244" fill="url(#fl-sheenGrad)"
                className="magic-anim" style={{ animation: "flSheen 5.6s ease-in-out infinite" }}/>
            </g>

            {/* family-specific detailing — collar, placket, hood, waistband… */}
            {previewShapeDetails(shapeId, view, colour.colorHex)}

            {/* placement composite — draggable */}
            <g
              onPointerDown={e => { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); setDrag(true); moveTo(e); }}
              onPointerMove={e => { if (drag) moveTo(e); }}
              onPointerUp={() => setDrag(false)}
              onPointerCancel={() => setDrag(false)}
              style={{ cursor: drag ? "grabbing" : "grab" }}>
              {designUrl ? (
                <>
                  <clipPath id="fl-pz"><rect x={box.x} y={box.y} width={box.w} height={box.h} rx="3"/></clipPath>
                  <image href={designUrl} x={box.x} y={box.y} width={box.w} height={box.h} preserveAspectRatio="xMidYMid slice" clipPath="url(#fl-pz)"
                    opacity={drag ? 0.85 : 0.97}/>
                  <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="3" fill="none"
                    stroke={drag ? "#7c5419" : "rgba(0,0,0,0.18)"} strokeWidth="0.8" strokeDasharray={drag ? "3 2" : "none"}/>
                  {/* stitch-on moment — sewing dashes run around the design, sparkles pop */}
                  {stitchAnim && (
                    <>
                      <rect x={box.x - 2.5} y={box.y - 2.5} width={box.w + 5} height={box.h + 5} rx="5" fill="none"
                        stroke={ACCENT} strokeWidth="1.7" strokeDasharray="5 4" pathLength={64}
                        className="magic-anim" style={{ animation: "flStitch 1.5s ease forwards" }}/>
                      <circle cx={box.x + box.w + 6} cy={box.y - 5} r="2.4" fill={ACCENT} className="magic-anim" style={{ animation: "garmTwinkle .8s ease-in-out 2" }}/>
                      <circle cx={box.x - 6} cy={box.y + box.h + 5} r="2" fill={ACCENT} className="magic-anim" style={{ animation: "garmTwinkle .8s ease-in-out .3s 2" }}/>
                      <circle cx={box.x - 5} cy={box.y - 6} r="1.6" fill="#fff" className="magic-anim" style={{ animation: "garmTwinkle .8s ease-in-out .5s 2" }}/>
                    </>
                  )}
                </>
              ) : (
                <>
                  <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="5" fill="rgba(255,255,255,0.5)" stroke="#7c5419" strokeWidth="1" strokeDasharray="4 3"/>
                  <text x={box.x + box.w / 2} y={box.y + box.h / 2 - 3} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 9, fontWeight: 700 }} fill="#7c5419">+</text>
                  <text x={box.x + box.w / 2} y={box.y + box.h / 2 + 6} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 5.5, fontWeight: 600 }} fill="#7c5419">Your design</text>
                </>
              )}
            </g>
          </g>
        </svg>
        {/* fabric chip — grounds the mockup in the real material you chose */}
        {material && (
          <span className="absolute" style={{ left: 10, bottom: 8, padding: "3px 9px", borderRadius: 999, background: "rgba(255,255,255,0.85)", border: "1px solid rgba(0,0,0,0.08)", fontSize: 9.5, fontWeight: 700, color: "#6b7280", backdropFilter: "blur(3px)" }}>
            {material}
          </span>
        )}
      </div>

      {/* Order-line selector — every garment × colour in the order is one tap away,
          and the mockup reshapes to match (polo, hoodie, shirt, dress…) */}
      {/* Garment tiles — icon on a colour swatch, clearly different from the
          text-pill placement chips below */}
      {lines.length > 1 && (
        <>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Preview a garment
          </p>
          <div className="grid grid-cols-2 gap-1.5 mb-2.5">
            {lines.map((l, i) => {
              const on = i === ci;
              const lightBg = isLightHex(l.colorHex);
              return (
                <button key={l.name + l.colorHex + i} onClick={() => setCi(i)} title={`${l.name} · ${l.colorLabel}`}
                  className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-xl text-left"
                  style={{
                    border: `1.5px solid ${on ? ACCENT : "var(--border)"}`,
                    background: on ? ACCENT_BG : "var(--card)",
                    cursor: "pointer", transition: "background .2s, border-color .2s",
                  }}>
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: l.colorHex, border: "1px solid rgba(0,0,0,0.12)" }}>
                    <GarmentIcon name={l.name} size={19} color={lightBg ? "rgba(0,0,0,0.60)" : "rgba(255,255,255,0.92)"}/>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block" style={{ fontSize: 11.5, fontWeight: on ? 700 : 600, color: on ? "#7c5419" : DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
                    <span className="block" style={{ fontSize: 10, color: on ? ACCENT_TEXT : "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.colorLabel}</span>
                  </span>
                  {on && <Check size={13} strokeWidth={2.5} style={{ color: "#7c5419", flexShrink: 0 }}/>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Placement chips — options match the garment family (thighs for pants,
          hood for hoodies…); drapes like sarees offer free drag only */}
      {placements.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {placements.map(p => {
            const on = p.id === pl.id;
            return (
              <button key={p.id} onClick={() => { setPlacement(p.id); setCustom(null); }}
                className="px-2.5 py-1 rounded-full" style={{ fontSize: 11, fontWeight: on && !custom ? 600 : 500, background: on && !custom ? DARK : "var(--muted)", color: on && !custom ? "#fff" : "#6b7280", border: "none", cursor: "pointer" }}>
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground" style={{ fontSize: 10.5, lineHeight: 1.5 }}>
          {colour.name} · {colour.colorLabel} · {custom ? "Custom spot" : pl.label} · drag to move{designUrl ? "" : " — add your design above to see it here"}
        </p>
        {custom && <button onClick={() => setCustom(null)} style={{ background:"none", border:"none", color:"#7c5419", fontSize: 10.5, fontWeight: 600, cursor:"pointer", flexShrink:0 }}>Reset</button>}
      </div>
      </>
      )}

      {mode === "picture" && (
        <div>
          <p className="text-muted-foreground mb-2.5" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
            Upload a photo of yourself to see {colour.name} in {colour.colorLabel} on you.
          </p>
          {result ? (
            <div className="rounded-xl overflow-hidden mb-2.5 border border-border" style={{ background: "#F4F2EC" }}>
              <img src={result} alt="Your try-on" className="w-full" style={{ display: "block" }}/>
            </div>
          ) : selfie ? (
            <div className="rounded-xl overflow-hidden mb-2.5 relative border border-border" style={{ background: "#F4F2EC" }}>
              <img src={selfie} alt="Your photo" className="w-full" style={{ display: "block", maxHeight: 240, objectFit: "contain" }}/>
              <button onClick={() => { setSelfie(null); setResult(null); setGen("idle"); }} className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)", border: "none", cursor: "pointer" }}><X size={12} color="#fff"/></button>
            </div>
          ) : (
            <button onClick={() => selfieRef.current?.click()} className="w-full flex flex-col items-center gap-1 py-7 rounded-xl mb-2.5 border-dashed border-2 border-border bg-muted" style={{ cursor: "pointer" }}>
              <Camera size={18} className="text-muted-foreground"/>
              <span className="text-foreground" style={{ fontSize: 12.5, fontWeight: 500 }}>Take or upload a photo</span>
              <span className="text-muted-foreground" style={{ fontSize: 11 }}>Front-facing, good light works best</span>
            </button>
          )}
          <input ref={selfieRef} type="file" accept="image/*" capture="user" className="hidden" onChange={e => onSelfie(e.target.files)}/>

          {selfie && gen !== "done" && (
            <button onClick={generate} disabled={gen === "loading"} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl" style={{ background: gen === "loading" ? "#9ca3af" : DARK, color: "#fff", border: "none", cursor: gen === "loading" ? "default" : "pointer", fontSize: 13, fontWeight: 600 }}>
              {gen === "loading" ? <><Loader2 size={14} className="animate-spin"/> Generating…</> : <><Sparkles size={14}/> Generate try-on</>}
            </button>
          )}
          {gen === "done" && (
            <button onClick={() => { setResult(null); setGen("idle"); }} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl" style={{ background: "var(--muted)", color: DARK, border: "1px solid var(--border)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              <RotateCcw size={13}/> Try again
            </button>
          )}
          {gen === "error" && (
            <div className="mt-2 flex gap-1.5 px-2.5 py-2 rounded-xl bg-amber-50 border border-amber-200">
              <Info size={12} style={{ color: "#92400e", flexShrink: 0, marginTop: 1 }}/>
              <p style={{ fontSize: 11, color: "#92400e", lineHeight: 1.5 }}>{genMsg || "Could not generate the try-on right now."}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RefImagesSection({ persona, isAccessoryOrder = false, onStateChange, initialChosen, previewLines, previewAudience, previewMaterial }: { persona: Persona; isAccessoryOrder?: boolean; onStateChange?: (s: { chosen: RefOption | null; logoNames: string[]; inspNames: string[]; files?: { name: string; dataUrl: string }[] }) => void; initialChosen?: RefOption | null; previewLines?: PreviewLine[]; previewAudience?: string; previewMaterial?: string }) {
  const [chosen, setChosen] = useState<RefOption | null>(initialChosen ?? null);
  const [logoFiles, setLogoFiles] = useState<RefImg[]>([]);
  const [showDigiBanner, setShowDigiBanner] = useState(false);
  const [inspirationFiles, setInspirationFiles] = useState<RefImg[]>([]);
  const [showCourier, setShowCourier] = useState(false);
  const [showSwatchModal, setShowSwatchModal] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    onStateChange?.({
      chosen,
      logoNames: logoFiles.map(f => f.name),
      inspNames: inspirationFiles.map(f => f.name),
      files: [...logoFiles, ...inspirationFiles]
        .filter((f): f is RefImg & { dataUrl: string } => !!f.dataUrl)
        .map(f => ({ name: f.name, dataUrl: f.dataUrl })),
    });
  }, [chosen, logoFiles, inspirationFiles]);

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
    const file = files[0]; imgId++;
    const id = imgId;
    const needsDigi = file.size < 80_000;
    setLogoFiles([{ id, url: URL.createObjectURL(file), name: file.name, size: file.size, caption:"", tag:"logo", needsDigi, digiStatus: needsDigi ? "pending" : undefined }]);
    // Embed the actual file so it reaches the admin portal with the order.
    refFileToDataUrl(file).then(dataUrl => {
      if (dataUrl) setLogoFiles(p => p.map(f => (f.id === id ? { ...f, dataUrl } : f)));
    });
    if (needsDigi) setShowDigiBanner(true);
  }
  function processInspirationFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).slice(0, 4 - inspirationFiles.length).forEach(f => {
      imgId++;
      const id = imgId;
      setInspirationFiles(p => [...p, { id, url: URL.createObjectURL(f), name: f.name, size: f.size, caption:"", tag:"garment" }]);
      refFileToDataUrl(f).then(dataUrl => {
        if (dataUrl) setInspirationFiles(p => p.map(x => (x.id === id ? { ...x, dataUrl } : x)));
      });
    });
  }
  function acceptDigi() {
    setLogoFiles(p => p.map(f => ({ ...f, digiStatus: "processing" as DigiStatus })));
    setShowDigiBanner(false);
    setTimeout(() => setLogoFiles(p => p.map(f => ({ ...f, digiStatus: "done" as DigiStatus }))), 3000);
  }

  return (
    <div>
      {/* Upload comes FIRST — so it's clear you add your design, then watch it appear
          on the live mockup below. */}
      <p className="text-muted-foreground mb-3" style={{ fontSize: 12 }}>Add your design or logo — then see it live on your garment below.</p>
      <div className="flex flex-col gap-2">
        {refOptDefs.filter(opt => {
          if (isAccessoryOrder && (opt.id === "match_uniform" || opt.id === "swatch_box")) return false;
          // The "Share a style photo" (inspiration) option is removed for everyone.
          if (opt.id === "inspiration") return false;
          // Individuals don't have an existing uniform to match, and the swatch box is org-only.
          if (persona !== "organisation" && (opt.id === "swatch_box" || opt.id === "match_uniform")) return false;
          return true;
        }).map(opt => {
          const isChosen = chosen === opt.id;
          const isModal = opt.id === "match_uniform" || opt.id === "swatch_box";
          return (
            <div key={opt.id}>
              <button onClick={() => selectOption(opt.id)} className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-left transition-all" style={{ border: `1.5px solid ${isChosen ? DARK : "var(--border)"}`, background: "var(--card)", cursor:"pointer", borderRadius: isChosen && !isModal ? "16px 16px 0 0" : 16 }}>
                <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center" style={{ border: `2px solid ${isChosen ? DARK : "#d1d5db"}`, background: isChosen ? DARK : "var(--card)" }}>
                  {isChosen && <div className="w-2 h-2 rounded-full bg-white"/>}
                </div>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: isChosen ? "rgba(13,13,13,0.06)" : "var(--muted)" }}>
                  <opt.Icon size={16} strokeWidth={1.5} style={{ color: isChosen ? DARK : "#6b7280" }}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground" style={{ fontSize: 13, fontWeight: isChosen ? 700 : 500, lineHeight: 1.3 }}>{opt.label}</p>
                  <p className="text-muted-foreground" style={{ fontSize: 11, marginTop: 1, lineHeight: 1.4 }}>{opt.sub}</p>
                </div>
                {opt.badge && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${opt.badgeCls}`}>{opt.badge}</span>
                )}
              </button>

              {isChosen && !isModal && (
                <div className="rounded-b-2xl px-3.5 pb-3.5 pt-3" style={{ background:"#f7f9ff", border:`1.5px solid ${DARK}`, borderTop:"none" }}>
                  {opt.id === "upload_logo" && (
                    <div>
                      {logoFiles.length > 0 ? (
                        <div className="rounded-xl overflow-hidden relative mb-3 border border-border" style={{ height: 90 }}>
                          <img src={logoFiles[0].url} alt="Logo" className="w-full h-full object-cover"/>
                          {logoFiles[0].digiStatus === "processing" && (
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background:"rgba(13,13,13,0.6)" }}>
                              <div className="text-center"><Sparkles size={18} style={{ color: ACCENT, margin:"0 auto 3px" }}/><p style={{ fontSize: 11, color:"#fff" }}>Digitizing…</p></div>
                            </div>
                          )}
                          {logoFiles[0].digiStatus === "done" && (
                            <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700" style={{ fontWeight: 500 }}>
                              <CheckCircle2 size={9}/> Vector ready ✓
                            </div>
                          )}
                          <button onClick={() => { setLogoFiles([]); setShowDigiBanner(false); }} className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background:"rgba(0,0,0,0.55)", border:"none", cursor:"pointer" }}><X size={10} color="#fff"/></button>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <button onClick={() => logoCamRef.current?.click()} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs border border-border bg-card" style={{ cursor:"pointer" }}><Camera size={13}/> Take photo</button>
                            <button onClick={() => logoGalRef.current?.click()} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs border border-border bg-card" style={{ cursor:"pointer" }}><ImageIcon size={13}/> Gallery</button>
                          </div>
                          <button onClick={() => logoGalRef.current?.click()} className="w-full flex flex-col items-center gap-1 py-4 rounded-xl mb-2 border-dashed border-2 border-border bg-muted" style={{ cursor:"pointer" }}>
                            <Upload size={15} className="text-muted-foreground"/>
                            <span className="text-foreground" style={{ fontSize: 12, fontWeight: 500 }}>Drop or tap to upload</span>
                            <span className="text-muted-foreground" style={{ fontSize: 11 }}>JPG, PNG, PDF, AI — any quality</span>
                          </button>
                        </>
                      )}
                      {showDigiBanner && (
                        <div className="rounded-xl p-3" style={{ background: ACCENT_BG, border: `1px solid ${ACCENT}` }}>
                          <div className="flex gap-2 items-start">
                            <Wand2 size={13} style={{ color: ACCENT, marginTop: 1, flexShrink: 0 }}/>
                            <div className="flex-1">
                              <p style={{ fontSize: 12, fontWeight: 600, color:"#7c5419", marginBottom: 2 }}>Don't have a crisp logo file?</p>
                              <p style={{ fontSize: 11, color:"#92400e", lineHeight: 1.5 }}>Upload any photo — even blurry. Our team digitises it into a vector for free.</p>
                              <div className="flex gap-2 mt-2">
                                <button onClick={acceptDigi} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-foreground text-white" style={{ cursor:"pointer", fontWeight: 500 }}><Wand2 size={9}/> Digitise free</button>
                                <button onClick={() => setShowDigiBanner(false)} className="px-2.5 py-1 rounded-lg text-xs bg-muted text-muted-foreground" style={{ cursor:"pointer" }}>Keep as-is</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {!showDigiBanner && logoFiles.length === 0 && (
                        <div className="flex gap-1.5 px-2.5 py-2 rounded-lg" style={{ background: ACCENT_BG, border: `0.5px solid ${ACCENT}` }}>
                          <Info size={11} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }}/>
                          <p style={{ fontSize: 11, color:"#7c5419", lineHeight: 1.5 }}>Blurry photo? No problem — we'll trace it into a crisp vector for free.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {opt.id === "inspiration" && (
                    <div>
                      {inspirationFiles.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          {inspirationFiles.map(img => (
                            <div key={img.id} className="rounded-xl overflow-hidden relative border border-border" style={{ height: 80 }}>
                              <img src={img.url} alt="Inspiration" className="w-full h-full object-cover"/>
                              <button onClick={() => setInspirationFiles(p => p.filter(x => x.id !== img.id))} className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background:"rgba(0,0,0,0.55)", border:"none", cursor:"pointer" }}><X size={10} color="#fff"/></button>
                            </div>
                          ))}
                        </div>
                      )}
                      {inspirationFiles.length < 4 && (
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <button onClick={() => inspCamRef.current?.click()} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs border border-border bg-card" style={{ cursor:"pointer" }}><Camera size={13}/> Take photo</button>
                          <button onClick={() => inspGalRef.current?.click()} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs border border-dashed border-border bg-muted" style={{ cursor:"pointer" }}><ImageIcon size={13}/> Upload</button>
                        </div>
                      )}
                      <div className="flex gap-1.5 px-2.5 py-2 rounded-lg bg-muted border border-border">
                        <Info size={11} style={{ color:"#9ca3af", marginTop: 1, flexShrink: 0 }}/>
                        <p style={{ fontSize: 11, color:"#6b7280", lineHeight: 1.5 }}>Screenshot from Instagram, Pinterest, or WhatsApp — your coordinator will study the cut, colour, and feel.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Live mockup — sits below the upload so the "aha" lands right after uploading */}
      {persona !== "organisation" && previewLines && previewLines.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: ACCENT_BG }}>
              <Shirt size={13} strokeWidth={1.8} style={{ color: "#7c5419" }}/>
            </span>
            <p className="text-foreground" style={{ fontSize: 13, fontWeight: 700 }}>Live preview</p>
            {logoFiles[0]?.url && (
              <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 9.5, fontWeight: 700, background: "#ECFDF5", color: "#047857" }}>Design on ✓</span>
            )}
          </div>
          <GarmentPreview lines={previewLines} audience={previewAudience} designUrl={logoFiles[0]?.url} material={previewMaterial}/>
        </div>
      )}

      <input ref={logoCamRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => processLogoFiles(e.target.files)}/>
      <input ref={logoGalRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => processLogoFiles(e.target.files)}/>
      <input ref={inspCamRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => processInspirationFiles(e.target.files)}/>
      <input ref={inspGalRef} type="file" accept="image/*" multiple className="hidden" onChange={e => processInspirationFiles(e.target.files)}/>

      {showCourier && <CourierModal onClose={() => setShowCourier(false)}/>}
      {showSwatchModal && <SwatchModal onClose={() => setShowSwatchModal(false)}/>}
    </div>
  );
}

// ─── Persona Selector ─────────────────────────────────────────────────────────

function PersonaSelector({ onSelect }: { onSelect: (p: Persona) => void }) {
  return (
    <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4 min-h-0" style={{ scrollbarWidth:"none" }}>
      <p className="text-foreground mb-1" style={{ fontSize: 20, fontWeight: 700 }}>Place a new order</p>
      <p className="text-muted-foreground mb-6 text-sm">Choose the type of order to get started.</p>

      <div className="flex flex-col gap-3 mb-5">
        <button onClick={() => onSelect("organisation")} className="w-full text-left rounded-2xl overflow-hidden" style={{ border:`2px solid ${DARK}`, cursor:"pointer", background:"var(--card)" }}>
          <div className="px-4 py-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-50"><Building2 size={22} style={{ color:"#1d4ed8" }} strokeWidth={1.5}/></div>
              <div>
                <p className="text-foreground" style={{ fontSize: 17, fontWeight: 700 }}>Organisation Order</p>
                <p className="text-muted-foreground" style={{ fontSize: 12, marginTop: 1 }}>School · College · Corporate · Hospital & more</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["Bulk quantity","GSM & fabric specs","Logo digitisation","Courier sample pickup","Size distribution"].map(t => (
                <span key={t} className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">{t}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 bg-foreground">
            <span style={{ fontSize: 12, color:"rgba(255,255,255,0.7)" }}>Minimum 100 pcs · Bulk pricing</span>
            <ChevronRight size={15} color="rgba(255,255,255,0.6)" strokeWidth={1.5}/>
          </div>
        </button>

        <button onClick={() => onSelect("individual")} className="w-full text-left rounded-2xl overflow-hidden" style={{ border:`2px solid ${ACCENT}`, cursor:"pointer", background:"var(--card)" }}>
          <div className="px-4 py-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: ACCENT_BG }}><User size={22} style={{ color:"#7c5419" }} strokeWidth={1.5}/></div>
              <div>
                <p className="text-foreground" style={{ fontSize: 17, fontWeight: 700 }}>Custom Order</p>
                <p className="text-muted-foreground" style={{ fontSize: 12, marginTop: 1 }}>Parent · Student · Family · Friends · Personal</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["From 1 pc","Any garment type","Kids to adults","Style inspiration","Personal fit"].map(t => (
                <span key={t} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: ACCENT_BG, color:"#7c5419" }}>{t}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ background: ACCENT }}>
            <span style={{ fontSize: 12, color:"#fff" }}>No minimum · Fully personalised</span>
            <ChevronRight size={15} color="#fff" strokeWidth={1.5}/>
          </div>
        </button>
      </div>

      <div className="flex gap-2 px-3 py-2.5 rounded-xl" style={{ background: ACCENT_BG, border:`0.5px solid ${ACCENT}` }}>
        <Info size={13} style={{ color: ACCENT, marginTop: 1, flexShrink: 0 }}/>
        <p style={{ fontSize: 12, color:"#7c5419", lineHeight: 1.5 }}>
          Your coordinator is a real person — they'll review and confirm every detail before production begins.
        </p>
      </div>
    </div>
  );
}

// ─── Switch Confirm Modal ─────────────────────────────────────────────────────

function SwitchConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <Overlay onClose={onCancel} center>
      <div className="bg-background rounded-2xl p-5">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3"><User size={22} strokeWidth={1.5}/></div>
        <p className="text-foreground text-center mb-1.5" style={{ fontSize: 15, fontWeight: 700 }}>Making a personal purchase?</p>
        <p className="text-muted-foreground text-center text-xs mb-3">You are currently logged in as</p>
        <div className="px-3 py-2 rounded-xl text-center bg-blue-50 mb-3">
          <p className="text-blue-800 flex items-center justify-center gap-1.5" style={{ fontSize: 13, fontWeight: 600 }}><Building2 size={13}/> {currentUser.org}</p>
          <p className="text-muted-foreground" style={{ fontSize: 11, marginTop: 2 }}>Organisation account · Bulk ordering</p>
        </div>
        <p className="text-muted-foreground text-center text-xs mb-4 leading-relaxed">Individual orders are for personal use with smaller quantities.</p>
        <div className="flex flex-col gap-2">
          <button onClick={onConfirm} className="w-full py-2.5 rounded-xl text-sm bg-muted text-foreground border border-border" style={{ cursor:"pointer", fontWeight: 500 }}>Continue to Individual Order</button>
          <button onClick={onCancel} className="w-full py-2.5 rounded-xl text-sm bg-foreground text-white" style={{ cursor:"pointer", fontWeight: 500 }}>Back to Organisation Bulk Order</button>
        </div>
      </div>
    </Overlay>
  );
}

// ─── Org Details Form (Step 1 for Organisation) ───────────────────────────────

interface OrgDetails { type: OrgType; service: OrgService; isAccessoryOrder: boolean; accessoryQty: Record<string, number>; name: string; board: string; address: string; city: string; pin: string; contactName: string; contactPhone: string; contactEmail: string }

export interface OrderSummaryColor { hex: string; label: string; qty?: number }
export interface OrderAccessorySpec { name: string; qty: number; fields: { label: string; value: string }[]; notes: string }
export interface OrderSummaryDelivery { name: string; phone: string; email?: string; address: string; city: string; pin: string }

// One garment line as submitted — carries the full detail Track needs to show
// (e.g. "T-Shirt · Round neck · Black × 1" with its fabric and size split).
export interface OrderGarmentLine {
  name: string;
  style?: string;
  colorLabel: string;
  colorHex: string;
  gender?: "boy" | "girl";
  audience?: string;
  qty: number;
  fabric?: string;
  gsm?: string;
  weave?: string;
  sizes: { size: string; qty: number }[];
  // Per-garment finishing & reference, for organisation orders (each product can differ).
  stitching?: string;
  packaging?: string;
  referenceMethod?: string;
  referenceFiles?: number;
}

// Display-ready price details, computed at submit so Track can render both flows cleanly:
// individuals pay a fixed price up front; organisations get an indicative estimate range.
export interface OrderPrice {
  kind: "fixed" | "estimate";
  rateLine: string;        // e.g. "₹350/pc × 2 pcs"
  addOnLine?: string;      // org only, e.g. "+₹8/pc"
  serviceFeeLine?: string; // e.g. "₹25 (5%)" — admin-configured service fee
  totalLabel: string;      // "Total paid" | "Estimated total"
  totalValue: string;      // "₹700" | "₹6,300 – ₹7,700"
  note?: string;
}

export interface SubmittedOrderSummary {
  id: string;
  name: string;
  isAccessoryOrder: boolean;
  serviceLabel?: string;
  accessoryItems?: { name: string; qty: number }[];
  totalPcs?: number;
  // ── Full order detail captured at submit (so Track shows real values) ──
  persona?: Persona;
  isUniform?: boolean;
  orderForLabel?: string;
  garmentLabel?: string;
  garmentLines?: OrderGarmentLine[];
  fabricSource?: string;
  fabric?: string;
  gsm?: string;
  weave?: string;
  colors?: OrderSummaryColor[];
  colorDesc?: string;
  qty?: number;
  sizeCatLabel?: string;
  sizeBreakdown?: { size: string; qty: number }[];
  stitching?: string;
  packaging?: string;
  referenceMethod?: string;
  referenceFiles?: number;
  // Actual uploaded design/logo reference files (base64) — sent with the
  // order so the admin team can download them from the portal.
  referenceAttachments?: { name: string; dataUrl: string }[];
  serviceFee?: number; // ₹ service fee included in the payable total
  paymentMethod?: string;
  price?: OrderPrice;
  delivery?: OrderSummaryDelivery;
  accessorySpecs?: OrderAccessorySpec[];
  // Full editable snapshot so the order can be reopened at the Review step (org, pre-production).
  editPayload?: DraftPayload;
}

// A saved-but-not-submitted order. The form builds the payload; App assigns id/createdAt.
// A full snapshot of the editable order state, so a draft can be reopened at Review.
export interface ResumeState {
  material: { fabric: string; gsm: string; weave: string };
  garmentMaterials?: Record<string, { fabric: string; gsm: string; weave: string }>;
  fabricSource: "fresh" | "surplus";
  orgColors: ColorEntry[];
  indivColors: { selected: string[]; desc: string; qtys?: Record<string, number> };
  selectedGarment?: SelectedGarment | null;
  garmentCart?: (SelectedGarment & { qty: number; colorHex?: string; colorLabel?: string; sizes?: Record<string, number>; gender?: "boy" | "girl" })[];
  orgCart?: OrgGarmentLine[];
  sizeState: { cat: SizeCat; qtys: Record<string, number> };
  packaging: { stitch: string; packing: string };
  refState: { chosen: RefOption | null; logoNames: string[]; inspNames: string[] };
  accSpecState: Record<string, Record<string, string>>;
  delivery: { name: string; phone: string; email: string; address: string; city: string; pin: string };
  payment: "upi" | "card";
  savedUpis?: string[];
  selectedUpi?: string;
  card?: { number: string; expiry: string; name: string };
  orgDraft: { name: string; board: string; address: string; city: string; pin: string; contactName: string; contactPhone: string; contactEmail: string };
  qty: number;
}

export interface DraftPayload {
  persona: Persona;
  title: string;
  subtitle: string;
  summary?: SubmittedOrderSummary;
  // For resuming the draft back into the editor:
  orgDetails?: OrgDetails | null;
  customDetails?: CustomOrderDetails | null;
  resume?: ResumeState;
}
export interface OrderDraft extends DraftPayload {
  id: string;
  createdAt: number;
}

function buildSubmittedOrderSummary(orgDetails: OrgDetails): SubmittedOrderSummary {
  const serviceLabel = orgServiceOptions[orgDetails.type].find(o => o.id === orgDetails.service)?.label ?? "Order";

  if (orgDetails.isAccessoryOrder) {
    const accessoryItems = Object.entries(orgDetails.accessoryQty)
      .filter(([, q]) => q > 0)
      .map(([key, qty]) => ({ name: parseAccessoryQtyKey(key).itemName, qty }));
    const totalPcs = accessoryItems.reduce((a, b) => a + b.qty, 0);
    const categoryIds = getAccessoryCategoriesFromQty(orgDetails.accessoryQty);
    const catLabels = categoryIds
      .map(id => universalAccessoryCategories.find(c => c.id === id)?.label)
      .filter(Boolean) as string[];
    const catSummary = catLabels.length > 0
      ? catLabels.slice(0, 2).join(", ") + (catLabels.length > 2 ? "…" : "")
      : "Accessories";

    return {
      // Placeholder until the backend assigns the real reference (FL-xxxx) —
      // Track swaps this for the server ref the moment the order syncs, so the
      // app and the admin portal always show the SAME order number.
      id: "FL-PENDING",
      name: `Accessories — ${catSummary} (${totalPcs} pcs)`,
      isAccessoryOrder: true,
      serviceLabel: "Accessories",
      accessoryItems,
      totalPcs,
    };
  }

  return {
    id: "FL-PENDING",
    name: `${serviceLabel} — Just submitted`,
    isAccessoryOrder: false,
    serviceLabel,
  };
}

// Custom org-type dropdown with per-option icons (native <select> can't render icons)
function OrgTypeSelect({ value, onChange }: { value: OrgType; onChange: (v: OrgType) => void }) {
  const [open, setOpen] = useState(false);
  const cur = orgTypeDefs.find(t => t.id === value)!;
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5"
        style={{ border:`1.5px solid ${DARK}`, background:"var(--card)", cursor:"pointer" }}>
        <div className="flex items-center justify-center flex-shrink-0" style={{ width:30, height:30, borderRadius:8, background:cur.iconBg }}>
          <cur.Icon size={16} strokeWidth={1.7} style={{ color:cur.iconColor }}/>
        </div>
        <span className="flex-1 text-left text-foreground text-sm" style={{ fontWeight:500 }}>{cur.label}</span>
        <ChevronDown size={16} style={{ color:DARK, transform: open ? "rotate(180deg)" : "none", transition:"transform .18s" }}/>
      </button>
      {/* In-flow expanding list — never clipped by the surrounding card */}
      {open && (
        <div className="mt-1.5 rounded-xl bg-card border border-border overflow-hidden" style={{ maxHeight:300, overflowY:"auto" }}>
          {orgTypeDefs.map((t, i) => {
            const sel = t.id === value;
            return (
              <button key={t.id} type="button" onClick={() => { onChange(t.id); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                style={{ background: sel ? ACCENT_BG : "transparent", border:"none", borderBottom: i < orgTypeDefs.length - 1 ? "1px solid var(--border)" : "none", cursor:"pointer" }}>
                <div className="flex items-center justify-center flex-shrink-0" style={{ width:30, height:30, borderRadius:8, background:t.iconBg }}>
                  <t.Icon size={16} strokeWidth={1.7} style={{ color:t.iconColor }}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm" style={{ fontWeight: sel ? 600 : 500 }}>{t.label}</p>
                  <p className="text-muted-foreground" style={{ fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.sub}</p>
                </div>
                {sel && <Check size={15} style={{ color:ACCENT, flexShrink:0 }} strokeWidth={2.5}/>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OrgDetailsForm({ onContinue, onBack, onCustomOrder, switchBanner, initialOrgType }: { onContinue: (d: OrgDetails) => void; onBack?: () => void; onCustomOrder?: () => void; switchBanner?: React.ReactNode; initialOrgType?: OrgType }) {
  const { isCategoryActive, isItemActive, isItemInStock, extraAccessoryCategories, extraItemsForCategory } = useCatalogAvailability({
    knownLabels: universalAccessoryCategories.map(c => c.label), audience: "B2B",
  });
  const ACCESSORY_MOQ = ORG_ACCESSORY_MOQ, ACCESSORY_STEP = ORG_ACCESSORY_STEP;
  // Organisation type is chosen once, during onboarding — it isn't re-asked or
  // switchable here. Falls back to the demo profile's org type if none was set.
  const [orgType]       = useState<OrgType>(initialOrgType ?? currentUser.orgType);
  const [service, setService]       = useState<OrgService>(orgServiceOptions[initialOrgType ?? currentUser.orgType][0].id);
  const [accessoryQty, setAccessoryQty] = useState<Record<string, number>>({});
  const [accessoryView, setAccessoryView] = useState<"categories"|"products">("categories");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  // For accessories, browse categories is a dedicated step after the selection step.
  const [formStep, setFormStep] = useState<"select"|"browse">("select");
  const [name, setName]             = useState(currentUser.org);
  const [board, setBoard]           = useState("");
  const [address, setAddress]       = useState("");
  const [city, setCity]             = useState("");
  const [pin, setPin]               = useState("");
  const [contactName, setContactName]   = useState(currentUser.name);
  const [contactPhone, setContactPhone] = useState(currentUser.phone);
  const [contactEmail, setContactEmail] = useState(currentUser.email);
  const [errors, setErrors]         = useState<string[]>([]);

  const cfg = orgCfg[orgType];
  const activeServiceOptions = orgServiceOptions[orgType];
  const selectedOpt = activeServiceOptions.find(o => o.id === service)!;
  const isAccessoryOrder = service === "accessories";
  const accessoryTotal = Object.values(accessoryQty).reduce((a, b) => a + b, 0);

  function selectService(id: OrgService) {
    setService(id);
    setAccessoryQty({});
    setAccessoryView("categories");
    setActiveCategoryId(null);
    setFormStep("select");
  }

  function openCategory(catId: string)  { setActiveCategoryId(catId); setAccessoryView("products"); }
  function closeCategory()               { setAccessoryView("categories"); setActiveCategoryId(null); }

  // MOQ-aware stepper: first tap jumps to the 100-pc minimum, then ±10; minus at 100 clears it.
  function stepAccessoryQty(key: string, delta: number) {
    setAccessoryQty(prev => {
      const cur = prev[key] ?? 0;
      let next: number;
      if (delta > 0) next = cur === 0 ? ACCESSORY_MOQ : cur + ACCESSORY_STEP;
      else           next = cur <= ACCESSORY_MOQ ? 0 : cur - ACCESSORY_STEP;
      return { ...prev, [key]: next };
    });
  }
  function clearAccessory(key: string) { setAccessoryQty(prev => ({ ...prev, [key]: 0 })); }

  // Derived accessory selection / validation
  const accessorySelected  = Object.entries(accessoryQty).filter(([, q]) => q > 0);
  const accessoryBelowMoq  = accessorySelected.some(([, q]) => q < ACCESSORY_MOQ);
  const accessoryValid     = !isAccessoryOrder || (accessorySelected.length > 0 && !accessoryBelowMoq);

  function handleContinue() {
    const errs: string[] = [];
    if (isAccessoryOrder) {
      if (accessorySelected.length === 0)   errs.push(`Add at least one accessory product (minimum ${ACCESSORY_MOQ} pcs each)`);
      else if (accessoryBelowMoq)           errs.push(`Each accessory product needs a minimum of ${ACCESSORY_MOQ} pcs`);
    }
    setErrors(errs);
    if (errs.length > 0) return;
    onContinue({ type: orgType, service, isAccessoryOrder, accessoryQty, name, board, address, city, pin, contactName, contactPhone, contactEmail });
  }

  // ─── Dedicated category product page (Accessories Category → Product Listing) ──
  const activeCat = activeCategoryId
    ? universalAccessoryCategories.find(c => c.id === activeCategoryId) ?? extraAccessoryCategories.find(c => c.id === activeCategoryId)
    : null;
  if (isAccessoryOrder && accessoryView === "products" && activeCat) {
    const catPcs   = countAccessoryQtyForCategory(activeCat.id, accessoryQty);
    const catCount = activeCat.items.filter(it => (accessoryQty[`${activeCat.id}-${it}`] ?? 0) > 0).length;
    return (
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border flex-shrink-0">
          <button onClick={closeCategory} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0" style={{ border:"none", cursor:"pointer" }}>
            <ChevronLeft size={16} strokeWidth={2}/>
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="flex items-center justify-center flex-shrink-0" style={{ width:36, height:36, borderRadius:10, background:ACCENT, color:"#fff" }}>
              <AccCatIcon id={activeCat.id} size={18}/>
            </div>
            <div className="min-w-0">
              <p className="text-foreground" style={{ fontSize:15, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{activeCat.label}</p>
              <p className="text-muted-foreground" style={{ fontSize:11 }}>{activeCat.items.length} products · min {ACCESSORY_MOQ} pcs each</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0" style={{ scrollbarWidth:"none" }}>
          {/* MOQ rule */}
          <div className="flex gap-2 px-3 py-2.5 rounded-xl mb-4" style={{ background:"#fff7ed", border:"1px solid #fed7aa" }}>
            <Info size={13} style={{ color:"#c2410c", flexShrink:0, marginTop:1 }}/>
            <p style={{ fontSize:11.5, color:"#9a3412", lineHeight:1.5 }}>
              <strong>Minimum order: {ACCESSORY_MOQ} pcs per product.</strong> Tap + to add a product at {ACCESSORY_MOQ} pcs, then adjust in steps of {ACCESSORY_STEP}.
            </p>
          </div>

          <p className="text-muted-foreground mb-2" style={{ fontSize:12, fontWeight:500 }}>{activeCat.label} products</p>
          <div className="flex flex-col gap-2">
            {[...activeCat.items.filter(isItemActive), ...(activeCat.id.startsWith("admin_") ? [] : extraItemsForCategory(activeCat.label, activeCat.items, "ACCESSORY").map(e => e.name))].map(item => {
              const key = `${activeCat.id}-${item}`;
              const q = accessoryQty[key] ?? 0;
              const active = q > 0;
              const inStock = isItemInStock(item);
              return (
                <div key={key} className="flex items-center gap-3 rounded-xl pl-3.5 pr-2 py-2.5"
                  style={{ border:`1px solid ${active ? ACCENT : "var(--border)"}`, background: active ? ACCENT_BG : "var(--card)", opacity: inStock || active ? 1 : 0.45 }}>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize:13, fontWeight: active ? 600 : 500, color: active ? "#7c5419" : DARK, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item}</p>
                    {inStock || active
                      ? <p style={{ fontSize:10.5, color: active ? ACCENT_TEXT : "#9ca3af", marginTop:1 }}>{inr(accessoryRatePerPc(activeCat.id, item))}/pc{active ? ` · ${q} pcs · ${inr(q * accessoryRatePerPc(activeCat.id, item))}` : ` · min ${ACCESSORY_MOQ}`}</p>
                      : <p style={{ fontSize:10.5, color:"#dc2626", fontWeight:600, marginTop:1 }}>Out of stock — back soon</p>}
                  </div>
                  <div className="flex items-center flex-shrink-0"
                    style={{ border:`1px solid ${active ? ACCENT : "var(--border)"}`, borderRadius:9, overflow:"hidden", background:"var(--card)" }}>
                    <button onClick={() => stepAccessoryQty(key, -1)} disabled={q === 0}
                      className="flex items-center justify-center" style={{ width:32, height:32, background:"transparent", border:"none", cursor: q === 0 ? "default" : "pointer", opacity: q === 0 ? 0.35 : 1 }}>
                      <Minus size={14} style={{ color: active ? "#7c5419" : "#6b7280" }}/>
                    </button>
                    <span style={{ fontSize:13, fontWeight:700, minWidth:42, textAlign:"center", color: active ? "#7c5419" : "#9ca3af", borderLeft:`1px solid ${active ? ACCENT : "var(--border)"}`, borderRight:`1px solid ${active ? ACCENT : "var(--border)"}`, lineHeight:"32px" }}>{q}</span>
                    <button onClick={() => inStock && stepAccessoryQty(key, 1)} disabled={!inStock}
                      className="flex items-center justify-center" style={{ width:32, height:32, background: active ? ACCENT : DARK, border:"none", cursor: inStock ? "pointer" : "not-allowed" }}>
                      <Plus size={14} style={{ color:"#fff" }}/>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-border bg-background">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-muted-foreground" style={{ fontSize:12 }}>
              {catPcs > 0 ? <><strong style={{ color:DARK }}>{catPcs} pcs</strong> · {catCount} product{catCount !== 1 ? "s" : ""}</> : "No products added yet"}
            </p>
            {catPcs > 0 && (
              <button onClick={() => activeCat.items.forEach(it => clearAccessory(`${activeCat.id}-${it}`))}
                style={{ fontSize:11, fontWeight:600, color:"#dc2626", background:"none", border:"none", cursor:"pointer" }}>Clear category</button>
            )}
          </div>
          <button onClick={closeCategory} style={btnPrimary}>
            <Check size={15} strokeWidth={2}/> Done · back to categories
          </button>
        </div>
      </div>
    );
  }

  // ─── Dedicated "Browse categories" step (accessories only) ──
  if (isAccessoryOrder && formStep === "browse") {
    return (
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border flex-shrink-0">
          <button onClick={() => setFormStep("select")} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0" style={{ border:"none", cursor:"pointer" }}>
            <ChevronLeft size={16} strokeWidth={2}/>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-foreground" style={{ fontSize:15, fontWeight:600 }}>Browse categories</p>
            <p className="text-muted-foreground" style={{ fontSize:11 }}>Choose products · min {ACCESSORY_MOQ} pcs each</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0" style={{ scrollbarWidth:"none" }}>
          {errors.length > 0 && (
            <div className="mb-3 rounded-xl px-3 py-2.5 bg-red-50 border border-red-200">
              {errors.map(e => <p key={e} className="flex items-center gap-1.5 text-xs text-red-600">• {e}</p>)}
            </div>
          )}
          {/* MOQ rule */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-4" style={{ background:"#fff7ed", border:"1px solid #fed7aa" }}>
            <Info size={13} style={{ color:"#c2410c", flexShrink:0 }}/>
            <p style={{ fontSize:11.5, color:"#9a3412" }}>Minimum order <strong>{ACCESSORY_MOQ} pcs per product</strong>. Tap a category to choose products.</p>
          </div>

          <div className="flex flex-col gap-2">
            {[...universalAccessoryCategories.filter(c => isCategoryActive(c.label)), ...extraAccessoryCategories].map(cat => {
              const catQty = countAccessoryQtyForCategory(cat.id, accessoryQty);
              const catItemCount = Object.entries(accessoryQty).filter(([key, q]) => q > 0 && parseAccessoryQtyKey(key).categoryId === cat.id).length;
              return (
                <button key={cat.id} onClick={() => openCategory(cat.id)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left"
                  style={{ border:`1.5px solid ${catQty > 0 ? ACCENT : "var(--border)"}`, background: catQty > 0 ? ACCENT_BG : "var(--card)", cursor:"pointer" }}>
                  <div className="flex items-center justify-center flex-shrink-0"
                    style={{ width:38, height:38, borderRadius:11, background: catQty > 0 ? ACCENT : "var(--muted)", border:`1px solid ${catQty > 0 ? ACCENT : "var(--border)"}`, color: catQty > 0 ? "#fff" : "#6b7280" }}>
                    <AccCatIcon id={cat.id} size={18}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize:13, fontWeight:600, color: catQty > 0 ? "#7c5419" : DARK }}>{cat.label}</p>
                    {catQty > 0
                      ? <p style={{ fontSize:11, color:ACCENT_TEXT, fontWeight:600, marginTop:1 }}>{catQty} pcs · {catItemCount} product{catItemCount !== 1 ? "s" : ""}</p>
                      : <p style={{ fontSize:11, color:"#9ca3af", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cat.sub}</p>}
                  </div>
                  <ChevronRight size={16} style={{ color:"#9ca3af", flexShrink:0 }}/>
                </button>
              );
            })}
          </div>

          {accessorySelected.length > 0 && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background:"#ecfdf5", border:"1px solid #a7f3d0" }}>
              <Check size={12} style={{ color:"#059669", flexShrink:0 }} strokeWidth={2.5}/>
              <p style={{ fontSize:11, color:"#065f46", fontWeight:500 }}>{accessoryTotal} pcs across {accessorySelected.length} product{accessorySelected.length !== 1 ? "s" : ""} · {inr(accessoryOrderTotal(accessoryQty))} — ready to continue</p>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-border bg-background">
          <button onClick={handleContinue} disabled={!accessoryValid}
            style={{ ...(!accessoryValid ? btnPrimaryDisabled : btnPrimary), opacity: !accessoryValid ? 0.45 : 1 }}>
            Continue · Step 3: Specifications <ArrowRight size={15} strokeWidth={2}/>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="flex-1 overflow-y-auto px-5 pt-3 pb-4" style={{ scrollbarWidth:"none" }}>
        {switchBanner}

        {onBack && (
          <button onClick={onBack} className="flex items-center gap-1 mb-3 text-muted-foreground text-sm" style={{ background:"transparent", border:"none", cursor:"pointer" }}>
            <ChevronDown size={14} style={{ transform:"rotate(90deg)" }}/> Back
          </button>
        )}

        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center"><Building2 size={18} style={{ color:"#1d4ed8" }} strokeWidth={1.5}/></div>
          <div className="flex-1">
            <p className="text-foreground" style={{ fontSize: 17, fontWeight: 600 }}>Organisation order</p>
            <p className="text-muted-foreground" style={{ fontSize: 12 }}>Choose what you'd like to order</p>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="mb-3 rounded-xl px-3 py-2.5 bg-red-50 border border-red-200">
            {errors.map(e => <p key={e} className="flex items-center gap-1.5 text-xs text-red-600">• {e}</p>)}
          </div>
        )}

        {/* Organisation type is already known from onboarding (edit it from Account →
            Business details, not mid-order) — so instead of just repeating it back,
            this spot gives a useful, org-type-aware tip for this step. */}
        <TipBanner tipKey={`org-order-start-${orgType}`}>
          {orderStartTipByOrgType[orgType] ?? orderStartTipByOrgType.default}
        </TipBanner>

        <Section title="What would you like to order?" icon={Scissors}>
          <p className="text-muted-foreground mb-3" style={{ fontSize:12 }}>Pick items from <strong>any categories</strong> — bottles, ID cards, bags and more can go in one order.</p>
          <div className="flex flex-col gap-2">
            {activeServiceOptions.map(opt => {
              const isSelected = service === opt.id;
              const isAccOpt = opt.id === "accessories";
              return (
                <div key={opt.id} className="rounded-xl overflow-hidden" style={{ border:`1.5px solid ${isSelected ? DARK : "var(--border)"}`, background: isSelected ? "rgba(13,13,13,0.03)" : "var(--card)" }}>
                  <button onClick={() => selectService(opt.id)}
                    className="w-full flex items-center gap-3 px-3.5 py-3 text-left"
                    style={{ background:"transparent", border:"none", cursor:"pointer" }}>
                    <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center" style={{ border:`2px solid ${isSelected ? DARK : "#d1d5db"}`, background: isSelected ? DARK : "var(--card)" }}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white"/>}
                    </div>
                    <div className="flex-1">
                      <p className="text-foreground text-sm" style={{ fontWeight:600 }}>{opt.label}</p>
                      <p className="text-muted-foreground" style={{ fontSize:11, marginTop:1 }}>{opt.sub}</p>
                    </div>
                    {isAccOpt && (
                      <ChevronRight size={16} className="text-muted-foreground flex-shrink-0"/>
                    )}
                  </button>

                  {isSelected && isAccOpt && (
                    <div className="px-3.5 pb-3">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: ACCENT_BG, border:`1px solid ${ACCENT}` }}>
                        <Info size={12} style={{ color: ACCENT, flexShrink:0 }}/>
                        <p style={{ fontSize:11, color:"#7c5419" }}>Browse the full catalog &amp; choose products in the next step · min {ACCESSORY_MOQ} pcs per product</p>
                      </div>
                      {accessorySelected.length > 0 && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <Check size={12} style={{ color:"#059669", flexShrink:0 }} strokeWidth={2.5}/>
                          <p style={{ fontSize:11, color:"#059669", fontWeight:600 }}>{accessoryTotal} pcs across {accessorySelected.length} product{accessorySelected.length !== 1 ? "s" : ""} selected</p>
                        </div>
                      )}
                    </div>
                  )}

                  {isSelected && !isAccOpt && (
                    <div className="px-3.5 pb-3">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: ACCENT_BG, border:`1px solid ${ACCENT}` }}>
                        <Info size={12} style={{ color: ACCENT, flexShrink:0 }}/>
                        <p style={{ fontSize:11, color:"#7c5419" }}>Fabric, quantity & size distribution set in the next step</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Multi-order guidance */}
          <div className="mt-3 flex gap-2 px-3 py-2.5 rounded-xl bg-muted border border-border">
            <Info size={12} style={{ color:"#9ca3af", flexShrink:0, marginTop:1 }}/>
            <p style={{ fontSize:11, color:"#6b7280", lineHeight:1.55 }}>
              You'll choose the exact garments — and their styles — from the catalog in the next step. Ordering <strong>accessories</strong> too? Place a separate accessories order so each gets its own specs.
            </p>
          </div>
        </Section>

        <div className="rounded-2xl bg-muted border border-border p-3 mb-3">
          <p className="text-foreground text-sm" style={{ fontWeight:600 }}>Organisation details come last</p>
          <p className="text-muted-foreground mt-1" style={{ fontSize:12, lineHeight:1.55 }}>Name, contact and address are confirmed in a single screen at the end — after material, colour, stitching and references.</p>
        </div>
      </div>

      <div className="flex-shrink-0 px-5 py-3 border-t border-border bg-background" style={{ position:"sticky", bottom:0, zIndex:10 }}>
        <button
          id="coachmark-org-continue"
          onClick={() => { if (isAccessoryOrder) { setErrors([]); setFormStep("browse"); } else handleContinue(); }}
          style={btnPrimary}>
          {isAccessoryOrder ? "Continue · Choose products" : "Continue · Step 2: Order details"} <ArrowRight size={15} strokeWidth={2}/>
        </button>
      </div>
      <Coachmark storageKey="fl_coach_org_continue_done" targetId="coachmark-org-continue"
        title="Ready to continue" body="Pick what you're ordering above, then tap here to move to the next step — garments, quantities and details."/>
    </div>
  );
}

// ─── Custom Order Form (Individual / Step 1) ──────────────────────────────────

interface CustomOrderDetails { garmentType: GarmentType; groupType: GroupType; audience?: CustomAudience; name: string; phone: string; email: string; address: string; city: string; pin: string; isAccessoryOrder?: boolean; accessoryQty?: Record<string, number> }

// educationLevel lets a parent have Child 1 (School) and Child 2 (College) in one form
interface ChildInfo {
  id: number;
  educationLevel: "school" | "college";
  schoolName: string;
  grade: string;
  parentName: string;
  sizes: Record<string, number>;
  sizesOpen: boolean;
}
interface StudentInfo { id: number; institutionName: string; department: string }

// Mini size allocator rendered per child
// ─── Family Gender Breakdown (issue 8) ────────────────────────────────────────
// Shows Man / Woman / Children size distributions when family group is selected

const menSizes    = [{ label:"S",hint:'36"' },{ label:"M",hint:'38-40"' },{ label:"L",hint:'42-44"' },{ label:"XL",hint:'46"' },{ label:"XXL",hint:'48"' }];
const womenSizes  = [{ label:"XS",hint:"UK 6" },{ label:"S",hint:"UK 8" },{ label:"M",hint:"UK 10-12" },{ label:"L",hint:"UK 14" },{ label:"XL",hint:"UK 16" }];
const childSizes  = [{ label:"3-4Y",hint:"Age 3-4" },{ label:"5-6Y",hint:"Age 5-6" },{ label:"7-8Y",hint:"Age 7-8" },{ label:"9-10Y",hint:"Age 9-10" },{ label:"11-12Y",hint:"Age 11-12" }];

function FamilyGenderBreakdown({ onAllocationChange }: { onAllocationChange?: (n: number) => void }) {
  const [menQtys,   setMenQtys]   = useState<Record<string,number>>({});
  const [womenQtys, setWomenQtys] = useState<Record<string,number>>({});
  const [childQtys, setChildQtys] = useState<Record<string,number>>({});

  const totalM = Object.values(menQtys).reduce((a,b)=>a+b,0);
  const totalW = Object.values(womenQtys).reduce((a,b)=>a+b,0);
  const totalC = Object.values(childQtys).reduce((a,b)=>a+b,0);
  const grand  = totalM + totalW + totalC;

  useEffect(() => { onAllocationChange?.(grand); }, [grand]);

  function MiniRow({ label, hint, val, onSet }: { label:string; hint:string; val:number; onSet:(v:number)=>void }) {
    return (
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex-shrink-0" style={{ width:48 }}>
          <p className="text-foreground" style={{ fontSize:11, fontWeight:600 }}>{label}</p>
          {hint && <p className="text-muted-foreground" style={{ fontSize:9 }}>{hint}</p>}
        </div>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full" style={{ width: grand>0 ? `${Math.min((val/grand)*100,100)}%` : "0%", background:"#C8A97E" }}/>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onSet(Math.max(0, val-1))} className="w-5 h-5 rounded bg-muted border border-border flex items-center justify-center" style={{ fontSize:12, cursor:"pointer" }}>−</button>
          <span className="text-foreground text-center" style={{ width:22, fontSize:11, fontWeight:500 }}>{val}</span>
          <button onClick={() => onSet(val+1)} className="w-5 h-5 rounded bg-muted border border-border flex items-center justify-center" style={{ fontSize:12, cursor:"pointer" }}>+</button>
        </div>
      </div>
    );
  }

  const groups = [
    { label:"Men",      sizes:menSizes,   qtys:menQtys,   setQty:(l:string,v:number)=>setMenQtys(p=>({...p,[l]:v})),   total:totalM, color:"#3b82f6" },
    { label:"Women",    sizes:womenSizes, qtys:womenQtys, setQty:(l:string,v:number)=>setWomenQtys(p=>({...p,[l]:v})), total:totalW, color:"#ec4899" },
    { label:"Children", sizes:childSizes, qtys:childQtys, setQty:(l:string,v:number)=>setChildQtys(p=>({...p,[l]:v})), total:totalC, color:"#f59e0b" },
  ];

  return (
    <div className="mt-3">
      <p className="text-foreground text-xs mb-3" style={{ fontWeight:600 }}>
        Size distribution by family member type
        {grand > 0 && <span className="text-muted-foreground ml-2" style={{ fontWeight:400 }}>({grand} pcs total)</span>}
      </p>
      {groups.map(g => (
        <div key={g.label} className="rounded-xl overflow-hidden border border-border mb-2">
          <div className="px-3 py-2 flex items-center justify-between" style={{ background:`${g.color}12` }}>
            <p className="text-foreground" style={{ fontSize:12, fontWeight:600 }}>{g.label}</p>
            <span className="text-muted-foreground" style={{ fontSize:11 }}>{g.total} pcs</span>
          </div>
          <div className="px-3 py-2">
            {g.sizes.map(s => (
              <MiniRow key={s.label} label={s.label} hint={s.hint} val={g.qtys[s.label]??0} onSet={v => g.setQty(s.label,v)}/>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChildSizeSection({
  child, sizeCat, totalQty, onChange,
}: {
  child: ChildInfo; sizeCat: "school" | "college";
  totalQty: number; onChange: (sizes: Record<string, number>) => void;
}) {
  const sizes = sizeSets[sizeCat];
  const allocated = Object.values(child.sizes).reduce((a, b) => a + b, 0);

  function set(label: string, val: number) {
    onChange({ ...child.sizes, [label]: Math.max(0, val) });
  }

  return (
    <div className="mt-2 rounded-xl overflow-hidden border border-blue-100 bg-card">
      <div className="flex items-center justify-between px-3 py-2 bg-blue-50">
        <p style={{ fontSize: 11, fontWeight: 600, color:"#1a4a8a" }}>Size & quantity for this child</p>
        <span style={{ fontSize: 11, color:"#3b82f6" }}>{allocated} pcs allocated</span>
      </div>
      <div className="px-3 py-2 flex flex-col gap-1.5">
        {sizes.map(s => {
          const q = child.sizes[s.label] ?? 0;
          return (
            <div key={s.label} className="flex items-center gap-2">
              <div className="flex-shrink-0" style={{ width: 52 }}>
                <p className="text-foreground" style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</p>
                {s.hint && <p className="text-muted-foreground" style={{ fontSize: 9 }}>{s.hint}</p>}
              </div>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted">
                <div className="h-full rounded-full" style={{ width: totalQty > 0 ? `${Math.min((q/totalQty)*100, 100)}%` : "0%", background: "#C8A97E" }}/>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => set(s.label, q - 1)} className="w-6 h-6 rounded flex items-center justify-center bg-muted border border-border text-foreground" style={{ fontSize: 14, lineHeight: 1 }}>−</button>
                <span className="text-center text-foreground" style={{ width: 28, fontSize: 12, fontWeight: 500 }}>{q}</span>
                <button onClick={() => set(s.label, q + 1)} className="w-6 h-6 rounded flex items-center justify-center bg-muted border border-border text-foreground" style={{ fontSize: 14, lineHeight: 1 }}>+</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Geo Delivery Section ─────────────────────────────────────────────────────

function GeoDeliverySection({ address, city, pin, onAddressChange, onCityChange, onPinChange }: {
  address: string; city: string; pin: string;
  onAddressChange: (v: string) => void; onCityChange: (v: string) => void; onPinChange: (v: string) => void;
}) {
  const [loading, setLoading]         = useState(false);
  const [geoError, setGeoError]       = useState("");
  const [showMap, setShowMap]         = useState(false);
  const [coords, setCoords]           = useState<{ lat: number; lng: number } | null>(null);
  const [mapCoords, setMapCoords]     = useState<{ lat: number; lng: number } | null>(null);
  const [resolving, setResolving]     = useState(false);
  const [resolvedAddr, setResolvedAddr] = useState<{ address: string; city: string; pin: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Reverse-geocode a lat/lng via Nominatim
  async function reverseGeocode(lat: number, lng: number) {
    setResolving(true);
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
      setResolvedAddr({
        address: road || data.display_name?.split(",")[0] || "",
        city: cityVal,
        pin: postcode,
      });
    } catch {
      setResolvedAddr(null);
    }
    setResolving(false);
  }

  // Get device GPS → open map modal centred on it
  function handleUseLocation() {
    if (!navigator.geolocation) {
      setGeoError("Geolocation not supported by your browser.");
      return;
    }
    setLoading(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(pt);
        setMapCoords(pt);
        reverseGeocode(pt.lat, pt.lng);
        setShowMap(true);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        if (err.code === 1) setGeoError("Location access denied — please enable in browser settings.");
        else setGeoError("Could not get your location. Try again or fill manually.");
      },
      { timeout: 12000, enableHighAccuracy: true }
    );
  }

  // Confirm location from map modal → fill fields
  function confirmLocation() {
    if (resolvedAddr) {
      onAddressChange(resolvedAddr.address);
      onCityChange(resolvedAddr.city);
      onPinChange(resolvedAddr.pin);
    }
    setShowMap(false);
  }

  // Map iframe URL (re-centres when mapCoords changes)
  const mapSrc = mapCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${mapCoords.lng-0.008},${mapCoords.lat-0.008},${mapCoords.lng+0.008},${mapCoords.lat+0.008}&layer=mapnik&marker=${mapCoords.lat},${mapCoords.lng}`
    : "";

  return (
    <>
      {/* ── Map modal overlay ── */}
      {showMap && (
        <div className="absolute inset-0 z-50 flex flex-col" style={{ background:"var(--background)" }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
            <button onClick={() => setShowMap(false)}
              style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
              <ChevronLeft size={20} className="text-foreground"/>
            </button>
            <div className="flex-1">
              <p className="text-foreground" style={{ fontSize:15, fontWeight:700 }}>Choose delivery location</p>
              <p className="text-muted-foreground" style={{ fontSize:11 }}>Pin shows your detected spot — scroll to adjust</p>
            </div>
          </div>

          {/* Map (takes up ~55% of height) */}
          <div className="relative flex-shrink-0" style={{ height: 300 }}>
            <iframe
              ref={iframeRef}
              title="Delivery map"
              src={mapSrc}
              className="w-full h-full"
              style={{ border:"none" }}
            />
            {/* Fixed centre pin overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div style={{ position:"relative", marginBottom: 28 }}>
                <MapPin size={36} strokeWidth={2} style={{ color: DARK, filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.35))" }}/>
              </div>
            </div>
            {/* Re-centre button */}
            {coords && (
              <button
                onClick={() => { setMapCoords({ ...coords }); reverseGeocode(coords.lat, coords.lng); }}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                style={{ background:DARK, color:"#fff", border:"none", cursor:"pointer", fontSize:11, fontWeight:500 }}>
                <Navigation size={11}/> My location
              </button>
            )}
          </div>

          {/* Address preview panel */}
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
            <div className="rounded-2xl border border-border bg-card p-4 mb-3">
              <p className="text-muted-foreground mb-1" style={{ fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.06em" }}>Detected address</p>
              {resolving ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 size={14} style={{ animation:"spin 1s linear infinite", color: DARK }}/>
                  <p style={{ fontSize:13, color:"var(--muted-foreground)" }}>Locating address…</p>
                </div>
              ) : resolvedAddr ? (
                <>
                  <p className="text-foreground" style={{ fontSize:14, fontWeight:600, lineHeight:1.4 }}>{resolvedAddr.address}</p>
                  <p className="text-muted-foreground mt-0.5" style={{ fontSize:12 }}>{resolvedAddr.city}{resolvedAddr.pin ? ` — ${resolvedAddr.pin}` : ""}</p>
                </>
              ) : (
                <p className="text-muted-foreground" style={{ fontSize:13 }}>Could not detect — you can edit manually after confirming.</p>
              )}
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 mb-4 flex items-start gap-2">
              <Info size={12} style={{ color:"#92400e", flexShrink:0, marginTop:1 }}/>
              <p style={{ fontSize:11, color:"#92400e", lineHeight:1.5 }}>
                The pin is placed at your GPS location. Scroll the map to fine-tune, then tap Confirm.
              </p>
            </div>
          </div>

          {/* Confirm CTA */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-border" style={{ position:"sticky", bottom:0, background:"var(--background)" }}>
            <button onClick={confirmLocation} style={btnPrimary}>
              <Check size={15}/> Confirm this location
            </button>
          </div>
        </div>
      )}

      {/* ── Use current location button ── */}
      <button
        onClick={handleUseLocation}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border mb-3"
        style={{ borderStyle:"dashed", borderColor: DARK, background:"rgba(13,13,13,0.04)", color:DARK, cursor:loading?"not-allowed":"pointer", fontWeight:600, fontSize:13 }}>
        {loading
          ? <Loader2 size={14} style={{ animation:"spin 1s linear infinite" }}/>
          : <Navigation size={14} strokeWidth={2}/>}
        {loading ? "Getting your location…" : "Use current location"}
      </button>

      {/* Auto-filled badge */}
      {address && coords && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl mb-3" style={{ background:"rgba(13,13,13,0.05)", border:`1px solid ${DARK}22` }}>
          <Check size={11} style={{ color: DARK }}/>
          <p style={{ fontSize:11, color: DARK, fontWeight:500 }}>Location auto-filled — edit below if needed</p>
          <button onClick={() => setShowMap(true)} style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", fontSize:11, color: DARK, fontWeight:600, textDecoration:"underline" }}>Change</button>
        </div>
      )}

      {geoError && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 border border-red-200 mb-2.5">
          <AlertTriangle size={11} style={{ color:"#dc2626", flexShrink:0 }}/>
          <p style={{ fontSize:11, color:"#dc2626" }}>{geoError}</p>
        </div>
      )}

      {/* ── Field 1: Address (full row) ── */}
      <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Address *</p>
      <input value={address} onChange={e => onAddressChange(e.target.value)}
        placeholder="Flat / Building, Street, Area" className={INP + " mb-3 block"} style={fnt}/>

      {/* ── Field 2: City | Pincode (2-col) ── */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>City *</p>
          <input value={city} onChange={e => onCityChange(sanitizeCity(e.target.value))}
            placeholder="City" className={INP} style={fnt}/>
        </div>
        <div>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>PIN code *</p>
          <input value={pin} onChange={e => onPinChange(e.target.value.replace(/\D/g,"").slice(0,6))}
            placeholder="6-digit PIN" inputMode="numeric" maxLength={6} className={INP} style={fnt}/>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

function CustomOrderForm({ onContinue, onBack }: { onContinue: (d: CustomOrderDetails) => void; onBack: () => void }) {
  const [garmentType, setGarmentType] = useState<GarmentType | null>(null);
  const [groupType, setGroupType]     = useState<GroupType | null>(null);
  const [qty, setQty]                 = useState(4);
  const [children, setChildren]       = useState<ChildInfo[]>([
    { id: 1, educationLevel:"school", schoolName:"", grade:"", parentName:"", sizes:{}, sizesOpen:true }
  ]);
  const [students, setStudents]       = useState<StudentInfo[]>([{ id: 1, institutionName: "", department: "" }]);
  const [groupNotes, setGroupNotes]   = useState("");
  const [name, setName]     = useState("");
  const [phone, setPhone]   = useState("+91");
  const [email, setEmail]   = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity]     = useState("");
  const [pin, setPin]       = useState("");
  const [sizeAllocated, setSizeAllocated] = useState(0);
  const [pendingGroupChange, setPendingGroupChange] = useState<GroupType | null>(null);

  // Must be declared BEFORE sizeCat / sizeOk which depend on it
  const totalAllocated = children.reduce((sum, c) => sum + Object.values(c.sizes).reduce((a, b) => a + b, 0), 0);
  const effectiveQty   = Math.max(qty, totalAllocated);

  const sizeCat    = groupType ? groupSizeCatMap[groupType] : "custom";
  const isKids     = groupType === "kids";
  const isStudents = groupType === "students";
  const isOther    = groupType && !isKids && !isStudents;
  const kidsDetailsOk = !isKids || children.every(c => c.schoolName.trim() && c.parentName.trim());
  const studentsDetailsOk = !isStudents || students.every(s => s.institutionName.trim());
  const groupNotesOk = !(isOther && groupType !== "family") || groupNotes.trim().length > 0;
  // For kids, use per-child allocation; for others use SizeSection
  const sizeOk     = isKids
    ? (totalAllocated > 0)
    : (qty === 0 || sizeAllocated === qty);
  const canContinue = !!(garmentType && groupType && name.trim() && isPhoneValid(phone) && address.trim() && sizeOk && kidsDetailsOk && studentsDetailsOk && groupNotesOk);

  function handleContinue() {
    if (!garmentType || !groupType) return;
    onContinue({ garmentType, groupType, name, phone, email, address, city, pin });
  }

  function selectGarmentType(next: GarmentType) {
    setGarmentType(next);
    if (next === garmentType) return;
    setGroupType(null);
    setGroupNotes("");
    setSizeAllocated(0);
    setPendingGroupChange(null);
    setChildren([{ id: 1, educationLevel:"school", schoolName:"", grade:"", parentName:"", sizes:{}, sizesOpen:true }]);
    setStudents([{ id: 1, institutionName: "", department: "" }]);
  }

  function addChild() {
    setChildren(prev => [...prev, { id: Date.now(), educationLevel:"school", schoolName:"", grade:"", parentName:"", sizes:{}, sizesOpen:true }]);
  }
  function removeChild(id: number) {
    setChildren(prev => prev.filter(c => c.id !== id));
  }
  function updateChild(id: number, field: keyof ChildInfo, value: string | boolean | Record<string, number>) {
    setChildren(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  }

  function addStudent() {
    setStudents(prev => [...prev, { id: Date.now(), institutionName: "", department: "" }]);
  }
  function removeStudent(id: number) {
    setStudents(prev => prev.filter(s => s.id !== id));
  }
  function updateStudent(id: number, field: keyof StudentInfo, value: string) {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="flex-1 overflow-y-auto px-5 pt-3 pb-4" style={{ scrollbarWidth:"none" }}>
        <button onClick={onBack} className="flex items-center gap-1 mb-3 text-muted-foreground text-sm" style={{ background:"transparent", border:"none", cursor:"pointer" }}>
          <ChevronDown size={14} style={{ transform:"rotate(90deg)" }}/> Back
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: ACCENT_BG }}><User size={18} strokeWidth={1.5} style={{ color:"#7c5419" }}/></div>
          <div className="flex-1">
            <p className="text-foreground" style={{ fontSize: 17, fontWeight: 600 }}>Custom order</p>
            <p className="text-muted-foreground" style={{ fontSize: 12 }}>Fully personalised · From 1 pc</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: ACCENT_BG, color:"#7c5419" }}>Step 1 · Setup</span>
        </div>

        <TipBanner tipKey="individual-custom-order-start">
          Ordering for a family, friend group or a few students? Pick who it's for below — you can set a different size for each person in one order.
        </TipBanner>

        <Section title="What would you like?" icon={Scissors}>
          <div className="grid grid-cols-4 gap-2">
            {garmentTypes.map(g => (
              <button key={g.id} onClick={() => selectGarmentType(g.id)}
                className="flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl text-center"
                style={{ border:`1.5px solid ${garmentType===g.id ? DARK : "var(--border)"}`, background: garmentType===g.id ? "rgba(13,13,13,0.04)" : "var(--card)", cursor:"pointer" }}>
                <g.Icon size={18} strokeWidth={1.5} style={{ color: garmentType===g.id ? DARK : "#6b7280" }}/>
                <span style={{ fontSize: 9.5, fontWeight: garmentType===g.id ? 700 : 400, color: garmentType===g.id ? DARK : "#374151", lineHeight: 1.3 }}>{g.label}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Who is it for */}
        <div className="bg-card border border-border rounded-2xl mb-3 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
            <User size={16} style={{ color: ACCENT, flexShrink: 0 }}/>
            <span className="text-foreground text-sm" style={{ fontWeight: 500 }}>Who is it for?</span>
          </div>
          <div className="px-4 pt-3 pb-3">
            {/* Kids & Students featured row */}
            {garmentType === "school_uniform" && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {([{ id:"kids" as GroupType, Icon: Users, label:"Kids", sub:"Age 3–16 · School sizing", borderC:"#bfdbfe", bg:"#E0F0FF", tc:"#1a4a8a" }, { id:"students" as GroupType, Icon: GraduationCap, label:"Students", sub:"College / Teen wear", borderC:"#fde68a", bg:"#fef3c7", tc:"#92400e" }]).map(g => (
                  <button key={g.id}
                    onClick={() => { if (sizeAllocated > 0 && g.id !== groupType) { setPendingGroupChange(g.id); } else { setGroupType(g.id); } }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left"
                    style={{ border:`2px solid ${groupType===g.id ? g.borderC : "var(--border)"}`, background: groupType===g.id ? g.bg : "var(--muted)", cursor:"pointer" }}>
                    <g.Icon size={18} strokeWidth={1.5} style={{ color: groupType===g.id ? g.tc : "#6b7280" }}/>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: groupType===g.id ? g.tc : DARK }}>{g.label}</p>
                      <p style={{ fontSize: 10, color: groupType===g.id ? g.tc : "#9ca3af", marginTop: 1 }}>{g.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Helper tip for multi-school */}
            {(isKids || isStudents) && garmentType === "school_uniform" && (
              <div className="mb-3 flex gap-1.5 px-3 py-2.5 rounded-xl bg-muted border border-border">
                <Info size={12} style={{ color:"#6b7280", flexShrink:0, marginTop:1 }}/>
                <p style={{ fontSize: 11, color:"#6b7280", lineHeight: 1.6 }}>
                  One child at St. Mary's and another at PSG College?{" "}
                  Submit two separate orders — one for each school/institution.{" "}
                  Use "Add another child" only for the <strong>same</strong> school.
                </p>
              </div>
            )}

            {/* Kids multi-child box — with per-child education level + size allocation */}
            {isKids && garmentType === "school_uniform" && (
              <div className="mb-3 rounded-xl overflow-hidden border border-blue-200">
                <div className="px-3 py-2 bg-blue-50 flex items-center justify-between">
                  <p style={{ fontSize: 11, fontWeight: 600, color:"#1a4a8a" }}>Kids order details</p>
                  <p style={{ fontSize: 11, color:"#3b82f6" }}>Total: {totalAllocated} pcs</p>
                </div>
                <div className="px-3 py-3 flex flex-col gap-4">
                  {children.map((child, idx) => {
                    const childAllocated = Object.values(child.sizes).reduce((a, b) => a + b, 0);
                    return (
                      <div key={child.id} className="rounded-xl overflow-hidden border border-blue-100">
                        {/* Child header */}
                        <div className="flex items-center justify-between px-3 py-2" style={{ background:"rgba(59,130,246,0.06)" }}>
                          <p className="text-foreground" style={{ fontSize: 12, fontWeight: 700 }}>Child {idx + 1}</p>
                          <div className="flex items-center gap-2">
                            {/* Education level toggle */}
                            <div className="flex border border-blue-200 rounded-lg overflow-hidden">
                              {(["school","college"] as const).map(lvl => (
                                <button key={lvl} onClick={() => updateChild(child.id, "educationLevel", lvl)}
                                  className="px-2 py-0.5 text-xs transition-colors"
                                  style={{ background: child.educationLevel===lvl ? "#1a4a8a" : "transparent", color: child.educationLevel===lvl ? "#fff" : "#9ca3af", border:"none", cursor:"pointer", fontWeight: child.educationLevel===lvl ? 600 : 400 }}>
                                  {lvl==="school" ? "School" : "College"}
                                </button>
                              ))}
                            </div>
                            {children.length > 1 && (
                              <button onClick={() => removeChild(child.id)} className="flex items-center gap-0.5 text-xs text-red-500 px-1.5 py-0.5 rounded-lg bg-red-50 border border-red-100" style={{ cursor:"pointer" }}>
                                <X size={9}/> Remove
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="px-3 py-2.5 flex flex-col gap-2">
                          <div>
                            <p className="text-foreground" style={{ fontSize: 11, fontWeight: 500, marginBottom: 3 }}>
                              {child.educationLevel==="school" ? "School name *" : "College / Institution *"}
                            </p>
                            <input value={child.schoolName} onChange={e => updateChild(child.id, "schoolName", e.target.value)}
                              placeholder={child.educationLevel==="school" ? "e.g. St. Mary's Primary School" : "e.g. PSG College of Technology"}
                              className={INP} style={fnt}/>
                          </div>
                          <div>
                            <p className="text-foreground" style={{ fontSize: 11, fontWeight: 500, marginBottom: 3 }}>
                              {child.educationLevel==="school" ? "Class / Grade" : "Course / Department"}
                            </p>
                            <input value={child.grade} onChange={e => updateChild(child.id, "grade", e.target.value)}
                              placeholder={child.educationLevel==="school" ? "e.g. Grade 3, Class 5B" : "e.g. B.Sc CSE, Batch 2025"}
                              className={INP} style={fnt}/>
                          </div>
                          <div>
                            <p className="text-foreground" style={{ fontSize: 11, fontWeight: 500, marginBottom: 3 }}>Parent / Guardian name *</p>
                            <input value={child.parentName} onChange={e => updateChild(child.id, "parentName", e.target.value)} placeholder="Full name" className={INP} style={fnt}/>
                          </div>

                          {/* Per-child size allocation */}
                          <ChildSizeSection
                            child={child}
                            sizeCat={child.educationLevel}
                            totalQty={effectiveQty}
                            onChange={sizes => updateChild(child.id, "sizes", sizes)}
                          />
                          {childAllocated > 0 && (
                            <p className="text-emerald-600 text-xs" style={{ fontWeight: 500 }}>
                              ✓ {childAllocated} pcs allocated for {child.schoolName || `Child ${idx+1}`}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <button onClick={addChild} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs border border-dashed border-blue-300 bg-blue-50 text-blue-700" style={{ cursor:"pointer", fontWeight: 500 }}>
                    <Plus size={13}/> Add another child
                  </button>
                  <div className="flex gap-1.5 px-2.5 py-2 rounded-lg bg-blue-50 border border-blue-100">
                    <Info size={11} style={{ color:"#3b82f6", marginTop: 1, flexShrink: 0 }}/>
                    <p style={{ fontSize: 11, color:"#1a4a8a", lineHeight: 1.5 }}>
                      Child 1 at school and Child 2 at college? Toggle School/College per child — sizes update automatically.
                      Different school designs = separate orders.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Students multi-entry box */}
            {isStudents && garmentType === "school_uniform" && (
              <div className="mb-3 rounded-xl overflow-hidden border border-yellow-200">
                <div className="px-3 py-2 bg-yellow-50">
                  <p style={{ fontSize: 11, fontWeight: 600, color:"#92400e" }}>Student order details</p>
                </div>
                <div className="px-3 py-3 flex flex-col gap-4">
                  {students.map((student, idx) => (
                    <div key={student.id}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-foreground" style={{ fontSize: 12, fontWeight: 600 }}>Student {idx + 1}</p>
                        {students.length > 1 && (
                          <button onClick={() => removeStudent(student.id)} className="flex items-center gap-1 text-xs text-red-500 px-2 py-0.5 rounded-lg bg-red-50 border border-red-100" style={{ cursor:"pointer" }}>
                            <X size={10}/> Remove
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col gap-2.5">
                        <div><p className="text-foreground" style={{ fontSize: 11, fontWeight: 500, marginBottom: 4 }}>College / School name *</p><input value={student.institutionName} onChange={e => updateStudent(student.id, "institutionName", e.target.value)} placeholder="e.g. PSG College of Technology" className={INP} style={fnt}/></div>
                        <div><p className="text-foreground" style={{ fontSize: 11, fontWeight: 500, marginBottom: 4 }}>Department / Course</p><input value={student.department} onChange={e => updateStudent(student.id, "department", e.target.value)} placeholder="e.g. B.Tech CSE, MBA Batch 2025" className={INP} style={fnt}/></div>
                      </div>
                      {idx < students.length - 1 && <div className="mt-3 border-t border-yellow-100"/>}
                    </div>
                  ))}
                  <button onClick={addStudent} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs border border-dashed border-yellow-300 bg-yellow-50 text-yellow-800" style={{ cursor:"pointer", fontWeight: 500 }}>
                    <Plus size={13}/> Add another student
                  </button>
                  <div className="flex gap-1.5 px-2.5 py-2 rounded-lg bg-yellow-50 border border-yellow-100">
                    <Info size={11} style={{ color:"#d97706", marginTop: 1, flexShrink: 0 }}/>
                    <p style={{ fontSize: 11, color:"#92400e", lineHeight: 1.5 }}>Ordering for two courses/batches? Each will be a separate order.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Others grid */}
            <p className="text-muted-foreground mb-1.5 text-xs uppercase tracking-wide" style={{ fontWeight: 500 }}>{garmentType === "school_uniform" ? "Personal & group orders" : "Who is this for?"}</p>
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {([{ id:"family" as GroupType, Icon: Users, label:"Family" }, { id:"friends" as GroupType, Icon: Heart, label:"Friends" }, { id:"personal" as GroupType, Icon: User, label:"Personal" }, { id:"event" as GroupType, Icon: Star, label:"Event" }]).map(g => (
                <button key={g.id}
                  onClick={() => { if (sizeAllocated > 0 && g.id !== groupType) { setPendingGroupChange(g.id); } else { setGroupType(g.id); } }}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-center"
                  style={{ border:`1.5px solid ${groupType===g.id ? DARK : "var(--border)"}`, background: groupType===g.id ? "rgba(13,13,13,0.04)" : "var(--muted)", cursor:"pointer" }}>
                  <g.Icon size={16} strokeWidth={1.5} style={{ color: groupType===g.id ? DARK : "#6b7280" }}/>
                  <span style={{ fontSize: 10, fontWeight: groupType===g.id ? 700 : 400, color: groupType===g.id ? DARK : "#6b7280" }}>{g.label}</span>
                </button>
              ))}
            </div>

            {/* Family gender breakdown (issue 8) — shown when family is selected */}
            {groupType === "family" && (
              <FamilyGenderBreakdown onAllocationChange={setSizeAllocated}/>
            )}

            {isOther && groupType !== "family" && (
              <div className="mt-2">
                <p className="text-foreground text-xs mb-1.5" style={{ fontWeight: 500 }}>Describe your order *</p>
                <textarea value={groupNotes} onChange={e => setGroupNotes(e.target.value)}
                  placeholder={groupType === "personal" ? "e.g. Custom shirt for my wedding. Linen blend, ivory." : "e.g. Sports day jerseys for 30 kids. Numbers on back."}
                  rows={3} className={INP} style={{ ...fnt, resize:"none" }}/>
              </div>
            )}
          </div>
        </div>

        <Section title="Quantity & size distribution" icon={Layers}>
          {/* For kids: sizes are per-child above; show total summary */}
          {isKids ? (
            <div>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-muted border border-border mb-2">
                <p className="text-foreground text-sm" style={{ fontWeight: 500 }}>Total pieces (all children)</p>
                <p className="text-foreground" style={{ fontSize: 18, fontWeight: 700 }}>{totalAllocated} pcs</p>
              </div>
              {children.map((child, idx) => {
                const ca = Object.values(child.sizes).reduce((a, b) => a + b, 0);
                // Build size breakdown string: "3-4Y×2  5-6Y×1"
                const sizeBreakdown = Object.entries(child.sizes)
                  .filter(([, q]) => q > 0)
                  .map(([size, q]) => `${size}×${q}`)
                  .join("  ");
                return ca > 0 ? (
                  <div key={child.id} className="bg-card border border-border rounded-xl px-3 py-2.5 mb-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-foreground flex items-center gap-1" style={{ fontSize: 12, fontWeight: 600 }}>
                        {child.educationLevel === "school" ? <BookOpen size={11}/> : <GraduationCap size={11}/>} Child {idx + 1}
                        {child.schoolName ? ` — ${child.schoolName}` : ""}
                      </p>
                      <p className="text-foreground" style={{ fontSize: 12, fontWeight: 700 }}>{ca} pcs</p>
                    </div>
                    {/* Per-size breakdown */}
                    <p className="text-muted-foreground" style={{ fontSize: 11, fontFamily:"monospace" }}>{sizeBreakdown}</p>
                  </div>
                ) : null;
              })}
              {totalAllocated === 0 && (
                <p className="text-muted-foreground text-xs text-center py-2">Allocate sizes above in each child's card</p>
              )}
            </div>
          ) : (
            <>
              <p className="text-muted-foreground mb-2" style={{ fontSize: 12 }}>Total pieces (minimum 1)</p>
              <div className="flex items-center gap-2.5 mb-4">
                <button onClick={() => setQty(q => Math.max(1, q-1))} className="w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center" style={{ cursor:"pointer" }}><Minus size={15}/></button>
                <div className="flex-1 flex items-center justify-center gap-1.5">
                  <input
                    type="text" inputMode="numeric" pattern="[0-9]*"
                    value={qty}
                    onChange={e => setQty(Math.max(1, parseInt(digitsOnly(e.target.value)) || 1))}
                    onBlur={e => setQty(Math.max(1, parseInt(digitsOnly(e.target.value)) || 1))}
                    onFocus={selectAllOnFocus} onClick={selectAllOnFocus} onMouseUp={preventSelectionCollapse}
                    className="text-center bg-card border border-border rounded-xl text-foreground"
                    style={{ width: 70, fontSize: 16, fontWeight: 600, outline:"none", padding:"6px 8px" }}
                  />
                  <span className="text-muted-foreground" style={{ fontSize: 13 }}>pcs</span>
                </div>
                <button onClick={() => setQty(q => q+1)} className="w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center" style={{ cursor:"pointer" }}><Plus size={15}/></button>
              </div>
              {groupType
                ? <SizeSection totalQty={qty} defaultCat={sizeCat} onAllocationChange={setSizeAllocated}/>
                : <div className="text-xs text-center py-3 rounded-xl border border-dashed border-border text-muted-foreground">Select "Who is it for?" above to see size options</div>
              }
            </>
          )}
        </Section>

        <Section title="Delivery address" icon={MapPin}>
          <GeoDeliverySection
            address={address} city={city} pin={pin}
            onAddressChange={setAddress} onCityChange={setCity} onPinChange={setPin}
          />
        </Section>

        <Section title="Contact details" icon={User}>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Your name *</p>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className={INP + " block"} style={fnt}/>
          <FieldError msg={name ? VALIDATORS.name(name) : ""}/>
          <div className="mb-3"/>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Phone number *</p>
          <input value={fmtPhone(phone)}
            onChange={e => setPhone(sanitizePhone(e.target.value))}
            onKeyDown={e => { if ((e.key==="Backspace"||e.key==="Delete") && phone.replace(/\D/g,"").length<=2) e.preventDefault(); }}
            placeholder="+91 98765 43210" inputMode="tel" maxLength={16} className={INP + " block"} style={fnt}/>
          <FieldError msg={phone.replace(/^\+91/,"").replace(/\D/g,"").length > 0 ? VALIDATORS.phone(phone) : ""}/>
          <div className="mb-3"/>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Email (optional)</p>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" inputMode="email" className={INP + " block"} style={fnt}/>
          <FieldError msg={email ? VALIDATORS.email(email) : ""}/>
        </Section>

        {!sizeOk && qty > 0 && (
          <div className="mb-2 flex gap-1.5 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
            <AlertTriangle size={12} className="text-red-500 flex-shrink-0 mt-0.5"/>
            <p className="text-red-700 text-xs">Please allocate all {qty} pcs across sizes before continuing ({sizeAllocated} / {qty} assigned)</p>
          </div>
        )}
      </div>

      {pendingGroupChange && (
        <Overlay center>
          <div className="bg-background rounded-2xl p-5">
            <p className="text-foreground mb-2" style={{ fontSize: 15, fontWeight: 700 }}>Reset size distribution?</p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">Changing the group will reset the size category and clear your current quantity distribution ({sizeAllocated} pcs assigned).</p>
            <div className="flex gap-2">
              <button onClick={() => { setGroupType(pendingGroupChange); setChildren([{ id:1, educationLevel:"school", schoolName:"", grade:"", parentName:"", sizes:{}, sizesOpen:true }]); setStudents([{ id:1, institutionName:"", department:"" }]); setGroupNotes(""); setSizeAllocated(0); setPendingGroupChange(null); }} className="flex-1 py-2.5 rounded-xl text-sm bg-red-50 text-red-600 border border-red-200" style={{ cursor:"pointer", fontWeight: 500 }}>Yes, reset</button>
              <button onClick={() => setPendingGroupChange(null)} className="flex-1 py-2.5 rounded-xl text-sm bg-foreground text-white" style={{ cursor:"pointer", fontWeight: 500 }}>Keep current</button>
            </div>
          </div>
        </Overlay>
      )}

      <div className="flex-shrink-0 px-5 py-3 border-t border-border bg-background" style={{ position:"sticky", bottom:0, zIndex:10 }}>
        <button onClick={handleContinue} disabled={!canContinue}
          style={{ ...(canContinue ? btnPrimary : btnPrimaryDisabled) }}>
          Continue · Step 2: Order details <ArrowRight size={15} strokeWidth={2}/>
        </button>
      </div>
    </div>
  );
}

// ─── Persona Order Form (Step 2 — shared for org & individual) ────────────────

function PersonaOrderForm({
  persona, orgDetails, customDetails, onSubmit, onChangePersona, onSaveDraft, resume,
}: {
  persona: Persona;
  orgDetails?: OrgDetails | null;
  customDetails?: CustomOrderDetails | null;
  onSubmit: (summary?: SubmittedOrderSummary, editPayload?: DraftPayload) => void;
  onChangePersona: () => void;
  onSaveDraft?: (d: DraftPayload) => void;
  resume?: ResumeState | null;
}) {
  // Which admin catalog (Individuals=B2C / Organizations=B2B) to price this order
  // against, so per-option prices come from the RIGHT catalog even if a product
  // name exists in both.
  const priceAudience: "B2C" | "B2B" = persona === "organisation" ? "B2B" : "B2C";
  const cfg = persona === "organisation" && orgDetails ? orgCfg[orgDetails.type]
    : customDetails ? { ...orgCfg.school, defaultQty: 1, minQty: 1, qtyStep: 1, fabricOptions: garmentFabricMap[customDetails.garmentType].fabricOptions, gsmOptions: garmentFabricMap[customDetails.garmentType].gsmOptions, weaveOptions: ["Plain","Twill","Jersey knit","Custom"], defaultSizeCat: customDetails.audience === "kids" ? "school" as SizeCat : customDetails.audience === "women" ? "womens" as SizeCat : "mens" as SizeCat }
    : orgCfg.school;

  const [qty, setQty] = useState(resume?.qty ?? cfg.minQty);
  const [orgSizeAllocated, setOrgSizeAllocated] = useState(() => resume ? Object.values(resume.sizeState.qtys).reduce((a, b) => a + b, 0) : 0);
  // Track if user has explicitly visited the Sizes step — only block submit if they have and didn't complete
  const [sizeStepVisited, setSizeStepVisited] = useState(!!resume);
  const [fabricSource, setFabricSource] = useState<"fresh" | "surplus">(resume?.fabricSource ?? "fresh");
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showConfirmChange, setShowConfirmChange] = useState(false);
  const [subStep, setSubStep] = useState(1);
  const [editingOrgDetails, setEditingOrgDetails] = useState(false);
  const [orgDraft, setOrgDraft] = useState(resume?.orgDraft ?? {
    name: orgDetails?.name || currentUser.org,
    board: orgDetails?.board || "",
    address: orgDetails?.address || currentUser.org + ", Erode, Tamil Nadu",
    city: orgDetails?.city || "Erode",
    pin: orgDetails?.pin || "638001",
    contactName: orgDetails?.contactName || currentUser.name,
    contactPhone: orgDetails?.contactPhone || currentUser.phone,
    contactEmail: orgDetails?.contactEmail || currentUser.email,
  });

  // ── Selections lifted up from section components (for the Review step) ──
  const [material, setMaterial] = useState(() => resume?.material ?? ({
    fabric: cfg.fabricOptions?.[0] ?? "",
    gsm: cfg.gsmOptions?.[0] ?? "",
    weave: cfg.weaveOptions?.[0] ?? "",
  }));
  // Per-garment material (individuals): each garment name can pick its own fabric/GSM/weave.
  // Falls back to the order-level `material` until the user changes it.
  const [garmentMaterials, setGarmentMaterials] = useState<Record<string, { fabric: string; gsm: string; weave: string }>>(resume?.garmentMaterials ?? {});
  const matFor = (name: string) => garmentMaterials[name] ?? material;
  const setMatFor = (name: string, patch: Partial<{ fabric: string; gsm: string; weave: string }>) =>
    setGarmentMaterials(prev => ({ ...prev, [name]: { ...(prev[name] ?? material), ...patch } }));
  const [orgColors, setOrgColors] = useState<ColorEntry[]>(resume?.orgColors ?? []);
  const [indivColors, setIndivColors] = useState<{ selected: string[]; desc: string; qtys?: Record<string, number> }>(resume?.indivColors ?? { selected: [], desc: "", qtys: {} });
  // What garment (catalog item) the order is for — drives the base price for both flows.
  const [selectedGarment, setSelectedGarment] = useState<SelectedGarment | null>(resume?.selectedGarment ?? null);

  // Individuals can order several garment types in one go (e.g. 1 hoodie + 1 shirt).
  // Each line carries its own quantity; the order total is the sum of the lines.
  // Organisations keep the single-garment flow (selectedGarment above).
  const [garmentCart, setGarmentCart] = useState<GarmentLine[]>(
    resume?.garmentCart && resume.garmentCart.length > 0
      ? resume.garmentCart.map(g => ({
          ...g,
          colorHex: (g as Partial<GarmentLine>).colorHex ?? individualPaletteFor(g.name)[0].hex,
          colorLabel: (g as Partial<GarmentLine>).colorLabel ?? individualPaletteFor(g.name)[0].label,
        }))
      : resume?.selectedGarment ? [{ ...resume.selectedGarment, qty: resume?.qty ?? 1, colorHex: individualPaletteFor(resume.selectedGarment.name)[0].hex, colorLabel: individualPaletteFor(resume.selectedGarment.name)[0].label }] : []
  );
  const garmentCartQty = garmentCart.reduce((s, g) => s + g.qty, 0);

  // ── Organisation multi-garment cart (org flow only, separate from individual) ──
  const [orgCart, setOrgCart] = useState<OrgGarmentLine[]>(resume?.orgCart ?? []);
  // Which "page" of the org garment picker is showing — lifted up from OrgGarmentCart
  // so the always-visible "Next: set up your N garments" CTA can live in the true
  // sticky footer instead of being buried inside the scrollable card.
  const [orgGarmentView, setOrgGarmentView] = useState<"add" | "list">(orgCart.length > 0 ? "list" : "add");
  const orgCartQty = orgCart.reduce((s, l) => s + l.qty, 0);
  // A garment line isn't ready until it also has at least one colour picked — quantity
  // and size distribution alone used to be enough to "complete" a line, which let
  // someone reach Review having never chosen a colour.
  const orgCartComplete = orgCart.length > 0 && orgCart.every(l => l.qty >= ORG_GARMENT_MOQ && orgLineAllocated(l) === l.qty && l.colors.length > 0);
  const orgCartRate = (l: OrgGarmentLine) => garmentPriceForFabric({ categoryId: l.categoryId, name: l.name, basePrice: l.basePrice, style: l.style }, l.material.fabric, l.material.weave, fabricSource, l.material.gsm, "B2B");
  const orgCartSubtotal = orgCart.reduce((s, l) => s + orgCartRate(l) * l.qty, 0);
  // Stitching/packaging is chosen per garment now, so the finishing add-on is
  // totalled up per line (each garment can have a different finishing cost).
  const orgLineFinishingPerPc = (l: OrgGarmentLine) => perPcCost(stitchingOpts.find(s => s.id === l.packaging?.stitch)?.cost)
    + perPcCost(packagingOpts.find(p => p.id === l.packaging?.packing)?.cost);
  const orgFinishingTotal = orgCart.reduce((s, l) => s + orgLineFinishingPerPc(l) * l.qty, 0);
  // Which garment's photo gallery is open (front/back/left/right), if any.
  const [galleryName, setGalleryName] = useState<string | null>(null);

  // Per-colour size allocation (Individual flow): write a size split onto one cart line.
  function setLineSizes(idx: number, sizes: Record<string, number>) {
    setGarmentCart(prev => prev.map((l, i) => (i === idx ? { ...l, sizes } : l)));
  }
  const lineAllocated = (g: GarmentLine) => Object.values(g.sizes ?? {}).reduce((a, b) => a + b, 0);
  const indivSizesAllocated = garmentCart.reduce((s, g) => s + lineAllocated(g), 0);
  const indivSizesComplete  = garmentCart.length > 0 && garmentCart.every(g => lineAllocated(g) === g.qty);

  // Audiences present in the individual cart — "Add more order" lets one order mix
  // Kids / Men / Women, so each line's size chart follows its own category.
  const indivCartCats = Array.from(new Set(garmentCart.map(g => g.categoryId)));
  const indivCartMixed = indivCartCats.length > 1;
  const indivLineSizeCat = (g: GarmentLine): SizeCat =>
    g.categoryId === "kids" ? "school" : g.categoryId === "womens" ? "womens" : g.categoryId === "mens" ? "mens" : cfg.defaultSizeCat;
  const indivAudienceShort = (c: GarmentCategoryId) => (c === "kids" ? "Kids" : c === "womens" ? "Women" : "Men");

  // Mirror the colour-aware cart into indivColors so the Review, summary and Track all
  // show each colour with its piece count (e.g. Black × 1, White × 1). Individual only.
  useEffect(() => {
    if (persona !== "individual") return;
    const qtys: Record<string, number> = {};
    const selected: string[] = [];
    for (const line of garmentCart) {
      if (!selected.includes(line.colorHex)) selected.push(line.colorHex);
      qtys[line.colorHex] = (qtys[line.colorHex] ?? 0) + line.qty;
    }
    setIndivColors(prev => ({ selected, desc: prev.desc, qtys }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garmentCart, persona]);

  // Keep the single selectedGarment mirrored to the first cart line so the rest of the
  // single-garment machinery (review card, validation, name) keeps working unchanged.
  useEffect(() => {
    if (persona !== "individual") return;
    setSelectedGarment(garmentCart[0]
      ? { categoryId: garmentCart[0].categoryId, name: garmentCart[0].name, basePrice: garmentCart[0].basePrice }
      : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garmentCart, persona]);

  // Same mirror for organisations — keeps the "a garment is chosen" gate satisfied
  // and gives the summary a base garment while org uses its own multi-garment cart.
  useEffect(() => {
    if (persona !== "organisation") return;
    setSelectedGarment(orgCart[0]
      ? { categoryId: orgCart[0].categoryId, name: orgCart[0].name, basePrice: orgCart[0].basePrice, style: orgCart[0].style }
      : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgCart, persona]);

  // For individuals, total pieces = sum of garment-line quantities. Sizes then distribute it.
  useEffect(() => {
    if (persona !== "individual") return;
    setQty(Math.max(1, garmentCartQty));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garmentCartQty, persona]);
  // For organisations, total pieces = sum of every garment line's quantity.
  useEffect(() => {
    if (persona !== "organisation") return;
    setQty(Math.max(0, orgCartQty));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgCartQty, persona]);
  // Seed each garment with its own fabric/GSM/weave defaults so a T-shirt and a shirt
  // in the same order can carry different materials (per-garment material selection).
  useEffect(() => {
    if (persona !== "individual") return;
    setGarmentMaterials(prev => {
      let changed = false; const next = { ...prev };
      for (const l of garmentCart) {
        if (!next[l.name]) {
          const o = materialOptionsForGarment(l.name);
          next[l.name] = { fabric: o.fabricOptions[0], gsm: o.gsmOptions[0], weave: o.weaveOptions[0] };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garmentCart, persona]);
  const [sizeState, setSizeState] = useState<{ cat: SizeCat; qtys: Record<string, number> }>(resume?.sizeState ?? { cat: cfg.defaultSizeCat, qtys: {} });
  // Org size chart follows the picked garment's audience (Men's/Women's/Kids),
  // falling back to the org-type default when nothing is selected yet.
  const orgSizeCat: SizeCat = selectedGarment
    ? (selectedGarment.categoryId === "womens" ? "womens" : selectedGarment.categoryId === "kids" ? "school" : "mens")
    : cfg.defaultSizeCat;
  const [packaging, setPackaging] = useState<{ stitch: string; packing: string }>(resume?.packaging ?? { stitch: "single_needle", packing: "bulk_loose" });
  const [refState, setRefState] = useState<{ chosen: RefOption | null; logoNames: string[]; inspNames: string[]; files?: { name: string; dataUrl: string }[] }>(resume?.refState ?? { chosen: null, logoNames: [], inspNames: [] });
  // Footer price card — tap to expand the full cost breakdown.
  const [priceExpanded, setPriceExpanded] = useState(false);
  // Accessory per-item specs, keyed by accessory item key → { fieldLabel: value, __notes: notes }
  const [accSpecState, setAccSpecState] = useState<Record<string, Record<string, string>>>(resume?.accSpecState ?? {});
  function setAccSpec(itemKey: string, field: string, value: string) {
    setAccSpecState(s => ({ ...s, [itemKey]: { ...s[itemKey], [field]: value } }));
  }

  // Delivery + payment (used by individual orders in the Review step)
  const [delivery, setDelivery] = useState(resume?.delivery ?? {
    name: customDetails?.name || currentUser.name,
    phone: customDetails?.phone || currentUser.phone,
    email: customDetails?.email || currentUser.email,
    address: customDetails?.address || currentUser.address,
    city: customDetails?.city || currentUser.city,
    pin: customDetails?.pin || currentUser.pin,
  });
  const [editingDelivery, setEditingDelivery] = useState(false);
  const [payment, setPayment] = useState<"upi" | "card">(resume?.payment ?? "upi");

  // Quick-pay UPI app (matches Payment details in account) — selected app for instant pay
  const [upiApp, setUpiApp]           = useState<UpiProvider>("gpay");
  // UPI + card details captured for the coordinator's secure payment link (no charge now)
  const [savedUpis, setSavedUpis]     = useState<string[]>(resume?.savedUpis ?? []);
  const [selectedUpi, setSelectedUpi] = useState<string>(resume?.selectedUpi ?? "");
  const [upiInput, setUpiInput]       = useState("");
  const [upiError, setUpiError]       = useState("");
  const [showUpiAdd, setShowUpiAdd]   = useState((resume?.savedUpis?.length ?? 0) === 0);
  const [cardData, setCardData]       = useState(resume?.card ?? { number: "", expiry: "", name: "" });
  const [cardCvv, setCardCvv]         = useState("");
  const [cardErrors, setCardErrors]   = useState<{ number?: string; expiry?: string; cvv?: string; name?: string }>({});

  function addUpi() {
    const v = upiInput.trim();
    if (!validateUpi(v)) { setUpiError("Enter a valid UPI ID (e.g. name@bank)"); return; }
    if (savedUpis.includes(v)) { setUpiError("This UPI ID is already added"); return; }
    setSavedUpis(prev => [...prev, v]);
    setSelectedUpi(v);
    setUpiInput(""); setUpiError(""); setShowUpiAdd(false);
  }

  // Once the user has seen Review, editing a section can jump straight back to it.
  const [visitedReview, setVisitedReview] = useState(false);
  // Resuming a draft jumps straight to the Review step.
  const didResumeJump = useRef(false);
  useEffect(() => {
    if (resume && !didResumeJump.current) { didResumeJump.current = true; setSubStep(subStepLabels.length); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume]);

  const isUniformOrder = customDetails?.garmentType === "school_uniform" && (customDetails.groupType === "kids" || customDetails.groupType === "students");
  // Accessory & uniform orders have no garment size-distribution step, so they're never "size incomplete".
  const hasSizeStep = !isUniformOrder
    && !((persona === "organisation" && !!orgDetails?.isAccessoryOrder) || (persona === "individual" && !!customDetails?.isAccessoryOrder));
  // Only block submit if user actually went to the Sizes step AND didn't finish (individual).
  // Organisations distribute sizes inside each garment card — gated by orgCartComplete instead.
  const sizeIncomplete = hasSizeStep && persona === "individual" && sizeStepVisited && !indivSizesComplete;

  const subLabel = orgDetails
    ? orgTypeDefs.find(o => o.id === orgDetails.type)?.label ?? "Organisation"
    : customDetails?.isAccessoryOrder
    ? "Accessories"
    : customDetails
    ? "Custom order"
    : persona === "organisation" ? "Organisation" : "Individual";

  const serviceLabel = orgDetails ? (orgServiceOptions[orgDetails.type].find(o => o.id === orgDetails.service)?.label ?? "") : null;
  // Show only org-type label + service in the pill — org name removed to avoid confusion
  const subName = orgDetails
    ? (serviceLabel || "Bulk order")
    : customDetails?.isAccessoryOrder
    ? `Personal · Min ${IND_ACCESSORY_MOQ} pcs`
    : customDetails
    ? ((indivCartMixed
        ? indivCartCats.map(indivAudienceShort).join(" + ") + " sizing"
        : customDetails.audience === "kids" ? "Kids sizing" : customDetails.audience === "women" ? "Women sizing" : "Men sizing") + " · Min 1 pcs")
    : undefined;

  const accentBg = persona === "organisation" ? "#E0F0FF" : ACCENT_BG;
  const accentC  = persona === "organisation" ? "#1a4a8a" : "#7c5419";

  // Accessory org orders skip fabric/colour/size — just Specs + References + Organisation
  // Accessory orders are supported for BOTH organisation and individual personas.
  const isAccessoryOrder = (persona === "organisation" && !!orgDetails?.isAccessoryOrder)
    || (persona === "individual" && !!customDetails?.isAccessoryOrder);
  const accessoryQtyData: Record<string, number> = orgDetails?.accessoryQty ?? customDetails?.accessoryQty ?? {};
  // Back-compat alias (org-specific paths still read this name in places)
  const isAccessoryOrgOrder = isAccessoryOrder;

  // ── Derived pricing (shared by the Sizes estimate, Review, footer & submit) ──
  // Garment per-pc rate comes from the chosen fabric + weave; finishing adds the
  // selected stitching + packaging. Accessory orders are priced from the catalog.
  const garmentRate    = garmentPriceForFabric(selectedGarment, material.fabric, material.weave, fabricSource, material.gsm, priceAudience);
  const finishingPerPc = perPcCost(stitchingOpts.find(s => s.id === packaging.stitch)?.cost)
    + perPcCost(packagingOpts.find(p => p.id === packaging.packing)?.cost);
  const accessoryTotalAmt = accessoryOrderTotal(accessoryQtyData, accSpecState);
  // Individual cart subtotal — every garment line priced for the chosen fabric/weave.
  const garmentCartSubtotal = garmentCart.reduce((s, g) => s + g.qty * garmentPriceForFabric(g, matFor(g.name).fabric, matFor(g.name).weave, fabricSource, matFor(g.name).gsm, priceAudience), 0);
  // The amount an individual pays (fixed) — garments + finishing, or accessory
  // total — PLUS the admin-configured service fee, shown as its own line.
  const orderFormCfg = useOrderFormConfig();
  const individualPayableBase = isAccessoryOrder ? accessoryTotalAmt : garmentCartSubtotal + garmentCartQty * finishingPerPc;
  const individualServiceFee = calcServiceFee(individualPayableBase, isAccessoryOrder ? Object.values(accessoryQtyData).reduce((a, b) => a + b, 0) : garmentCartQty, "B2C", orderFormCfg.fee);
  const individualPayable = individualPayableBase > 0 ? individualPayableBase + individualServiceFee : 0;

  // Admin product record (colours, spec fields) for accessory items — when the
  // admin defined spec fields for a product they REPLACE the app's built-in
  // per-category defaults; admin colour swatches always add a Colour choice.
  const { productMeta } = useCatalogAvailability({ audience: persona === "organisation" ? "B2B" : "B2C" });
  function accFieldsFor(categoryId: string, itemName: string): { label: string; options: string[]; hint?: string }[] {
    const meta = productMeta(itemName);
    const base = meta?.specFields?.length ? meta.specFields : (getAccessoryCategorySpecs(categoryId)?.fields ?? []);
    const colorOpts = (meta?.colors ?? []).map(c => c.label);
    return colorOpts.length ? [{ label: "Colour", options: colorOpts }, ...base] : [...base];
  }

  // Snapshot the order as it was reopened, so Review can flag which sections changed.
  function sectionFingerprints() {
    return {
      garment: JSON.stringify(selectedGarment),
      material: JSON.stringify({ ...material, fabricSource }),
      colors: JSON.stringify(persona === "individual" ? indivColors : orgColors),
      sizes: JSON.stringify({ qty, sizeState }),
      packaging: JSON.stringify(packaging),
      references: JSON.stringify(refState),
      accessories: JSON.stringify(accSpecState),
    } as Record<string, string>;
  }
  // Baseline captured the first time the user reaches Review (works for fresh orders too,
  // not just reopened ones), so editing a section afterwards flags it as UPDATED.
  const originalSnapshot = useRef<Record<string, string> | null>(null);
  const sectionChanged = (key: string) => !!originalSnapshot.current && originalSnapshot.current[key] !== sectionFingerprints()[key];
  // Per-accessory-item change detection (so each product shows its own UPDATED chip).
  const originalAccSpec = useRef<Record<string, Record<string, string>> | null>(null);
  function accItemFingerprint(state: Record<string, Record<string, string>> | null, itemKey: string) {
    const { categoryId } = parseAccessoryQtyKey(itemKey);
    const specs = getAccessoryCategorySpecs(categoryId);
    const fields = specs ? specs.fields.map(f => state?.[itemKey]?.[f.label] ?? f.options[0]) : [];
    const notes = state?.[itemKey]?.__notes ?? state?.[`cat:${categoryId}`]?.__notes ?? "";
    return JSON.stringify({ fields, notes });
  }
  const accessoryItemChanged = (itemKey: string) => !!originalSnapshot.current
    && accItemFingerprint(originalAccSpec.current, itemKey) !== accItemFingerprint(accSpecState, itemKey);

  // Build sub-step label arrays based on persona/isUniformOrder/isAccessoryOrgOrder.
  // Every flow ends with a "Review" step that previews the order before submission.
  // Organisation contact/delivery is captured inside Review (no separate step).
  // Organisations: stitching/packaging and references now live inside the single
  // "Garment" step (right under each garment's size distribution) instead of as
  // separate steps, so there's one place to set everything up per garment.
  // Steps are ADMIN-CONFIGURABLE (Garm Admin Portal → Settings → Order Form):
  // switched-off sections vanish from the flow entirely and the order simply
  // skips them (fabric/sizes fall back to sensible defaults the coordinator
  // confirms). Garment, colours, quantity and Review are always on.
  const stepEnabled = (l: string) =>
    (l !== "Material" || orderFormCfg.materials) &&
    (l !== "Sizes" || orderFormCfg.sizes) &&
    (l !== "References" || orderFormCfg.referenceUpload);
  const subStepLabels = (isAccessoryOrgOrder
    ? ["Specs", "References", "Review"]
    : !isUniformOrder
      ? persona === "individual"
        ? ["Garment", "Material", "Sizes", "References", "Review"]
        : ["Garment", "Review"]
      : ["References", "Review"]).filter(stepEnabled);

  const totalSubSteps = subStepLabels.length;
  const currentSubStepLabel = subStepLabels[subStep - 1];
  // True while an organisation is still on the "pick garments" page (as opposed to the
  // "configure each garment" page) of the Garment step — drives the footer CTA below.
  const onGarmentAddView = persona === "organisation" && currentSubStepLabel === "Garment" && orgGarmentView === "add";

  // True whenever org contact/address data is incomplete (independent of which step is showing)
  const orgDataIncomplete = !!orgDetails && (
    !orgDraft.name.trim() ||
    !orgDraft.contactName.trim() ||
    orgDraft.contactPhone.replace(/\D/g, "").length < 10 ||
    !orgDraft.address.trim() ||
    !orgDraft.city.trim() ||
    !/^\d{6}$/.test(orgDraft.pin.trim())
  );
  // True whenever an individual's delivery details are incomplete
  const deliveryIncomplete = persona === "individual" && (
    VALIDATORS.name(delivery.name) !== "" ||
    !isPhoneValid(delivery.phone) ||
    !delivery.address.trim() ||
    !delivery.city.trim() ||
    !/^\d{6}$/.test(delivery.pin.trim())
  );

  // Block forward navigation when the current step has unmet requirements, with a visible reason.
  const sizesStepIncomplete = currentSubStepLabel === "Sizes" && persona === "individual" && !indivSizesComplete;
  // Allocated-so-far count to surface in messages (per-colour sum for individuals).
  const sizeAllocShown = persona === "individual" ? indivSizesAllocated : orgSizeAllocated;
  // Org: which garment lines still need work (missing colours or an unfinished size split).
  const orgLineIssue = orgCart.find(l => l.qty < ORG_GARMENT_MOQ || orgLineAllocated(l) !== l.qty || l.colors.length === 0);
  const orgLineMissingColor = orgCart.find(l => l.qty >= ORG_GARMENT_MOQ && orgLineAllocated(l) === l.qty && l.colors.length === 0);
  // Can't leave the Garment step until it's complete. Individuals: ≥1 garment. Orgs: every
  // garment line ≥100 pcs with its sizes fully distributed (material/colours/size all live here).
  const garmentStepIncomplete = currentSubStepLabel === "Garment"
    && (persona === "individual" ? garmentCart.length === 0 : !orgCartComplete);
  // Individuals must pick at least one colour for the order.
  const colorsStepIncomplete = currentSubStepLabel === "Colors" && persona === "individual" && (indivColors.selected?.length ?? 0) < 1;
  // The final Review step can't submit until everything (incl. contact/delivery) is valid.
  // A garment is only required for actual garment orders — NOT accessory or uniform orders.
  const needsGarment = !isAccessoryOrder && !isUniformOrder;
  const orgGarmentIncomplete = persona === "organisation" && needsGarment && !orgCartComplete;
  const reviewIncomplete = currentSubStepLabel === "Review" && (sizeIncomplete || orgGarmentIncomplete || orgDataIncomplete || deliveryIncomplete || (needsGarment && !selectedGarment));
  const currentStepBlocked = sizesStepIncomplete || garmentStepIncomplete || colorsStepIncomplete || reviewIncomplete;

  const blockReason = (garmentStepIncomplete && persona === "organisation")
    ? (orgCart.length === 0 ? "Add at least one garment to continue"
        : orgLineMissingColor ? `Pick at least one colour for “${orgLineMissingColor.name}” to continue`
        : orgLineIssue ? `Finish “${orgLineIssue.name}” — min ${ORG_GARMENT_MOQ} pcs with all sizes distributed`
        : "Complete each garment's colours, quantity and sizes")
    : garmentStepIncomplete
    ? "Choose a garment to continue"
    : colorsStepIncomplete
    ? "Select at least one colour for your order"
    : sizesStepIncomplete
    ? `Distribute all pieces to continue — ${sizeAllocShown} of ${qty} pcs assigned`
    : (currentSubStepLabel === "Review" && needsGarment && !selectedGarment)
      ? "Go back and choose a garment before submitting"
    : (currentSubStepLabel === "Review" && orgGarmentIncomplete)
      ? "Go back to Garments and finish each garment (min 100 pcs, all sizes set)"
    : (currentSubStepLabel === "Review" && sizeIncomplete)
      ? `Go back to Sizes and distribute all pieces — ${sizeAllocShown} of ${qty} assigned`
      : (currentSubStepLabel === "Review" && orgDataIncomplete)
        ? "Complete the organisation, contact & delivery details before submitting"
        : (currentSubStepLabel === "Review" && deliveryIncomplete)
          ? "Add a valid delivery name, phone, address, city & PIN before submitting"
          : "";

  useEffect(() => {
    if (currentSubStepLabel === "Sizes") setSizeStepVisited(true);
    if (currentSubStepLabel === "Review") {
      setVisitedReview(true);
      if (!originalSnapshot.current) {
        originalSnapshot.current = sectionFingerprints();
        originalAccSpec.current = JSON.parse(JSON.stringify(accSpecState));
      }
    }
  }, [currentSubStepLabel]);

  // Jump straight back to a named step (used by "Change" links in the Review step)
  function goToStep(label: string) {
    const i = subStepLabels.indexOf(label);
    if (i >= 0) setSubStep(i + 1);
  }

  // Per-accessory-item specs (material, finish, branding, notes) for Review + summary
  function buildAccessorySpecsList(): { key: string; name: string; qty: number; fields: { label: string; value: string }[]; notes: string }[] {
    return Object.entries(accessoryQtyData)
      .filter(([, q]) => q > 0)
      .map(([key, q]) => {
        const { categoryId, itemName } = parseAccessoryQtyKey(key);
        const fields = accFieldsFor(categoryId, itemName).map(f => ({ label: f.label, value: accSpecState[key]?.[f.label] ?? f.options[0] }));
        const notes = accSpecState[key]?.__notes ?? accSpecState[`cat:${categoryId}`]?.__notes ?? "";
        return { key, name: itemName, qty: q, fields, notes };
      });
  }

  // Capture the full order — every actual selection — so Track shows real data.
  function buildFullSummary(): SubmittedOrderSummary {
    const colors = persona === "individual"
      ? indivColors.selected.map(hex => ({ hex, label: individualColorPresets.find(c => c.hex === hex)?.label ?? hex, qty: indivColors.qtys?.[hex] }))
      : orgColors.map(c => ({ hex: c.hex, label: c.label }));
    const sizeBreakdown = (persona === "individual"
      ? Object.entries(garmentCart.reduce((acc, l) => { for (const [s, q] of Object.entries(l.sizes ?? {})) acc[s] = (acc[s] ?? 0) + q; return acc; }, {} as Record<string, number>))
      : Object.entries(sizeState.qtys)
    ).filter(([, q]) => q > 0).map(([size, q]) => ({ size, qty: q }));
    const accessorySpecs = isAccessoryOrder ? buildAccessorySpecsList() : undefined;
    const accessoryItems = accessorySpecs?.map(a => ({ name: a.name, qty: a.qty }));
    const accTotal = accessoryItems?.reduce((a, b) => a + b.qty, 0) ?? 0;
    const refDef = refState.chosen ? refOptDefs.find(o => o.id === refState.chosen) : null;
    const firstColor = colors[0]?.label;

    const orderForLabel = isAccessoryOrder ? "Accessories"
      : orgDetails ? `${subLabel}${serviceLabel ? " · " + serviceLabel : ""}`
      // "Add more order" can mix audiences — label reflects everyone in the cart.
      : persona === "individual" && customDetails && garmentCart.length > 0
        ? indivCartCats.map(indivAudienceShort).join(" + ")
      : customDetails?.audience === "kids" ? "Kids"
      : customDetails?.audience === "women" ? "Women"
      : customDetails?.audience === "men" ? "Men"
      : "Personal";

    const uniqueGarmentNames = Array.from(new Set(garmentCart.map(g => g.name)));
    const garmentName = persona === "individual" && garmentCart.length > 0
      ? (uniqueGarmentNames.length === 1 ? uniqueGarmentNames[0] : `${uniqueGarmentNames[0]} +${uniqueGarmentNames.length - 1} more`)
      : (selectedGarment?.name || material.fabric || "Custom order");
    const name = isAccessoryOrder ? `Accessories — ${accTotal} pcs`
      : isUniformOrder ? `${subLabel} — Uniform`
      : `${garmentName}${firstColor ? " — " + firstColor : ""}`;

    const deliveryInfo: OrderSummaryDelivery = persona === "individual"
      ? { name: delivery.name, phone: delivery.phone, email: delivery.email, address: delivery.address, city: delivery.city, pin: delivery.pin }
      : { name: orgDraft.contactName, phone: orgDraft.contactPhone, email: orgDraft.contactEmail, address: orgDraft.address, city: orgDraft.city, pin: orgDraft.pin };

    // ── Price details — same logic as the Review step, captured for Track ──
    // Individuals pay a fixed price up front (garment+finishing, or accessory total);
    // organisations get an indicative range. Uniform orders are quoted by the coordinator.
    let price: OrderPrice | undefined;
    if (isUniformOrder) {
      price = undefined;
    } else if (isAccessoryOrder) {
      const itemCount = accessoryItems?.length ?? 0;
      const rateLine = `${accTotal} pcs · ${itemCount} product${itemCount !== 1 ? "s" : ""}`;
      price = persona === "individual"
        ? { kind: "fixed", rateLine, totalLabel: "Total paid", totalValue: inr(individualPayable),
            serviceFeeLine: individualServiceFee > 0 ? `${inr(individualServiceFee)} (${orderFormCfg.fee.b2cPercent}% + ${inr(orderFormCfg.fee.b2cPerPiece)}/pc)` : undefined,
            note: "Fixed price — payable in Track once Garm confirms your order." }
        : { kind: "estimate", rateLine, totalLabel: "Estimated total", totalValue: inr(accessoryTotalAmt),
            note: "Indicative — your coordinator confirms the final price before production." };
    } else if (persona === "individual") {
      price = {
        kind: "fixed",
        rateLine: `${qty} ${qty > 1 ? "pieces" : "piece"} · ${garmentCart.length} garment${garmentCart.length !== 1 ? "s" : ""}`,
        serviceFeeLine: individualServiceFee > 0 ? `${inr(individualServiceFee)} (${orderFormCfg.fee.b2cPercent}% + ${inr(orderFormCfg.fee.b2cPerPiece)}/pc)` : undefined,
        totalLabel: "Total paid",
        totalValue: inr(individualPayable),
        note: "Fixed price — payable in Track once Garm confirms your order.",
      };
    } else {
      const orgBase = orgCartSubtotal > 0 ? orgCartSubtotal : qty * garmentRate;
      price = {
        kind: "estimate",
        rateLine: `${qty} pieces · ${orgCart.length || 1} garment${(orgCart.length || 1) !== 1 ? "s" : ""}`,
        // Each garment can have its own stitching & packaging now, so this is a
        // lump total across all garments rather than a single per-piece rate.
        addOnLine: orgFinishingTotal > 0 ? `+${inr(orgFinishingTotal)} total finishing (stitching & packaging)` : undefined,
        serviceFeeLine: `${orderFormCfg.fee.b2bPercent}% (${orderFormCfg.fee.bulkPercent}% for ${orderFormCfg.fee.bulkQtyThreshold}+ pcs) — added in the final quote`,
        totalLabel: "Estimated total",
        totalValue: `${inr(orgBase * 0.9 + orgFinishingTotal)} – ${inr(orgBase * 1.1 + orgFinishingTotal)}`,
        note: "Indicative — your coordinator confirms the final price before production.",
      };
    }

    return {
      // Placeholder until the backend assigns the real reference (FL-xxxx) —
      // Track swaps this for the server ref the moment the order syncs, so the
      // app and the admin portal always show the SAME order number.
      id: "FL-PENDING",
      name,
      isAccessoryOrder,
      serviceLabel: serviceLabel ?? undefined,
      accessoryItems,
      totalPcs: isAccessoryOrder ? accTotal : undefined,
      persona,
      isUniform: isUniformOrder,
      orderForLabel,
      garmentLabel: isAccessoryOrder || isUniformOrder ? undefined : (selectedGarment ? `${garmentCatalog.find(c => c.id === selectedGarment.categoryId)?.label ?? ""} · ${selectedGarment.name}${selectedGarment.style ? ` · ${selectedGarment.style}` : ""}` : undefined),
      // Individuals & organisations can order several garments — capture each line in full so
      // Track shows the same detail as Review (garment · style · colour × qty, fabric, sizes).
      garmentLines: (isAccessoryOrder || isUniformOrder)
        ? undefined
        : (persona === "individual" && garmentCart.length > 0)
          ? garmentCart.map(g => {
              const m = matFor(g.name);
              return {
                name: g.name,
                style: g.style,
                // Includes set-piece colours (e.g. "Navy · Salwar: White · Dupatta: Gold")
                colorLabel: lineColourSummary(g),
                colorHex: g.colorHex,
                gender: g.gender,
                // Mixed-audience orders label each line (Men's / Women's / Kids) in Track.
                audience: indivCartMixed ? orgAudienceLabel(g.categoryId, g.gender) : undefined,
                qty: g.qty,
                fabric: m.fabric,
                gsm: m.gsm,
                weave: m.weave,
                sizes: Object.entries(g.sizes ?? {}).filter(([, q]) => q > 0).map(([size, q]) => ({ size, qty: q })),
              };
            })
          : (persona === "organisation" && orgCart.length > 0)
            ? orgCart.map(l => ({
                name: l.name,
                style: l.style,
                colorLabel: l.colors.length ? l.colors.map(c => c.label).join(", ") : "—",
                colorHex: l.colors[0]?.hex ?? "#cccccc",
                gender: l.gender,
                audience: orgAudienceLabel(l.categoryId, l.gender),
                qty: l.qty,
                fabric: l.material.fabric,
                gsm: l.material.gsm,
                weave: l.material.weave,
                sizes: Object.entries(l.sizes ?? {}).filter(([, q]) => q > 0).map(([size, q]) => ({ size, qty: q })),
                // Each garment carries its own stitching/packaging & reference choice.
                stitching: stitchingOpts.find(s => s.id === l.packaging?.stitch)?.label,
                packaging: packagingOpts.find(p => p.id === l.packaging?.packing)?.label,
                referenceMethod: l.refChosen ? refOptDefs.find(o => o.id === l.refChosen)?.label : undefined,
                referenceFiles: (l.refLogoNames?.length ?? 0) + (l.refInspNames?.length ?? 0),
              }))
            : undefined,
      fabricSource: isAccessoryOrder || isUniformOrder ? undefined : (fabricSource === "surplus" ? "Surplus (mill stock)" : "New fabric"),
      fabric: isAccessoryOrder || isUniformOrder ? undefined : material.fabric,
      gsm: isAccessoryOrder || isUniformOrder ? undefined : material.gsm,
      weave: isAccessoryOrder || isUniformOrder ? undefined : material.weave,
      colors: isAccessoryOrder ? undefined : colors,
      colorDesc: persona === "individual" ? indivColors.desc : "",
      qty: isAccessoryOrder ? undefined : qty,
      sizeCatLabel: isAccessoryOrder || isUniformOrder ? undefined : sizeCats.find(c => c.id === sizeState.cat)?.label,
      sizeBreakdown: isAccessoryOrder ? undefined : sizeBreakdown,
      // Organisations now set stitching/packaging per garment (see garmentLines above),
      // so this top-level pair is only meaningful for individuals (accessory orders never
      // had stitching/packaging at all — unchanged from before).
      stitching: (isAccessoryOrder || persona === "organisation") ? undefined : stitchingOpts.find(s => s.id === packaging.stitch)?.label,
      packaging: (isAccessoryOrder || persona === "organisation") ? undefined : packagingOpts.find(p => p.id === packaging.packing)?.label,
      // References are also per garment for organisations (except accessory orders,
      // which have no garment cart and still use the single global choice).
      referenceMethod: (persona === "organisation" && !isAccessoryOrder) ? undefined : refDef?.label,
      referenceFiles: (persona === "organisation" && !isAccessoryOrder) ? undefined : refState.logoNames.length + refState.inspNames.length,
      // Real uploaded files: summary-level picker for individuals/accessories,
      // per-garment pickers for organisation garment carts. Capped at 6 files.
      referenceAttachments: ((persona === "organisation" && !isAccessoryOrder)
        ? orgCart.flatMap(l => l.refFiles ?? [])
        : (refState.files ?? [])).slice(0, 6),
      // No payment method at submit — individuals choose UPI/card in Track
      // AFTER Garm confirms the order (the pay step records the real method).
      paymentMethod: undefined,
      serviceFee: persona === "individual" ? individualServiceFee : undefined,
      price,
      delivery: deliveryInfo,
      accessorySpecs,
    };
  }

  // Snapshot the current order into a draft payload (App assigns id + timestamp)
  function buildDraftPayload(): DraftPayload {
    const accTotal = isAccessoryOrder
      ? Object.values(accessoryQtyData).reduce((a, b) => a + b, 0)
      : 0;
    const subtitle = isAccessoryOrder
      ? `Accessories · ${accTotal} pcs`
      : `${serviceLabel || subName || (persona === "organisation" ? "Bulk order" : "Custom order")} · ${qty} pcs`;
    return {
      persona,
      title: subLabel,
      subtitle,
      summary: buildFullSummary(),
      orgDetails: orgDetails ?? null,
      customDetails: customDetails ?? null,
      resume: {
        material, fabricSource, orgColors, indivColors, selectedGarment, garmentCart, orgCart, sizeState, packaging, refState,
        accSpecState, delivery, payment, savedUpis, selectedUpi, card: cardData, orgDraft, qty,
      },
    };
  }

  // ── Final Review step: previews everything selected before submission ──
  function renderReview() {
    const isAccessory = isAccessoryOrgOrder;
    // Organisations now configure material, colours and sizes per garment, so those flat
    // cards are folded into a single per-garment breakdown (like individuals).
    const orgMulti = persona === "organisation" && !isUniformOrder && !isAccessory && orgCart.length > 0;
    const showMaterial  = !isUniformOrder && !isAccessory && !orgMulti;
    // Individuals pick colour per garment (shown in the garment/sizes card), so the
    // standalone Colours card is redundant for them — same now for orgs.
    const showColors    = !isUniformOrder && !isAccessory && persona !== "individual" && !orgMulti;
    const showSizes     = !isUniformOrder && !isAccessory && !orgMulti;
    // Organisations now choose stitching/packaging & references per garment (shown inside
    // the per-garment breakdown below), so the old single-choice cards are for individuals
    // and org accessory orders only (neither of which has a per-garment cart).
    const showPackaging = persona === "organisation" && !isUniformOrder && !isAccessory && !orgMulti;
    const showReferences = !orgMulti;
    const referencesBackTo = "References";

    const colorChips: { hex: string; label: string; qty?: number }[] = persona === "individual"
      ? indivColors.selected.map(hex => ({ hex, label: individualColorPresets.find(c => c.hex === hex)?.label ?? hex, qty: indivColors.qtys?.[hex] }))
      : orgColors.map(c => ({ hex: c.hex, label: c.label }));
    const colorDesc = persona === "individual" ? indivColors.desc.trim() : "";

    const sizeRows = Object.entries(sizeState.qtys).filter(([, q]) => q > 0);
    const indivSizeLines = garmentCart.map(l => ({ name: l.name, colorLabel: l.colorLabel, colorHex: l.colorHex, qty: l.qty, gender: l.gender, rows: Object.entries(l.sizes ?? {}).filter(([, q]) => q > 0) }));
    const refDef = refState.chosen ? refOptDefs.find(o => o.id === refState.chosen) : null;
    const refFileCount = refState.logoNames.length + refState.inspNames.length;
    const stitchLabel = stitchingOpts.find(s => s.id === packaging.stitch)?.label ?? "";
    const packLabel   = packagingOpts.find(p => p.id === packaging.packing)?.label ?? "";

    const accessorySpecsList = isAccessory ? buildAccessorySpecsList() : [];
    const accTotal = accessorySpecsList.reduce((a, b) => a + b.qty, 0);

    const header = (title: string, to?: string, changedKey?: string) => (
      <div className="flex items-center justify-between px-3.5 py-2.5" style={{ background: "var(--muted)", borderBottom: "0.5px solid var(--border)" }}>
        <div className="flex items-center gap-2 min-w-0">
          <p style={{ fontSize: 12, fontWeight: 700, color: DARK }}>{title}</p>
          {changedKey && sectionChanged(changedKey) && (
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4, color: ACCENT_TEXT, background: ACCENT_BG, border: `1px solid ${ACCENT}`, padding: "2px 6px", borderRadius: 5 }}>UPDATED</span>
          )}
        </div>
        {to && <button onClick={() => goToStep(to)} className="text-xs px-2.5 py-1 rounded-lg bg-card border border-border text-foreground" style={{ cursor: "pointer", fontWeight: 500 }}>Change</button>}
      </div>
    );
    const line = (k: React.ReactNode, v: React.ReactNode) => (
      <div className="flex items-start justify-between gap-3 py-1">
        {/* Label wraps; value never shrinks — long garment lines can't overlap the price */}
        <span className="text-muted-foreground flex-1 min-w-0" style={{ fontSize: 12, lineHeight: 1.45, overflowWrap: "break-word" }}>{k}</span>
        <span className="text-foreground text-right flex-shrink-0" style={{ fontSize: 12, fontWeight: 500 }}>{v}</span>
      </div>
    );
    const card = "rounded-2xl border border-border bg-card mb-3 overflow-hidden";

    return (
      <div>
        {/* Intro */}
        <div className="mb-3 flex gap-2 px-3 py-2.5 rounded-xl" style={{ background: ACCENT_BG, border: `0.5px solid ${ACCENT}` }}>
          <Info size={13} style={{ color: ACCENT, marginTop: 1, flexShrink: 0 }}/>
          <p style={{ fontSize: 12, color: "#7c5419", lineHeight: 1.5 }}>
            Here's everything you selected. Check it over and tap <strong>Change</strong> on any section to edit — then submit.
          </p>
        </div>

        {/* Accessories — items with their material / finish / branding / notes */}
        {isAccessory && (
          <div className={card}>
            {header("Accessories", "Specs", "accessories")}
            <div className="px-3.5 py-3 flex flex-col gap-2.5">
              {accessorySpecsList.length === 0
                ? <p className="text-muted-foreground" style={{ fontSize: 12 }}>No accessory items selected yet.</p>
                : accessorySpecsList.map(it => (
                    <div key={it.name} className="rounded-xl border border-border overflow-hidden">
                      <div className="flex items-center justify-between gap-3 px-3 py-2" style={{ background: "var(--muted)" }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-foreground" style={{ fontSize: 12.5, fontWeight: 600 }}>{it.name}</span>
                          {accessoryItemChanged(it.key) && (
                            <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.4, color: ACCENT_TEXT, background: ACCENT_BG, border: `1px solid ${ACCENT}`, padding: "1px 5px", borderRadius: 5, flexShrink: 0 }}>UPDATED</span>
                          )}
                        </div>
                        <span className="text-foreground" style={{ fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{it.qty} pcs</span>
                      </div>
                      {(it.fields.length > 0 || it.notes) && (
                        <div className="px-3 py-2">
                          {it.fields.map(f => line(f.label, f.value))}
                          {it.notes && line("Notes", `“${it.notes}”`)}
                        </div>
                      )}
                    </div>
                  ))}
              {accessorySpecsList.length > 0 && (
                <div className="flex items-center justify-between px-3 py-2 mt-1 rounded-xl" style={{ background: ACCENT_BG, border: `0.5px solid ${ACCENT}` }}>
                  <span style={{ fontSize: 12, color: "#7c5419" }}>Total accessories</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#7c5419" }}>{accTotal} pcs</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Organisation — full per-garment breakdown (material/colours/sizes folded in) */}
        {orgMulti && (
          <div className={card}>
            {header("Garments", "Garment", "garment")}
            <div className="px-3.5 py-3 flex flex-col gap-2.5">
              {orgCart.map(l => {
                const rate = orgCartRate(l);
                const rows = Object.entries(l.sizes ?? {}).filter(([, q]) => q > 0);
                return (
                  <div key={l.id} className="rounded-xl border border-border overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ background: "var(--muted)" }}>
                      <div className="min-w-0">
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: DARK }}>{l.name}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: ACCENT_TEXT, background: ACCENT_BG, border: `1px solid ${ACCENT}`, padding: "1px 6px", borderRadius: 5, marginLeft: 6 }}>{orgAudienceLabel(l.categoryId, l.gender)}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: DARK, flexShrink: 0 }}>{l.qty} pcs · {inr(rate)}/pc</span>
                    </div>
                    <div className="px-3 py-2">
                      {l.style && line("Style", l.style)}
                      {line("Fabric", [l.material.fabric, l.material.gsm, l.material.weave].filter(Boolean).join(" · ") || "—")}
                      {l.colors.length > 0 && (
                        <div className="flex items-start justify-between gap-4 py-1">
                          <span className="text-muted-foreground flex-shrink-0" style={{ fontSize: 12 }}>Colours</span>
                          <div className="flex flex-wrap gap-1.5 justify-end">
                            {l.colors.map((c, i) => (
                              <span key={c.hex + i} className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-border bg-card" style={{ fontSize: 10.5, fontWeight: 500 }}>
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.hex, border: "1px solid rgba(0,0,0,0.15)" }}/>{c.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {rows.length > 0 && (
                        <div className="flex items-start justify-between gap-4 py-1">
                          <span className="text-muted-foreground flex-shrink-0" style={{ fontSize: 12 }}>Sizes</span>
                          <div className="flex flex-wrap gap-1.5 justify-end">
                            {rows.map(([sz, q]) => (
                              <span key={sz} className="px-2 py-0.5 rounded-lg bg-muted border border-border" style={{ fontSize: 11, fontWeight: 500, color: DARK }}>{sz}: {q}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Per-garment stitching, packaging & reference — each product can differ */}
                      {line("Stitching", stitchingOpts.find(s => s.id === l.packaging?.stitch)?.label ?? "—")}
                      {line("Packaging", packagingOpts.find(p => p.id === l.packaging?.packing)?.label ?? "—")}
                      {line("Reference", l.refChosen ? (refOptDefs.find(o => o.id === l.refChosen)?.label ?? "—") : "Not added — coordinator will follow up")}
                    </div>
                  </div>
                );
              })}
              {line("Total pieces", `${orgCartQty} pcs`)}
            </div>
          </div>
        )}

        {/* Garment */}
        {showMaterial && (
          <div className={card}>
            {header(persona === "individual" ? "Garments" : "Garment", "Garment", "garment")}
            <div className="px-3.5 py-3">
              {persona === "individual" ? (
                garmentCart.length > 0 ? (
                  <>
                    {garmentCart.map(g => line(
                      `${indivCartMixed ? `${indivAudienceShort(g.categoryId)} · ` : ""}${g.name}${g.style ? ` · ${g.style}` : ""} · ${lineColourSummary(g)} × ${g.qty}`,
                      `${inr(garmentPriceForFabric(g, matFor(g.name).fabric, matFor(g.name).weave, fabricSource, matFor(g.name).gsm, priceAudience))}/pc`
                    ))}
                    {line("Total pieces", `${garmentCartQty} pcs`)}
                  </>
                ) : (
                  <p className="text-muted-foreground" style={{ fontSize: 12 }}>No garments chosen yet.</p>
                )
              ) : selectedGarment ? (
                <>
                  {line("Category", garmentCatalog.find(c => c.id === selectedGarment.categoryId)?.label ?? "—")}
                  {line("Garment", selectedGarment.name)}
                  {selectedGarment.style && line("Style", selectedGarment.style)}
                  {line("Base price", `${inr(selectedGarment.basePrice)}/pc`)}
                  {line("Price for this fabric", `${inr(garmentRate)}/pc`)}
                </>
              ) : (
                <p className="text-muted-foreground" style={{ fontSize: 12 }}>No garment chosen yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Material */}
        {showMaterial && (
          <div className={card}>
            {header("Material", "Material", "material")}
            <div className="px-3.5 py-3">
              {line("Fabric source", fabricSource === "surplus" ? "Surplus (mill stock)" : "New fabric")}
              {persona === "individual" && garmentCart.length > 0 ? (
                <div className="mt-1 flex flex-col gap-2">
                  {Array.from(new Set(garmentCart.map(g => g.name))).map(name => {
                    const m = matFor(name);
                    return (
                      <div key={name}>
                        <p style={{ fontSize: 11.5, fontWeight: 600, color: DARK, marginBottom: 2 }}>{name}</p>
                        <p className="text-muted-foreground" style={{ fontSize: 11.5, lineHeight: 1.5 }}>{[m.fabric, m.gsm, m.weave].filter(Boolean).join(" · ") || "—"}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  {line("Fabric", material.fabric || "—")}
                  {line("GSM weight", material.gsm || "—")}
                  {line("Weave", material.weave || "—")}
                </>
              )}
            </div>
          </div>
        )}

        {/* Uniform note (fabric on record) */}
        {isUniformOrder && (
          <div className={card}>
            {header("Fabric & stitching")}
            <div className="px-3.5 py-3">
              <div className="flex gap-1.5 px-2.5 py-2 rounded-lg" style={{ background: "#ecfdf5", border: "0.5px solid #a7f3d0" }}>
                <CheckCircle2 size={12} style={{ color: "#059669", flexShrink: 0, marginTop: 1 }}/>
                <p style={{ fontSize: 11, color: "#065f46", lineHeight: 1.5 }}>Fabric type, GSM, colours & stitching are auto-filled from your school/college record. Your coordinator confirms before production.</p>
              </div>
            </div>
          </div>
        )}

        {/* Colours */}
        {showColors && (
          <div className={card}>
            {header("Colours", "Colors", "colors")}
            <div className="px-3.5 py-3">
              {colorChips.length === 0
                ? <p className="text-muted-foreground" style={{ fontSize: 12 }}>No colours chosen yet.</p>
                : (
                  <div className="flex flex-wrap gap-1.5">
                    {colorChips.map((c, i) => (
                      <div key={c.hex + i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.hex, border: "1px solid rgba(0,0,0,0.12)" }}/>
                        <span style={{ fontSize: 11, fontWeight: 500 }}>{c.label}{typeof c.qty === "number" ? ` × ${c.qty}` : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              {colorDesc && <p className="text-muted-foreground mt-2" style={{ fontSize: 11, lineHeight: 1.5 }}>“{colorDesc}”</p>}
            </div>
          </div>
        )}

        {/* Quantity & sizes */}
        {showSizes && (
          <div className={card}>
            {header("Quantity & sizes", "Sizes", "sizes")}
            <div className="px-3.5 py-3">
              {line("Total pieces", `${qty} pcs`)}
              {persona === "individual" ? (
                <div className="mt-1 flex flex-col gap-2">
                  {indivSizeLines.map((il, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: il.colorHex, border: "1px solid rgba(0,0,0,0.15)" }}/>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: DARK }}>{il.name}{il.gender && !il.name.includes("(") ? ` (${il.gender === "boy" ? "Boys" : "Girls"})` : ""} · {il.colorLabel}</span>
                        <span style={{ fontSize: 11, color: "#6b7280" }}>({il.qty} pcs)</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {il.rows.length > 0
                          ? il.rows.map(([sz, q]) => (
                              <span key={sz} className="px-2 py-0.5 rounded-lg bg-muted border border-border" style={{ fontSize: 11, fontWeight: 500, color: DARK }}>{sz}: {q}</span>
                            ))
                          : <span style={{ fontSize: 11, color: "#dc2626" }}>no sizes set</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {line("Sizing", sizeCats.find(c => c.id === sizeState.cat)?.label ?? "—")}
                  {sizeRows.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {sizeRows.map(([sz, q]) => (
                        <span key={sz} className="px-2 py-0.5 rounded-lg bg-muted border border-border" style={{ fontSize: 11, fontWeight: 500, color: DARK }}>{sz}: {q}</span>
                      ))}
                    </div>
                  )}
                </>
              )}
              {sizeIncomplete && (
                <div className="mt-2 flex gap-1.5 px-2.5 py-2 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle size={11} className="text-red-500 flex-shrink-0 mt-0.5"/>
                  <p className="text-red-700" style={{ fontSize: 11 }}>{sizeAllocShown} of {qty} pcs assigned — tap Change to finish the size split.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Packaging */}
        {showPackaging && (
          <div className={card}>
            {header("Stitching & packaging", "Garment", "packaging")}
            <div className="px-3.5 py-3">
              {line("Stitching", stitchLabel)}
              {line("Packaging", packLabel)}
            </div>
          </div>
        )}

        {/* References — organisations see this per garment instead (below), since each
            product can have its own logo/sample. */}
        {showReferences && (
          <div className={card}>
            {header("References & samples", referencesBackTo, "references")}
            <div className="px-3.5 py-3">
              {refDef
                ? <>{line("Method", refDef.label)}{refFileCount > 0 && line("Files attached", `${refFileCount} file${refFileCount > 1 ? "s" : ""}`)}</>
                : <p className="text-muted-foreground" style={{ fontSize: 12 }}>No reference added — your coordinator will reach out for design details.</p>}
            </div>
          </div>
        )}

        {/* Organisation contact & delivery — editable inline (no separate step) */}
        {persona === "organisation" && orgDetails && (
          <div className={card}>
            <div className="flex items-center justify-between px-3.5 py-2.5" style={{ background: "var(--muted)", borderBottom: "0.5px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <Building2 size={13} style={{ color: ACCENT }}/>
                <p style={{ fontSize: 12, fontWeight: 700, color: DARK }}>Organisation, contact & delivery</p>
              </div>
              {!editingOrgDetails && !orgDataIncomplete && (
                <button onClick={() => setEditingOrgDetails(true)} className="text-xs px-2.5 py-1 rounded-lg bg-card border border-border text-foreground" style={{ cursor: "pointer", fontWeight: 500 }}>Change</button>
              )}
            </div>
            <div className="px-3.5 py-3">
              {(editingOrgDetails || orgDataIncomplete) ? (
                <div>
                  <GeoLocate onResolved={r => setOrgDraft(p => ({ ...p, address: r.address || p.address, city: r.city || p.city, pin: r.pin || p.pin }))}/>
                  <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Organisation name *</p>
                  <input value={orgDraft.name} onChange={e => setOrgDraft(p => ({ ...p, name: e.target.value }))} placeholder={orgCfg[orgDetails.type].namePlaceholder} className={INP + " mb-3 block"} style={fnt}/>
                  <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>{orgCfg[orgDetails.type].regLabel}</p>
                  <input value={orgDraft.board} onChange={e => setOrgDraft(p => ({ ...p, board: e.target.value }))} placeholder={orgCfg[orgDetails.type].regPlaceholder} className={INP + " mb-3 block"} style={fnt}/>
                  <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Contact person *</p>
                  <input value={orgDraft.contactName} onChange={e => setOrgDraft(p => ({ ...p, contactName: e.target.value }))} className={INP + " block"} style={fnt}/>
                  <FieldError msg={orgDraft.contactName ? VALIDATORS.name(orgDraft.contactName) : ""}/>
                  <div className="mb-3"/>
                  <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Phone number *</p>
                  <input value={fmtPhone(orgDraft.contactPhone)}
                    onChange={e => setOrgDraft(p => ({ ...p, contactPhone: sanitizePhone(e.target.value) }))}
                    onKeyDown={e => { if ((e.key === "Backspace" || e.key === "Delete") && orgDraft.contactPhone.replace(/\D/g, "").length <= 2) e.preventDefault(); }}
                    inputMode="tel" placeholder="+91 98765 43210" maxLength={16} className={INP + " block"} style={fnt}/>
                  <FieldError msg={orgDraft.contactPhone ? VALIDATORS.phone(orgDraft.contactPhone) : ""}/>
                  <div className="mb-3"/>
                  <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Email</p>
                  <input value={orgDraft.contactEmail} onChange={e => setOrgDraft(p => ({ ...p, contactEmail: e.target.value }))} inputMode="email" className={INP + " block"} style={fnt}/>
                  <FieldError msg={orgDraft.contactEmail ? VALIDATORS.email(orgDraft.contactEmail) : ""}/>
                  <div className="mb-3"/>
                  <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Delivery address *</p>
                  <input value={orgDraft.address} onChange={e => setOrgDraft(p => ({ ...p, address: e.target.value }))} placeholder="Building, street, area" className={INP + " mb-3 block"} style={fnt}/>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>City *</p>
                      <input value={orgDraft.city} onChange={e => setOrgDraft(p => ({ ...p, city: sanitizeCity(e.target.value) }))} placeholder="City" className={INP} style={fnt}/>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>PIN *</p>
                      <input value={orgDraft.pin} onChange={e => setOrgDraft(p => ({ ...p, pin: e.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="6-digit PIN" inputMode="numeric" maxLength={6} className={INP} style={fnt}/>
                      <FieldError msg={orgDraft.pin ? VALIDATORS.pin(orgDraft.pin) : ""}/>
                    </div>
                  </div>
                  <button onClick={() => { if (!orgDataIncomplete) setEditingOrgDetails(false); }} disabled={orgDataIncomplete}
                    style={{ ...(orgDataIncomplete ? btnPrimaryDisabled : btnPrimary), padding: "11px 20px" }}>
                    Save organisation details
                  </button>
                </div>
              ) : (
                <>
                  {line("Organisation", orgDraft.name || "—")}
                  {orgDraft.board && line(orgCfg[orgDetails.type].regLabel, orgDraft.board)}
                  {line("Contact", `${orgDraft.contactName || "—"} · ${fmtPhone(orgDraft.contactPhone)}`)}
                  {orgDraft.contactEmail && line("Email", orgDraft.contactEmail)}
                  {line("Delivery address", `${orgDraft.address}, ${orgDraft.city} ${orgDraft.pin}`)}
                  <div className="mt-2 flex gap-1.5 px-2.5 py-2 rounded-lg" style={{ background: "#ecfdf5", border: "0.5px solid #a7f3d0" }}>
                    <Check size={11} style={{ color: "#059669", flexShrink: 0, marginTop: 1 }}/>
                    <p style={{ fontSize: 11, color: "#065f46", lineHeight: 1.5 }}>Saved. These details are reused for your next order — tap Change only if they've changed.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Delivery & contact — individual (editable) + payment */}
        {persona === "individual" && (
          <>
            <div className={card}>
              <div className="flex items-center justify-between px-3.5 py-2.5" style={{ background: "var(--muted)", borderBottom: "0.5px solid var(--border)" }}>
                <div className="flex items-center gap-2">
                  <Truck size={13} style={{ color: ACCENT }}/>
                  <p style={{ fontSize: 12, fontWeight: 700, color: DARK }}>Delivery address & contact</p>
                </div>
                {!editingDelivery && !deliveryIncomplete && (
                  <button onClick={() => setEditingDelivery(true)} className="text-xs px-2.5 py-1 rounded-lg bg-card border border-border text-foreground" style={{ cursor: "pointer", fontWeight: 500 }}>Change</button>
                )}
              </div>
              <div className="px-3.5 py-3">
                {(editingDelivery || deliveryIncomplete) ? (
                  <div>
                    <GeoLocate onResolved={r => setDelivery(p => ({ ...p, address: r.address || p.address, city: r.city || p.city, pin: r.pin || p.pin }))}/>
                    <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Full name *</p>
                    <input value={delivery.name} onChange={e => setDelivery(p => ({ ...p, name: e.target.value }))} className={INP + " block"} style={fnt}/>
                    <FieldError msg={delivery.name ? VALIDATORS.name(delivery.name) : ""}/>
                    <div className="mb-3"/>
                    <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Phone number *</p>
                    <input value={fmtPhone(delivery.phone)}
                      onChange={e => setDelivery(p => ({ ...p, phone: sanitizePhone(e.target.value) }))}
                      onKeyDown={e => { if ((e.key === "Backspace" || e.key === "Delete") && delivery.phone.replace(/\D/g, "").length <= 2) e.preventDefault(); }}
                      inputMode="tel" placeholder="+91 98765 43210" maxLength={16} className={INP + " block"} style={fnt}/>
                    <FieldError msg={delivery.phone ? VALIDATORS.phone(delivery.phone) : ""}/>
                    <div className="mb-3"/>
                    <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Email</p>
                    <input value={delivery.email} onChange={e => setDelivery(p => ({ ...p, email: e.target.value }))} inputMode="email" className={INP + " block"} style={fnt}/>
                    <FieldError msg={delivery.email ? VALIDATORS.email(delivery.email) : ""}/>
                    <div className="mb-3"/>
                    <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Delivery address *</p>
                    <input value={delivery.address} onChange={e => setDelivery(p => ({ ...p, address: e.target.value }))} placeholder="Flat / house, street, area" className={INP + " mb-3 block"} style={fnt}/>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>City *</p>
                        <input value={delivery.city} onChange={e => setDelivery(p => ({ ...p, city: sanitizeCity(e.target.value) }))} placeholder="City" className={INP} style={fnt}/>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>PIN *</p>
                        <input value={delivery.pin} onChange={e => setDelivery(p => ({ ...p, pin: e.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="6-digit PIN" inputMode="numeric" maxLength={6} className={INP} style={fnt}/>
                        <FieldError msg={delivery.pin ? VALIDATORS.pin(delivery.pin) : ""}/>
                      </div>
                    </div>
                    <button onClick={() => { if (!deliveryIncomplete) setEditingDelivery(false); }} disabled={deliveryIncomplete}
                      style={{ ...(deliveryIncomplete ? btnPrimaryDisabled : btnPrimary), padding: "11px 20px" }}>
                      <Check size={14}/> Use this address
                    </button>
                  </div>
                ) : (
                  <>
                    {line("Name", delivery.name)}
                    {line("Phone", fmtPhone(delivery.phone))}
                    {delivery.email && line("Email", delivery.email)}
                    {line("Address", `${delivery.address}, ${delivery.city} ${delivery.pin}`)}
                    <div className="mt-2 flex gap-1.5 px-2.5 py-2 rounded-lg" style={{ background: "#ecfdf5", border: "0.5px solid #a7f3d0" }}>
                      <Check size={11} style={{ color: "#059669", flexShrink: 0, marginTop: 1 }}/>
                      <p style={{ fontSize: 11, color: "#065f46", lineHeight: 1.5 }}>Using your saved address — nothing to do here. Tap Change only if you want a different delivery address for this order.</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* How payment works — individuals do NOT pay at submit. The order
                goes to the Garm team first; once they Accept & Confirm it, the
                payment step unlocks in Track (with a notification), and
                production starts only after payment. */}
            <div className={card}>
              <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ background: "var(--muted)", borderBottom: "0.5px solid var(--border)" }}>
                <Wallet size={13} style={{ color: ACCENT }}/>
                <p style={{ fontSize: 12, fontWeight: 700, color: DARK }}>Payment — after confirmation</p>
              </div>
              <div className="px-3.5 py-3">
                {([
                  ["1", "Submit your order", "No payment now — your order goes to the Garm team for review."],
                  ["2", "Garm confirms it", `You'll be notified in Track when it's confirmed, with the final price${individualPayable ? ` (${inr(individualPayable)})` : ""}.`],
                  ["3", "Pay to start production", "Pay by UPI or card right from Track — production begins the moment payment is received."],
                ] as const).map(([n, title, sub]) => (
                  <div key={n} className="flex items-start gap-3 mb-2.5 last:mb-0">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: ACCENT, color: "#fff", fontSize: 11, fontWeight: 700 }}>{n}</span>
                    <div className="min-w-0">
                      <p className="text-foreground" style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>{title}</p>
                      <p className="text-muted-foreground" style={{ fontSize: 11, lineHeight: 1.5, marginTop: 1 }}>{sub}</p>
                    </div>
                  </div>
                ))}

                <div className="mt-2 flex gap-1.5 px-2.5 py-2 rounded-lg" style={{ background: ACCENT_BG, border: `0.5px solid ${ACCENT}` }}>
                  <Info size={11} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }}/>
                  <p style={{ fontSize: 11, color: "#7c5419", lineHeight: 1.5 }}>Nothing is charged when you submit.{isAccessoryOrder ? "" : " Stitching & packaging are included in the price."} Payment unlocks in Track after Garm confirms your order.</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Total is shown in the sticky footer (above the buttons) so it stays visible. */}
      </div>
    );
  }

  // Map subStep to content index within the labels array
  function getSubStepContent() {
    const label = subStepLabels[subStep - 1];

    if (label === "Review") return renderReview();

    if (label === "Specs") {
      const accessoryQty = accessoryQtyData;
      const selectedItems = Object.entries(accessoryQty)
        .filter(([, q]) => q > 0)
        .map(([key, qty]) => {
          const { categoryId, itemName } = parseAccessoryQtyKey(key);
          return { key, qty, categoryId, name: itemName };
        });
      const selectedCategoryIds = getAccessoryCategoriesFromQty(accessoryQty);
      const totalPcs = selectedItems.reduce((a, b) => a + b.qty, 0);
      const multipleCategories = selectedCategoryIds.length > 1;
      const multipleItems = selectedItems.length > 1;

      return (
        <div>
          {/* Order summary */}
          <div className="rounded-xl overflow-hidden border border-border mb-4">
            <div className="px-3 py-2 bg-muted flex items-center justify-between">
              <p style={{ fontSize: 12, fontWeight: 600, color: DARK }}>Your accessory order</p>
              <span style={{ fontSize: 11, color: "#6b7280" }}>{totalPcs} pcs · {selectedCategoryIds.length} categor{selectedCategoryIds.length === 1 ? "y" : "ies"}</span>
            </div>
            <div className="px-3 py-2.5 flex flex-col gap-2">
              {selectedCategoryIds.map(catId => {
                const cat = universalAccessoryCategories.find(c => c.id === catId);
                if (!cat) return null;
                const catItems = selectedItems.filter(i => i.categoryId === catId);
                const catPcs = catItems.reduce((a, b) => a + b.qty, 0);
                return (
                  <div key={catId} className="rounded-xl px-3 py-2.5" style={{ background: ACCENT_BG, border:`0.5px solid ${ACCENT}` }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <AccCatIcon id={catId} size={16}/>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#7c5419", flex: 1 }}>{cat.label}</p>
                      <span style={{ fontSize: 11, color: "#92400e", fontWeight: 500 }}>{catPcs} pcs</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {catItems.map(({ key, name, qty }) => (
                        <div key={key} className="flex items-center gap-2">
                          <span style={{ fontSize: 12, color: DARK, flex: 1 }}>{name}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: DARK }}>{qty}</span>
                          <button onClick={() => onChangePersona()}
                            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: "#fee2e2", border: "1px solid #fca5a5", cursor: "pointer" }}
                            title="Edit accessory items">
                            <X size={9} style={{ color: "#dc2626" }}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hint for multiple categories / items */}
          {(multipleCategories || multipleItems) && (
            <div className="flex gap-2 px-3 py-2.5 rounded-xl mb-4" style={{ background: "#eff6ff", border: "0.5px solid #bfdbfe" }}>
              <Info size={12} style={{ color: "#3b82f6", flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 11, color: "#1e40af", lineHeight: 1.6 }}>
                {multipleCategories
                  ? <>You've selected items from <strong>{selectedCategoryIds.length} categories</strong>. Each category has its own spec section below — set material, finish and branding per category.</>
                  : <>You've selected <strong>{selectedItems.length} different products</strong>. Each has its own spec section below — set material, finish and branding separately for each item.</>}
              </p>
            </div>
          )}

          {/* Per-category spec sections */}
          {selectedCategoryIds.map(catId => {
            const cat = universalAccessoryCategories.find(c => c.id === catId);
            const catItems = selectedItems.filter(i => i.categoryId === catId);
            const accessorySpecs = getAccessoryCategorySpecs(catId);
            if (!cat) return null;

            return (
              <div key={catId} className="mb-4">
                <div className="flex items-center gap-2 mb-3" style={{ color: DARK }}>
                  <AccCatIcon id={catId} size={16}/>
                  <p style={{ fontSize: 13, fontWeight: 700, color: DARK }}>{cat.label}</p>
                </div>

                {(accessorySpecs || catItems.some(ci => accFieldsFor(catId, ci.name).length > 0)) ? catItems.map(({ key, name }, idx) => {
                  const efields = accFieldsFor(catId, name);
                  const matIdx = efields.findIndex(f => f.label !== "Colour");
                  return (
                  <div key={key} className="rounded-2xl overflow-hidden border border-border mb-4">
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5" style={{ background: "var(--muted)", borderBottom: "0.5px solid var(--border)" }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white" style={{ background: DARK, fontSize: 11, fontWeight: 700 }}>
                        {idx + 1}
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: DARK }}>{name}</p>
                    </div>
                    <div className="px-3.5 py-3 flex flex-col gap-3">
                      {efields.map((field, fi) => (
                        <div key={fi}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{field.label}</p>
                          {field.hint && (
                            <p style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4 }}>{field.hint}</p>
                          )}
                          <SelectField options={field.options}
                            value={accSpecState[key]?.[field.label] ?? field.options[0]}
                            onChange={v => setAccSpec(key, field.label, v)}
                            priceFor={fi === matIdx ? (opt => ` · ${inr(Math.round(accessoryRatePerPc(catId, name) * accessoryMaterialMultiplier(opt) / accessoryMaterialMultiplier(field.options[0])))}/pc`) : undefined} />
                        </div>
                      ))}
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Notes for this item</p>
                        <textarea
                          value={accSpecState[key]?.__notes ?? ""}
                          onChange={e => setAccSpec(key, "__notes", e.target.value)}
                          placeholder={`Any specific requirement for ${name}…`}
                          className="w-full bg-card border border-border rounded-xl px-3 py-2 text-foreground outline-none resize-none"
                          style={{ fontSize: 12, fontFamily: "DM Sans, sans-serif", height: 52 }}
                        />
                      </div>
                    </div>
                  </div>
                  );
                }) : (
                  <div className="rounded-2xl border border-border p-3.5 mb-4">
                    <p className="text-foreground mb-1.5" style={{ fontSize: 13, fontWeight: 600 }}>Product notes for {cat.label}</p>
                    <textarea
                      value={accSpecState[`cat:${catId}`]?.__notes ?? ""}
                      onChange={e => setAccSpec(`cat:${catId}`, "__notes", e.target.value)}
                      placeholder="Describe material preferences, finish, branding or any specific requirements…"
                      className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none resize-none h-24"
                      style={fnt}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (label === "Garment") {
      // The audience (Kids / Men / Women) is already chosen on the previous screen,
      // so lock the garment catalog to that category instead of asking again.
      const lockedCat: GarmentCategoryId | undefined =
        persona === "individual" && customDetails?.audience
          ? (customDetails.audience === "men" ? "mens" : customDetails.audience === "women" ? "womens" : "kids")
          : undefined;
      // Organisations only sell adult wear unless they're a school (kids uniforms).
      // So college / corporate / hospital etc. should NOT show the Kids category.
      const orgAllowedCats: GarmentCategoryId[] | undefined =
        persona === "organisation"
          ? (orgDetails?.type === "school" ? ["mens", "womens", "kids"] : ["mens", "womens"])
          : undefined;
      return (
        <div className="flex flex-col gap-4">
          {persona === "individual" ? (
            <TipBanner tipKey="individual-garment-step">
              Every garment keeps its own colour, sizes and finishing — you'll set each one step by step.
            </TipBanner>
          ) : (
            <TipBanner tipKey="org-garment-step">
              Add every garment you need first, then tap into each one to set its fabric, quantity and sizes — you don't have to finish one before adding the next.
            </TipBanner>
          )}
          <Section title="Choose your garments" icon={Shirt}>
            {persona === "individual"
              ? <GarmentCart cart={garmentCart} onChange={setGarmentCart} lockedCategory={lockedCat} onViewPhotos={setGalleryName}/>
              : <OrgGarmentCart cart={orgCart} onChange={setOrgCart} orgType={orgDetails?.type} allowedCategories={orgAllowedCats} onViewPhotos={setGalleryName} view={orgGarmentView} onViewChange={setOrgGarmentView} fabricSource={fabricSource}/>}
          </Section>
        </div>
      );
    }

    if (label === "Material") {
      return <div className="flex flex-col gap-4">{renderMaterial()}</div>;
    }

    function renderMaterial() {
      return (
        <div>
          {/* Uniform DB banner shown once */}
          {isUniformOrder && (
            <div className="bg-card border border-border rounded-2xl p-4 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={15} style={{ color: ACCENT }}/>
                <span className="text-foreground text-sm" style={{ fontWeight: 600 }}>Fabric, colour & stitching on record</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700" style={{ fontWeight: 500 }}>Auto-filled ✓</span>
              </div>
              <div className="rounded-xl p-3 mb-3 bg-muted border border-border">
                <p style={{ fontSize: 12, color:"#374151", lineHeight: 1.6 }}>Since you've shared the school/college details, we already have the <strong>fabric type, GSM, weave, standard colours,</strong> and <strong>stitching specs</strong> in our database. Your coordinator will confirm before production.</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[["Fabric","From DB"],["Colours","Standard"],["Stitching","Uniform spec"]].map(([lbl2, val]) => (
                  <div key={lbl2} className="rounded-xl px-2.5 py-2 bg-muted border border-border">
                    <p className="text-muted-foreground" style={{ fontSize: 10 }}>{lbl2}</p>
                    <p className="text-foreground" style={{ fontSize: 11, fontWeight: 500 }}>{val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isUniformOrder && (
            <Section title="Material" icon={Ruler}>
              <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Fabric source</p>
              {(() => {
                // Representative garment for the price preview on the two cards —
                // the first garment in the order with its current fabric/weave picks.
                const rep = persona === "individual" && garmentCart.length > 0
                  ? { g: { categoryId: garmentCart[0].categoryId, name: garmentCart[0].name, basePrice: garmentCart[0].basePrice }, m: matFor(garmentCart[0].name) }
                  : orgCart.length > 0
                    ? { g: { categoryId: orgCart[0].categoryId, name: orgCart[0].name, basePrice: orgCart[0].basePrice }, m: orgCart[0].material }
                    : selectedGarment ? { g: selectedGarment, m: material } : null;
                const priceOf = (src: "fresh" | "surplus") => rep ? garmentPriceForFabric(rep.g, rep.m.fabric, rep.m.weave, src, rep.m.gsm, priceAudience) : null;
                const freshPc = priceOf("fresh");
                const surplusPc = priceOf("surplus");
                const moreThanOne = persona === "individual" ? new Set(garmentCart.map(g => g.name)).size > 1 : orgCart.length > 1;
                return (
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {([["fresh", "New fabric", "New production run", freshPc, null],
                       ["surplus", "Surplus fabric", "Mill leftover stock", surplusPc, freshPc]] as const).map(([id, lbl2, sub, pc, was]) => (
                      <button key={id} onClick={() => setFabricSource(id)}
                        className="flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl text-left"
                        style={{ border:`1.5px solid ${fabricSource===id ? DARK : "var(--border)"}`, background: fabricSource===id ? "rgba(13,13,13,0.04)" : "var(--card)", cursor:"pointer" }}>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ border:`2px solid ${fabricSource===id ? DARK : "#d1d5db"}`, background: fabricSource===id ? DARK : "var(--card)" }}>
                            {fabricSource===id && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: fabricSource===id ? DARK : "#111827" }}>{lbl2}</span>
                        </div>
                        {/* The REAL per-piece price for this source — the core of the decision */}
                        {pc !== null && (
                          <span className="flex items-baseline gap-1.5" style={{ marginLeft: 22, marginTop: 2 }}>
                            <span style={{ fontSize: 17, fontWeight: 800, color: id === "surplus" ? "#047857" : DARK }}>{inr(pc)}<span style={{ fontSize: 11.5, fontWeight: 600 }}>/pc</span></span>
                            {id === "surplus" && was !== null && was !== pc && (
                              <span style={{ fontSize: 12.5, color: "#9ca3af", textDecoration: "line-through" }}>{inr(was)}</span>
                            )}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: id === "surplus" ? "#047857" : "#9ca3af", marginLeft: 22, fontWeight: id === "surplus" ? 600 : 400 }}>
                          {id === "surplus" ? `Save ${surplusDiscountPct()}%${moreThanOne ? " on every garment" : ""}` : sub}
                        </span>
                        {pc !== null && moreThanOne && (
                          <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 22 }}>e.g. {rep!.g.name}</span>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })()}
              {fabricSource === "surplus" && (
                <div className="mb-3 flex gap-1.5 px-2.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
                  <RotateCcw size={12} style={{ color:"#065f46", flexShrink:0, marginTop:1 }}/>
                  <p style={{ fontSize: 11, color:"#065f46", lineHeight: 1.5 }}>Surplus fabric is leftover mill stock — same quality, <strong>{surplusDiscountPct()}% off</strong> every garment below. Availability confirmed before production.</p>
                </div>
              )}

              {persona === "individual" && garmentCart.length > 0 ? (
                /* Per-garment material — each garment type in the cart picks its own fabric. */
                <div className="flex flex-col gap-3">
                  <div className="flex gap-1.5 px-2.5 py-2 rounded-xl bg-blue-50 border border-blue-100">
                    <Info size={12} style={{ color:"#1a4a8a", flexShrink:0, marginTop:1 }}/>
                    <p style={{ fontSize: 11, color:"#1a4a8a", lineHeight: 1.5 }}>Pick fabric, GSM and weave <strong>separately for each garment</strong>. Prices update per garment.</p>
                  </div>
                  {Array.from(new Set(garmentCart.map(g => g.name))).map(name => {
                    const o = materialOptionsForGarment(name);
                    const cur = matFor(name);
                    const fabricVal = o.fabricOptions.includes(cur.fabric) ? cur.fabric : o.fabricOptions[0];
                    const gsmVal    = o.gsmOptions.includes(cur.gsm) ? cur.gsm : o.gsmOptions[0];
                    const weaveVal  = o.weaveOptions.includes(cur.weave) ? cur.weave : o.weaveOptions[0];
                    return (
                      <div key={name} className="rounded-xl border border-border overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ background:"var(--muted)" }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: DARK }}>{name}</span>
                          <span className="flex items-center gap-1.5 flex-shrink-0">
                            {(() => {
                              const gLine = { categoryId: "mens" as const, name, basePrice: garmentCart.find(g => g.name === name)!.basePrice };
                              const fresh = garmentPriceForFabric(gLine, fabricVal, weaveVal, "fresh", gsmVal, priceAudience);
                              const now = garmentPriceForFabric(gLine, fabricVal, weaveVal, fabricSource, gsmVal, priceAudience);
                              return (
                                <span className="flex items-baseline gap-1.5">
                                  {fabricSource === "surplus" && fresh !== now && (
                                    <span style={{ fontSize: 13, color:"#9ca3af", textDecoration:"line-through" }}>{inr(fresh)}</span>
                                  )}
                                  <span style={{ fontSize: 17, color: fabricSource === "surplus" ? "#047857" : "#1a4a8a", fontWeight: 800 }}>{inr(now)}<span style={{ fontSize: 12, fontWeight: 600 }}>/pc</span></span>
                                </span>
                              );
                            })()}
                            <RemoveChip title={`Remove ${name} from this order`}
                              onRemove={() => setGarmentCart(prev => prev.filter(g => g.name !== name))}/>
                          </span>
                        </div>
                        <div className="px-3 py-2.5">
                          <p className="text-muted-foreground mb-1" style={{ fontSize: 11.5 }}>Fabric</p>
                          <div className="mb-2"><SelectField options={o.fabricOptions} value={fabricVal} onChange={v => setMatFor(name, { fabric: v })} /></div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-muted-foreground mb-1" style={{ fontSize: 11.5 }}>GSM weight</p>
                              <SelectField options={o.gsmOptions} value={gsmVal} onChange={v => setMatFor(name, { gsm: v })} />
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1" style={{ fontSize: 11.5 }}>Weave</p>
                              <SelectField options={o.weaveOptions} value={weaveVal} onChange={v => setMatFor(name, { weave: v })} priceFor={ox => { const a = weaveAddOnPerPc(ox); return a > 0 ? ` · +${inr(a)}` : ""; }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>{cfg.fabricLabel}</p>
                  <div className="mb-2"><SelectField options={cfg.fabricOptions} value={material.fabric} onChange={v => setMaterial(m => ({ ...m, fabric: v }))} priceFor={o => ` · ${inr(fabricSource === "surplus" ? Math.max(1, Math.round(fabricRatePerPc(o) * (1 - surplusDiscountPct() / 100))) : fabricRatePerPc(o))}/pc`} /></div>
                  {/* The price of what's currently selected — big and unmissable */}
                  <div className="flex items-baseline justify-between px-3 py-2 mb-3 rounded-xl" style={{ background: fabricSource === "surplus" ? "#ecfdf5" : "var(--muted)", border: `1px solid ${fabricSource === "surplus" ? "#a7f3d0" : "var(--border)"}` }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Your price with this fabric</span>
                    <span className="flex items-baseline gap-1.5">
                      {fabricSource === "surplus" && (
                        <span style={{ fontSize: 12.5, color: "#9ca3af", textDecoration: "line-through" }}>{inr(garmentPriceForFabric(selectedGarment, material.fabric, material.weave, "fresh", material.gsm, priceAudience))}</span>
                      )}
                      <span style={{ fontSize: 17, fontWeight: 800, color: fabricSource === "surplus" ? "#047857" : DARK }}>{inr(garmentRate)}<span style={{ fontSize: 12, fontWeight: 600 }}>/pc</span></span>
                    </span>
                  </div>

                  <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>GSM weight</p>
                  <div className="mb-3"><SelectField options={cfg.gsmOptions} value={material.gsm} onChange={v => setMaterial(m => ({ ...m, gsm: v }))} /></div>

                  <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Weave</p>
                  <SelectField options={cfg.weaveOptions} value={material.weave} onChange={v => setMaterial(m => ({ ...m, weave: v }))} priceFor={o => { const a = weaveAddOnPerPc(o); return a > 0 ? ` · +${inr(a)}/pc` : ` · included`; }} />
                </>
              )}
            </Section>
          )}
        </div>
      );
    }

    if (label === "Colors") {
      if (persona === "individual") {
        return <Section title="Colors" icon={Palette}><IndividualColorSection paletteOnly onStateChange={setIndivColors} initial={resume ? indivColors : undefined}/></Section>;
      }
      return <Section title="Colors" icon={Palette}><ColorSection onStateChange={setOrgColors} initial={resume ? orgColors : undefined}/></Section>;
    }

    if (label === "Sizes") {
      return (
        <Section title="Quantity & size distribution" icon={Layers}>
          <SizeInfoBanner minQty={cfg.minQty}/>
          {persona === "individual" ? (
            /* Individuals set quantity per garment, so the total is fixed here — just distribute it across sizes. */
            <div className="mb-4">
              <p className="text-muted-foreground mb-2" style={{ fontSize: 12 }}>Total pieces (from your garments)</p>
              <div className="flex items-center justify-between px-3.5 py-3 rounded-xl bg-muted border border-border">
                <span style={{ fontSize: 13, color:"#374151" }}>{garmentCart.length} colour line{garmentCart.length !== 1 ? "s" : ""}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: DARK }}>{qty} pcs</span>
              </div>
              <button onClick={() => goToStep("Garment")} className="mt-2 text-xs" style={{ background:"none", border:"none", color:"#1a4a8a", cursor:"pointer", fontWeight: 500 }}>
                Change garments →
              </button>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground mb-2" style={{ fontSize: 12 }}>Total pieces (minimum {cfg.minQty})</p>
              <div className="flex items-center gap-2.5 mb-4">
                <button onClick={() => setQty(q => Math.max(cfg.minQty, q - cfg.qtyStep))} className="w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center" style={{ cursor:"pointer" }}><Minus size={15}/></button>
                <div className="flex-1 flex items-center justify-center gap-1.5">
                  <input
                    type="text" inputMode="numeric" pattern="[0-9]*"
                    value={qty}
                    onChange={e => {
                      const v = parseInt(digitsOnly(e.target.value)) || cfg.minQty;
                      setQty(Math.max(cfg.minQty, v));
                    }}
                    onBlur={e => { const v = parseInt(digitsOnly(e.target.value)) || cfg.minQty; setQty(Math.max(cfg.minQty, v)); }}
                    onFocus={selectAllOnFocus} onClick={selectAllOnFocus} onMouseUp={preventSelectionCollapse}
                    className="text-center bg-card border border-border rounded-xl text-foreground"
                    style={{ width: 80, fontSize: 16, fontWeight: 600, outline:"none", padding:"6px 8px" }}
                  />
                  <span className="text-muted-foreground" style={{ fontSize: 13 }}>pcs</span>
                </div>
                <button onClick={() => setQty(q => q + cfg.qtyStep)} className="w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center" style={{ cursor:"pointer" }}><Plus size={15}/></button>
              </div>
            </>
          )}

          {/* Price — fixed for individuals (pay to order), indicative range for organisations.
              Based on the chosen fabric + weave; finishing add-ons apply at the Packaging step. */}
          {(() => {
            if (persona === "individual") {
              return (
                <div className="rounded-xl px-3.5 py-3 mb-1" style={{ background:"#EFF6FF", border:"1px solid #BFDBFE" }}>
                  <div className="flex items-center justify-between">
                    <p style={{ fontSize:12, color:"#1a4a8a", fontWeight:600 }}>Total payable</p>
                    <p style={{ fontSize:15, color:"#1a4a8a", fontWeight:700 }}>{inr(individualPayable)}</p>
                  </div>
                  <p style={{ fontSize:10.5, color:"#315f8f", marginTop:3, lineHeight:1.5 }}>
                    Fixed price · {qty} {qty > 1 ? "pieces" : "piece"} across {garmentCart.length} colour line{garmentCart.length !== 1 ? "s" : ""}. Submit now — payment unlocks after Garm confirms.
                  </p>
                </div>
              );
            }
            const orgBase = orgCartSubtotal > 0 ? orgCartSubtotal : qty * garmentRate;
            const low = orgBase * 0.9 + orgFinishingTotal, high = orgBase * 1.1 + orgFinishingTotal;
            return (
              <div className="rounded-xl px-3.5 py-3 mb-1" style={{ background:"#EFF6FF", border:"1px solid #BFDBFE" }}>
                <div className="flex items-center justify-between">
                  <p style={{ fontSize:12, color:"#1a4a8a", fontWeight:600 }}>Estimated total</p>
                  <p style={{ fontSize:15, color:"#1a4a8a", fontWeight:700 }}>{inr(low)} – {inr(high)}</p>
                </div>
                <p style={{ fontSize:10.5, color:"#315f8f", marginTop:3, lineHeight:1.5 }}>
                  {qty} pieces across {orgCart.length || 1} garment{(orgCart.length || 1) !== 1 ? "s" : ""}. Finishing &amp; packaging add-ons adjust this — your coordinator confirms the final price.
                </p>
              </div>
            );
          })()}

          <div className="my-3 border-t border-border"/>
          <p className="text-foreground text-xs mb-2.5" style={{ fontWeight: 500 }}>Size distribution</p>
          {persona === "individual" ? (
            <>
              <p className="text-muted-foreground mb-2.5" style={{ fontSize: 11 }}>Set the sizes for each colour — every piece is matched to its size.</p>
              <div className="flex flex-col gap-3">
                {garmentCart.map((ln, idx) => (
                  <PerColourSize key={`${ln.categoryId}-${ln.gender ?? ""}-${ln.name}-${ln.colorHex}`} line={ln}
                    cat={indivLineSizeCat(ln)}
                    audienceLabel={indivCartMixed && ln.categoryId !== "kids" ? (ln.categoryId === "womens" ? "Women's" : "Men's") : undefined}
                    onChange={s => setLineSizes(idx, s)}
                    onRemove={() => setGarmentCart(prev => prev.filter((_, i) => i !== idx))}/>
                ))}
              </div>
            </>
          ) : (
            /* Size chart follows the garment the org actually picked (Men's/Women's/Kids),
               not the org-type default — so Men's wear never shows kids ages. */
            <SizeSection totalQty={qty} defaultCat={orgSizeCat} step={10} onAllocationChange={setOrgSizeAllocated} onStateChange={setSizeState} initialCat={resume ? sizeState.cat : undefined} initialQtys={resume ? sizeState.qtys : undefined}/>
          )}
          <div className="my-3 border-t border-border"/>
          <p className="text-foreground text-xs mb-2" style={{ fontWeight: 500 }}>Additional notes</p>
          <textarea placeholder={`${subLabel} — department, special finishing, branding or OEKO-TEX requirements…`}
            className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-xs outline-none resize-none h-16" style={fnt}/>
          {/* Size incomplete warning only on Sizes step */}
          {sizeIncomplete && (
            <div className="mt-3 flex gap-1.5 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
              <AlertTriangle size={12} className="text-red-500 flex-shrink-0 mt-0.5"/>
              <p className="text-red-700 text-xs">Size distribution incomplete — {sizeAllocShown} of {qty} pcs assigned. Please allocate all pieces before submitting.</p>
            </div>
          )}
        </Section>
      );
    }


    if (label === "Packaging") {
      return <Section title="Stitching & packaging" icon={Package}><PackagingSection onStateChange={setPackaging} initial={resume ? packaging : undefined}/></Section>;
    }

    if (label === "References") {
      return (
        <div>
          {isUniformOrder && (
            <div className="mb-3 flex gap-1.5 px-3 py-2 rounded-xl bg-muted border border-border">
              <Info size={12} style={{ color:"#9ca3af", flexShrink: 0, marginTop: 1 }}/>
              <p style={{ fontSize: 11, color:"#6b7280", lineHeight: 1.5 }}>Fabric & stitching auto-filled from database</p>
            </div>
          )}
          {isAccessoryOrder && (
            <div className="mb-3 rounded-xl overflow-hidden border border-border">
              <div className="px-3 py-2 bg-muted flex items-center justify-between">
                <p style={{ fontSize:12, fontWeight:600, color:DARK }}>Your accessory order summary</p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700" style={{ fontWeight:500 }}>Confirmed ✓</span>
              </div>
              <div className="px-3 py-2.5 flex flex-col gap-1.5">
                {Object.entries(accessoryQtyData)
                  .filter(([, q]) => q > 0)
                  .map(([key, q]) => {
                    const itemName = key.includes("-") ? key.split("-").slice(1).join("-") : key;
                    return (
                      <div key={key} className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
                        <span style={{ fontSize:12, fontWeight:500, color:DARK, flex:1 }}>{itemName}</span>
                        <span style={{ fontSize:12, fontWeight:700, color:DARK }}>{q} pcs</span>
                      </div>
                    );
                  })}
              </div>
              <div className="px-3 pb-3">
                <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background:ACCENT_BG, border:`0.5px solid ${ACCENT}` }}>
                  <span style={{ fontSize:12, color:"#7c5419" }}>Total accessories</span>
                  <span style={{ fontSize:13, fontWeight:700, color:"#7c5419" }}>{Object.values(accessoryQtyData).reduce((a,b)=>a+b,0)} pcs</span>
                </div>
              </div>
            </div>
          )}
          <Section title="References & samples" icon={ImageIcon}><RefImagesSection persona={persona} isAccessoryOrder={isAccessoryOrgOrder} onStateChange={setRefState} initialChosen={resume ? refState.chosen : undefined} previewLines={orderFormCfg.livePreview && persona === "individual" ? garmentCart.map(g => ({ name: g.name, colorHex: g.colorHex, colorLabel: g.colorLabel })) : undefined} previewAudience={indivCartMixed ? undefined : customDetails?.audience} previewMaterial={material.fabric}/></Section>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="flex-1 overflow-y-auto px-5 pt-3 pb-4" style={{ scrollbarWidth:"none" }}>
        {/* Progress header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-foreground text-sm" style={{ fontWeight: 600 }}>
              {currentSubStepLabel === "Packaging" ? "Stitching & Packaging" : currentSubStepLabel === "Garment" ? (persona === "individual" ? "Garments & colours" : "Garments, stitching & references") : currentSubStepLabel === "Material" ? "Fabric & material" : currentSubStepLabel}
            </p>
          </div>
          {/* Progress dots */}
          <div className="flex gap-1.5">
            {subStepLabels.map((_, i) => (
              <div
                key={i}
                className="h-1 rounded-full flex-1 transition-all"
                style={{ background: i < subStep ? "var(--foreground)" : "var(--muted)" }}
              />
            ))}
          </div>
        </div>

        {/* Persona pill — removed for organisations entirely (was just re-showing the
            org type with a stale "Change" affordance; org type is fixed at onboarding
            and already shown in Step 1, so this had no use once you're past it). Kept
            for individuals, where it still surfaces the audience/sizing profile. */}
        {persona === "individual" && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl" style={{ background: accentBg }}>
            <User size={16} strokeWidth={1.5} style={{ color: accentC }}/>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: accentC }}>{subLabel}</p>
              <p className="text-muted-foreground" style={{ fontSize: 11 }}>{subName ?? "Personalised order"}</p>
            </div>
          </div>
        )}

        {/* Sub-step content */}
        {getSubStepContent()}
      </div>

      {/* Navigation footer */}
      <div className="flex-shrink-0 px-5 py-3 border-t border-border bg-background" style={{ position:"sticky", bottom:0, zIndex:10 }}>
        {/* Price summary — kept in the footer (above the buttons) so it's always visible on Review */}
        {currentSubStepLabel === "Review" && !isUniformOrder && (() => {
          const accPcs   = Object.values(accessoryQtyData).reduce((a, b) => a + b, 0);
          const accCount = Object.values(accessoryQtyData).filter(q => q > 0).length;
          const perPc    = garmentRate + finishingPerPc;
          // Sub-line under the label, tailored to garment vs accessory orders.
          const subLine  = isAccessoryOrder
            ? `${accPcs} pcs · ${accCount} product${accCount !== 1 ? "s" : ""}`
            : persona === "organisation"
              ? `${qty} pcs · ${orgCart.length || 1} garment${(orgCart.length || 1) !== 1 ? "s" : ""}`
              : `${qty} ${qty > 1 ? "pieces" : "piece"} × ${inr(perPc)} each`;

          // Full cost breakdown rows (shown when the card is expanded).
          const stitchOpt = stitchingOpts.find(s => s.id === packaging.stitch);
          const packOpt   = packagingOpts.find(p => p.id === packaging.packing);
          const stitchCost = perPcCost(stitchOpt?.cost), packCost = perPcCost(packOpt?.cost);
          const weaveCost  = weaveAddOnPerPc(material.weave);
          const breakdown: { label: string; value: string; strong?: boolean }[] = isAccessoryOrder
            ? [
                ...Object.entries(accessoryQtyData).filter(([, q]) => q > 0).map(([key, q]) => {
                  const { categoryId, itemName } = parseAccessoryQtyKey(key);
                  const r = accessoryItemRate(categoryId, itemName, accSpecState[key]);
                  return { label: `${itemName} · ${q} × ${inr(r)}`, value: inr(q * r) };
                }),
                ...(persona === "individual" && individualServiceFee > 0 ? [{ label: `Service fee (${orderFormCfg.fee.b2cPercent}% + ${inr(orderFormCfg.fee.b2cPerPiece)}/pc)`, value: inr(individualServiceFee) }] : []),
              ]
            : persona === "individual"
            ? [
                ...garmentCart.map(g => {
                  const r = garmentPriceForFabric(g, matFor(g.name).fabric, matFor(g.name).weave, fabricSource, matFor(g.name).gsm, priceAudience);
                  return { label: `${g.name} · ${g.colorLabel} · ${g.qty} × ${inr(r)}`, value: inr(g.qty * r) };
                }),
                { label: `Stitching · ${stitchOpt?.label ?? "Standard"}`, value: stitchCost > 0 ? `+${inr(stitchCost)}/pc` : "included" },
                { label: `Packaging · ${packOpt?.label ?? "Standard"}`, value: packCost > 0 ? `+${inr(packCost)}/pc` : "included" },
                { label: "Finishing", value: garmentCartQty * finishingPerPc > 0 ? inr(garmentCartQty * finishingPerPc) : "included" },
                ...(individualServiceFee > 0 ? [{ label: `Service fee (${orderFormCfg.fee.b2cPercent}% + ${inr(orderFormCfg.fee.b2cPerPiece)}/pc)`, value: inr(individualServiceFee) }] : []),
                { label: "Total pieces", value: `${garmentCartQty} pcs`, strong: true },
              ]
            : [
                ...orgCart.map(l => {
                  const r = orgCartRate(l);
                  return { label: `${l.name}${l.gender ? ` (${l.gender === "boy" ? "Boys" : "Girls"})` : ""} · ${l.qty} × ${inr(r)}`, value: inr(l.qty * r) };
                }),
                // Each garment has its own stitching & packaging now, so break it out per garment.
                ...orgCart.map(l => {
                  const sOpt = stitchingOpts.find(s => s.id === l.packaging?.stitch);
                  const pOpt = packagingOpts.find(p => p.id === l.packaging?.packing);
                  const fin = orgLineFinishingPerPc(l) * l.qty;
                  return { label: `${l.name} finishing · ${sOpt?.label ?? "Standard"} + ${pOpt?.label ?? "Standard"}`, value: fin > 0 ? inr(fin) : "included" };
                }),
                { label: "Total pieces", value: `${qty} pcs`, strong: true },
              ];

          const orgBase = orgCartSubtotal > 0 ? orgCartSubtotal : qty * garmentRate;
          const low = orgBase * 0.9 + orgFinishingTotal, high = orgBase * 1.1 + orgFinishingTotal;

          if (persona === "individual") {
            return (
              // Premium dark card with a gold gradient hairline border — signals "this is what you pay".
              <div className="mb-2.5 rounded-2xl" style={{ padding:1, background:`linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_TEXT} 100%)`, boxShadow:"0 6px 18px rgba(13,13,13,0.18)" }}>
                <div className="rounded-2xl overflow-hidden" style={{ background:"linear-gradient(135deg,#1c1c1c 0%,#0D0D0D 100%)" }}>
                  <button onClick={() => setPriceExpanded(v => !v)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left" style={{ background:"transparent", border:"none", cursor:"pointer" }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:"rgba(200,169,126,0.16)", border:"1px solid rgba(200,169,126,0.4)" }}>
                        <Wallet size={18} strokeWidth={1.75} style={{ color:ACCENT }}/>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p style={{ fontSize:12.5, color:"#fff", fontWeight:700 }}>Total payable</p>
                          <span style={{ fontSize:8, fontWeight:800, letterSpacing:0.7, color:DARK, background:ACCENT, padding:"2px 6px", borderRadius:5 }}>FIXED</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <ShieldCheck size={11} strokeWidth={2} style={{ color:"rgba(200,169,126,0.9)", flexShrink:0 }}/>
                          <p style={{ fontSize:10.5, color:"rgba(255,255,255,0.62)" }} className="truncate">{priceExpanded ? "Payable after confirmation" : "Tap to see full breakdown"}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p style={{ fontSize:22, color:"#fff", fontWeight:800, lineHeight:1, letterSpacing:-0.3 }}>{inr(individualPayable)}</p>
                      <ChevronDown size={16} style={{ color:"rgba(255,255,255,0.55)", transform: priceExpanded ? "rotate(180deg)" : "none", transition:"transform 0.2s" }}/>
                    </div>
                  </button>
                  {priceExpanded && (
                    <div className="px-4 pb-3.5 pt-1">
                      {breakdown.map((r, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                          <span style={{ fontSize:11.5, color: r.strong ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)", fontWeight: r.strong ? 600 : 400 }} className="truncate pr-3">{r.label}</span>
                          <span style={{ fontSize:11.5, color: r.strong ? "#fff" : "rgba(255,255,255,0.8)", fontWeight: r.strong ? 700 : 500, flexShrink:0 }}>{r.value}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop:"1px solid rgba(255,255,255,0.12)" }}>
                        <span style={{ fontSize:12.5, color:ACCENT, fontWeight:700 }}>Total payable</span>
                        <span style={{ fontSize:14, color:"#fff", fontWeight:800 }}>{inr(individualPayable)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }
          return (
            // On-brand gold estimate card — softer, since this is indicative (not charged now).
            <div className="mb-2.5 rounded-2xl overflow-hidden" style={{ background:`linear-gradient(135deg, rgba(200,169,126,0.16) 0%, rgba(200,169,126,0.06) 100%)`, border:"1px solid rgba(200,169,126,0.45)", boxShadow:"0 4px 14px rgba(124,84,25,0.08)" }}>
              <button onClick={() => setPriceExpanded(v => !v)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left" style={{ background:"transparent", border:"none", cursor:"pointer" }}>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:"#fff", border:"1px solid rgba(200,169,126,0.45)" }}>
                    <ReceiptText size={18} strokeWidth={1.6} style={{ color:ACCENT_TEXT }}/>
                  </div>
                  <p style={{ fontSize:12.5, color:DARK, fontWeight:700, whiteSpace:"nowrap" }}>Estimated total</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <p style={{ fontSize:14.5, color:DARK, fontWeight:800, letterSpacing:-0.2, whiteSpace:"nowrap" }}>{isAccessoryOrder ? inr(accessoryTotalAmt) : `${inr(low)} – ${inr(high)}`}</p>
                  <ChevronDown size={16} style={{ color:ACCENT_TEXT, transform: priceExpanded ? "rotate(180deg)" : "none", transition:"transform 0.2s" }}/>
                </div>
              </button>
              {priceExpanded && (
                <div className="px-4 pb-3.5 pt-1">
                  {breakdown.map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <span style={{ fontSize:11.5, color: r.strong ? DARK : ACCENT_TEXT, fontWeight: r.strong ? 600 : 400 }} className="truncate pr-3">{r.label}</span>
                      <span style={{ fontSize:11.5, color:DARK, fontWeight: r.strong ? 700 : 500, flexShrink:0 }}>{r.value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop:"1px solid rgba(200,169,126,0.4)" }}>
                    <span style={{ fontSize:12.5, color:ACCENT_TEXT, fontWeight:700 }}>{isAccessoryOrder ? "Estimated total" : "Estimated range"}</span>
                    <span style={{ fontSize:14, color:DARK, fontWeight:800 }}>{isAccessoryOrder ? inr(accessoryTotalAmt) : `${inr(low)} – ${inr(high)}`}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        {/* Why the user can't proceed yet */}
        {blockReason && (
          <div className="flex items-center gap-1.5 mb-2.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle size={12} className="text-amber-600 flex-shrink-0"/>
            <p className="text-xs" style={{ color:"#92400e" }}>{blockReason}</p>
          </div>
        )}

        {/* Save as draft — only on the final Review step, sits above the submit row */}
        {onSaveDraft && currentSubStepLabel === "Review" && (
          <button onClick={() => onSaveDraft(buildDraftPayload())}
            className="w-full flex items-center justify-center gap-2 mb-2.5 py-2.5 rounded-2xl"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: DARK, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            <FileText size={14} strokeWidth={2}/> Save as draft
          </button>
        )}

        <div className="flex gap-3" id="coachmark-order-footer">
          {/* Back button — always visible */}
          <button
            onClick={() => subStep > 1 ? setSubStep(s => s - 1) : setShowConfirmChange(true)}
            className="w-12 h-12 rounded-2xl border border-border flex items-center justify-center bg-card flex-shrink-0">
            <ChevronDown size={16} style={{ transform: "rotate(90deg)" }} className="text-foreground"/>
          </button>

          {/* Organisations picking garments (before configuring them) get a dedicated,
              always-visible footer CTA to move on — instead of a button buried at the
              bottom of a potentially long catalog list. */}
          {onGarmentAddView ? (
            <button onClick={() => { if (orgCart.length > 0) setOrgGarmentView("list"); }}
              disabled={orgCart.length === 0}
              style={{ ...(orgCart.length === 0 ? btnPrimaryDisabled : btnPrimary), flex:1, width:"auto" }}>
              Next: set up your {orgCart.length} garment{orgCart.length !== 1 ? "s" : ""} <ArrowRight size={14} strokeWidth={2}/>
            </button>
          ) : subStep < totalSubSteps ? (
            visitedReview ? (
              <button onClick={() => { if (!currentStepBlocked) setSubStep(totalSubSteps); }}
                disabled={currentStepBlocked}
                style={{ ...(currentStepBlocked ? btnPrimaryDisabled : btnPrimary), flex:1, width:"auto" }}>
                <Check size={14} strokeWidth={2}/> Save &amp; back to review
              </button>
            ) : (
              <button onClick={() => { if (!currentStepBlocked) setSubStep(s => s + 1); }}
                disabled={currentStepBlocked}
                style={{ ...(currentStepBlocked ? btnPrimaryDisabled : btnPrimary), flex:1, width:"auto" }}>
                Next: {subStepLabels[subStep]} <ArrowRight size={14} strokeWidth={2}/>
              </button>
            )
          ) : (
            <button
              onClick={() => { if (!currentStepBlocked) setShowConfirmSubmit(true); }}
              disabled={currentStepBlocked}
              style={{ ...(currentStepBlocked ? btnPrimaryDisabled : btnPrimary), flex:1, width:"auto" }}
            >
              {persona === "individual"
                ? <><Send size={14}/> Submit order · {inr(individualPayable)}</>
                : <><Send size={14}/> Submit my order</>}
            </button>
          )}
        </div>
      </div>
      <Coachmark storageKey="fl_coach_order_footer_done" targetId="coachmark-order-footer" placement="above"
        title="Next step's down here" body="Use Back to revisit a step, or the button on the right to move forward — right through to submitting your order."/>

      {/* Garment photo gallery (front/back/left/right) */}
      {galleryName && <GarmentGallery name={galleryName} onClose={() => setGalleryName(null)}/>}

      {/* Submit confirm modal */}
      {showConfirmSubmit && (
        <Overlay center>
          <div className="bg-background rounded-2xl p-5 text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: ACCENT_BG }}>
              <Send size={20} style={{ color: ACCENT }}/>
            </div>
            <p className="text-foreground mb-1.5" style={{ fontSize: 16, fontWeight: 700 }}>{persona === "individual" ? `Submit order for confirmation?` : "Submit my order?"}</p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-5">{persona === "individual"
              ? <>Your order is sent to Garm for confirmation — nothing is charged now. Once confirmed, you'll pay {inr(individualPayable)} in Track and production starts right after.</>
              : <>Your coordinator will confirm the order details and share the final price &amp; next steps shortly. You can still request changes after submitting.</>}</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => { setShowConfirmSubmit(false); onSubmit(buildFullSummary(), buildDraftPayload()); }} style={{ ...btnPrimary, padding:"12px 20px" }}>
                <Check size={15}/> Yes, submit order
              </button>
              <button onClick={() => setShowConfirmSubmit(false)} style={{ ...btnSecondary, padding:"10px 20px" }}>Go back and review</button>
            </div>
          </div>
        </Overlay>
      )}

      {/* Change confirm modal */}
      {showConfirmChange && (
        <Overlay center>
          <div className="bg-background rounded-2xl p-5">
            <p className="text-foreground mb-2" style={{ fontSize: 15, fontWeight: 700 }}>Clear order details?</p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">Going back will clear all the order details you've filled in. This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => { setShowConfirmChange(false); onChangePersona(); }} className="flex-1 py-2.5 rounded-xl text-sm bg-red-50 text-red-600 border border-red-200" style={{ cursor:"pointer", fontWeight: 500 }}>Yes, go back</button>
              <button onClick={() => setShowConfirmChange(false)} className="flex-1 py-2.5 rounded-xl text-sm bg-foreground text-white" style={{ cursor:"pointer", fontWeight: 500 }}>Keep editing</button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function CustomAudienceForm({ onContinue, onBack, onAccessories }: { onContinue: (d: CustomOrderDetails) => void; onBack: () => void; onAccessories?: () => void }) {
  const [audience, setAudience] = useState<CustomAudience>("kids");
  const options = [
    { id:"kids" as CustomAudience, label:"Kids", sub:"Age-based child sizing", cat:"school" as SizeCat, group:"kids" as GroupType, Icon: Users },
    { id:"men" as CustomAudience, label:"Men", sub:"Chest-based adult sizing", cat:"mens" as SizeCat, group:"family" as GroupType, Icon: User },
    { id:"women" as CustomAudience, label:"Women", sub:"UK-size adult sizing", cat:"womens" as SizeCat, group:"family" as GroupType, Icon: Heart },
  ];
  const selected = options.find(o => o.id === audience)!;

  function continueCustom() {
    onContinue({
      garmentType: audience === "kids" ? "tshirt" : "shirt",
      groupType: selected.group,
      audience,
      name: currentUser.name,
      phone: currentUser.phone,
      email: currentUser.email,
      address: "",
      city: "",
      pin: "",
    });
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="flex-1 overflow-y-auto px-5 pt-3 pb-4" style={{ scrollbarWidth:"none" }}>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: ACCENT_BG }}><Scissors size={18} strokeWidth={1.5} style={{ color:"#7c5419" }}/></div>
          <div className="flex-1">
            <p className="text-foreground" style={{ fontSize:17, fontWeight:600 }}>Custom order</p>
            <p className="text-muted-foreground" style={{ fontSize:12 }}>Minimum 1 pc · Material to reference flow</p>
          </div>
        </div>

        <SizeInfoBanner minQty={1}/>

        <Section title="Who needs this custom order?" icon={User}>
          <div className="flex flex-col gap-2">
            {options.map(opt => {
              const active = opt.id === audience;
              return (
                <button key={opt.id} onClick={() => setAudience(opt.id)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left"
                  style={{ border:`1.5px solid ${active ? DARK : "var(--border)"}`, background: active ? "rgba(13,13,13,0.03)" : "var(--card)", cursor:"pointer" }}>
                  <opt.Icon size={20} strokeWidth={1.5} style={{ color: active ? DARK : "#6b7280" }}/>
                  <div className="flex-1">
                    <p className="text-foreground text-sm" style={{ fontWeight:600 }}>{opt.label}</p>
                    <p className="text-muted-foreground" style={{ fontSize:11 }}>{opt.sub}</p>
                  </div>
                  <span className="text-muted-foreground" style={{ fontSize:11 }}>{opt.cat}</span>
                </button>
              );
            })}
          </div>
          <p className="text-muted-foreground mt-2.5" style={{ fontSize: 11, lineHeight: 1.5 }}>
            Ordering for the family? Start with one person — you can add more on the next step.
          </p>
        </Section>

        {/* Accessories — same catalog as organisation orders */}
        {onAccessories && (
          <Section title="Accessories" icon={Gift}>
            <p className="text-muted-foreground mb-3" style={{ fontSize:12 }}>Bottles, bags, ID cards, awards & more — the same catalog organisations use.</p>
            <button onClick={onAccessories}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left"
              style={{ border:`1.5px solid var(--border)`, background:"var(--card)", cursor:"pointer" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: ACCENT_BG }}>
                <Gift size={18} strokeWidth={1.5} style={{ color:"#7c5419" }}/>
              </div>
              <div className="flex-1">
                <p className="text-foreground text-sm" style={{ fontWeight:600 }}>Browse accessories</p>
                <p className="text-muted-foreground" style={{ fontSize:11 }}>Min {IND_ACCESSORY_MOQ} pcs per product</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground flex-shrink-0"/>
            </button>
          </Section>
        )}
      </div>
      <div className="flex-shrink-0 px-5 py-3 border-t border-border bg-background" style={{ position:"sticky", bottom:0, zIndex:10 }}>
        <button id="coachmark-ind-continue" onClick={continueCustom} style={btnPrimary}>
          Continue custom order <ArrowRight size={15} strokeWidth={2}/>
        </button>
      </div>
      <Coachmark storageKey="fl_coach_ind_continue_done" targetId="coachmark-ind-continue"
        title="Ready to continue" body="Fill in your details above, then tap here to move on to garments, sizes and quantities."/>
    </div>
  );
}

// ─── Individual Accessory Picker (same catalog & MOQ rules as organisation) ────
function IndividualAccessoryPicker({ onContinue, onBack }: { onContinue: (qty: Record<string, number>) => void; onBack: () => void }) {
  const { isCategoryActive, isItemActive, isItemInStock, extraAccessoryCategories, extraItemsForCategory } = useCatalogAvailability({
    knownLabels: universalAccessoryCategories.map(c => c.label), audience: "B2C",
  });
  const ACCESSORY_MOQ = IND_ACCESSORY_MOQ, ACCESSORY_STEP = IND_ACCESSORY_STEP;
  const [accessoryQty, setAccessoryQty] = useState<Record<string, number>>({});
  const [view, setView] = useState<"categories" | "products">("categories");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const accessorySelected = Object.entries(accessoryQty).filter(([, q]) => q > 0);
  const accessoryBelowMoq = accessorySelected.some(([, q]) => q < ACCESSORY_MOQ);
  const accessoryValid    = accessorySelected.length > 0 && !accessoryBelowMoq;
  const accessoryTotal    = Object.values(accessoryQty).reduce((a, b) => a + b, 0);

  function stepQty(key: string, delta: number) {
    setAccessoryQty(prev => {
      const cur = prev[key] ?? 0;
      const next = delta > 0 ? (cur === 0 ? ACCESSORY_MOQ : cur + ACCESSORY_STEP) : (cur <= ACCESSORY_MOQ ? 0 : cur - ACCESSORY_STEP);
      return { ...prev, [key]: next };
    });
  }
  function clearAccessory(key: string) { setAccessoryQty(prev => ({ ...prev, [key]: 0 })); }

  const activeCat = activeCategoryId
    ? universalAccessoryCategories.find(c => c.id === activeCategoryId) ?? extraAccessoryCategories.find(c => c.id === activeCategoryId)
    : null;

  // ── Products page for a chosen category ──
  if (view === "products" && activeCat) {
    const catPcs   = countAccessoryQtyForCategory(activeCat.id, accessoryQty);
    const catCount = activeCat.items.filter(it => (accessoryQty[`${activeCat.id}-${it}`] ?? 0) > 0).length;
    return (
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border flex-shrink-0">
          <button onClick={() => { setView("categories"); setActiveCategoryId(null); }} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0" style={{ border:"none", cursor:"pointer" }}>
            <ChevronLeft size={16} strokeWidth={2}/>
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="flex items-center justify-center flex-shrink-0" style={{ width:36, height:36, borderRadius:10, background:ACCENT, color:"#fff" }}>
              <AccCatIcon id={activeCat.id} size={18}/>
            </div>
            <div className="min-w-0">
              <p className="text-foreground" style={{ fontSize:15, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{activeCat.label}</p>
              <p className="text-muted-foreground" style={{ fontSize:11 }}>{activeCat.items.length} products · min {ACCESSORY_MOQ} pcs each</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0" style={{ scrollbarWidth:"none" }}>
          <div className="flex gap-2 px-3 py-2.5 rounded-xl mb-4" style={{ background:"#fff7ed", border:"1px solid #fed7aa" }}>
            <Info size={13} style={{ color:"#c2410c", flexShrink:0, marginTop:1 }}/>
            <p style={{ fontSize:11.5, color:"#9a3412", lineHeight:1.5 }}><strong>Minimum order: {ACCESSORY_MOQ} pcs per product.</strong> Tap + to add a product at {ACCESSORY_MOQ} pcs, then adjust in steps of {ACCESSORY_STEP}.</p>
          </div>
          <p className="text-muted-foreground mb-2" style={{ fontSize:12, fontWeight:500 }}>{activeCat.label} products</p>
          <div className="flex flex-col gap-2">
            {[...activeCat.items.filter(isItemActive), ...(activeCat.id.startsWith("admin_") ? [] : extraItemsForCategory(activeCat.label, activeCat.items, "ACCESSORY").map(e => e.name))].map(item => {
              const key = `${activeCat.id}-${item}`;
              const q = accessoryQty[key] ?? 0;
              const active = q > 0;
              const inStock = isItemInStock(item);
              return (
                <div key={key} className="flex items-center gap-3 rounded-xl pl-3.5 pr-2 py-2.5" style={{ border:`1px solid ${active ? ACCENT : "var(--border)"}`, background: active ? ACCENT_BG : "var(--card)", opacity: inStock || active ? 1 : 0.45 }}>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize:13, fontWeight: active ? 600 : 500, color: active ? "#7c5419" : DARK, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item}</p>
                    {inStock || active
                      ? <p style={{ fontSize:10.5, color: active ? ACCENT_TEXT : "#9ca3af", marginTop:1 }}>{inr(accessoryRatePerPc(activeCat.id, item))}/pc{active ? ` · ${q} pcs · ${inr(q * accessoryRatePerPc(activeCat.id, item))}` : ` · min ${ACCESSORY_MOQ}`}</p>
                      : <p style={{ fontSize:10.5, color:"#dc2626", fontWeight:600, marginTop:1 }}>Out of stock — back soon</p>}
                  </div>
                  <div className="flex items-center flex-shrink-0" style={{ border:`1px solid ${active ? ACCENT : "var(--border)"}`, borderRadius:9, overflow:"hidden", background:"var(--card)" }}>
                    <button onClick={() => stepQty(key, -1)} disabled={q === 0} className="flex items-center justify-center" style={{ width:32, height:32, background:"transparent", border:"none", cursor: q === 0 ? "default" : "pointer", opacity: q === 0 ? 0.35 : 1 }}>
                      <Minus size={14} style={{ color: active ? "#7c5419" : "#6b7280" }}/>
                    </button>
                    <span style={{ fontSize:13, fontWeight:700, minWidth:42, textAlign:"center", color: active ? "#7c5419" : "#9ca3af", borderLeft:`1px solid ${active ? ACCENT : "var(--border)"}`, borderRight:`1px solid ${active ? ACCENT : "var(--border)"}`, lineHeight:"32px" }}>{q}</span>
                    <button onClick={() => inStock && stepQty(key, 1)} disabled={!inStock} className="flex items-center justify-center" style={{ width:32, height:32, background: active ? ACCENT : DARK, border:"none", cursor: inStock ? "pointer" : "not-allowed" }}>
                      <Plus size={14} style={{ color:"#fff" }}/>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex-shrink-0 px-5 py-3 border-t border-border bg-background">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-muted-foreground" style={{ fontSize:12 }}>
              {catPcs > 0 ? <><strong style={{ color:DARK }}>{catPcs} pcs</strong> · {catCount} product{catCount !== 1 ? "s" : ""}</> : "No products added yet"}
            </p>
            {catPcs > 0 && (
              <button onClick={() => activeCat.items.forEach(it => clearAccessory(`${activeCat.id}-${it}`))} style={{ fontSize:11, fontWeight:600, color:"#dc2626", background:"none", border:"none", cursor:"pointer" }}>Clear category</button>
            )}
          </div>
          <button onClick={() => { setView("categories"); setActiveCategoryId(null); }} style={btnPrimary}>
            <Check size={15} strokeWidth={2}/> Done · back to categories
          </button>
        </div>
      </div>
    );
  }

  // ── Browse categories ──
  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border flex-shrink-0">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0" style={{ border:"none", cursor:"pointer" }}>
          <ChevronLeft size={16} strokeWidth={2}/>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-foreground" style={{ fontSize:15, fontWeight:600 }}>Browse accessories</p>
          <p className="text-muted-foreground" style={{ fontSize:11 }}>Choose products · min {ACCESSORY_MOQ} pcs each</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0" style={{ scrollbarWidth:"none" }}>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-4" style={{ background:"#fff7ed", border:"1px solid #fed7aa" }}>
          <Info size={13} style={{ color:"#c2410c", flexShrink:0 }}/>
          <p style={{ fontSize:11.5, color:"#9a3412" }}>Minimum order <strong>{ACCESSORY_MOQ} pcs per product</strong>. Tap a category to choose products.</p>
        </div>
        <div className="flex flex-col gap-2">
          {[...universalAccessoryCategories.filter(c => isCategoryActive(c.label)), ...extraAccessoryCategories].map(cat => {
            const catQty = countAccessoryQtyForCategory(cat.id, accessoryQty);
            const catItemCount = Object.entries(accessoryQty).filter(([key, q]) => q > 0 && parseAccessoryQtyKey(key).categoryId === cat.id).length;
            return (
              <button key={cat.id} onClick={() => { setActiveCategoryId(cat.id); setView("products"); }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left"
                style={{ border:`1.5px solid ${catQty > 0 ? ACCENT : "var(--border)"}`, background: catQty > 0 ? ACCENT_BG : "var(--card)", cursor:"pointer" }}>
                <div className="flex items-center justify-center flex-shrink-0" style={{ width:38, height:38, borderRadius:11, background: catQty > 0 ? ACCENT : "var(--muted)", border:`1px solid ${catQty > 0 ? ACCENT : "var(--border)"}`, color: catQty > 0 ? "#fff" : "#6b7280" }}>
                  <AccCatIcon id={cat.id} size={18}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize:13, fontWeight:600, color: catQty > 0 ? "#7c5419" : DARK }}>{cat.label}</p>
                  {catQty > 0
                    ? <p style={{ fontSize:11, color:ACCENT_TEXT, fontWeight:600, marginTop:1 }}>{catQty} pcs · {catItemCount} product{catItemCount !== 1 ? "s" : ""}</p>
                    : <p style={{ fontSize:11, color:"#9ca3af", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cat.sub}</p>}
                </div>
                <ChevronRight size={16} style={{ color:"#9ca3af", flexShrink:0 }}/>
              </button>
            );
          })}
        </div>
        {accessorySelected.length > 0 && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background:"#ecfdf5", border:"1px solid #a7f3d0" }}>
            <Check size={12} style={{ color:"#059669", flexShrink:0 }} strokeWidth={2.5}/>
            <p style={{ fontSize:11, color:"#065f46", fontWeight:500 }}>{accessoryTotal} pcs across {accessorySelected.length} product{accessorySelected.length !== 1 ? "s" : ""} · {inr(accessoryOrderTotal(accessoryQty))} — ready to continue</p>
          </div>
        )}
        {accessoryBelowMoq && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
            <AlertTriangle size={12} style={{ color:"#dc2626", flexShrink:0 }}/>
            <p style={{ fontSize:11, color:"#dc2626" }}>Each product needs at least {ACCESSORY_MOQ} pcs.</p>
          </div>
        )}
      </div>
      <div className="flex-shrink-0 px-5 py-3 border-t border-border bg-background">
        <button onClick={() => { if (accessoryValid) onContinue(accessoryQty); }} disabled={!accessoryValid}
          style={{ ...(!accessoryValid ? btnPrimaryDisabled : btnPrimary), opacity: !accessoryValid ? 0.45 : 1 }}>
          Continue · Specs & references <ArrowRight size={15} strokeWidth={2}/>
        </button>
      </div>
    </div>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({ onNavigate, onTrackOrder }: { onNavigate: (tab: "home" | "order" | "track" | "account") => void; onTrackOrder: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center min-h-0">
      <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-5">
        <CheckCircle2 size={30} className="text-emerald-500" strokeWidth={1.5}/>
      </div>
      <p className="text-foreground mb-2" style={{ fontSize: 20, fontWeight: 600 }}>Order submitted!</p>
      <p className="text-muted-foreground mb-1.5 text-sm leading-relaxed">Your coordinator will confirm your order details and share the next steps shortly.</p>
      <p className="text-muted-foreground mb-8" style={{ fontSize: 11 }}>Your order reference (FL-xxxx) appears in <span className="text-foreground" style={{ fontWeight: 500 }}>Track</span> in a moment.</p>
      <div className="w-full flex flex-col gap-2.5">
        <button onClick={onTrackOrder} className="w-full bg-foreground text-white rounded-2xl py-3.5 text-sm" style={{ fontWeight: 500 }}>Track your order</button>
        <button onClick={() => onNavigate("home")} className="w-full bg-card border border-border rounded-2xl py-3.5 text-sm text-foreground" style={{ fontWeight: 500 }}>Back to Home</button>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

type OrderStep =
  | { type: "org_details" }
  | { type: "custom_audience" }
  | { type: "custom_details" }
  | { type: "individual_accessories" }
  | { type: "org_step2"; org: OrgDetails; resume?: ResumeState | null }
  | { type: "individual_step2"; custom: CustomOrderDetails; resume?: ResumeState | null }
  | { type: "success" };

export function NewOrderTab({ onNavigate, onTrackOrder, onOrderPlaced, accountType, orgType, orgName, name, phone, email, address, city, pin, onSaveDraft, resumeDraft }: { onNavigate: (tab: "home" | "order" | "track" | "account") => void; onTrackOrder: (summary?: SubmittedOrderSummary) => void; onOrderPlaced?: (summary?: SubmittedOrderSummary) => void; accountType?: "personal" | "organisation"; orgType?: string; orgName?: string; name?: string; phone?: string; email?: string; address?: string; city?: string; pin?: string; onSaveDraft?: (d: DraftPayload) => void; resumeDraft?: OrderDraft | null }) {
  const isPersonal = accountType === "personal";
  // Carry the real onboarding profile (org name/type, contact name, phone, email, saved
  // default delivery address) into the shared `currentUser` default that the rest of this
  // file reads from, so the "Organisation, contact & delivery" step and the order's
  // contact/delivery details are the person's actual details instead of hardcoded demo
  // values, and so the individual flow's Review step doesn't ask for an address the user
  // already saved during onboarding.
  currentUser = {
    name: name || "",
    org: orgName || "",
    accountType: currentUser.accountType,
    orgType: (orgTypeDefs.some(t => t.id === orgType) ? (orgType as OrgType) : currentUser.orgType),
    email: email || "",
    phone: phone || "",
    address: address || "",
    city: city || "",
    pin: pin || "",
  };
  const [step, setStep] = useState<OrderStep>(() => {
    if (resumeDraft) {
      if (resumeDraft.persona === "organisation" && resumeDraft.orgDetails) return { type: "org_step2", org: resumeDraft.orgDetails, resume: resumeDraft.resume };
      if (resumeDraft.persona === "individual" && resumeDraft.customDetails) return { type: "individual_step2", custom: resumeDraft.customDetails, resume: resumeDraft.resume };
    }
    return isPersonal ? { type: "custom_audience" } : { type: "org_details" };
  });
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const [submittedSummary, setSubmittedSummary] = useState<SubmittedOrderSummary | null>(null);

  // Feature gate: the admin portal can turn Individual (B2C) or Organisation
  // (B2B) ordering on/off (Settings → Feature Toggles). Reads live config;
  // fails open (ordering allowed) until it loads or if the backend is down.
  const gateCfg = useOrderFormConfig();
  const orderingOff = isPersonal ? gateCfg.features.b2c_orders === false : gateCfg.features.b2b_orders === false;

  const switchBanner = null;

  if (orderingOff) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Info size={24} strokeWidth={1.5} className="text-muted-foreground" />
        </div>
        <p className="text-foreground" style={{ fontSize: 16, fontWeight: 600 }}>Ordering is paused</p>
        <p className="text-muted-foreground text-sm mt-1.5" style={{ maxWidth: 280, lineHeight: 1.5 }}>
          New {isPersonal ? "individual" : "organisation"} orders are temporarily unavailable. Please check back
          soon or contact your Garm coordinator.
        </p>
        <button onClick={() => onNavigate("home")} className="mt-5 px-4 py-2.5 rounded-2xl text-sm" style={{ background: "var(--foreground)", color: "#fff", fontWeight: 500 }}>
          Back to home
        </button>
      </div>
    );
  }

  function handleSuccess(summary?: SubmittedOrderSummary, editPayload?: DraftPayload) {
    // Keep the editable snapshot on the summary so Track can reopen this order at Review.
    setSubmittedSummary(summary ? { ...summary, editPayload } : null);
    setStep({ type: "success" });
    // Create the order on the backend NOW (at submit) — so it reaches the admin
    // portal whether the customer then taps "Track your order" or "Back to Home".
    onOrderPlaced?.(summary);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {step.type === "org_details" && (
        <>
          {showSwitchConfirm && (
            <SwitchConfirmModal
              onConfirm={() => { setShowSwitchConfirm(false); setStep({ type:"custom_audience" }); }}
              onCancel={() => setShowSwitchConfirm(false)}
            />
          )}
          <OrgDetailsForm
            switchBanner={switchBanner}
            initialOrgType={orgTypeDefs.some(t => t.id === orgType) ? (orgType as OrgType) : undefined}
            onContinue={org => setStep({ type:"org_step2", org })}
            onCustomOrder={() => setStep({ type:"custom_audience" })}
          />
        </>
      )}
      {step.type === "custom_audience" && (
        <CustomAudienceForm
          onContinue={custom => setStep({ type:"individual_step2", custom })}
          onBack={() => isPersonal ? onNavigate("home") : setStep({ type:"org_details" })}
          onAccessories={() => setStep({ type:"individual_accessories" })}
        />
      )}
      {step.type === "individual_accessories" && (
        <IndividualAccessoryPicker
          onBack={() => setStep({ type:"custom_audience" })}
          onContinue={accessoryQty => setStep({ type:"individual_step2", custom: {
            garmentType: "tshirt", groupType: "personal", name: currentUser.name,
            phone: currentUser.phone, email: currentUser.email,
            address: currentUser.address, city: currentUser.city, pin: currentUser.pin,
            isAccessoryOrder: true, accessoryQty,
          } })}
        />
      )}
      {step.type === "custom_details" && (
        <CustomOrderForm
          onContinue={custom => setStep({ type:"individual_step2", custom })}
          onBack={() => setStep({ type:"custom_audience" })}
        />
      )}
      {step.type === "org_step2" && (
        <PersonaOrderForm
          persona="organisation"
          orgDetails={step.org}
          resume={step.resume}
          onSubmit={handleSuccess}
          onChangePersona={() => setStep({ type:"org_details" })}
          onSaveDraft={onSaveDraft}
        />
      )}
      {step.type === "individual_step2" && (
        <PersonaOrderForm
          persona="individual"
          customDetails={step.custom}
          resume={step.resume}
          onSubmit={handleSuccess}
          onChangePersona={() => setStep({ type:"custom_audience" })}
          onSaveDraft={onSaveDraft}
        />
      )}
      {step.type === "success" && (
        <SuccessScreen
          onNavigate={onNavigate}
          onTrackOrder={() => onTrackOrder(submittedSummary ?? undefined)}
        />
      )}
    </div>
  );
}
