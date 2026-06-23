import { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronDown, ChevronUp, Plus, Minus, ArrowRight, X, Check,
  Send, AlertTriangle, CheckCircle2, Upload, Camera, Image as ImageIcon,
  Wand2, Sparkles, Info, QrCode, Truck, Box, Layers, Ruler,
  Palette, Scissors, MapPin, User, Building2, Package, RotateCcw,
  Hash, Percent, ChevronRight,
} from "lucide-react";

const ACCENT = "#C8A97E";
const ACCENT_BG = "rgba(200,169,126,0.12)";
const DARK = "#0D0D0D";
const INP = "w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none";
const fnt: React.CSSProperties = { fontFamily: "DM Sans, sans-serif" };

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
  { id: "school" as OrgType,       emoji: "🏫", label: "School",              sub: "K-12 uniforms & sportswear" },
  { id: "college" as OrgType,      emoji: "🎓", label: "College / University", sub: "Batch wear & campus events" },
  { id: "corporate" as OrgType,    emoji: "🏢", label: "Corporate",            sub: "Office wear & branded apparel" },
  { id: "hospital" as OrgType,     emoji: "🏥", label: "Hospital / Clinic",    sub: "Scrubs, lab coats & patient wear" },
  { id: "industry" as OrgType,     emoji: "🏭", label: "Industry / Factory",   sub: "Workwear, safety & uniforms" },
  { id: "hospitality" as OrgType,  emoji: "🏨", label: "Hotel / Hospitality",  sub: "Staff uniforms & aprons" },
  { id: "sports" as OrgType,       emoji: "⚽", label: "Sports Club / Team",   sub: "Jerseys, tracksuits & kits" },
  { id: "government" as OrgType,   emoji: "🏛️", label: "Government / PSU",    sub: "Formal & department uniforms" },
  { id: "ngo" as OrgType,          emoji: "🤝", label: "NGO / Trust",          sub: "Volunteer tees & event wear" },
];

const orgServiceOptions: Record<OrgType, OrgServiceOption[]> = {
  school: [
    { id:"uniform", label:"Uniform", sub:"Shirts, pants, skirts, pinafores" },
    { id:"sports", label:"Sports dress", sub:"House tees, tracks, jerseys" },
    { id:"accessories", label:"Accessories", sub:"Tie, socks, belt, cap, NCC, RSS, cap, badge, bow", accessories:["Tie","Socks","Belt","Cap","NCC set","RSS set","Badge","Bow","ID lace","House sash"] },
  ],
  college: [
    { id:"uniform", label:"Uniform", sub:"Department or campus uniform" },
    { id:"lab_dress", label:"Lab dress", sub:"Lab coats, aprons, practical wear" },
    { id:"sports", label:"Sports dress", sub:"Team jerseys and tracksuits" },
    { id:"accessories", label:"Accessories", sub:"Lab caps, ID lace, badges, event caps", accessories:["ID lace","Lab cap","Department badge","Event cap","Tie","Scarf","Belt"] },
  ],
  corporate: [
    { id:"formal", label:"Office wear", sub:"Formal shirts, trousers, blazers" },
    { id:"tshirt", label:"Brand tees", sub:"Polos, event tees, onboarding kits" },
    { id:"accessories", label:"Accessories", sub:"Caps, scarves, bags, lanyards", accessories:["Cap","Lanyard","Scarf","Tie","Laptop sleeve","Tote bag","ID badge"] },
  ],
  hospital: [
    { id:"scrubs", label:"Scrubs", sub:"Doctor, nurse and OT uniforms" },
    { id:"lab_dress", label:"Lab coats", sub:"Coats, aprons and patient wear" },
    { id:"accessories", label:"Accessories", sub:"Caps, masks, utility add-ons", accessories:["Surgical cap","Mask","Apron","Name badge","Patient wrist tag","Utility pouch"] },
  ],
  industry: [
    { id:"workwear", label:"Workwear", sub:"Durable shirts, pants, coveralls" },
    { id:"uniform", label:"Safety uniform", sub:"Hi-vis, FR and protective wear" },
    { id:"accessories", label:"Accessories", sub:"Caps, belts and safety add-ons", accessories:["Safety cap","Belt","Reflective band","Name patch","Apron","Arm sleeve"] },
  ],
  hospitality: [
    { id:"uniform", label:"Staff uniform", sub:"Front desk and service wear" },
    { id:"apron", label:"Apron / chef wear", sub:"Kitchen, housekeeping and cafe wear" },
    { id:"accessories", label:"Accessories", sub:"Caps, scarves, ties and tags", accessories:["Chef cap","Apron","Scarf","Bow tie","Name tag","Waist belt"] },
  ],
  sports: [
    { id:"jersey", label:"Jerseys", sub:"Player kits and fan wear" },
    { id:"sports", label:"Tracksuits", sub:"Training, warm-up and travel wear" },
    { id:"accessories", label:"Accessories", sub:"Caps, bags and number add-ons", accessories:["Cap","Kit bag","Wrist band","Head band","Number patch","Socks"] },
  ],
  government: [
    { id:"uniform", label:"Uniform", sub:"Department and field uniforms" },
    { id:"formal", label:"Formal wear", sub:"Ceremonial and office wear" },
    { id:"accessories", label:"Accessories", sub:"Caps, belts, badges and add-ons", accessories:["Cap","Belt","Badge","Shoulder patch","Tie","Name plate"] },
  ],
  ngo: [
    { id:"tshirt", label:"Volunteer tees", sub:"Campaign and event tees" },
    { id:"uniform", label:"Field wear", sub:"Coordinator and staff wear" },
    { id:"accessories", label:"Accessories", sub:"Caps, bags and campaign kits", accessories:["Cap","Tote bag","Badge","Scarf","ID lace","Campaign sash"] },
  ],
};

function activeServiceLabel(type: OrgType, id: OrgService) {
  return orgServiceOptions[type].find(o => o.id === id)?.label ?? id;
}

