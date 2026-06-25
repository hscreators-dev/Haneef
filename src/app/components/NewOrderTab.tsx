import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronDown, ChevronUp, Plus, Minus, ArrowRight, X, Check,
  Send, AlertTriangle, CheckCircle2, Upload, Camera, Image as ImageIcon,
  Wand2, Sparkles, Info, QrCode, Truck, Box, Layers, Ruler,
  Palette, Scissors, MapPin, User, Building2, Package, RotateCcw,
  Hash, Percent, ChevronRight, GraduationCap, BookOpen, Factory,
  Landmark, Trophy, Utensils, Heart, Shirt, Dumbbell, Users, Briefcase,
  Award, Smartphone, Gift, Star, Navigation, Loader2, ChevronLeft, FileText,
  Wallet, ReceiptText, ShieldCheck,
} from "lucide-react";
import { UpiLogo, upiProviderDefs, type UpiProvider } from "./AccountTab";

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

const VALIDATORS = {
  email:    (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "Enter a valid email address",
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
interface RefImg { id: number; url: string; name: string; size: number; caption: string; tag: string; digiStatus?: DigiStatus; needsDigi?: boolean }

const currentUser = {
  name: "Arjun Kumar", org: "Sri Vidya Mandir School",
  accountType: "institution" as "institution" | "individual",
  orgType: "school" as OrgType,
  email: "arjun@srividyamandir.edu.in", phone: "+91 98765 43210",
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

const orgServiceOptions: Record<OrgType, OrgServiceOption[]> = {
  school: [
    { id:"uniform",      label:"Uniform",      sub:"Shirts, pants, skirts, pinafores" },
    { id:"sports",       label:"Sports dress",  sub:"House tees, tracks, jerseys" },
    { id:"accessories",  label:"Accessories",   sub:"Browse full catalog — bottles, bags, awards, ID & more" },
  ],
  college: [
    { id:"uniform",      label:"Uniform",       sub:"Department or campus uniform" },
    { id:"lab_dress",    label:"Lab dress",      sub:"Lab coats, aprons, practical wear" },
    { id:"sports",       label:"Sports dress",   sub:"Team jerseys and tracksuits" },
    { id:"accessories",  label:"Accessories",    sub:"Browse full catalog — bottles, bags, awards, ID & more" },
  ],
  corporate: [
    { id:"formal",       label:"Office wear",   sub:"Formal shirts, trousers, blazers" },
    { id:"tshirt",       label:"Brand tees",    sub:"Polos, event tees, onboarding kits" },
    { id:"accessories",  label:"Accessories",   sub:"Browse full catalog — bottles, bags, awards, ID & more" },
  ],
  hospital: [
    { id:"scrubs",       label:"Scrubs",        sub:"Doctor, nurse and OT uniforms" },
    { id:"lab_dress",    label:"Lab coats",     sub:"Coats, aprons and patient wear" },
    { id:"accessories",  label:"Accessories",   sub:"Browse full catalog — bottles, bags, awards, ID & more" },
  ],
  industry: [
    { id:"workwear",     label:"Workwear",      sub:"Durable shirts, pants, coveralls" },
    { id:"uniform",      label:"Safety uniform",sub:"Hi-vis, FR and protective wear" },
    { id:"accessories",  label:"Accessories",   sub:"Browse full catalog — bottles, bags, awards, ID & more" },
  ],
  hospitality: [
    { id:"uniform",      label:"Staff uniform", sub:"Front desk and service wear" },
    { id:"apron",        label:"Chef / Apron wear", sub:"Kitchen, housekeeping and cafe wear" },
    { id:"accessories",  label:"Accessories",   sub:"Browse full catalog — bottles, bags, awards, ID & more" },
  ],
  sports: [
    { id:"jersey",       label:"Jerseys",       sub:"Player kits and fan wear" },
    { id:"sports",       label:"Tracksuits",    sub:"Training, warm-up and travel wear" },
    { id:"accessories",  label:"Accessories",   sub:"Browse full catalog — bottles, bags, awards, ID & more" },
  ],
  government: [
    { id:"uniform",      label:"Uniform",       sub:"Department and field uniforms" },
    { id:"formal",       label:"Formal wear",   sub:"Ceremonial and office wear" },
    { id:"accessories",  label:"Accessories",   sub:"Browse full catalog — bottles, bags, awards, ID & more" },
  ],
  ngo: [
    { id:"tshirt",       label:"Volunteer tees",sub:"Campaign and event tees" },
    { id:"uniform",      label:"Field wear",    sub:"Coordinator and staff wear" },
    { id:"accessories",  label:"Accessories",   sub:"Browse full catalog — bottles, bags, awards, ID & more" },
  ],
};

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

const sizeSets: Record<SizeCat, { label: string; hint: string }[]> = {
  mens:    [{ label:"XS",hint:'34"' },{ label:"S",hint:'36"' },{ label:"M",hint:'38-40"' },{ label:"L",hint:'42-44"' },{ label:"XL",hint:'46"' },{ label:"XXL",hint:'48"' },{ label:"3XL",hint:'50"' }],
  womens:  [{ label:"XS",hint:"UK 6" },{ label:"S",hint:"UK 8" },{ label:"M",hint:"UK 10-12" },{ label:"L",hint:"UK 14" },{ label:"XL",hint:"UK 16" },{ label:"XXL",hint:"UK 18" }],
  school:  [{ label:"3-4Y",hint:"Age 3-4" },{ label:"5-6Y",hint:"Age 5-6" },{ label:"7-8Y",hint:"Age 7-8" },{ label:"9-10Y",hint:"Age 9-10" },{ label:"11-12Y",hint:"Age 11-12" },{ label:"13-14Y",hint:"Age 13-14" },{ label:"15-16Y",hint:"Age 15-16" }],
  college: [{ label:"XS",hint:"" },{ label:"S",hint:"" },{ label:"M",hint:"" },{ label:"L",hint:"" },{ label:"XL",hint:"" },{ label:"XXL",hint:"" },{ label:"3XL",hint:"" }],
  custom:  [],
};

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

function IndividualColorSection({ onStateChange, initial }: { onStateChange?: (s: { selected: string[]; desc: string }) => void; initial?: { selected: string[]; desc: string } }) {
  const [selected, setSelected] = useState<string[]>(initial?.selected ?? []);
  const [desc, setDesc]         = useState(initial?.desc ?? "");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onStateChange?.({ selected, desc }); }, [selected, desc]);

  function toggle(hex: string) {
    setSelected(p => p.includes(hex) ? p.filter(h => h !== hex) : [...p, hex]);
  }

  return (
    <div>
      <p className="text-muted-foreground mb-3" style={{ fontSize: 12 }}>Select your preferred colors (choose one or more)</p>
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
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selected.map(h => {
            const c = individualColorPresets.find(p => p.hex === h)!;
            return (
              <div key={h} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: h, border:"1px solid rgba(0,0,0,0.12)" }}/>
                <span style={{ fontSize: 11, fontWeight: 500 }}>{c.label}</span>
                <button onClick={() => toggle(h)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af" }}><X size={11}/></button>
              </div>
            );
          })}
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

function SizeSection({ totalQty, defaultCat = "school", step = 1, onAllocationChange, onStateChange, initialCat, initialQtys }: { totalQty: number; defaultCat?: SizeCat; step?: number; onAllocationChange?: (n: number) => void; onStateChange?: (s: { cat: SizeCat; qtys: Record<string, number> }) => void; initialCat?: SizeCat; initialQtys?: Record<string, number> }) {
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
                        type="number"
                        value={q === 0 ? "" : q}
                        onChange={e => setQtyFor(s.label, Math.max(0, parseInt(e.target.value) || 0))}
                        className="text-center text-foreground bg-card border border-border rounded"
                        style={{ width: 46, fontSize: 12, fontWeight: 500, outline:"none", padding:"2px 4px" }}
                        min={0}
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
function RefImagesSection({ persona, isAccessoryOrder = false, onStateChange, initialChosen }: { persona: Persona; isAccessoryOrder?: boolean; onStateChange?: (s: { chosen: RefOption | null; logoNames: string[]; inspNames: string[] }) => void; initialChosen?: RefOption | null }) {
  const [chosen, setChosen] = useState<RefOption | null>(initialChosen ?? null);
  const [logoFiles, setLogoFiles] = useState<RefImg[]>([]);
  const [showDigiBanner, setShowDigiBanner] = useState(false);
  const [inspirationFiles, setInspirationFiles] = useState<RefImg[]>([]);
  const [showCourier, setShowCourier] = useState(false);
  const [showSwatchModal, setShowSwatchModal] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onStateChange?.({ chosen, logoNames: logoFiles.map(f => f.name), inspNames: inspirationFiles.map(f => f.name) }); }, [chosen, logoFiles, inspirationFiles]);

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
    const needsDigi = file.size < 80_000;
    setLogoFiles([{ id: imgId, url: URL.createObjectURL(file), name: file.name, size: file.size, caption:"", tag:"logo", needsDigi, digiStatus: needsDigi ? "pending" : undefined }]);
    if (needsDigi) setShowDigiBanner(true);
  }
  function processInspirationFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).slice(0, 4 - inspirationFiles.length).forEach(f => {
      imgId++;
      setInspirationFiles(p => [...p, { id: imgId, url: URL.createObjectURL(f), name: f.name, size: f.size, caption:"", tag:"garment" }]);
    });
  }
  function acceptDigi() {
    setLogoFiles(p => p.map(f => ({ ...f, digiStatus: "processing" as DigiStatus })));
    setShowDigiBanner(false);
    setTimeout(() => setLogoFiles(p => p.map(f => ({ ...f, digiStatus: "done" as DigiStatus }))), 3000);
  }

  return (
    <div>
      <p className="text-muted-foreground mb-3" style={{ fontSize: 12 }}>Pick <strong>one</strong> option — whichever is easiest for you.</p>
      <div className="flex flex-col gap-2">
        {refOptDefs.filter(opt => {
          if (isAccessoryOrder && (opt.id === "match_uniform" || opt.id === "swatch_box")) return false;
          if (persona !== "organisation" && opt.id === "swatch_box") return false;
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

export interface OrderSummaryColor { hex: string; label: string }
export interface OrderAccessorySpec { name: string; qty: number; fields: { label: string; value: string }[]; notes: string }
export interface OrderSummaryDelivery { name: string; phone: string; email?: string; address: string; city: string; pin: string }

// Display-ready price details, computed at submit so Track can render both flows cleanly:
// individuals pay a fixed price up front; organisations get an indicative estimate range.
export interface OrderPrice {
  kind: "fixed" | "estimate";
  rateLine: string;        // e.g. "₹350/pc × 2 pcs"
  addOnLine?: string;      // org only, e.g. "+₹8/pc"
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
  fabricSource: "fresh" | "surplus";
  orgColors: ColorEntry[];
  indivColors: { selected: string[]; desc: string };
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
      id: "#FL-2046",
      name: `Accessories — ${catSummary} (${totalPcs} pcs)`,
      isAccessoryOrder: true,
      serviceLabel: "Accessories",
      accessoryItems,
      totalPcs,
    };
  }

  return {
    id: "#FL-2046",
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

function OrgDetailsForm({ onContinue, onBack, onCustomOrder, switchBanner }: { onContinue: (d: OrgDetails) => void; onBack?: () => void; onCustomOrder?: () => void; switchBanner?: React.ReactNode }) {
  const ACCESSORY_MOQ = ORG_ACCESSORY_MOQ, ACCESSORY_STEP = ORG_ACCESSORY_STEP;
  const [orgType, setOrgType]       = useState<OrgType>(currentUser.orgType);
  const [service, setService]       = useState<OrgService>(orgServiceOptions[currentUser.orgType][0].id);
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

  function switchOrgType(next: OrgType) {
    setOrgType(next);
    setName(currentUser.org);
    setBoard("");
    setService(orgServiceOptions[next][0].id);
    setAccessoryQty({});
    setAccessoryView("categories");
    setActiveCategoryId(null);
    setFormStep("select");
  }

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
  const activeCat = activeCategoryId ? universalAccessoryCategories.find(c => c.id === activeCategoryId) : null;
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
            {activeCat.items.map(item => {
              const key = `${activeCat.id}-${item}`;
              const q = accessoryQty[key] ?? 0;
              const active = q > 0;
              return (
                <div key={key} className="flex items-center gap-3 rounded-xl pl-3.5 pr-2 py-2.5"
                  style={{ border:`1px solid ${active ? ACCENT : "var(--border)"}`, background: active ? ACCENT_BG : "var(--card)" }}>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize:13, fontWeight: active ? 600 : 500, color: active ? "#7c5419" : DARK, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item}</p>
                    <p style={{ fontSize:10.5, color: active ? ACCENT_TEXT : "#9ca3af", marginTop:1 }}>{inr(accessoryRatePerPc(activeCat.id, item))}/pc{active ? ` · ${q} pcs · ${inr(q * accessoryRatePerPc(activeCat.id, item))}` : ` · min ${ACCESSORY_MOQ}`}</p>
                  </div>
                  <div className="flex items-center flex-shrink-0"
                    style={{ border:`1px solid ${active ? ACCENT : "var(--border)"}`, borderRadius:9, overflow:"hidden", background:"var(--card)" }}>
                    <button onClick={() => stepAccessoryQty(key, -1)} disabled={q === 0}
                      className="flex items-center justify-center" style={{ width:32, height:32, background:"transparent", border:"none", cursor: q === 0 ? "default" : "pointer", opacity: q === 0 ? 0.35 : 1 }}>
                      <Minus size={14} style={{ color: active ? "#7c5419" : "#6b7280" }}/>
                    </button>
                    <span style={{ fontSize:13, fontWeight:700, minWidth:42, textAlign:"center", color: active ? "#7c5419" : "#9ca3af", borderLeft:`1px solid ${active ? ACCENT : "var(--border)"}`, borderRight:`1px solid ${active ? ACCENT : "var(--border)"}`, lineHeight:"32px" }}>{q}</span>
                    <button onClick={() => stepAccessoryQty(key, 1)}
                      className="flex items-center justify-center" style={{ width:32, height:32, background: active ? ACCENT : DARK, border:"none", cursor:"pointer" }}>
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
          <span className="text-xs px-2.5 py-1 rounded-lg font-semibold flex-shrink-0" style={{ background: ACCENT_BG, color:"#7c5419" }}>Step 2 of 3</span>
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
            {universalAccessoryCategories.map(cat => {
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
            <p className="text-muted-foreground" style={{ fontSize: 12 }}>Select your org type and what you want to order</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: ACCENT_BG, color:"#7c5419" }}>Step 1 · Setup</span>
        </div>

        {errors.length > 0 && (
          <div className="mb-3 rounded-xl px-3 py-2.5 bg-red-50 border border-red-200">
            {errors.map(e => <p key={e} className="flex items-center gap-1.5 text-xs text-red-600">• {e}</p>)}
          </div>
        )}

        <Section title="Organisation type" icon={Building2}>
          {/* Icon dropdown — all 9 types, each with its own icon */}
          <div className="mb-3">
            <OrgTypeSelect value={orgType} onChange={switchOrgType}/>
          </div>
          {/* Selected org description */}
          <div className="flex gap-2 px-2.5 py-2 rounded-xl bg-blue-50 border border-blue-100">
            {(() => { const t = orgTypeDefs.find(x => x.id === orgType); return t ? <t.Icon size={14} strokeWidth={1.5} style={{ color:"#1a4a8a", flexShrink:0, marginTop:1 }}/> : null; })()}
            <p style={{ fontSize: 11, color:"#1a4a8a", lineHeight: 1.5 }}>
              <strong>{orgTypeDefs.find(t => t.id === orgType)?.label}</strong> — {orgTypeDefs.find(t => t.id === orgType)?.sub}
            </p>
          </div>
        </Section>

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
              Need to order <strong>Uniform + Sports dress</strong> together? Place two separate orders — each gets its own fabric, colour and size specs.
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
          onClick={() => { if (isAccessoryOrder) { setErrors([]); setFormStep("browse"); } else handleContinue(); }}
          style={btnPrimary}>
          {isAccessoryOrder ? "Continue · Choose products" : "Continue · Step 2: Order details"} <ArrowRight size={15} strokeWidth={2}/>
        </button>
      </div>
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
          <input value={city} onChange={e => onCityChange(e.target.value)}
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
  const canContinue = !!(garmentType && groupType && name.trim() && phone.trim() && address.trim() && sizeOk && kidsDetailsOk && studentsDetailsOk && groupNotesOk);

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
    setStudents(prev => [...prev, { id: prev.length + 1, institutionName: "", department: "" }]);
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
                    type="number"
                    value={qty}
                    onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                    onBlur={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="text-center bg-card border border-border rounded-xl text-foreground"
                    style={{ width: 70, fontSize: 16, fontWeight: 600, outline:"none", padding:"6px 8px" }}
                    min={1}
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
  const [orgColors, setOrgColors] = useState<ColorEntry[]>(resume?.orgColors ?? []);
  const [indivColors, setIndivColors] = useState<{ selected: string[]; desc: string }>(resume?.indivColors ?? { selected: [], desc: "" });
  const [sizeState, setSizeState] = useState<{ cat: SizeCat; qtys: Record<string, number> }>(resume?.sizeState ?? { cat: cfg.defaultSizeCat, qtys: {} });
  const [packaging, setPackaging] = useState<{ stitch: string; packing: string }>(resume?.packaging ?? { stitch: "single_needle", packing: "bulk_loose" });
  const [refState, setRefState] = useState<{ chosen: RefOption | null; logoNames: string[]; inspNames: string[] }>(resume?.refState ?? { chosen: null, logoNames: [], inspNames: [] });
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
    address: customDetails?.address || "",
    city: customDetails?.city || "",
    pin: customDetails?.pin || "",
  });
  const [editingDelivery, setEditingDelivery] = useState(!resume);
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
  // Only block submit if user actually went to the Sizes step AND didn't finish
  const sizeIncomplete = hasSizeStep && sizeStepVisited && qty > 0 && orgSizeAllocated !== qty;

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
    ? ((customDetails.audience === "kids" ? "Kids sizing" : customDetails.audience === "women" ? "Women sizing" : "Men sizing") + " · Min 3 pcs")
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
  const garmentRate    = garmentRatePerPc(material.fabric, material.weave);
  const finishingPerPc = perPcCost(stitchingOpts.find(s => s.id === packaging.stitch)?.cost)
    + perPcCost(packagingOpts.find(p => p.id === packaging.packing)?.cost);
  const accessoryTotalAmt = accessoryOrderTotal(accessoryQtyData, accSpecState);
  // The amount an individual pays now (fixed) — garment + finishing, or accessory total.
  const individualPayable = isAccessoryOrder ? accessoryTotalAmt : qty * (garmentRate + finishingPerPc);

  // Snapshot the order as it was reopened, so Review can flag which sections changed.
  function sectionFingerprints() {
    return {
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
  const subStepLabels = isAccessoryOrgOrder
    ? ["Specs", "References", "Review"]
    : !isUniformOrder
      ? persona === "individual"
        ? ["Material", "Colors", "Sizes", "References", "Review"]
        : ["Material", "Colors", "Sizes", "Packaging", "References", "Review"]
      : ["References", "Review"];

  const totalSubSteps = subStepLabels.length;
  const currentSubStepLabel = subStepLabels[subStep - 1];

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
  const sizesStepIncomplete = currentSubStepLabel === "Sizes" && qty > 0 && orgSizeAllocated !== qty;
  // The final Review step can't submit until everything (incl. contact/delivery) is valid.
  const reviewIncomplete = currentSubStepLabel === "Review" && (sizeIncomplete || orgDataIncomplete || deliveryIncomplete);
  const currentStepBlocked = sizesStepIncomplete || reviewIncomplete;

  const blockReason = sizesStepIncomplete
    ? `Distribute all pieces to continue — ${orgSizeAllocated} of ${qty} pcs assigned`
    : (currentSubStepLabel === "Review" && sizeIncomplete)
      ? `Go back to Sizes and distribute all pieces — ${orgSizeAllocated} of ${qty} assigned`
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
        const specs = getAccessoryCategorySpecs(categoryId);
        const fields = specs ? specs.fields.map(f => ({ label: f.label, value: accSpecState[key]?.[f.label] ?? f.options[0] })) : [];
        const notes = accSpecState[key]?.__notes ?? accSpecState[`cat:${categoryId}`]?.__notes ?? "";
        return { key, name: itemName, qty: q, fields, notes };
      });
  }

  // Capture the full order — every actual selection — so Track shows real data.
  function buildFullSummary(): SubmittedOrderSummary {
    const colors = persona === "individual"
      ? indivColors.selected.map(hex => ({ hex, label: individualColorPresets.find(c => c.hex === hex)?.label ?? hex }))
      : orgColors.map(c => ({ hex: c.hex, label: c.label }));
    const sizeBreakdown = Object.entries(sizeState.qtys).filter(([, q]) => q > 0).map(([size, q]) => ({ size, qty: q }));
    const accessorySpecs = isAccessoryOrder ? buildAccessorySpecsList() : undefined;
    const accessoryItems = accessorySpecs?.map(a => ({ name: a.name, qty: a.qty }));
    const accTotal = accessoryItems?.reduce((a, b) => a + b.qty, 0) ?? 0;
    const refDef = refState.chosen ? refOptDefs.find(o => o.id === refState.chosen) : null;
    const firstColor = colors[0]?.label;

    const orderForLabel = isAccessoryOrder ? "Accessories"
      : orgDetails ? `${subLabel}${serviceLabel ? " · " + serviceLabel : ""}`
      : customDetails?.audience === "kids" ? "Kids"
      : customDetails?.audience === "women" ? "Women"
      : customDetails?.audience === "men" ? "Men"
      : "Personal";

    const name = isAccessoryOrder ? `Accessories — ${accTotal} pcs`
      : isUniformOrder ? `${subLabel} — Uniform`
      : `${material.fabric || "Custom order"}${firstColor ? " — " + firstColor : ""}`;

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
        ? { kind: "fixed", rateLine, totalLabel: "Total paid", totalValue: inr(accessoryTotalAmt),
            note: `Fixed price, paid by ${payment === "upi" ? "UPI" : "card"} to place this order.` }
        : { kind: "estimate", rateLine, totalLabel: "Estimated total", totalValue: inr(accessoryTotalAmt),
            note: "Indicative — your coordinator confirms the final price before production." };
    } else if (persona === "individual") {
      const perPc = garmentRate + finishingPerPc;
      price = {
        kind: "fixed",
        rateLine: `${qty} ${qty > 1 ? "pieces" : "piece"} × ${inr(perPc)} each`,
        totalLabel: "Total paid",
        totalValue: inr(qty * perPc),
        note: `Fixed price, paid by ${payment === "upi" ? "UPI" : "card"} to place this order.`,
      };
    } else {
      price = {
        kind: "estimate",
        rateLine: `${qty} pieces × about ${inr(garmentRate)} each`,
        addOnLine: finishingPerPc > 0 ? `+${inr(finishingPerPc)}/pc` : undefined,
        totalLabel: "Estimated total",
        totalValue: `${inr(qty * garmentRate * 0.9 + qty * finishingPerPc)} – ${inr(qty * garmentRate * 1.1 + qty * finishingPerPc)}`,
        note: "Indicative — your coordinator confirms the final price before production.",
      };
    }

    return {
      id: "#FL-2046",
      name,
      isAccessoryOrder,
      serviceLabel: serviceLabel ?? undefined,
      accessoryItems,
      totalPcs: isAccessoryOrder ? accTotal : undefined,
      persona,
      isUniform: isUniformOrder,
      orderForLabel,
      fabricSource: isAccessoryOrder || isUniformOrder ? undefined : (fabricSource === "surplus" ? "Surplus (mill stock)" : "New fabric"),
      fabric: isAccessoryOrder || isUniformOrder ? undefined : material.fabric,
      gsm: isAccessoryOrder || isUniformOrder ? undefined : material.gsm,
      weave: isAccessoryOrder || isUniformOrder ? undefined : material.weave,
      colors: isAccessoryOrder ? undefined : colors,
      colorDesc: persona === "individual" ? indivColors.desc : "",
      qty: isAccessoryOrder ? undefined : qty,
      sizeCatLabel: isAccessoryOrder || isUniformOrder ? undefined : sizeCats.find(c => c.id === sizeState.cat)?.label,
      sizeBreakdown: isAccessoryOrder ? undefined : sizeBreakdown,
      stitching: isAccessoryOrder ? undefined : stitchingOpts.find(s => s.id === packaging.stitch)?.label,
      packaging: isAccessoryOrder ? undefined : packagingOpts.find(p => p.id === packaging.packing)?.label,
      referenceMethod: refDef?.label,
      referenceFiles: refState.logoNames.length + refState.inspNames.length,
      paymentMethod: persona === "individual"
        ? (payment === "upi"
            ? (selectedUpi ? `UPI · ${selectedUpi}` : "UPI")
            : (cardData.number ? `Card · ${maskCardNum(cardData.number)}` : "Card"))
        : undefined,
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
        material, fabricSource, orgColors, indivColors, sizeState, packaging, refState,
        accSpecState, delivery, payment, savedUpis, selectedUpi, card: cardData, orgDraft, qty,
      },
    };
  }

  // ── Final Review step: previews everything selected before submission ──
  function renderReview() {
    const isAccessory = isAccessoryOrgOrder;
    const showMaterial  = !isUniformOrder && !isAccessory;
    const showColors    = !isUniformOrder && !isAccessory;
    const showSizes     = !isUniformOrder && !isAccessory;
    const showPackaging = persona === "organisation" && !isUniformOrder && !isAccessory;

    const colorChips = persona === "individual"
      ? indivColors.selected.map(hex => ({ hex, label: individualColorPresets.find(c => c.hex === hex)?.label ?? hex }))
      : orgColors.map(c => ({ hex: c.hex, label: c.label }));
    const colorDesc = persona === "individual" ? indivColors.desc.trim() : "";

    const sizeRows = Object.entries(sizeState.qtys).filter(([, q]) => q > 0);
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
      <div className="flex items-start justify-between gap-4 py-1">
        <span className="text-muted-foreground flex-shrink-0" style={{ fontSize: 12 }}>{k}</span>
        <span className="text-foreground text-right" style={{ fontSize: 12, fontWeight: 500 }}>{v}</span>
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

        {/* Material */}
        {showMaterial && (
          <div className={card}>
            {header("Material", "Material", "material")}
            <div className="px-3.5 py-3">
              {line("Fabric source", fabricSource === "surplus" ? "Surplus (mill stock)" : "New fabric")}
              {line("Fabric", material.fabric || "—")}
              {line("GSM weight", material.gsm || "—")}
              {line("Weave", material.weave || "—")}
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
                        <span style={{ fontSize: 11, fontWeight: 500 }}>{c.label}</span>
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
              {line("Sizing", sizeCats.find(c => c.id === sizeState.cat)?.label ?? "—")}
              {sizeRows.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {sizeRows.map(([sz, q]) => (
                    <span key={sz} className="px-2 py-0.5 rounded-lg bg-muted border border-border" style={{ fontSize: 11, fontWeight: 500, color: DARK }}>{sz}: {q}</span>
                  ))}
                </div>
              )}
              {sizeIncomplete && (
                <div className="mt-2 flex gap-1.5 px-2.5 py-2 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle size={11} className="text-red-500 flex-shrink-0 mt-0.5"/>
                  <p className="text-red-700" style={{ fontSize: 11 }}>{orgSizeAllocated} of {qty} pcs assigned — tap Change to finish the size split.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Packaging */}
        {showPackaging && (
          <div className={card}>
            {header("Stitching & packaging", "Packaging", "packaging")}
            <div className="px-3.5 py-3">
              {line("Stitching", stitchLabel)}
              {line("Packaging", packLabel)}
            </div>
          </div>
        )}

        {/* References */}
        <div className={card}>
          {header("References & samples", "References", "references")}
          <div className="px-3.5 py-3">
            {refDef
              ? <>{line("Method", refDef.label)}{refFileCount > 0 && line("Files attached", `${refFileCount} file${refFileCount > 1 ? "s" : ""}`)}</>
              : <p className="text-muted-foreground" style={{ fontSize: 12 }}>No reference added — your coordinator will reach out for design details.</p>}
          </div>
        </div>

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
                      <input value={orgDraft.city} onChange={e => setOrgDraft(p => ({ ...p, city: e.target.value }))} placeholder="City" className={INP} style={fnt}/>
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
                        <input value={delivery.city} onChange={e => setDelivery(p => ({ ...p, city: e.target.value }))} placeholder="City" className={INP} style={fnt}/>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>PIN *</p>
                        <input value={delivery.pin} onChange={e => setDelivery(p => ({ ...p, pin: e.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="6-digit PIN" inputMode="numeric" maxLength={6} className={INP} style={fnt}/>
                        <FieldError msg={delivery.pin ? VALIDATORS.pin(delivery.pin) : ""}/>
                      </div>
                    </div>
                    <button onClick={() => { if (!deliveryIncomplete) setEditingDelivery(false); }} disabled={deliveryIncomplete}
                      style={{ ...(deliveryIncomplete ? btnPrimaryDisabled : btnPrimary), padding: "11px 20px" }}>
                      <Check size={14}/> Save delivery address
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
                      <p style={{ fontSize: 11, color: "#065f46", lineHeight: 1.5 }}>Delivery address saved. Tap Change to edit or use current location.</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Payment */}
            <div className={card}>
              <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ background: "var(--muted)", borderBottom: "0.5px solid var(--border)" }}>
                <QrCode size={13} style={{ color: ACCENT }}/>
                <p style={{ fontSize: 12, fontWeight: 700, color: DARK }}>Payment method</p>
              </div>
              <div className="px-3.5 py-3">
                {([["upi", "UPI", "Google Pay, PhonePe, Paytm & more", QrCode], ["card", "Card", "Credit or debit card", Box]] as const).map(([id, lbl2, sub, Ic]) => {
                  const sel = payment === id;
                  return (
                    <button key={id} onClick={() => setPayment(id)} className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left mb-2 last:mb-0 transition-all"
                      style={{ border: `1.5px solid ${sel ? DARK : "var(--border)"}`, background: sel ? "rgba(13,13,13,0.03)" : "var(--card)", cursor: "pointer" }}>
                      <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ border: `2px solid ${sel ? DARK : "#d1d5db"}`, background: sel ? DARK : "var(--card)" }}>
                        {sel && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                      </div>
                      <Ic size={16} strokeWidth={1.5} style={{ color: sel ? DARK : "#6b7280" }}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-sm" style={{ fontWeight: sel ? 600 : 400 }}>{lbl2}</p>
                        <p className="text-muted-foreground" style={{ fontSize: 11 }}>{sub}</p>
                      </div>
                    </button>
                  );
                })}

                {/* ── Quick-pay UPI apps (same as Payment details in account) ── */}
                {payment === "upi" && (
                  <>
                    <p className="text-muted-foreground mt-1 mb-2" style={{ fontSize: 11, fontWeight: 500 }}>Pay instantly via</p>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {(Object.keys(upiProviderDefs) as UpiProvider[]).map(key => {
                        const sel = upiApp === key;
                        return (
                          <button key={key} onClick={() => setUpiApp(key)}
                            className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-transform active:scale-95"
                            style={{ cursor: "pointer", background: sel ? ACCENT_BG : "var(--card)", border: `1.5px solid ${sel ? DARK : "var(--border)"}` }}>
                            <UpiLogo provider={key} size={32}/>
                            <span style={{ fontSize: 10, fontWeight: sel ? 600 : 500, color: "var(--foreground)" }}>{upiProviderDefs[key].label.split(" ")[0]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* ── Expanded UPI detail ── */}
                {payment === "upi" && (
                  <div className="mt-1 mb-2 rounded-xl" style={{ border: "0.5px solid var(--border)", overflow: "hidden" }}>
                    {savedUpis.map((u) => {
                      const sel = selectedUpi === u;
                      return (
                        <div key={u} className="w-full flex items-center gap-2.5 px-3 py-2.5 transition-all"
                          style={{ background: sel ? ACCENT_BG : "var(--card)", borderBottom: "0.5px solid var(--border)" }}>
                          <button onClick={() => setSelectedUpi(u)} className="flex-1 flex items-center gap-2.5 text-left" style={{ cursor: "pointer", background: "transparent", border: "none", padding: 0 }}>
                            <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center" style={{ border: `2px solid ${sel ? DARK : "#d1d5db"}`, background: sel ? DARK : "var(--card)" }}>
                              {sel && <div className="w-1 h-1 rounded-full bg-white"/>}
                            </div>
                            <QrCode size={14} strokeWidth={1.5} style={{ color: sel ? DARK : "#6b7280" }}/>
                            <span className="text-sm text-foreground" style={{ fontWeight: sel ? 600 : 400, wordBreak: "break-all" }}>{u}</span>
                          </button>
                          <span style={{ fontSize: 9, fontWeight: 700, color: ACCENT_TEXT, background: ACCENT_BG, padding: "2px 6px", borderRadius: 4, letterSpacing: 0.5, flexShrink: 0 }}>UPI</span>
                          <button onClick={() => { setSavedUpis(prev => prev.filter(x => x !== u)); if (selectedUpi === u) setSelectedUpi(""); }} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }} aria-label="Remove UPI ID">
                            <X size={13} style={{ color: "#9ca3af" }}/>
                          </button>
                        </div>
                      );
                    })}
                    {showUpiAdd ? (
                      <div className="px-3 py-3">
                        <p style={{ fontSize: 11, fontWeight: 600, color: DARK, marginBottom: 6 }}>Add UPI ID</p>
                        <div className="flex gap-2">
                          <input
                            value={upiInput}
                            onChange={(e) => { setUpiInput(e.target.value); if (upiError) setUpiError(""); }}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUpi(); } }}
                            placeholder="yourname@bank"
                            autoCapitalize="none" autoCorrect="off" spellCheck={false}
                            className="flex-1 rounded-lg px-3 py-2 text-sm min-w-0"
                            style={{ border: `1px solid ${upiError ? "#dc2626" : "var(--border)"}`, background: "var(--card)", outline: "none", color: DARK }}
                          />
                          <button onClick={addUpi} className="rounded-lg px-4 text-sm flex-shrink-0" style={{ background: DARK, color: "#fff", fontWeight: 600, cursor: "pointer", border: "none" }}>Save</button>
                        </div>
                        {upiError && <p style={{ fontSize: 10.5, color: "#dc2626", marginTop: 5 }}>{upiError}</p>}
                        <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 5 }}>Works with Google Pay, PhonePe, Paytm & any UPI app.</p>
                      </div>
                    ) : (
                      <button onClick={() => setShowUpiAdd(true)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left" style={{ background: "var(--card)", cursor: "pointer", border: "none" }}>
                        <Plus size={14} style={{ color: ACCENT }}/>
                        <span className="flex-1 text-sm" style={{ color: ACCENT_TEXT, fontWeight: 600 }}>Add new UPI ID</span>
                        <ChevronRight size={14} style={{ color: "#9ca3af" }}/>
                      </button>
                    )}
                  </div>
                )}

                {/* ── Expanded Card detail ── */}
                {payment === "card" && (
                  <div className="mt-1 mb-2 rounded-xl px-3 py-3" style={{ border: "0.5px solid var(--border)" }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: DARK }}>Card number</label>
                    <input
                      value={cardData.number}
                      onChange={(e) => { setCardData(c => ({ ...c, number: formatCardNum(e.target.value) })); if (cardErrors.number) setCardErrors(x => ({ ...x, number: undefined })); }}
                      onBlur={(e) => { const d = e.target.value.replace(/\D/g, ""); setCardErrors(x => ({ ...x, number: d && d.length < 13 ? "Enter a valid card number" : undefined })); }}
                      inputMode="numeric" placeholder="1234 5678 9012 3456"
                      className="w-full rounded-lg px-3 py-2 text-sm mt-1"
                      style={{ border: `1px solid ${cardErrors.number ? "#dc2626" : "var(--border)"}`, background: "var(--card)", outline: "none", color: DARK, letterSpacing: 1 }}
                    />
                    {cardErrors.number && <p style={{ fontSize: 10.5, color: "#dc2626", marginTop: 4 }}>{cardErrors.number}</p>}

                    <div className="flex gap-2 mt-2.5">
                      <div className="flex-1 min-w-0">
                        <label style={{ fontSize: 11, fontWeight: 600, color: DARK }}>Expiry</label>
                        <input
                          value={cardData.expiry}
                          onChange={(e) => { setCardData(c => ({ ...c, expiry: formatExpiry(e.target.value) })); if (cardErrors.expiry) setCardErrors(x => ({ ...x, expiry: undefined })); }}
                          onBlur={(e) => { const v = e.target.value; setCardErrors(x => ({ ...x, expiry: v && !validExpiry(v) ? "MM/YY" : undefined })); }}
                          inputMode="numeric" placeholder="MM/YY" maxLength={5}
                          className="w-full rounded-lg px-3 py-2 text-sm mt-1"
                          style={{ border: `1px solid ${cardErrors.expiry ? "#dc2626" : "var(--border)"}`, background: "var(--card)", outline: "none", color: DARK }}
                        />
                        {cardErrors.expiry && <p style={{ fontSize: 10.5, color: "#dc2626", marginTop: 4 }}>{cardErrors.expiry}</p>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <label style={{ fontSize: 11, fontWeight: 600, color: DARK }}>CVV</label>
                        <input
                          value={cardCvv}
                          onChange={(e) => { setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4)); if (cardErrors.cvv) setCardErrors(x => ({ ...x, cvv: undefined })); }}
                          onBlur={(e) => { const v = e.target.value; setCardErrors(x => ({ ...x, cvv: v && v.length < 3 ? "3–4 digits" : undefined })); }}
                          type="password" inputMode="numeric" placeholder="•••" maxLength={4}
                          className="w-full rounded-lg px-3 py-2 text-sm mt-1"
                          style={{ border: `1px solid ${cardErrors.cvv ? "#dc2626" : "var(--border)"}`, background: "var(--card)", outline: "none", color: DARK }}
                        />
                        {cardErrors.cvv && <p style={{ fontSize: 10.5, color: "#dc2626", marginTop: 4 }}>{cardErrors.cvv}</p>}
                      </div>
                    </div>

                    <div className="mt-2.5">
                      <label style={{ fontSize: 11, fontWeight: 600, color: DARK }}>Name on card</label>
                      <input
                        value={cardData.name}
                        onChange={(e) => setCardData(c => ({ ...c, name: e.target.value }))}
                        placeholder="As printed on card"
                        className="w-full rounded-lg px-3 py-2 text-sm mt-1"
                        style={{ border: "1px solid var(--border)", background: "var(--card)", outline: "none", color: DARK }}
                      />
                    </div>
                    <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 8, lineHeight: 1.5 }}>Saved securely for your coordinator's payment link. Your card is not charged now and the CVV is never stored.</p>
                  </div>
                )}

                <div className="mt-1 flex gap-1.5 px-2.5 py-2 rounded-lg" style={{ background: ACCENT_BG, border: `0.5px solid ${ACCENT}` }}>
                  <Info size={11} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }}/>
                  <p style={{ fontSize: 11, color: "#7c5419", lineHeight: 1.5 }}>Fixed price — pay {inr(individualPayable)} now by {payment === "upi" ? "UPI" : "card"} to place your order.{isAccessoryOrder ? "" : " Stitching & packaging are included in this price."} Your coordinator confirms fit before production.</p>
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

                {accessorySpecs ? catItems.map(({ key, name }, idx) => (
                  <div key={key} className="rounded-2xl overflow-hidden border border-border mb-4">
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5" style={{ background: "var(--muted)", borderBottom: "0.5px solid var(--border)" }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white" style={{ background: DARK, fontSize: 11, fontWeight: 700 }}>
                        {idx + 1}
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: DARK }}>{name}</p>
                    </div>
                    <div className="px-3.5 py-3 flex flex-col gap-3">
                      {accessorySpecs.fields.map((field, fi) => (
                        <div key={fi}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{field.label}</p>
                          {field.hint && (
                            <p style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4 }}>{field.hint}</p>
                          )}
                          <SelectField options={field.options}
                            value={accSpecState[key]?.[field.label] ?? field.options[0]}
                            onChange={v => setAccSpec(key, field.label, v)}
                            priceFor={fi === 0 ? (opt => ` · ${inr(Math.round(accessoryRatePerPc(catId, name) * accessoryMaterialMultiplier(opt) / accessoryMaterialMultiplier(field.options[0])))}/pc`) : undefined} />
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
                )) : (
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

    if (label === "Material") {
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
              <div className="grid grid-cols-2 gap-2 mb-4">
                {([["fresh","New fabric","New production run"],["surplus","Surplus fabric","Mill leftover stock · Discounted"]] as const).map(([id, lbl2, sub]) => (
                  <button key={id} onClick={() => setFabricSource(id)}
                    className="flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl text-left"
                    style={{ border:`1.5px solid ${fabricSource===id ? DARK : "var(--border)"}`, background: fabricSource===id ? "rgba(13,13,13,0.04)" : "var(--card)", cursor:"pointer" }}>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ border:`2px solid ${fabricSource===id ? DARK : "#d1d5db"}`, background: fabricSource===id ? DARK : "var(--card)" }}>
                        {fabricSource===id && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: fabricSource===id ? DARK : "#111827" }}>{lbl2}</span>
                    </div>
                    <span style={{ fontSize: 11, color:"#9ca3af", marginLeft: 22 }}>{sub}</span>
                  </button>
                ))}
              </div>
              {fabricSource === "surplus" && (
                <div className="mb-3 flex gap-1.5 px-2.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
                  <RotateCcw size={12} style={{ color:"#065f46", flexShrink:0, marginTop:1 }}/>
                  <p style={{ fontSize: 11, color:"#065f46", lineHeight: 1.5 }}>Surplus fabric is leftover mill stock — same quality, up to 30% cheaper. Availability confirmed before production.</p>
                </div>
              )}

              <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>{cfg.fabricLabel}</p>
              <div className="mb-3"><SelectField options={cfg.fabricOptions} value={material.fabric} onChange={v => setMaterial(m => ({ ...m, fabric: v }))} priceFor={o => ` · ${inr(fabricRatePerPc(o))}/pc`} /></div>

              <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>GSM weight</p>
              <div className="mb-3"><SelectField options={cfg.gsmOptions} value={material.gsm} onChange={v => setMaterial(m => ({ ...m, gsm: v }))} /></div>

              <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Weave</p>
              <SelectField options={cfg.weaveOptions} value={material.weave} onChange={v => setMaterial(m => ({ ...m, weave: v }))} priceFor={o => { const a = weaveAddOnPerPc(o); return a > 0 ? ` · +${inr(a)}/pc` : ` · included`; }} />
            </Section>
          )}
        </div>
      );
    }

    if (label === "Colors") {
      if (persona === "individual") {
        return <Section title="Colors" icon={Palette}><IndividualColorSection onStateChange={setIndivColors} initial={resume ? indivColors : undefined}/></Section>;
      }
      return <Section title="Colors" icon={Palette}><ColorSection onStateChange={setOrgColors} initial={resume ? orgColors : undefined}/></Section>;
    }

    if (label === "Sizes") {
      return (
        <Section title="Quantity & size distribution" icon={Layers}>
          <SizeInfoBanner minQty={cfg.minQty}/>
          <p className="text-muted-foreground mb-2" style={{ fontSize: 12 }}>Total pieces (minimum {cfg.minQty})</p>
          <div className="flex items-center gap-2.5 mb-4">
            <button onClick={() => setQty(q => Math.max(cfg.minQty, q - cfg.qtyStep))} className="w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center" style={{ cursor:"pointer" }}><Minus size={15}/></button>
            <div className="flex-1 flex items-center justify-center gap-1.5">
              <input
                type="number"
                value={qty}
                onChange={e => {
                  const v = parseInt(e.target.value) || cfg.minQty;
                  setQty(Math.max(cfg.minQty, v));
                }}
                onBlur={e => { const v = parseInt(e.target.value) || cfg.minQty; setQty(Math.max(cfg.minQty, v)); }}
                className="text-center bg-card border border-border rounded-xl text-foreground"
                style={{ width: 80, fontSize: 16, fontWeight: 600, outline:"none", padding:"6px 8px" }}
                min={cfg.minQty}
              />
              <span className="text-muted-foreground" style={{ fontSize: 13 }}>pcs</span>
            </div>
            <button onClick={() => setQty(q => q + cfg.qtyStep)} className="w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center" style={{ cursor:"pointer" }}><Plus size={15}/></button>
          </div>

          {/* Price — fixed for individuals (pay to order), indicative range for organisations.
              Based on the chosen fabric + weave; finishing add-ons apply at the Packaging step. */}
          {(() => {
            if (persona === "individual") {
              const perPc = garmentRate + finishingPerPc;
              return (
                <div className="rounded-xl px-3.5 py-3 mb-1" style={{ background:"#EFF6FF", border:"1px solid #BFDBFE" }}>
                  <div className="flex items-center justify-between">
                    <p style={{ fontSize:12, color:"#1a4a8a", fontWeight:600 }}>Total payable</p>
                    <p style={{ fontSize:15, color:"#1a4a8a", fontWeight:700 }}>{inr(qty * perPc)}</p>
                  </div>
                  <p style={{ fontSize:10.5, color:"#315f8f", marginTop:3, lineHeight:1.5 }}>
                    Fixed price · {qty} {qty > 1 ? "pieces" : "piece"} × {inr(perPc)} each. Pay now by UPI or card to place your order.
                  </p>
                </div>
              );
            }
            const low = qty * garmentRate * 0.9 + qty * finishingPerPc, high = qty * garmentRate * 1.1 + qty * finishingPerPc;
            return (
              <div className="rounded-xl px-3.5 py-3 mb-1" style={{ background:"#EFF6FF", border:"1px solid #BFDBFE" }}>
                <div className="flex items-center justify-between">
                  <p style={{ fontSize:12, color:"#1a4a8a", fontWeight:600 }}>Estimated total</p>
                  <p style={{ fontSize:15, color:"#1a4a8a", fontWeight:700 }}>{inr(low)} – {inr(high)}</p>
                </div>
                <p style={{ fontSize:10.5, color:"#315f8f", marginTop:3, lineHeight:1.5 }}>
                  {qty} pieces × about {inr(garmentRate)} each. Finishing &amp; packaging add-ons adjust this — your coordinator confirms the final price.
                </p>
              </div>
            );
          })()}

          <div className="my-3 border-t border-border"/>
          <p className="text-foreground text-xs mb-2.5" style={{ fontWeight: 500 }}>Size distribution</p>
          <SizeSection totalQty={qty} defaultCat={cfg.defaultSizeCat} step={persona === "individual" ? 1 : 10} onAllocationChange={setOrgSizeAllocated} onStateChange={setSizeState} initialCat={resume ? sizeState.cat : undefined} initialQtys={resume ? sizeState.qtys : undefined}/>
          <div className="my-3 border-t border-border"/>
          <p className="text-foreground text-xs mb-2" style={{ fontWeight: 500 }}>Additional notes</p>
          <textarea placeholder={`${subLabel} — department, special finishing, branding or OEKO-TEX requirements…`}
            className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-xs outline-none resize-none h-16" style={fnt}/>
          {/* Size incomplete warning only on Sizes step */}
          {sizeIncomplete && (
            <div className="mt-3 flex gap-1.5 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
              <AlertTriangle size={12} className="text-red-500 flex-shrink-0 mt-0.5"/>
              <p className="text-red-700 text-xs">Size distribution incomplete — {orgSizeAllocated} of {qty} pcs assigned. Please allocate all pieces before submitting.</p>
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
          <Section title="References & samples" icon={ImageIcon}><RefImagesSection persona={persona} isAccessoryOrder={isAccessoryOrgOrder} onStateChange={setRefState} initialChosen={resume ? refState.chosen : undefined}/></Section>
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
              {currentSubStepLabel === "Packaging" ? "Stitching & Packaging" : currentSubStepLabel}
            </p>
            <p className="text-muted-foreground" style={{ fontSize: 11 }}>
              Step 2 · {subStep} of {totalSubSteps}
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

        {/* Persona pill */}
        <div className="flex items-center justify-between mb-4 px-3 py-2.5 rounded-xl" style={{ background: accentBg }}>
          <div className="flex items-center gap-2">
            {persona === "organisation"
              ? <Building2 size={16} strokeWidth={1.5} style={{ color: accentC }}/>
              : <User size={16} strokeWidth={1.5} style={{ color: accentC }}/>}
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: accentC }}>{subLabel}</p>
              <p className="text-muted-foreground" style={{ fontSize: 11 }}>{subName ?? (persona === "organisation" ? "Bulk order · Custom specs" : "Personalised order")}</p>
            </div>
          </div>
          <button onClick={() => setShowConfirmChange(true)} className="text-xs px-2.5 py-1 rounded-xl bg-card border border-border text-foreground" style={{ cursor:"pointer" }}>Change</button>
        </div>

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
            : `${qty} ${qty > 1 ? "pieces" : "piece"} × ${inr(perPc)} each`;

          // Full cost breakdown rows (shown when the card is expanded).
          const stitchOpt = stitchingOpts.find(s => s.id === packaging.stitch);
          const packOpt   = packagingOpts.find(p => p.id === packaging.packing);
          const stitchCost = perPcCost(stitchOpt?.cost), packCost = perPcCost(packOpt?.cost);
          const weaveCost  = weaveAddOnPerPc(material.weave);
          const breakdown: { label: string; value: string; strong?: boolean }[] = isAccessoryOrder
            ? Object.entries(accessoryQtyData).filter(([, q]) => q > 0).map(([key, q]) => {
                const { categoryId, itemName } = parseAccessoryQtyKey(key);
                const r = accessoryItemRate(categoryId, itemName, accSpecState[key]);
                return { label: `${itemName} · ${q} × ${inr(r)}`, value: inr(q * r) };
              })
            : [
                { label: material.fabric || "Fabric", value: `${inr(fabricRatePerPc(material.fabric))}/pc` },
                { label: `Weave · ${material.weave || "Plain"}`, value: weaveCost > 0 ? `+${inr(weaveCost)}/pc` : "included" },
                { label: `Stitching · ${stitchOpt?.label ?? "Standard"}`, value: stitchCost > 0 ? `+${inr(stitchCost)}/pc` : "included" },
                { label: `Packaging · ${packOpt?.label ?? "Standard"}`, value: packCost > 0 ? `+${inr(packCost)}/pc` : "included" },
                { label: "Per piece", value: inr(perPc), strong: true },
                { label: "Quantity", value: `${qty} pcs` },
              ];

          const low = qty * garmentRate * 0.9 + qty * finishingPerPc, high = qty * garmentRate * 1.1 + qty * finishingPerPc;

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
                          <p style={{ fontSize:10.5, color:"rgba(255,255,255,0.62)" }} className="truncate">{priceExpanded ? `Pay by ${payment === "upi" ? "UPI" : "card"}` : "Tap to see full breakdown"}</p>
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

        <div className="flex gap-3">
          {/* Back button — always visible */}
          <button
            onClick={() => subStep > 1 ? setSubStep(s => s - 1) : setShowConfirmChange(true)}
            className="w-12 h-12 rounded-2xl border border-border flex items-center justify-center bg-card flex-shrink-0">
            <ChevronDown size={16} style={{ transform: "rotate(90deg)" }} className="text-foreground"/>
          </button>

          {/* Next, or jump back to Review after an edit, or Submit */}
          {subStep < totalSubSteps ? (
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
                ? <>{`Pay ${inr(individualPayable)} & place order`}</>
                : <><Send size={14}/> Submit my order</>}
            </button>
          )}
        </div>
      </div>

      {/* Submit confirm modal */}
      {showConfirmSubmit && (
        <Overlay center>
          <div className="bg-background rounded-2xl p-5 text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: ACCENT_BG }}>
              <Send size={20} style={{ color: ACCENT }}/>
            </div>
            <p className="text-foreground mb-1.5" style={{ fontSize: 16, fontWeight: 700 }}>{persona === "individual" ? `Pay ${inr(individualPayable)} & place order?` : "Submit my order?"}</p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-5">{persona === "individual"
              ? <>You'll pay the fixed price of {inr(individualPayable)} by {payment === "upi" ? "UPI" : "card"} to place your order. Your coordinator confirms fit before production.</>
              : <>Your coordinator will confirm the order details and share the final price &amp; next steps shortly. You can still request changes after submitting.</>}</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => { setShowConfirmSubmit(false); onSubmit(buildFullSummary(), buildDraftPayload()); }} style={{ ...btnPrimary, padding:"12px 20px" }}>
                <Check size={15}/> {persona === "individual" ? `Pay ${inr(individualPayable)} now` : "Yes, submit order"}
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
        <button onClick={continueCustom} style={btnPrimary}>
          Continue custom order <ArrowRight size={15} strokeWidth={2}/>
        </button>
      </div>
    </div>
  );
}