const orgCfg: Record<OrgType, { minQty: number; defaultQty: number; qtyStep: number; defaultSizeCat: SizeCat; fabricLabel: string; fabricOptions: string[]; gsmOptions: string[]; weaveOptions: string[]; nameLabel: string; namePlaceholder: string; regLabel: string; regPlaceholder: string }> = {
  school:      { minQty: 50,  defaultQty: 200, qtyStep: 50,  defaultSizeCat: "school",  fabricLabel: "Fabric type",    fabricOptions: ["100% Cotton Pique","Cotton-Poly Blend","100% Polyester","Linen Blend","Heavy Cotton Twill"],                  gsmOptions: ["160–180 GSM (polo shirts)","180–220 GSM (shirts)","240–280 GSM (jackets)"],          weaveOptions: ["Plain","Pique","Twill","Oxford"],                nameLabel: "School name",                namePlaceholder: "e.g. St. Mary's High School",      regLabel: "Board / Affiliation",                        regPlaceholder: "e.g. CBSE, ICSE, State Board" },
  college:     { minQty: 100, defaultQty: 500, qtyStep: 50,  defaultSizeCat: "college", fabricLabel: "Fabric type",    fabricOptions: ["Cotton-Poly Blend (Dri-fit)","100% Cotton","Fleece / Sweatshirt","Micro Pique","Heavy GSM for Hoodies"],     gsmOptions: ["160–180 GSM (tees)","200–240 GSM (sweatshirts)","280–320 GSM (hoodies)"],          weaveOptions: ["Plain","Pique","French Terry","Fleece"],         nameLabel: "College / University name",  namePlaceholder: "e.g. PSG College of Technology",   regLabel: "Affiliated under",                           regPlaceholder: "e.g. Anna University, Autonomous" },
  corporate:   { minQty: 50,  defaultQty: 300, qtyStep: 50,  defaultSizeCat: "mens",   fabricLabel: "Fabric type",    fabricOptions: ["Oxford Cotton (formal shirts)","Cotton-Poly Blend (polo)","Premium Pique","Linen Blend","Dri-fit (branded tees)"], gsmOptions: ["120–140 GSM (summer wear)","180–200 GSM (formal shirts)","220–260 GSM (polos)"],  weaveOptions: ["Oxford","Plain","Pique","Twill"],                nameLabel: "Company name",               namePlaceholder: "e.g. Tata Consultancy Services",   regLabel: "Industry / Sector",                          regPlaceholder: "e.g. IT, Finance, Manufacturing" },
  hospital:    { minQty: 50,  defaultQty: 150, qtyStep: 25,  defaultSizeCat: "mens",   fabricLabel: "Garment type",   fabricOptions: ["Medical scrubs (Cotton-Poly)","Lab coats (100% Cotton)","Patient gowns (soft cotton)","OT wear (poly-cotton)"], gsmOptions: ["130–160 GSM (patient gowns)","180–200 GSM (scrubs & lab coats)","220–240 GSM"], weaveOptions: ["Plain weave","Twill","Ripstop"],                  nameLabel: "Hospital / Clinic name",     namePlaceholder: "e.g. Apollo Hospitals, City Clinic", regLabel: "Registration / NABH no.",                    regPlaceholder: "e.g. NABH-2024-XXXX" },
  industry:    { minQty: 100, defaultQty: 500, qtyStep: 100, defaultSizeCat: "mens",   fabricLabel: "Workwear type",  fabricOptions: ["Heavy cotton twill (workwear)","Poly-Cotton Ripstop (durable)","FR Cotton (fire-retardant)","100% Polyester (hi-vis)"], gsmOptions: ["240–280 GSM (standard workwear)","300–340 GSM (heavy duty)","360+ GSM (protective)"], weaveOptions: ["Twill","Ripstop","Plain","Canvas"],             nameLabel: "Company / Factory name",     namePlaceholder: "e.g. Mahindra Industries",         regLabel: "Industry type",                              regPlaceholder: "e.g. Automotive, Textile, Construction" },
  hospitality: { minQty: 30,  defaultQty: 100, qtyStep: 25,  defaultSizeCat: "mens",   fabricLabel: "Fabric type",    fabricOptions: ["Premium Cotton-Poly (staff shirts)","Cotton Twill (trousers & aprons)","Pique knit (polo uniforms)","Chef coat cotton"], gsmOptions: ["160–180 GSM (shirts)","200–240 GSM (aprons)","260–300 GSM (chef coats)"], weaveOptions: ["Plain","Twill","Pique","Oxford"],                nameLabel: "Hotel / Restaurant name",    namePlaceholder: "e.g. Taj Hotels, The Grand Brasserie", regLabel: "Property type",                              regPlaceholder: "e.g. 5-star hotel, Restaurant chain" },
  sports:      { minQty: 20,  defaultQty: 100, qtyStep: 20,  defaultSizeCat: "college",fabricLabel: "Sports fabric",  fabricOptions: ["Dri-fit Polyester (jerseys)","Mesh knit (ventilated kits)","Compression spandex blend","Fleece (tracksuits)"], gsmOptions: ["100–130 GSM (jerseys & singlets)","160–180 GSM (training wear)","280–320 GSM (tracksuits)"], weaveOptions: ["Knit (jersey)","Mesh","Interlock","Fleece"],   nameLabel: "Club / Team name",           namePlaceholder: "e.g. Chennai Super Kings, ABC FC",  regLabel: "Sport / League",                             regPlaceholder: "e.g. Cricket, Football, Basketball" },
  government:  { minQty: 100, defaultQty: 500, qtyStep: 100, defaultSizeCat: "mens",   fabricLabel: "Fabric type",    fabricOptions: ["Heavy Cotton Twill (uniforms)","Poly-Cotton Blend (formal)","100% Cotton (summer wear)","Wool Blend (winter formal)"], gsmOptions: ["180–220 GSM (standard uniform)","240–280 GSM (formal & ceremonial)","300–340 GSM (winter)"], weaveOptions: ["Twill","Plain","Serge","Oxford"],            nameLabel: "Department / Organisation name", namePlaceholder: "e.g. Tamil Nadu Police, TNEB",  regLabel: "Department code / Ministry",                 regPlaceholder: "e.g. Home Dept., Ministry of Health" },
  ngo:         { minQty: 20,  defaultQty: 100, qtyStep: 20,  defaultSizeCat: "college",fabricLabel: "Fabric type",    fabricOptions: ["100% Cotton (tees & polos)","Organic Cotton (eco-friendly)","Cotton-Poly Blend","Recycled Polyester","Bamboo Blend"], gsmOptions: ["140–160 GSM (lightweight tees)","180–200 GSM (standard)","220–240 GSM (polo & jackets)"], weaveOptions: ["Plain","Pique","Jersey knit"],              nameLabel: "NGO / Trust name",           namePlaceholder: "e.g. Teach For India, HelpAge India", regLabel: "Registration number (optional)",              regPlaceholder: "e.g. 80G / FCRA no." },
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
  { id:"school_uniform" as GarmentType, emoji:"🏫", label:"Uniform" },
  { id:"tshirt"         as GarmentType, emoji:"👕", label:"T-shirt design" },
  { id:"shirt"          as GarmentType, emoji:"👔", label:"Shirt design" },
  { id:"polo"           as GarmentType, emoji:"🧵", label:"Polo / Collar" },
  { id:"hoodie"         as GarmentType, emoji:"🧥", label:"Hoodie / Sweatshirt" },
  { id:"sportswear"     as GarmentType, emoji:"⚽", label:"Sportswear / Kit" },
  { id:"dress"          as GarmentType, emoji:"👗", label:"Dress / Frock" },
  { id:"formal"         as GarmentType, emoji:"🤵", label:"Formal wear" },
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

const refOptDefs = [
  { id:"upload_logo"    as RefOption, emoji:"🖼️", label:"Upload logo / design file",   sub:"Any photo works — we digitise it for free",    badge:"Free digitise", badgeCls:"bg-emerald-50 text-emerald-700" },
  { id:"inspiration"    as RefOption, emoji:"📸", label:"Share a style photo",          sub:"Screenshot, Instagram, Pinterest — anything",  badge:null },
  { id:"match_uniform"  as RefOption, emoji:"👕", label:"Match my existing uniform",    sub:"Send us a sample — we identify fabric & GSM",  badge:"Recommended",   badgeCls:"bg-blue-50 text-blue-700" },
  { id:"swatch_box"     as RefOption, emoji:"📦", label:"Send me a fabric swatch box",  sub:"Feel the fabrics before you commit",           badge:"Free",          badgeCls:"bg-emerald-50 text-emerald-700" },
];

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
    <button onClick={onSelect} className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left mb-2 transition-all" style={{ border: `1.5px solid ${selected ? DARK : "rgba(0,0,0,0.08)"}`, background: selected ? "rgba(13,13,13,0.03)" : "#fff", cursor:"pointer" }}>
      <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ border: `2px solid ${selected ? DARK : "#d1d5db"}`, background: selected ? DARK : "#fff" }}>
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

function SizeInfoBanner({ minQty }: { minQty?: number }) {
  return (
    <div className="rounded-2xl p-3 mb-3 bg-blue-50 border border-blue-100">
      <div className="flex items-start gap-2">
        <Info size={13} style={{ color:"#1a4a8a", flexShrink:0, marginTop:2 }}/>
        <div>
          <p style={{ fontSize:12, color:"#1a4a8a", fontWeight:700 }}>Size guide before production</p>
          <p style={{ fontSize:11, color:"#315f8f", lineHeight:1.55, marginTop:3 }}>
            Kids use age sizes, men use chest sizes, and women use UK sizes. Add exact quantities for every size; your coordinator will confirm measurements before cutting.
          </p>
          {minQty && <p style={{ fontSize:11, color:"#1a4a8a", fontWeight:600, marginTop:5 }}>Minimum quantity: {minQty} pcs</p>}
        </div>
      </div>
    </div>
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
                <button key={d} onClick={() => setDate(d)} className="py-2.5 rounded-xl text-xs" style={{ background: date===d ? DARK : "#f3f4f6", color: date===d ? "#fff" : "#374151", border:"none", cursor:"pointer", fontWeight: date===d ? 600 : 400 }}>{d}</button>
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
                  <p style={{ fontSize: 11, fontWeight: 600, color: DARK }}>FABRICLINK SAMPLE · #SP-0821</p>
                  <p style={{ fontSize: 10, color: "#9ca3af" }}>FabricLink Pvt. Ltd., Coimbatore 641001</p>
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

function IndividualColorSection() {
  const [selected, setSelected] = useState<string[]>([]);
  const [desc, setDesc]         = useState("");

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

let cid = 10;
function ColorSection() {
  const [colors, setColors] = useState<ColorEntry[]>([{ id:1, hex:"#1a2540", pantone:"PMS 289 C", label:"Navy Blue", position:"" }]);
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState("#c8a84b");
  const [pantone, setPantone] = useState("");
  const [lbl, setLbl] = useState("");
  const [pos, setPos] = useState("");
  const [preset, setPreset] = useState<string | null>(null);
  const fRef = useRef<HTMLInputElement>(null);

  function add() {
    cid++;
    setColors(p => [...p, { id: cid, hex, pantone, label: lbl || hex, position: pos }]);
    setOpen(false); setPantone(""); setLbl(""); setPreset(null); setPos("");
  }

  function fromPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    const mocks = [["#3a5a8a","Steel Blue"],["#a85a3a","Terracotta"],["#5a8a3a","Sage Green"]];
    const [h, l] = mocks[Math.floor(Math.random() * 3)];
    setHex(h); setLbl(l); setOpen(true); setPos("");
  }

  return (
    <div>
      <p className="text-muted-foreground mb-2" style={{ fontSize: 12 }}>Colors in this order</p>
      {colors.length === 0 && (
        <div className="text-xs text-muted-foreground rounded-xl py-3 text-center border border-dashed border-border mb-3">No colors yet — tap + Add Color</div>
      )}
      <div className="flex flex-col gap-2 mb-3">
        {colors.map(c => (
          <div key={c.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted border border-border">
            <div className="w-7 h-7 rounded-full flex-shrink-0 border-2 border-white shadow-sm" style={{ background: c.hex }}/>
            <div className="flex-1 min-w-0">
              <p className="text-foreground" style={{ fontSize: 13, fontWeight: 500 }}>{c.label}</p>
              {c.pantone && <p className="text-muted-foreground" style={{ fontSize: 11 }}>{c.pantone}</p>}
              {c.position && <p className="text-muted-foreground" style={{ fontSize: 11 }}>📍 {c.position}</p>}
            </div>
            <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-card border border-border" style={{ fontFamily:"monospace" }}>{c.hex}</span>
            <button onClick={() => setColors(p => p.filter(x => x.id !== c.id))} style={{ background:"transparent", border:"none", cursor:"pointer", color:"#9ca3af" }}><X size={14}/></button>
          </div>
        ))}
      </div>

      {!open ? (
        <div className="flex gap-2">
          <button onClick={() => setOpen(true)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs border border-dashed" style={{ background: ACCENT_BG, color:"#7c5419", borderColor: ACCENT, cursor:"pointer", fontWeight: 500 }}>
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
              <button key={s.hex} onClick={() => { setPreset(s.hex); setHex(s.hex); setLbl(s.label); }} title={s.label}
                className="w-7 h-7 rounded-full" style={{ background: s.hex, border: preset===s.hex ? `2.5px solid ${DARK}` : "2px solid #fff", boxShadow:"0 0 0 1px #d1d5db", cursor:"pointer", outline:"none" }}/>
            ))}
          </div>
          <div className="flex gap-2 mb-2.5">
            <div className="relative w-10 h-9 rounded-xl border border-border overflow-hidden flex-shrink-0" style={{ background: hex }}>
              <input type="color" value={hex} onChange={e => { setHex(e.target.value); setPreset(null); }} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
            </div>
            <input type="text" value={hex} onChange={e => setHex(e.target.value)} className={INP + " flex-1"} style={{ ...fnt, fontFamily:"monospace" }}/>
          </div>
          <div className="flex gap-2 mb-2">
            <input type="text" value={lbl} onChange={e => setLbl(e.target.value)} placeholder="Color name" className={INP + " flex-1"} style={fnt}/>
            <input type="text" value={pantone} onChange={e => setPantone(e.target.value)} placeholder="Pantone (optional)" className={INP + " flex-1"} style={fnt}/>
          </div>
          <input type="text" value={pos} onChange={e => setPos(e.target.value)} placeholder="Placement (e.g. Front chest, Collar, Sleeve)" className={INP + " mb-3 block"} style={fnt}/>
          <div className="flex gap-2">
            <button onClick={add} className="flex-1 py-2.5 rounded-xl text-sm" style={{ background: DARK, color:"#fff", border:"none", cursor:"pointer", fontWeight: 500 }}>Add to order</button>
            <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl text-sm bg-card border border-border text-muted-foreground" style={{ cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Size Section ─────────────────────────────────────────────────────────────

function SizeSection({ totalQty, defaultCat = "school", step = 1, onAllocationChange }: { totalQty: number; defaultCat?: SizeCat; step?: number; onAllocationChange?: (n: number) => void }) {
  const [cat, setCat] = useState<SizeCat>(defaultCat);
  const [showCat, setShowCat] = useState(false);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [customSizes, setCustomSizes] = useState<string[]>([]);
  const [customIn, setCustomIn] = useState("");
  const [mode, setMode] = useState<"qty" | "pct">("qty");

  useEffect(() => { setCat(defaultCat); setQtys({}); setShowCat(false); }, [defaultCat]);

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
            <button key={c.id} onClick={() => { setCat(c.id); setQtys({}); setShowCat(false); }} className="w-full flex items-center justify-between px-3.5 py-2.5 border-b border-border last:border-0 text-left" style={{ background: cat===c.id ? ACCENT_BG : "#fff", cursor:"pointer" }}>
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
              <button onClick={() => setMode("qty")} className="px-2 py-0.5 rounded text-xs flex items-center gap-0.5" style={{ background: mode==="qty" ? DARK : "#f3f4f6", color: mode==="qty" ? "#fff" : "#6b7280", border:"none", cursor:"pointer", fontWeight: mode==="qty" ? 500 : 400 }}>
                <Hash size={9}/> pcs
              </button>
              <button onClick={() => setMode("pct")} className="px-2 py-0.5 rounded text-xs flex items-center gap-0.5" style={{ background: mode==="pct" ? DARK : "#f3f4f6", color: mode==="pct" ? "#fff" : "#6b7280", border:"none", cursor:"pointer", fontWeight: mode==="pct" ? 500 : 400 }}>
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
                    <div className="text-center text-foreground" style={{ width: 50, fontSize: 12, fontWeight: 500 }}>{mode==="pct" ? `${pct}%` : `${q}`}</div>
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

function PackagingSection() {
  const [stitch, setStitch] = useState("single_needle");
  const [packing, setPacking] = useState("bulk_loose");
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
function RefImagesSection({ persona }: { persona: Persona }) {
  const [chosen, setChosen] = useState<RefOption | null>(null);
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
        {refOptDefs.filter(opt => persona === "organisation" || opt.id !== "swatch_box").map(opt => {
          const isChosen = chosen === opt.id;
          const isModal = opt.id === "match_uniform" || opt.id === "swatch_box";
          return (
            <div key={opt.id}>
              <button onClick={() => selectOption(opt.id)} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-left transition-all" style={{ border: `1.5px solid ${isChosen ? DARK : "rgba(0,0,0,0.10)"}`, background: "#fff", cursor:"pointer", borderRadius: isChosen && !isModal ? "16px 16px 0 0" : 16 }}>
                <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center" style={{ border: `2px solid ${isChosen ? DARK : "#d1d5db"}`, background: isChosen ? DARK : "#fff" }}>
                  {isChosen && <div className="w-2.5 h-2.5 rounded-full bg-white"/>}
                </div>
                <span className="flex-shrink-0" style={{ fontSize: 20, lineHeight: 1 }}>{opt.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>{opt.label}</p>
                  <p className="text-muted-foreground" style={{ fontSize: 12, marginTop: 3, lineHeight: 1.45 }}>{opt.sub}</p>
                </div>
                {opt.badge && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${opt.badgeCls}`}>{opt.badge}</span>
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
        {/* Organisation */}
        <button onClick={() => onSelect("organisation")} className="w-full text-left rounded-2xl overflow-hidden" style={{ border:`2px solid ${DARK}`, cursor:"pointer", background:"#fff" }}>
          <div className="px-4 py-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-blue-50">🏛️</div>
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
            <span style={{ fontSize: 12, color:"rgba(255,255,255,0.7)" }}>Minimum 50 pcs · Bulk pricing</span>
            <ChevronRight size={15} color="rgba(255,255,255,0.6)" strokeWidth={1.5}/>
          </div>
        </button>

        {/* Individual */}
        <button onClick={() => onSelect("individual")} className="w-full text-left rounded-2xl overflow-hidden" style={{ border:`2px solid ${ACCENT}`, cursor:"pointer", background:"#fff" }}>
          <div className="px-4 py-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: ACCENT_BG }}>👤</div>
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
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 text-2xl">👤</div>
        <p className="text-foreground text-center mb-1.5" style={{ fontSize: 15, fontWeight: 700 }}>Making a personal purchase?</p>
        <p className="text-muted-foreground text-center text-xs mb-3">You are currently logged in as</p>
        <div className="px-3 py-2 rounded-xl text-center bg-blue-50 mb-3">
          <p className="text-blue-800" style={{ fontSize: 13, fontWeight: 600 }}>🏛️ {currentUser.org}</p>
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

function OrgDetailsForm({ onContinue, onBack, onCustomOrder, switchBanner }: { onContinue: (d: OrgDetails) => void; onBack?: () => void; onCustomOrder?: () => void; switchBanner?: React.ReactNode }) {
  const [orgType, setOrgType]       = useState<OrgType>(currentUser.orgType);
  const [service, setService]       = useState<OrgService>(orgServiceOptions[currentUser.orgType][0].id);
  const [accessoryQty, setAccessoryQty] = useState<Record<string, number>>({});
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
  const isAccessoryOrder = !!selectedOpt?.accessories;
  const accessoryTotal = Object.values(accessoryQty).reduce((a, b) => a + b, 0);

  function switchOrgType(next: OrgType) {
    setOrgType(next);
    setName(currentUser.org);
    setBoard("");
    setService(orgServiceOptions[next][0].id);
    setAccessoryQty({});
  }

  function selectService(id: OrgService) {
    setService(id);
    setAccessoryQty({});
  }

  function stepAccessoryQty(key: string, delta: number) {
    setAccessoryQty(prev => ({ ...prev, [key]: Math.max(0, (prev[key] ?? 0) + delta) }));
  }

  function handleContinue() {
    const errs: string[] = [];
    if (isAccessoryOrder && accessoryTotal === 0) errs.push("Add quantity for at least one accessory item");
    setErrors(errs);
    if (errs.length > 0) return;
    onContinue({ type: orgType, service, isAccessoryOrder, accessoryQty, name, board, address, city, pin, contactName, contactPhone, contactEmail });
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
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-lg">🏛️</div>
          <div className="flex-1">
            <p className="text-foreground" style={{ fontSize: 17, fontWeight: 600 }}>Organisation order</p>
            <p className="text-muted-foreground" style={{ fontSize: 12 }}>Select your org type and what you want to order</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: ACCENT_BG, color:"#7c5419" }}>Step 1 of 2</span>
        </div>

        {errors.length > 0 && (
          <div className="mb-3 rounded-xl px-3 py-2.5 bg-red-50 border border-red-200">
            {errors.map(e => <p key={e} className="flex items-center gap-1.5 text-xs text-red-600">• {e}</p>)}
          </div>
        )}

        <Section title="Organisation type" icon={Building2}>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {orgTypeDefs.map(t => (
              <button key={t.id} onClick={() => switchOrgType(t.id)}
                className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-center transition-all"
                style={{ border:`1.5px solid ${orgType===t.id ? DARK : "rgba(0,0,0,0.08)"}`, background: orgType===t.id ? "rgba(13,13,13,0.04)" : "#fff", cursor:"pointer" }}>
                <span style={{ fontSize: 22 }}>{t.emoji}</span>
                <span style={{ fontSize: 10, fontWeight: orgType===t.id ? 700 : 400, color: orgType===t.id ? DARK : "#374151", lineHeight: 1.3 }}>{t.label}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2 px-2.5 py-2 rounded-xl bg-blue-50 border border-blue-100">
            <span style={{ fontSize: 14, flexShrink: 0 }}>{orgTypeDefs.find(t => t.id === orgType)?.emoji}</span>
            <p style={{ fontSize: 11, color:"#1a4a8a", lineHeight: 1.5 }}>
              <strong>{orgTypeDefs.find(t => t.id === orgType)?.label}</strong> — {orgTypeDefs.find(t => t.id === orgType)?.sub}
            </p>
          </div>
        </Section>

        <Section title="What would you like to order?" icon={Scissors}>
          <p className="text-muted-foreground mb-3" style={{ fontSize:12 }}>Select <strong>one category</strong> per order. For multiple categories, place separate orders.</p>
          <div className="flex flex-col gap-2">
            {activeServiceOptions.map(opt => {
              const isSelected = service === opt.id;
              const isAccOpt = !!opt.accessories;
              return (
                <div key={opt.id} className="rounded-xl overflow-hidden" style={{ border:`1.5px solid ${isSelected ? DARK : "rgba(0,0,0,0.08)"}`, background: isSelected ? "rgba(13,13,13,0.03)" : "#fff" }}>
                  {/* Radio row */}
                  <button onClick={() => selectService(opt.id)}
                    className="w-full flex items-center gap-3 px-3.5 py-3 text-left"
                    style={{ background:"transparent", border:"none", cursor:"pointer" }}>
                    {/* Radio circle */}
                    <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center" style={{ border:`2px solid ${isSelected ? DARK : "#d1d5db"}`, background: isSelected ? DARK : "#fff" }}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white"/>}
                    </div>
                    <div className="flex-1">
                      <p className="text-foreground text-sm" style={{ fontWeight:600 }}>{opt.label}</p>
                      <p className="text-muted-foreground" style={{ fontSize:11, marginTop:1 }}>{opt.sub}</p>
                    </div>
                    {isAccOpt && (
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background:"rgba(200,169,126,0.15)", color:"#7c5419", fontWeight:500 }}>Qty here</span>
                    )}
                    {!isAccOpt && (
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background:"#f0f0f0", color:"#6b7280", fontWeight:500 }}>Qty next</span>
                    )}
                  </button>

                  {/* Accessories: quantity per item right here in Step 1 */}
                  {isSelected && isAccOpt && (
                    <div className="px-3.5 pb-3.5">
                      <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl mb-3" style={{ background:"#fef3c7", border:"0.5px solid #fbbf24" }}>
                        <Info size={11} style={{ color:"#d97706", flexShrink:0 }}/>
                        <p style={{ fontSize:11, color:"#92400e" }}>Accessories don't need fabric or size distribution — set quantities below and proceed directly to references.</p>
                      </div>
                      <p className="text-foreground mb-2" style={{ fontSize:12, fontWeight:500 }}>How many of each item?</p>
                      <div className="grid grid-cols-2 gap-2">
                        {opt.accessories!.map(item => {
                          const key = `${orgType}-${item}`;
                          const q = accessoryQty[key] ?? 0;
                          return (
                            <div key={key} className="rounded-xl bg-card border border-border px-2.5 py-2.5">
                              <p className="text-foreground mb-2" style={{ fontSize:11, fontWeight:600 }}>{item}</p>
                              <div className="flex items-center justify-between">
                                <button onClick={() => stepAccessoryQty(key, -1)} className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center" style={{ cursor:"pointer" }}><Minus size={11}/></button>
                                <span style={{ fontSize:13, fontWeight:700, color: q > 0 ? DARK : "#9ca3af" }}>{q}</span>
                                <button onClick={() => stepAccessoryQty(key, 1)} className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center" style={{ cursor:"pointer" }}><Plus size={11}/></button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {accessoryTotal > 0 && (
                        <div className="mt-3 flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
                          <Check size={11} className="text-emerald-600" strokeWidth={2.5}/>
                          <p style={{ fontSize:11, color:"#065f46", fontWeight:500 }}>{accessoryTotal} items added — ready to continue</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Non-accessory: just a hint that qty comes in Step 2 */}
                  {isSelected && !isAccOpt && (
                    <div className="px-3.5 pb-3">
                      <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl" style={{ background: ACCENT_BG, border:`0.5px solid ${ACCENT}` }}>
                        <Info size={11} style={{ color: ACCENT, flexShrink:0 }}/>
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

      <div className="flex-shrink-0 px-5 py-3 border-t border-border bg-background">
        <button
          onClick={handleContinue}
          disabled={isAccessoryOrder && accessoryTotal === 0}
          className="w-full bg-foreground text-white rounded-2xl py-3.5 flex items-center justify-center gap-2 text-sm"
          style={{ fontWeight:500, opacity: isAccessoryOrder && accessoryTotal === 0 ? 0.45 : 1, cursor: isAccessoryOrder && accessoryTotal === 0 ? "not-allowed" : "pointer" }}>
          {isAccessoryOrder ? "Continue · Step 2: References & submit" : "Continue · Step 2: Order details"} <ArrowRight size={15} strokeWidth={2}/>
        </button>
      </div>
    </div>
  );
}

// ─── Custom Order Form (Individual / Step 1) ──────────────────────────────────

interface CustomOrderDetails { garmentType: GarmentType; groupType: GroupType; audience?: CustomAudience; name: string; phone: string; email: string; address: string; city: string; pin: string }

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
    { label:"👨 Men",      sizes:menSizes,   qtys:menQtys,   setQty:(l:string,v:number)=>setMenQtys(p=>({...p,[l]:v})),   total:totalM, color:"#3b82f6" },
    { label:"👩 Women",    sizes:womenSizes, qtys:womenQtys, setQty:(l:string,v:number)=>setWomenQtys(p=>({...p,[l]:v})), total:totalW, color:"#ec4899" },
    { label:"🧒 Children", sizes:childSizes, qtys:childQtys, setQty:(l:string,v:number)=>setChildQtys(p=>({...p,[l]:v})), total:totalC, color:"#f59e0b" },
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
    <div className="mt-2 rounded-xl overflow-hidden border border-blue-100 bg-white">
      <div className="flex items-center justify-between px-3 py-2 bg-blue-50">
        <p style={{ fontSize: 11, fontWeight: 600, color:"#1a4a8a" }}>👕 Size & quantity for this child</p>
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
  const [phone, setPhone]   = useState("");
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
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: ACCENT_BG }}>👤</div>
          <div className="flex-1">
            <p className="text-foreground" style={{ fontSize: 17, fontWeight: 600 }}>Custom order</p>
            <p className="text-muted-foreground" style={{ fontSize: 12 }}>Fully personalised · From 1 pc</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: ACCENT_BG, color:"#7c5419" }}>Step 1 of 2</span>
        </div>

        <Section title="What would you like?" icon={Scissors}>
          <div className="grid grid-cols-4 gap-2">
            {garmentTypes.map(g => (
              <button key={g.id} onClick={() => selectGarmentType(g.id)}
                className="flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl text-center"
                style={{ border:`1.5px solid ${garmentType===g.id ? DARK : "rgba(0,0,0,0.08)"}`, background: garmentType===g.id ? "rgba(13,13,13,0.04)" : "#fff", cursor:"pointer" }}>
                <span style={{ fontSize: 20 }}>{g.emoji}</span>
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
                {([{ id:"kids" as GroupType, emoji:"👶", label:"Kids", sub:"Age 3–16 · School sizing", borderC:"#bfdbfe", bg:"#E0F0FF", tc:"#1a4a8a" }, { id:"students" as GroupType, emoji:"🎒", label:"Students", sub:"College / Teen wear", borderC:"#fde68a", bg:"#fef3c7", tc:"#92400e" }]).map(g => (
                  <button key={g.id}
                    onClick={() => { if (sizeAllocated > 0 && g.id !== groupType) { setPendingGroupChange(g.id); } else { setGroupType(g.id); } }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left"
                    style={{ border:`2px solid ${groupType===g.id ? g.borderC : "rgba(0,0,0,0.08)"}`, background: groupType===g.id ? g.bg : "#fafafa", cursor:"pointer" }}>
                    <span style={{ fontSize: 20 }}>{g.emoji}</span>
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
                <span style={{ fontSize: 13 }}>💡</span>
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
                  <p style={{ fontSize: 11, fontWeight: 600, color:"#1a4a8a" }}>👶 Kids order details</p>
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
                                  {lvl==="school" ? "🏫 School" : "🎓 College"}
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
                      Child 1 at school and Child 2 at college? Toggle 🏫/🎓 per child — sizes update automatically.
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
                  <p style={{ fontSize: 11, fontWeight: 600, color:"#92400e" }}>🎒 Student order details</p>
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
              {([{ id:"family" as GroupType, emoji:"👨‍👩‍👧‍👦", label:"Family" }, { id:"friends" as GroupType, emoji:"👫", label:"Friends" }, { id:"personal" as GroupType, emoji:"👤", label:"Personal" }, { id:"event" as GroupType, emoji:"🎉", label:"Event" }]).map(g => (
                <button key={g.id}
                  onClick={() => { if (sizeAllocated > 0 && g.id !== groupType) { setPendingGroupChange(g.id); } else { setGroupType(g.id); } }}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-center"
                  style={{ border:`1.5px solid ${groupType===g.id ? DARK : "rgba(0,0,0,0.08)"}`, background: groupType===g.id ? "rgba(13,13,13,0.04)" : "#fafafa", cursor:"pointer" }}>
                  <span style={{ fontSize: 16 }}>{g.emoji}</span>
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
                      <p className="text-foreground" style={{ fontSize: 12, fontWeight: 600 }}>
                        {child.educationLevel === "school" ? "🏫" : "🎓"} Child {idx + 1}
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
                <div className="flex-1 text-center text-foreground" style={{ fontSize: 16, fontWeight: 500 }}>{qty} pcs</div>
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
          <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Street address *</p>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Building, street, area" className={INP + " mb-3 block"} style={fnt}/>
          <div className="grid grid-cols-2 gap-2">
            <div><p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>City</p><input value={city} onChange={e => setCity(e.target.value)} placeholder="City" className={INP} style={fnt}/></div>
            <div><p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>PIN code</p><input value={pin} onChange={e => setPin(e.target.value)} placeholder="6-digit PIN" inputMode="numeric" maxLength={6} className={INP} style={fnt}/></div>
          </div>
        </Section>

        <Section title="Contact details" icon={User}>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Your name *</p>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className={INP + " mb-3 block"} style={fnt}/>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Phone number *</p>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" inputMode="tel" className={INP + " mb-3 block"} style={fnt}/>
          <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Email (optional)</p>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" inputMode="email" className={INP + " block"} style={fnt}/>
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

      <div className="flex-shrink-0 px-5 py-3 border-t border-border bg-background">
        <button onClick={handleContinue} disabled={!canContinue}
          className="w-full rounded-2xl py-3.5 flex items-center justify-center gap-2 text-sm"
          style={{ background: canContinue ? DARK : "#e5e7eb", color: canContinue ? "#fff" : "#9ca3af", border:"none", cursor: canContinue ? "pointer" : "not-allowed", fontWeight: 500 }}>
          Continue · Step 2: Order details <ArrowRight size={15} strokeWidth={2}/>
        </button>
      </div>
    </div>
  );
}

// ─── Persona Order Form (Step 2 — shared for org & individual) ────────────────

function PersonaOrderForm({
  persona, orgDetails, customDetails, onSubmit, onChangePersona,
}: {
  persona: Persona;
  orgDetails?: OrgDetails | null;
  customDetails?: CustomOrderDetails | null;
  onSubmit: () => void;
  onChangePersona: () => void;
}) {
  const cfg = persona === "organisation" && orgDetails ? orgCfg[orgDetails.type]
    : customDetails ? { ...orgCfg.school, defaultQty: 10, minQty: 10, qtyStep: 5, fabricOptions: garmentFabricMap[customDetails.garmentType].fabricOptions, gsmOptions: garmentFabricMap[customDetails.garmentType].gsmOptions, weaveOptions: ["Plain","Twill","Jersey knit","Custom"], defaultSizeCat: customDetails.audience === "kids" ? "school" as SizeCat : customDetails.audience === "women" ? "womens" as SizeCat : "mens" as SizeCat }
    : orgCfg.school;

  const [qty, setQty] = useState(cfg.defaultQty);
  const [orgSizeAllocated, setOrgSizeAllocated] = useState(0);
  // Track if user has explicitly visited the Sizes step — only block submit if they have and didn't complete
  const [sizeStepVisited, setSizeStepVisited] = useState(false);
  const [fabricSource, setFabricSource] = useState<"fresh" | "surplus">("fresh");
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showConfirmChange, setShowConfirmChange] = useState(false);
  const [subStep, setSubStep] = useState(1);
  const [editingOrgDetails, setEditingOrgDetails] = useState(false);
  const [orgDraft, setOrgDraft] = useState({
    name: orgDetails?.name || currentUser.org,
    board: orgDetails?.board || "",
    address: orgDetails?.address || "",
    city: orgDetails?.city || "",
    pin: orgDetails?.pin || "",
    contactName: orgDetails?.contactName || currentUser.name,
    contactPhone: orgDetails?.contactPhone || currentUser.phone,
    contactEmail: orgDetails?.contactEmail || currentUser.email,
  });

  const isUniformOrder = customDetails?.garmentType === "school_uniform" && (customDetails.groupType === "kids" || customDetails.groupType === "students");
  // Only block submit if user actually went to the Sizes step AND didn't finish
  const sizeIncomplete = sizeStepVisited && qty > 0 && orgSizeAllocated !== qty;

  const subLabel = orgDetails
    ? `${orgTypeDefs.find(o => o.id === orgDetails.type)?.emoji} ${orgTypeDefs.find(o => o.id === orgDetails.type)?.label}`
    : customDetails
    ? `✂️ Custom order`
    : persona === "organisation" ? "🏛️ Organisation" : "👤 Individual";

  const serviceLabel = orgDetails ? (orgServiceOptions[orgDetails.type].find(o => o.id === orgDetails.service)?.label ?? "") : null;
  const subName = orgDetails?.name
    ? `${orgDetails.name}${serviceLabel ? " · " + serviceLabel : ""}`
    : serviceLabel || (customDetails ? (customDetails.audience === "kids" ? "Kids sizing" : customDetails.audience === "women" ? "Women sizing" : "Men sizing") + " · Min 10 pcs" : undefined);

  const accentBg = persona === "organisation" ? "#E0F0FF" : ACCENT_BG;
  const accentC  = persona === "organisation" ? "#1a4a8a" : "#7c5419";

  // Accessory org orders skip fabric/colour/size — just References + Organisation
  const isAccessoryOrgOrder = persona === "organisation" && !!orgDetails?.isAccessoryOrder;

  // Build sub-step label arrays based on persona/isUniformOrder/isAccessoryOrgOrder
  const subStepLabels = isAccessoryOrgOrder
    ? ["References", "Organisation"]
    : !isUniformOrder
      ? persona === "individual"
        ? ["Material", "Colors", "Sizes", "References"]
        : ["Material", "Colors", "Sizes", "Packaging", "References", "Organisation"]
      : ["References"];

  const totalSubSteps = subStepLabels.length;
  const currentSubStepLabel = subStepLabels[subStep - 1];
  const orgDetailsIncomplete = currentSubStepLabel === "Organisation" && !!orgDetails && (
    !orgDraft.name.trim() ||
    !orgDraft.contactName.trim() ||
    orgDraft.contactPhone.replace(/\D/g, "").length < 10 ||
    !orgDraft.address.trim() ||
    !orgDraft.city.trim() ||
    !/^\d{6}$/.test(orgDraft.pin.trim())
  );

  useEffect(() => {
    if (currentSubStepLabel === "Sizes") setSizeStepVisited(true);
  }, [currentSubStepLabel]);

  // Map subStep to content index within the labels array
  function getSubStepContent() {
    const label = subStepLabels[subStep - 1];

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
                {([["fresh","🆕","Fresh fabric","New production run"],["surplus","♻️","Surplus fabric","Mill leftover stock · Discounted"]] as const).map(([id, emoji, lbl2, sub]) => (
                  <button key={id} onClick={() => setFabricSource(id)}
                    className="flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl text-left"
                    style={{ border:`1.5px solid ${fabricSource===id ? DARK : "rgba(0,0,0,0.08)"}`, background: fabricSource===id ? "rgba(13,13,13,0.04)" : "#fff", cursor:"pointer" }}>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ border:`2px solid ${fabricSource===id ? DARK : "#d1d5db"}`, background: fabricSource===id ? DARK : "#fff" }}>
                        {fabricSource===id && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: fabricSource===id ? DARK : "#111827" }}>{emoji} {lbl2}</span>
                    </div>
                    <span style={{ fontSize: 11, color:"#9ca3af", marginLeft: 22 }}>{sub}</span>
                  </button>
                ))}
              </div>
              {fabricSource === "surplus" && (
                <div className="mb-3 flex gap-1.5 px-2.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span style={{ fontSize: 12 }}>♻️</span>
                  <p style={{ fontSize: 11, color:"#065f46", lineHeight: 1.5 }}>Surplus fabric is leftover mill stock — same quality, up to 30% cheaper. Availability confirmed before production.</p>
                </div>
              )}

              <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>{cfg.fabricLabel}</p>
              <select className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none mb-3" style={fnt}>
                {cfg.fabricOptions.map(o => <option key={o}>{o}</option>)}
              </select>

              <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>GSM weight</p>
              <select className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none mb-3" style={fnt}>
                {cfg.gsmOptions.map(o => <option key={o}>{o}</option>)}
              </select>

              <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Weave</p>
              <select className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none" style={fnt}>
                {cfg.weaveOptions.map(o => <option key={o}>{o}</option>)}
              </select>
            </Section>
          )}
        </div>
      );
    }

    if (label === "Colors") {
      if (persona === "individual") {
        return <Section title="Colors" icon={Palette}><IndividualColorSection/></Section>;
      }
      return <Section title="Colors" icon={Palette}><ColorSection/></Section>;
    }

    if (label === "Sizes") {
      return (
        <Section title="Quantity & size distribution" icon={Layers}>
          <SizeInfoBanner minQty={cfg.minQty}/>
          <p className="text-muted-foreground mb-2" style={{ fontSize: 12 }}>Total pieces (minimum {cfg.minQty})</p>
          <div className="flex items-center gap-2.5 mb-4">
            <button onClick={() => setQty(q => Math.max(cfg.minQty, q - cfg.qtyStep))} className="w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center" style={{ cursor:"pointer" }}><Minus size={15}/></button>
            <div className="flex-1 text-center text-foreground" style={{ fontSize: 16, fontWeight: 500 }}>{qty} pcs</div>
            <button onClick={() => setQty(q => q + cfg.qtyStep)} className="w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center" style={{ cursor:"pointer" }}><Plus size={15}/></button>
          </div>
          <div className="my-3 border-t border-border"/>
          <p className="text-foreground text-xs mb-2.5" style={{ fontWeight: 500 }}>Size distribution</p>
          <SizeSection totalQty={qty} defaultCat={cfg.defaultSizeCat} step={10} onAllocationChange={setOrgSizeAllocated}/>
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

    if (label === "Organisation" && orgDetails) {
      const displayOrg = { ...orgDetails, ...orgDraft };
      return (
        <Section title="Organisation, contact & address" icon={Building2}>
          {editingOrgDetails ? (
            <div>
              <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Organisation name *</p>
              <input value={orgDraft.name} onChange={e => setOrgDraft(p => ({ ...p, name:e.target.value }))} placeholder={orgCfg[orgDetails.type].namePlaceholder} className={INP + " mb-3 block"} style={fnt}/>
              <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>{orgCfg[orgDetails.type].regLabel}</p>
              <input value={orgDraft.board} onChange={e => setOrgDraft(p => ({ ...p, board:e.target.value }))} placeholder={orgCfg[orgDetails.type].regPlaceholder} className={INP + " mb-3 block"} style={fnt}/>
              <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Contact person *</p>
              <input value={orgDraft.contactName} onChange={e => setOrgDraft(p => ({ ...p, contactName:e.target.value }))} className={INP + " mb-3 block"} style={fnt}/>
              <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Phone number *</p>
              <input value={orgDraft.contactPhone} onChange={e => setOrgDraft(p => ({ ...p, contactPhone:e.target.value }))} inputMode="tel" className={INP + " mb-3 block"} style={fnt}/>
              <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Email</p>
              <input value={orgDraft.contactEmail} onChange={e => setOrgDraft(p => ({ ...p, contactEmail:e.target.value }))} inputMode="email" className={INP + " mb-3 block"} style={fnt}/>
              <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>Street address *</p>
              <input value={orgDraft.address} onChange={e => setOrgDraft(p => ({ ...p, address:e.target.value }))} placeholder="Building, street, area" className={INP + " mb-3 block"} style={fnt}/>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div>
                  <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>City *</p>
                  <input value={orgDraft.city} onChange={e => setOrgDraft(p => ({ ...p, city:e.target.value }))} placeholder="City" className={INP} style={fnt}/>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1.5" style={{ fontSize:12 }}>PIN *</p>
                  <input value={orgDraft.pin} onChange={e => setOrgDraft(p => ({ ...p, pin:e.target.value }))} placeholder="6-digit PIN" inputMode="numeric" maxLength={6} className={INP} style={fnt}/>
                </div>
              </div>
              <button onClick={() => setEditingOrgDetails(false)} className="w-full bg-foreground text-white rounded-2xl py-3 text-sm" style={{ fontWeight:500 }}>Save details</button>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-muted border border-border p-3 mb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-foreground text-sm" style={{ fontWeight:600 }}>{displayOrg.name || "Add organisation name"}</p>
                    <p className="text-muted-foreground" style={{ fontSize:11 }}>{displayOrg.board || "Registration details to be confirmed"}</p>
                    <p className="text-muted-foreground" style={{ fontSize:11, marginTop:3 }}>{activeServiceLabel(orgDetails.type, orgDetails.service)}</p>
                  </div>
                  <button onClick={() => setEditingOrgDetails(true)} className="text-xs px-2.5 py-1 rounded-xl bg-card border border-border text-foreground" style={{ cursor:"pointer", fontWeight:500 }}>Change</button>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-sm">
                {[
                  ["Contact", `${displayOrg.contactName || "Add contact"} · ${displayOrg.contactPhone || "Add phone"}`],
                  ["Email", displayOrg.contactEmail || "Not added"],
                  ["Address", displayOrg.address ? `${displayOrg.address}, ${displayOrg.city} ${displayOrg.pin}` : "Add delivery address"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground flex-shrink-0" style={{ fontSize:12 }}>{k}</span>
                    <span className="text-foreground text-right" style={{ fontSize:12, fontWeight:500 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
                <Check size={12} className="text-emerald-600 flex-shrink-0 mt-0.5"/>
                <p className="text-emerald-700 text-xs">These details are saved for the next order. Use Change only when contact or address has changed.</p>
              </div>
            </>
          )}
        </Section>
      );
    }

    if (label === "Packaging") {
      return <Section title="Stitching & packaging" icon={Package}><PackagingSection/></Section>;
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
          {isAccessoryOrgOrder && orgDetails && (
            <div className="mb-3 rounded-xl overflow-hidden border border-border">
              <div className="px-3 py-2 bg-muted flex items-center justify-between">
                <p style={{ fontSize:12, fontWeight:600, color:DARK }}>Your accessory order summary</p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700" style={{ fontWeight:500 }}>Confirmed ✓</span>
              </div>
              <div className="px-3 py-2.5 grid grid-cols-2 gap-2">
                {Object.entries(orgDetails.accessoryQty)
                  .filter(([, q]) => q > 0)
                  .map(([key, q]) => {
                    const itemName = key.replace(`${orgDetails.type}-`, "");
                    return (
                      <div key={key} className="flex items-center justify-between bg-card border border-border rounded-xl px-2.5 py-2">
                        <span style={{ fontSize:11, fontWeight:500, color:DARK }}>{itemName}</span>
                        <span style={{ fontSize:12, fontWeight:700, color:DARK }}>{q} pcs</span>
                      </div>
                    );
                  })}
              </div>
              <div className="px-3 pb-3">
                <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background:ACCENT_BG, border:`0.5px solid ${ACCENT}` }}>
                  <span style={{ fontSize:12, color:"#7c5419" }}>Total accessories</span>
                  <span style={{ fontSize:13, fontWeight:700, color:"#7c5419" }}>{Object.values(orgDetails.accessoryQty).reduce((a,b)=>a+b,0)} pcs</span>
                </div>
              </div>
            </div>
          )}
          <Section title="References & samples" icon={ImageIcon}><RefImagesSection persona={persona}/></Section>
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
              {currentSubStepLabel}
            </p>
            <p className="text-muted-foreground" style={{ fontSize: 11 }}>
              {subStep} of {totalSubSteps}
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
            <span style={{ fontSize: 17 }}>{persona === "organisation" ? "🏛️" : "👤"}</span>
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
      <div className="flex-shrink-0 px-5 py-3 border-t border-border bg-background flex gap-3">
        {/* Back button — always visible */}
        <button
          onClick={() => subStep > 1 ? setSubStep(s => s - 1) : setShowConfirmChange(true)}
          className="w-12 h-12 rounded-2xl border border-border flex items-center justify-center bg-card flex-shrink-0">
          <ChevronDown size={16} style={{ transform: "rotate(90deg)" }} className="text-foreground"/>
        </button>

        {/* Next or Submit */}
        {subStep < totalSubSteps ? (
          <button onClick={() => setSubStep(s => s + 1)} className="flex-1 bg-foreground text-white rounded-2xl py-3.5 flex items-center justify-center gap-2 text-sm" style={{ fontWeight: 500 }}>
            Next: {subStepLabels[subStep]} <ArrowRight size={14} strokeWidth={2}/>
          </button>
        ) : (
          <button
            onClick={() => !sizeIncomplete && !orgDetailsIncomplete && setShowConfirmSubmit(true)}
            disabled={sizeIncomplete || orgDetailsIncomplete}
            className="flex-1 rounded-2xl py-3.5 flex items-center justify-center gap-2 text-sm"
            style={{ background: sizeIncomplete || orgDetailsIncomplete ? "#e5e7eb" : ACCENT, color: sizeIncomplete || orgDetailsIncomplete ? "#9ca3af" : "#fff", fontWeight: 500, border:"none", cursor: sizeIncomplete || orgDetailsIncomplete ? "not-allowed" : "pointer" }}
          >
            <Send size={14}/> {persona === "individual" ? "Submit My Order" : "Review & submit for quotation"}
          </button>
        )}
      </div>

      {/* Submit confirm modal */}
      {showConfirmSubmit && (
        <Overlay center>
          <div className="bg-background rounded-2xl p-5 text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: ACCENT_BG }}>
              <Send size={20} style={{ color: ACCENT }}/>
            </div>
            <p className="text-foreground mb-1.5" style={{ fontSize: 16, fontWeight: 700 }}>Submit for quotation?</p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-5">Your coordinator will review the order and send you a quote within 24 hours. You can still request changes after receiving the quote.</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => { setShowConfirmSubmit(false); onSubmit(); }} className="w-full py-3 rounded-2xl flex items-center justify-center gap-2 text-sm" style={{ background: ACCENT, color:"#fff", border:"none", cursor:"pointer", fontWeight: 500 }}>
                <Check size={15}/> Yes, submit order
              </button>
              <button onClick={() => setShowConfirmSubmit(false)} className="w-full py-2.5 rounded-2xl text-sm bg-muted text-foreground" style={{ cursor:"pointer" }}>Go back and review</button>
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

function CustomAudienceForm({ onContinue, onBack }: { onContinue: (d: CustomOrderDetails) => void; onBack: () => void }) {
  const [audience, setAudience] = useState<CustomAudience>("kids");
  const options = [
    { id:"kids" as CustomAudience, label:"Kids", sub:"Age-based child sizing", cat:"school" as SizeCat, group:"kids" as GroupType, icon:"🧒" },
    { id:"men" as CustomAudience, label:"Men", sub:"Chest-based adult sizing", cat:"mens" as SizeCat, group:"family" as GroupType, icon:"👔" },
    { id:"women" as CustomAudience, label:"Women", sub:"UK-size adult sizing", cat:"womens" as SizeCat, group:"family" as GroupType, icon:"👗" },
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
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: ACCENT_BG }}>✂️</div>
          <div className="flex-1">
            <p className="text-foreground" style={{ fontSize:17, fontWeight:600 }}>Custom order</p>
            <p className="text-muted-foreground" style={{ fontSize:12 }}>Minimum 10 pcs · Material to reference flow</p>
          </div>
        </div>

        <SizeInfoBanner minQty={10}/>

        <Section title="Who needs this custom order?" icon={User}>
          <div className="flex flex-col gap-2">
            {options.map(opt => {
              const active = opt.id === audience;
              return (
              <button key={opt.id} onClick={() => setAudience(opt.id)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left"
                  style={{ border:`1.5px solid ${active ? DARK : "rgba(0,0,0,0.08)"}`, background: active ? "rgba(13,13,13,0.03)" : "#fff", cursor:"pointer" }}>
                  <span style={{ fontSize:20 }}>{opt.icon}</span>
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
      </div>
      <div className="flex-shrink-0 px-5 py-3 border-t border-border bg-background">
        <button onClick={continueCustom} className="w-full bg-foreground text-white rounded-2xl py-3.5 flex items-center justify-center gap-2 text-sm" style={{ fontWeight:500 }}>
          Continue custom order <ArrowRight size={15} strokeWidth={2}/>
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
      <p className="text-muted-foreground mb-1.5 text-sm leading-relaxed">Your coordinator will review and send you a quotation within 2–4 hours.</p>
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
  | { type: "org_step2"; org: OrgDetails }
  | { type: "individual_step2"; custom: CustomOrderDetails }
  | { type: "success" };

export function NewOrderTab({ onNavigate, onTrackOrder, accountType }: { onNavigate: (tab: "home" | "order" | "track" | "account") => void; onTrackOrder: () => void; accountType?: "personal" | "organisation" }) {
  const isPersonal = accountType === "personal";
  const [step, setStep] = useState<OrderStep>(isPersonal ? { type: "custom_audience" } : { type: "org_details" });
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);

  const switchBanner = null;

  function handleSuccess() {
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
          onSubmit={handleSuccess}
          onChangePersona={() => setStep({ type:"org_details" })}
        />
      )}
      {step.type === "individual_step2" && (
        <PersonaOrderForm
          persona="individual"
          customDetails={step.custom}
          onSubmit={handleSuccess}
          onChangePersona={() => setStep({ type:"custom_audience" })}
        />
      )}
      {step.type === "success" && (
        <SuccessScreen
          onNavigate={onNavigate}
          onTrackOrder={onTrackOrder}
        />
      )}
    </div>
  );
}