// ─── Individual Accessory Picker (same catalog & MOQ rules as organisation) ────
function IndividualAccessoryPicker({ onContinue, onBack }: { onContinue: (qty: Record<string, number>) => void; onBack: () => void }) {
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

  const activeCat = activeCategoryId ? universalAccessoryCategories.find(c => c.id === activeCategoryId) : null;

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
            {activeCat.items.map(item => {
              const key = `${activeCat.id}-${item}`;
              const q = accessoryQty[key] ?? 0;
              const active = q > 0;
              return (
                <div key={key} className="flex items-center gap-3 rounded-xl pl-3.5 pr-2 py-2.5" style={{ border:`1px solid ${active ? ACCENT : "var(--border)"}`, background: active ? ACCENT_BG : "var(--card)" }}>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize:13, fontWeight: active ? 600 : 500, color: active ? "#7c5419" : DARK, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item}</p>
                    <p style={{ fontSize:10.5, color: active ? ACCENT_TEXT : "#9ca3af", marginTop:1 }}>{inr(accessoryRatePerPc(activeCat.id, item))}/pc{active ? ` · ${q} pcs · ${inr(q * accessoryRatePerPc(activeCat.id, item))}` : ` · min ${ACCESSORY_MOQ}`}</p>
                  </div>
                  <div className="flex items-center flex-shrink-0" style={{ border:`1px solid ${active ? ACCENT : "var(--border)"}`, borderRadius:9, overflow:"hidden", background:"var(--card)" }}>
                    <button onClick={() => stepQty(key, -1)} disabled={q === 0} className="flex items-center justify-center" style={{ width:32, height:32, background:"transparent", border:"none", cursor: q === 0 ? "default" : "pointer", opacity: q === 0 ? 0.35 : 1 }}>
                      <Minus size={14} style={{ color: active ? "#7c5419" : "#6b7280" }}/>
                    </button>
                    <span style={{ fontSize:13, fontWeight:700, minWidth:42, textAlign:"center", color: active ? "#7c5419" : "#9ca3af", borderLeft:`1px solid ${active ? ACCENT : "var(--border)"}`, borderRight:`1px solid ${active ? ACCENT : "var(--border)"}`, lineHeight:"32px" }}>{q}</span>
                    <button onClick={() => stepQty(key, 1)} className="flex items-center justify-center" style={{ width:32, height:32, background: active ? ACCENT : DARK, border:"none", cursor:"pointer" }}>
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
          {universalAccessoryCategories.map(cat => {
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

function SuccessScreen({ onNavigate, onTrackOrder }: { onNavigate: (tab: string) => void; onTrackOrder: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center min-h-0">
      <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-5">
        <CheckCircle2 size={30} className="text-emerald-500" strokeWidth={1.5}/>
      </div>
      <p className="text-foreground mb-2" style={{ fontSize: 20, fontWeight: 600 }}>Order submitted!</p>
      <p className="text-muted-foreground mb-1.5 text-sm leading-relaxed">Your coordinator will confirm your order details and share the next steps shortly.</p>
      <p className="text-muted-foreground mb-8" style={{ fontSize: 11 }}>Reference: <span className="text-foreground" style={{ fontWeight: 500 }}>#FL-2046</span></p>
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

export function NewOrderTab({ onNavigate, onTrackOrder, accountType, onSaveDraft, resumeDraft }: { onNavigate: (tab: "home" | "order" | "track" | "account") => void; onTrackOrder: (summary?: SubmittedOrderSummary) => void; accountType?: "personal" | "organisation"; onSaveDraft?: (d: DraftPayload) => void; resumeDraft?: OrderDraft | null }) {
  const isPersonal = accountType === "personal";
  const [step, setStep] = useState<OrderStep>(() => {
    if (resumeDraft) {
      if (resumeDraft.persona === "organisation" && resumeDraft.orgDetails) return { type: "org_step2", org: resumeDraft.orgDetails, resume: resumeDraft.resume };
      if (resumeDraft.persona === "individual" && resumeDraft.customDetails) return { type: "individual_step2", custom: resumeDraft.customDetails, resume: resumeDraft.resume };
    }
    return isPersonal ? { type: "custom_audience" } : { type: "org_details" };
  });
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const [submittedSummary, setSubmittedSummary] = useState<SubmittedOrderSummary | null>(null);

  const switchBanner = null;

  function handleSuccess(summary?: SubmittedOrderSummary, editPayload?: DraftPayload) {
    // Keep the editable snapshot on the summary so Track can reopen this order at Review.
    setSubmittedSummary(summary ? { ...summary, editPayload } : null);
    setStep({ type: "success" });
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
            phone: currentUser.phone, email: currentUser.email, address: "", city: "", pin: "",
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
