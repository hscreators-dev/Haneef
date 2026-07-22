import React, { useState, useRef, useEffect } from "react";
import {
  Bell, User, Home, PlusCircle, MapPin,
  ChevronRight, TrendingUp, Clock, CheckCircle2, ArrowRight, Box, Package,
  Mail, Smartphone, ShieldCheck, Building2, UserCircle, ChevronLeft, Phone,
  MapPinned, Headphones, Star, Check, Navigation, FileText, Trash2,
  HelpCircle, X, Shirt, Wallet, Truck, RotateCcw,
  Users, Heart, Gift, Ruler, Palette, Droplets, Smile, Scissors, Lightbulb,
} from "lucide-react";
import certArt from "@/assets/undraw_certification_garm.svg";
import { NewOrderTab, SizeGuideModal, type SubmittedOrderSummary, type OrderDraft, type DraftPayload, type OrderIntent } from "./components/NewOrderTab";
import { TrackTab } from "./components/TrackTab";
import { AccountTab, type UserProfile, orgTypeDefs, OrgTypeSelect } from "./components/AccountTab";
import { NotificationsScreen } from "./components/NotificationsScreen";
import { fetchUnreadCount } from "../lib/notifCenter";
import { playChime } from "../lib/notify";
import { StageAnimation, stageFromLabel } from "./components/StageAnimation";
import { auth as authApi, account as accountApi, orders as ordersApi, token as authToken, type UserProfile as ApiUserProfile, type Order as ApiOrder } from "../lib/api";
import { readPendingOrders, writePendingOrders, rememberOrderSummary, flushPendingOrders, createOrderWithRetry, readOrderSummaries } from "../lib/orderSync";
import { useOrderFormConfig } from "../lib/useOrderFormConfig";

// ── Onboarding-flag persistence (bulletproof) ────────────────────────────────
// The onboarding "done" flag is saved via a profile PUT. If that save silently
// fails — backend cold/slow on Render's free tier, or a transient error — the
// flag never lands and the customer is asked to onboard again on the NEXT login.
// So we: (1) retry with backoff, and (2) if it STILL fails, QUEUE it in
// localStorage and keep retrying app-wide (on login, on an interval, on focus)
// until it lands — the same pattern that fixed order submits. Merged with the
// local identity cache, onboarding can no longer come back once completed.
const PENDING_PROFILE_KEY = "fl_pending_profile";

function queuePendingProfile(update: Parameters<typeof accountApi.updateProfile>[0]) {
  try {
    const prev = JSON.parse(localStorage.getItem(PENDING_PROFILE_KEY) || "{}");
    localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify({ ...prev, ...update }));
  } catch { /* ignore storage errors */ }
}

export async function flushPendingProfile(): Promise<void> {
  let raw: string | null = null;
  try { raw = localStorage.getItem(PENDING_PROFILE_KEY); } catch { return; }
  if (!raw || !authToken.get()) return;
  try {
    await accountApi.updateProfile(JSON.parse(raw));
    try { localStorage.removeItem(PENDING_PROFILE_KEY); } catch { /* ignore */ }
  } catch { /* keep queued — the app-level poller retries */ }
}

async function saveProfileWithRetry(
  update: Parameters<typeof accountApi.updateProfile>[0], attempts = 5,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      await accountApi.updateProfile(update);
      try { localStorage.removeItem(PENDING_PROFILE_KEY); } catch { /* ignore */ }
      return true;
    } catch { if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  // All retries exhausted — persist it so it syncs later without re-onboarding.
  queuePendingProfile(update);
  return false;
}

export type Tab = "home" | "order" | "track" | "account";

// ─── Submit → backend order mapping ───────────────────────────────────────────
// Turns the rich in-app order summary into the backend Order payload so the
// order actually lands in the shared MongoDB (and the Garm Admin Portal).
function parseINRAmount(v?: string): number | undefined {
  if (!v) return undefined;
  if (v.includes("–") || v.includes("-")) return undefined; // estimate range
  const n = Number(v.replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// Best-effort audience guess from a past order's garment name — used only when
// repeating an order that has no rich local edit-snapshot (see handleReorderPast),
// so "Repeat order" still opens a sensibly pre-filled cart instead of a blank one.
function guessGarmentAudience(name: string): { categoryId: "kids" | "mens" | "womens"; sizeCat: "school" | "mens" | "womens"; garmentType: "tshirt" | "shirt" } {
  const n = name.toLowerCase();
  if (/kurti|saree|dress|legging|\btop\b|blouse|women/.test(n)) return { categoryId: "womens", sizeCat: "womens", garmentType: "shirt" };
  if (/kid|child|school/.test(n)) return { categoryId: "kids", sizeCat: "school", garmentType: "tshirt" };
  return { categoryId: "mens", sizeCat: "mens", garmentType: /shirt/.test(n) && !/t-shirt|tshirt|tee\b/.test(n) ? "shirt" : "tshirt" };
}

function summaryToOrderPayload(summary: SubmittedOrderSummary, profile: UserProfile): Partial<ApiOrder> {
  const persona = profile.accountType === "organisation" ? "organisation" : "individual";
  const firstLine = summary.garmentLines?.[0];
  const src = (summary.fabricSource || "").toLowerCase();
  const fabricSource = src.includes("surplus") || src.includes("deadstock") ? "surplus" : src ? "fresh" : undefined;
  const total = summary.price?.kind === "fixed" ? parseINRAmount(summary.price.totalValue) : undefined;
  const totalQty = summary.qty ?? summary.totalPcs ?? 0;
  // Per-piece unit for line items = the GOODS rate (total minus the service
  // fee). The fee is sent separately (serviceFee below) — if the unit included
  // it, every rate row would double-count the fee: rate × qty + fee ≠ total.
  const goods = total != null ? Math.max(0, total - (summary.serviceFee || 0)) : undefined;
  const perPc = goods && totalQty ? Math.round(goods / totalQty) : 0;
  // Per-garment line items — carries STYLE, colour and the size split for
  // every garment, so the admin portal shows exactly what the customer
  // configured (not just top-level defaults).
  const lines = (summary.garmentLines ?? []).flatMap((g) => {
    const pname = `${g.name}${g.style ? ` · ${g.style}` : ""}`;
    return g.sizes.length
      ? g.sizes.map((s) => ({ p: pname, size: s.size, color: g.colorLabel, qty: s.qty, unit: perPc }))
      : [{ p: pname, size: "—", color: g.colorLabel, qty: g.qty, unit: perPc }];
  });
  return {
    persona,
    isAccessoryOrder: summary.isAccessoryOrder,
    orgName: persona === "organisation" ? profile.orgName : undefined,
    orgType: persona === "organisation" ? profile.orgType : undefined,
    serviceLabel: summary.serviceLabel ?? summary.name,
    // Garment carries the chosen style; fabric/GSM/weave come from the
    // PER-GARMENT material the customer actually picked (the top-level
    // summary fields are just the configurator's defaults).
    garmentType: firstLine ? `${firstLine.name}${firstLine.style ? ` · ${firstLine.style}` : ""}` : (summary.garmentLabel ?? undefined),
    fabric: firstLine?.fabric ?? summary.fabric,
    gsm: firstLine?.gsm ?? summary.gsm,
    weave: firstLine?.weave ?? summary.weave,
    fabricSource: fabricSource as ApiOrder["fabricSource"],
    lines,
    qty: totalQty,
    sizes: (summary.sizeBreakdown ?? firstLine?.sizes ?? []).map((s) => ({ label: s.size, qty: s.qty })),
    colors: (summary.colors ?? (firstLine ? [{ hex: firstLine.colorHex, label: firstLine.colorLabel }] : [])).map((c) => ({ hex: c.hex, label: c.label })),
    accessoryItems: (summary.accessoryItems ?? []).map((a) => ({
      categoryId: "app", categoryLabel: summary.serviceLabel ?? "Accessories", itemName: a.name, qty: a.qty,
    })),
    stitching: firstLine?.stitching ?? summary.stitching,
    packaging: firstLine?.packaging ?? summary.packaging,
    deliveryAddress: summary.delivery?.address,
    deliveryCity: summary.delivery?.city,
    deliveryPin: summary.delivery?.pin,
    contactName: summary.delivery?.name || profile.name,
    contactPhone: summary.delivery?.phone || profile.phone,
    contactEmail: summary.delivery?.email || profile.email,
    // Accessory spec choices (Colour, Material, Finish…) travel to the admin
    // as readable notes so the order record is complete on both sides.
    notes: [
      summary.colorDesc,
      ...(summary.accessorySpecs ?? []).map((sp) =>
        `${sp.name}: ${sp.fields.map((f) => `${f.label} — ${f.value}`).join(", ")}${sp.notes ? ` · Note: ${sp.notes}` : ""}`),
    ].filter(Boolean).join("\n") || undefined,
    total,
    quoteAmount: total,
    serviceFee: summary.serviceFee,
    // Design/logo reference uploads — downloadable by the admin team from the
    // portal's order Documents card.
    documents: (summary.referenceAttachments ?? []).map((f) => ({
      name: f.name, kind: "DESIGN" as const, dataUrl: f.dataUrl, uploadedBy: "customer" as const,
    })),
  };
}


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
  boxShadow: "0 1px 2px rgba(13,13,13,0.03), 0 4px 14px rgba(13,13,13,0.04)",
};
// Muted input
const inputStyle: React.CSSProperties = {
  width: "100%", background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: 12, padding: "10px 14px", color: "var(--foreground)",
  fontSize: 14, fontFamily: "DM Sans, sans-serif", outline: "none",
};

// ─── Garm logo — basket-weave tile (brand mark) ─────────────────────────────────
// Concept C: an over-under warp & weft weave inside a rounded "app icon" tile.
// When `animated`, the threads weave themselves in (warp grows down, weft slides
// across), then the tile gently floats — a textile-native intro animation.
function GarmLogo({ size = 96, rounded = true, animated = false, style }: {
  size?: number; rounded?: boolean; animated?: boolean; style?: React.CSSProperties;
}) {
  const ivory = "#FBF8F2";
  const strand = { fill: ivory, stroke: DARK, strokeWidth: 4 } as const;
  // class + stagger only applied when animated
  const a = (cls: string, delay: number) =>
    animated ? { className: `garm-strand ${cls}`, style: { animationDelay: `${delay}s` } } : {};
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" role="img" aria-label="Garm"
      className={animated ? "garm-float" : undefined} style={style}>
      {animated && (
        <style>{`
          .garm-strand{transform-box:fill-box}
          .garm-warp{transform-origin:center top;animation:garmWarp .5s cubic-bezier(.5,0,.25,1) both}
          .garm-weft{transform-origin:left center;animation:garmWeft .5s cubic-bezier(.5,0,.25,1) both}
          .garm-patch{animation:garmPatch .3s ease both}
          .garm-float{animation:garmFloat 4s ease-in-out 1.3s infinite}
          @keyframes garmWarp{from{transform:scaleY(0)}to{transform:scaleY(1)}}
          @keyframes garmWeft{from{transform:scaleX(0)}to{transform:scaleX(1)}}
          @keyframes garmPatch{from{opacity:0}to{opacity:1}}
          @keyframes garmFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
          @media (prefers-reduced-motion: reduce){
            .garm-warp,.garm-weft,.garm-patch{animation:none}.garm-float{animation:none}
          }
        `}</style>
      )}
      <rect width="96" height="96" rx={rounded ? 22 : 0} fill={DARK} />
      {/* horizontal strands — weft (laid first) */}
      <rect x="12" y="21" width="72" height="18" rx="9" {...strand} {...a("garm-weft", 0)} />
      <rect x="12" y="57" width="72" height="18" rx="9" {...strand} {...a("garm-weft", 0.24)} />
      {/* vertical strands — warp (woven over) */}
      <rect x="21" y="12" width="18" height="72" rx="9" {...strand} {...a("garm-warp", 0.12)} />
      <rect x="57" y="12" width="18" height="72" rx="9" {...strand} {...a("garm-warp", 0.36)} />
      {/* over-under correction patches → basket weave */}
      <rect x="17" y="57" width="26" height="18" rx="9" {...strand} {...a("garm-patch", 0.62)} />
      <rect x="53" y="21" width="26" height="18" rx="9" {...strand} {...a("garm-patch", 0.72)} />
    </svg>
  );
}

// ─── Animated welcome illustrations (flat, undraw-inspired) ──────────────────────
// Slide 2 — kids playing football, scoring into a goal (one-shot "goal" animation).
function FootballArt({ size = 248 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 184) / 248} viewBox="0 0 248 184" fill="none" role="img" aria-label="Kids playing football">
      <style>{`
        .fbBall{transform-box:fill-box;animation:fbBall 1.5s cubic-bezier(.3,0,.55,1) forwards}
        .fbLeg{transform-box:fill-box;transform-origin:top center;animation:fbKick 1.5s ease-out forwards}
        .fbGoalie{transform-box:fill-box;animation:fbDive 1.5s ease-in-out forwards}
        .fbCheer{transform-box:fill-box;animation:fbCheer .7s ease-in-out infinite}
        .fbNet{transform-box:fill-box;transform-origin:center;animation:fbNet .5s ease 1.45s both}
        .fbWin{transform-box:fill-box;animation:fbWin 1.2s ease 1.5s both}
        @keyframes fbBall{0%{transform:translate(0,0)}55%{transform:translate(70px,-52px)}100%{transform:translate(112px,-30px)}}
        @keyframes fbKick{0%{transform:rotate(-26deg)}18%{transform:rotate(44deg)}42%,100%{transform:rotate(8deg)}}
        @keyframes fbDive{0%,52%{transform:translate(0,0) rotate(0)}82%,100%{transform:translate(-9px,7px) rotate(-15deg)}}
        @keyframes fbCheer{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes fbNet{0%{transform:scaleY(1)}40%{transform:scaleY(1.06)}100%{transform:scaleY(1)}}
        @keyframes fbWin{0%{transform:scale(.2);opacity:0}35%{transform:scale(1);opacity:1}100%{opacity:1}}
        @media (prefers-reduced-motion:reduce){.fbBall,.fbLeg,.fbGoalie,.fbCheer,.fbNet,.fbWin{animation:none}}
      `}</style>
      <circle cx="124" cy="92" r="84" fill="rgba(200,169,126,0.12)" />
      <ellipse cx="124" cy="172" rx="86" ry="9" fill="rgba(13,13,13,0.06)" />

      {/* Goal */}
      <g>
        <rect x="172" y="64" width="66" height="5" rx="2" fill="#E6E6E6" />
        <rect x="172" y="64" width="5" height="88" rx="2" fill="#E6E6E6" />
        <rect x="233" y="64" width="5" height="88" rx="2" fill="#E6E6E6" />
        <g className="fbNet" stroke="#D7D7D7" strokeWidth="1">
          <line x1="184" y1="69" x2="184" y2="150" /><line x1="196" y1="69" x2="196" y2="150" />
          <line x1="208" y1="69" x2="208" y2="150" /><line x1="220" y1="69" x2="220" y2="150" />
          <line x1="177" y1="84" x2="233" y2="84" /><line x1="177" y1="102" x2="233" y2="102" />
          <line x1="177" y1="120" x2="233" y2="120" /><line x1="177" y1="138" x2="233" y2="138" />
        </g>
      </g>

      {/* Goalie kid — dark jersey, brand-gold shorts */}
      <g className="fbGoalie">
        <rect x="196" y="118" width="7" height="22" rx="3.5" fill="#C8A97E" />
        <rect x="206" y="118" width="7" height="22" rx="3.5" fill="#C8A97E" />
        <rect x="195" y="98" width="20" height="24" rx="8" fill="#0D0D0D" />
        <path d="M180 104 q12 -6 16 4" stroke="#ED9DA0" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M214 108 q12 -8 18 -2" stroke="#ED9DA0" strokeWidth="6" fill="none" strokeLinecap="round" />
        <circle cx="205" cy="88" r="10" fill="#ED9DA0" />
        <path d="M195 87 q10 -15 20 0 q-3 -9 -10 -9 q-7 0 -10 9 Z" fill="#2F2E41" />
      </g>

      {/* Cheering kid (teal) */}
      <g className="fbCheer">
        <rect x="26" y="120" width="7" height="22" rx="3.5" fill="#2F2E41" />
        <rect x="36" y="120" width="7" height="22" rx="3.5" fill="#2F2E41" />
        <rect x="25" y="98" width="20" height="26" rx="8" fill="#3E7E7A" />
        <path d="M27 100 q-8 -10 -4 -20" stroke="#ED9DA0" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M43 100 q8 -10 4 -20" stroke="#ED9DA0" strokeWidth="6" fill="none" strokeLinecap="round" />
        <circle cx="35" cy="88" r="10" fill="#ED9DA0" />
        <path d="M25 87 q10 -15 20 0 q-3 -9 -10 -9 q-7 0 -10 9 Z" fill="#2F2E41" />
      </g>

      {/* Kicker kid (gold) */}
      <g>
        <rect x="58" y="118" width="7" height="24" rx="3.5" fill="#2F2E41" />
        <g className="fbLeg">
          <rect x="68" y="118" width="7" height="24" rx="3.5" fill="#2F2E41" />
          <ellipse cx="71" cy="142" rx="6" ry="3" fill="#1F2730" />
        </g>
        <ellipse cx="61" cy="142" rx="6" ry="3" fill="#1F2730" />
        <rect x="54" y="96" width="22" height="26" rx="9" fill="#C8A97E" />
        <path d="M54 100 q-9 8 -6 18" stroke="#ED9DA0" strokeWidth="6" fill="none" strokeLinecap="round" />
        <circle cx="66" cy="86" r="11" fill="#ED9DA0" />
        <path d="M55 85 q11 -16 22 0 q-3 -10 -11 -10 q-8 0 -11 10 Z" fill="#2F2E41" />
      </g>

      {/* Ball */}
      <g className="fbBall">
        <circle cx="96" cy="150" r="9" fill="#FBF8F2" stroke="#0D0D0D" strokeWidth="1" />
        <path d="M96 144 l4.5 3.3 -1.7 5.3 -5.6 0 -1.7 -5.3 Z" fill="#0D0D0D" />
      </g>

      {/* GOAL! sparkle */}
      <g className="fbWin"><path d="M150 54 l2.6 6.4 6.4 2.6 -6.4 2.6 -2.6 6.4 -2.6 -6.4 -6.4 -2.6 6.4 -2.6 Z" fill="#C8A97E" /></g>
    </svg>
  );
}

// Delivery van drives in and reaches the customer's house, then drops the parcel.
function DeliveryArt({ size = 248 }: { size?: number }) {
  const Wheel = ({ cx }: { cx: number }) => (
    <g>
      <circle cx={cx} cy="118" r="15" fill="#1F2730" />
      <circle cx={cx} cy="118" r="15" fill="none" stroke="#3a444f" strokeWidth="2.5" />
      <circle cx={cx} cy="118" r="5.5" fill="#9AA0A6" />
      <g stroke="#9AA0A6" strokeWidth="2.2">
        <line x1={cx} y1="105" x2={cx} y2="131" />
        <line x1={cx - 13} y1="118" x2={cx + 13} y2="118" />
        <line x1={cx - 9} y1="109" x2={cx + 9} y2="127" />
        <line x1={cx - 9} y1="127" x2={cx + 9} y2="109" />
      </g>
      <line x1={cx} y1="118" x2={cx} y2="104" stroke="#C8A97E" strokeWidth="2.6" />
      <animateTransform attributeName="transform" attributeType="XML" type="rotate"
        from={`0 ${cx} 118`} to={`360 ${cx} 118`} dur="0.55s" repeatCount="4.4" fill="freeze" />
    </g>
  );
  return (
    <svg width={size} height={(size * 150) / 248} viewBox="0 0 248 150" fill="none" role="img" aria-label="Delivery reaching the customer's home">
      <style>{`
        .dvRoad{animation:dvRoad .5s linear 5 forwards}
        .dvDrive{transform-box:fill-box;animation:dvDrive 2.4s cubic-bezier(.16,.6,.3,1) forwards}
        .dvDone{transform-box:fill-box;transform-origin:center;animation:dvDone .5s cubic-bezier(.34,1.56,.64,1) 2.35s both}
        @keyframes dvRoad{from{transform:translateX(0)}to{transform:translateX(-40px)}}
        @keyframes dvDrive{from{transform:translateX(-210px)}to{transform:translateX(0)}}
        @keyframes dvDone{0%{transform:scale(0);opacity:0}100%{transform:scale(1);opacity:1}}
        @media (prefers-reduced-motion:reduce){.dvDrive{animation:none}.dvRoad{animation:none}.dvDone{animation:none}}
      `}</style>
      <circle cx="124" cy="76" r="84" fill="rgba(200,169,126,0.12)" />

      {/* Customer's house */}
      <g>
        <path d="M180 86 L209 62 L238 86 Z" fill="#3E7E7A" />
        <rect x="186" y="84" width="46" height="44" rx="3" fill="#FBF8F2" stroke="#E2DFD7" strokeWidth="1.5" />
        <rect x="196" y="104" width="15" height="24" rx="2" fill="#C8A97E" />
        <rect x="216" y="96" width="12" height="12" rx="2" fill="#BFE0DE" />
        <circle cx="208" cy="116" r="1.4" fill="#7C5419" />
      </g>

      {/* road */}
      <line x1="8" y1="133" x2="240" y2="133" stroke="#0D0D0D" strokeWidth="2" opacity="0.22" />
      <g className="dvRoad">
        {[-40, 0, 40, 80, 120, 160, 200, 240].map(x => (
          <rect key={x} x={x} y="132" width="22" height="3" rx="1.5" fill="#0D0D0D" opacity="0.28" />
        ))}
      </g>

      {/* van + wheels drive in together */}
      <g className="dvDrive">
        <g>
          <rect x="36" y="60" width="92" height="58" rx="10" fill="#C8A97E" />
          <path d="M128 74 h22 l22 22 v22 H128 Z" fill="#0D0D0D" />
          <rect x="136" y="80" width="24" height="16" rx="3" fill="#BFE0DE" />
          <circle cx="168" cy="112" r="3.5" fill="#FFD27A" />
          <rect x="52" y="76" width="34" height="26" rx="5" fill="#FBF8F2" />
          <g transform="translate(60,82)" stroke="#0D0D0D" strokeWidth="1.6" fill="#FBF8F2">
            <rect x="0" y="4" width="18" height="4" rx="2" />
            <rect x="0" y="11" width="18" height="4" rx="2" />
            <rect x="4" y="0" width="4" height="18" rx="2" />
            <rect x="11" y="0" width="4" height="18" rx="2" />
          </g>
        </g>
        <Wheel cx={64} />
        <Wheel cx={142} />
      </g>

      {/* delivered parcel + check (pops once the van arrives) */}
      <g className="dvDone">
        <rect x="183" y="120" width="18" height="13" rx="2" fill="#C8A97E" stroke="#7C5419" strokeWidth="1.2" />
        <line x1="192" y1="120" x2="192" y2="133" stroke="#7C5419" strokeWidth="1.2" />
        <circle cx="199" cy="110" r="9" fill="#3E7E7A" />
        <path d="M195 110 l3 3 5 -6" stroke="#FBF8F2" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// Brand banner — real undraw "certification" illustration (recoloured to gold).
function BrandShowcaseArt({ size = 104 }: { size?: number }) {
  return (
    <img src={certArt} alt="Your own brand, certified" draggable={false}
      className="garm-float-soft"
      style={{ display: "block", height: size, width: "auto" }} />
  );
}

// Sign-in hero — animated scene: a sun rises and sets over the mountains across a
// day → sunset → night cycle, with two explorers taking in the view on the ridge.
function NatureScene() {
  return (
    <svg width="100%" viewBox="0 0 336 140" fill="none" role="img"
      aria-label="Explorers watching the sun rise and set over the mountains" style={{ display: "block" }}>
      <style>{`
        .ns-sky{fill:#BFE3F5;animation:nsSky 16s ease-in-out infinite}
        .ns-sun{animation:nsSun 16s ease-in-out infinite}
        .ns-night{animation:nsNight 16s ease-in-out infinite}
        .ns-star{animation:nsStar 2.6s ease-in-out infinite}
        .ns-star.b{animation-delay:.7s}.ns-star.c{animation-delay:1.4s}.ns-star.d{animation-delay:2s}
        .ns-hiker{transform-box:fill-box;animation:nsHiker 3s ease-in-out infinite}
        .ns-hiker.b{animation-delay:.5s}
        .ns-bird{animation:nsBird 13s linear infinite}.ns-bird.b{animation-delay:5s}
        @keyframes nsSky{0%{fill:#F7D7AC}20%{fill:#BFE3F5}45%{fill:#F2924E}60%{fill:#23203F}86%{fill:#23203F}100%{fill:#F7D7AC}}
        @keyframes nsSun{0%{transform:translate(44px,96px);opacity:1}23%{transform:translate(168px,26px);opacity:1}46%{transform:translate(292px,96px);opacity:1}50%{transform:translate(292px,112px);opacity:0}96%{transform:translate(44px,112px);opacity:0}100%{transform:translate(44px,96px);opacity:1}}
        @keyframes nsNight{0%,40%{opacity:0}58%,84%{opacity:1}100%{opacity:0}}
        @keyframes nsStar{0%,100%{opacity:.15}50%{opacity:1}}
        @keyframes nsHiker{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}
        @keyframes nsBird{0%{transform:translate(-30px,6px)}100%{transform:translate(366px,-8px)}}
        @media (prefers-reduced-motion:reduce){.ns-sky,.ns-sun,.ns-night,.ns-star,.ns-hiker,.ns-bird{animation:none}}
      `}</style>

      <rect className="ns-sky" x="0" y="0" width="336" height="140" />

      {/* sun — rises and sets behind the mountains */}
      <g className="ns-sun">
        <circle cx="0" cy="0" r="20" fill="#FFE2A6" opacity="0.35" />
        <circle cx="0" cy="0" r="13" fill="#FFD06A" />
      </g>

      {/* night — moon + stars */}
      <g className="ns-night">
        <circle cx="268" cy="30" r="16" fill="#F4F0E2" opacity="0.25" />
        <circle cx="268" cy="30" r="11" fill="#F6F2E6" />
        <circle className="ns-star" cx="40" cy="26" r="1.4" fill="#fff" />
        <circle className="ns-star b" cx="84" cy="16" r="1.2" fill="#fff" />
        <circle className="ns-star c" cx="130" cy="30" r="1.4" fill="#fff" />
        <circle className="ns-star d" cx="186" cy="18" r="1.2" fill="#fff" />
        <circle className="ns-star b" cx="222" cy="40" r="1.3" fill="#fff" />
        <circle className="ns-star" cx="306" cy="48" r="1.2" fill="#fff" />
      </g>

      {/* birds */}
      <g className="ns-bird"><path d="M0 0 q4 -4 8 0 q4 -4 8 0" fill="none" stroke="#2A3350" strokeWidth="1.4" transform="translate(60 44)" /></g>
      <g className="ns-bird b"><path d="M0 0 q3 -3 6 0 q3 -3 6 0" fill="none" stroke="#2A3350" strokeWidth="1.2" transform="translate(90 58)" /></g>

      {/* mountains */}
      <path d="M0 112 L60 78 L112 104 L172 66 L232 100 L300 74 L336 94 L336 140 L0 140 Z" fill="#5E6E96" />
      <path d="M172 66 L162 78 L172 74 L182 80 Z" fill="#EAF1F6" opacity="0.85" />
      <path d="M300 74 L292 84 L300 81 L308 86 Z" fill="#EAF1F6" opacity="0.85" />
      <path d="M0 140 L0 120 L72 90 L132 116 L192 86 L252 112 L322 90 L336 100 L336 140 Z" fill="#3C476A" />

      {/* foreground ridge + explorers */}
      <path d="M0 140 L0 128 L120 120 L240 130 L336 124 L336 140 Z" fill="#2A3350" />
      <g className="ns-hiker">
        <line x1="150" y1="116" x2="156" y2="106" stroke="#C8A97E" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="148" cy="113" r="3" fill="#1F2740" />
        <rect x="145.6" y="116" width="5" height="9" rx="2.3" fill="#1F2740" />
        <rect x="150" y="117" width="3.2" height="4" rx="1" fill="#C8A97E" />
        <line x1="146" y1="125" x2="144" y2="130" stroke="#1F2740" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="150" y1="125" x2="152" y2="130" stroke="#1F2740" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g className="ns-hiker b">
        <circle cx="166" cy="115" r="2.7" fill="#1F2740" />
        <rect x="163.8" y="118" width="4.6" height="8" rx="2.2" fill="#1F2740" />
        <rect x="167.5" y="119" width="3" height="3.6" rx="1" fill="#C8A97E" />
        <line x1="164" y1="126" x2="162" y2="130" stroke="#1F2740" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="168" y1="126" x2="170" y2="130" stroke="#1F2740" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="168" y1="120" x2="174" y2="115" stroke="#1F2740" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full ${cls}`} style={{ fontWeight: 500, fontSize: 11 }}>
      {label}
    </span>
  );
}

// City names in India are alphabetic — strip digits and stray symbols as the user types.
const sanitizeCity = (v: string) => v.replace(/[^A-Za-z\s.'-]/g, "");

// Format a canonical "+91XXXXXXXXXX" number for display as "+91 98765 43210"
function fmtPhone(canonical: string): string {
  const d = canonical.replace(/^\+91/, "").replace(/\D/g, "").slice(0, 10);
  const a = d.slice(0, 5), b = d.slice(5, 10);
  return "+91" + (a ? " " + a : "") + (b ? " " + b : "");
}

// ─── Identity → account registry ───────────────────────────────────────────────
// A phone number or email is registered as ONE account type (personal or
// organisation) the first time someone completes onboarding with it. Signing out
// and back in with that same number/email should restore that exact account —
// not let them pick a different account type the second time round.
type IdentityBits = { phone?: string; email?: string };
function identityKey(id: IdentityBits): string | null {
  // Last 10 digits only — so "+916380339944" and "6380339944" are the SAME key.
  if (id.phone) return "phone:" + id.phone.replace(/\D/g, "").slice(-10);
  if (id.email) return "email:" + id.email.trim().toLowerCase();
  return null;
}
function loadIdentityRegistry(): Record<string, UserProfile> {
  try { return JSON.parse(localStorage.getItem("fl_identity_registry") || "{}"); } catch { return {}; }
}
function rememberIdentity(id: IdentityBits, profile: UserProfile) {
  const key = identityKey(id);
  if (!key) return;
  const registry = loadIdentityRegistry();
  registry[key] = profile;
  try { localStorage.setItem("fl_identity_registry", JSON.stringify(registry)); } catch { /* ignore */ }
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
// Note: the mock status bar (clock/signal/wifi/battery) that used to render here has
// been removed — it was just a static design-preview icon with no function, and on a
// real device the OS already draws its own status bar, so this was redundant chrome.

// ─── Active-order card shape (Home) ─────────────────────────────────────────────
// Derived from the customer's REAL orders — no mock data. The card only shows
// once a real order exists, so tapping "Track" always opens something.
interface HomeOrderCard { id: string; name: string; shade: string; qty: string; gsm: string; eta: string; status: string; pct: number; quoteReady: boolean; quoteText: string; orderId?: string; needsPayment?: boolean; payAmount?: number; }

// "Order again" rail entry — enough of the original delivered order to rebuild
// a properly priced, fully-sized repeat cart even with no local edit-snapshot.
interface HomePastOrder {
  ref: string; orderId?: string; name: string; shade?: string; colorHex?: string;
  qty: number; isAccessoryOrder?: boolean; sizes?: { label: string; qty: number }[]; unitPrice?: number;
}

const HOME_STATUS_PCT: Record<string, number> = {
  "Order placed": 8, "Order submitted": 8, "Quote pending": 15, "Quote ready": 20, "Order confirmed": 30,
  "In production": 55, "Quality check": 78, "Shipped": 92, "Delivered": 100, "Completed": 100,
};

function apiOrderToHomeCard(o: ApiOrder): HomeOrderCard {
  const name = o.isAccessoryOrder && o.accessoryItems?.length
    ? `${o.accessoryItems[0].itemName}${o.accessoryItems.length > 1 ? ` +${o.accessoryItems.length - 1}` : ""}`
    : (o.garmentType || "Custom order");
  const shade = o.colors?.[0]?.label || "";
  const quoteReady = o.status === "Quote ready" || (o.persona === "organisation" && (o.quoteAmount ?? 0) > 0 && o.paymentStatus !== "paid" && o.status === "Quote pending");
  // Individual order that Garm has confirmed but the customer hasn't paid yet →
  // surface a "Pay now" prompt on Home so they know an action is waiting.
  const payAmount = o.total || o.quoteAmount || 0;
  const needsPayment = o.persona !== "organisation"
    && o.paymentStatus !== "paid"
    && (o.adminStatus === "CONFIRMED" || o.status === "Order confirmed")
    && payAmount > 0;
  return {
    id: o.orderRef ? `#${o.orderRef}` : (o._id ? `#${o._id.slice(-6)}` : "#—"),
    orderId: o.orderRef || o._id,
    name,
    shade,
    qty: `${o.qty || 0} pcs`,
    gsm: "",
    // "Arriving in 3 days" beats "ETA 2026-07-20" — countdowns are felt, dates are read.
    eta: o.etaDate ? (etaCountdown(o.etaDate) ?? `ETA ${o.etaDate}`) : "",
    status: o.status,
    pct: HOME_STATUS_PCT[o.status] ?? 10,
    quoteReady,
    quoteText: (o.quoteAmount ?? 0) > 0 ? `Quote ready — ₹${Math.round(o.quoteAmount!).toLocaleString("en-IN")}` : "Quote ready",
    needsPayment,
    payAmount,
  };
}

// ─── Home Tab ─────────────────────────────────────────────────────────────────
// ─── Curated collections — ready-made bundles that open the order flow
// pre-filled at Review (customer just adjusts sizes & submits). Edit freely. ──
export interface HomeCollection {
  id: string; title: string; sub: string; emoji: string;
  audience: "men" | "women";
  lines: { categoryId: "mens" | "womens"; name: string; basePrice: number; style?: string; qty: number; colorHex: string; colorLabel: string }[];
}
const HOME_COLLECTIONS: HomeCollection[] = [
  { id: "tees", title: "Everyday Tees Pack", sub: "2× Black + 1× Off-white tees", emoji: "◼︎", audience: "men", lines: [
    { categoryId: "mens", name: "T-Shirts", basePrice: 190, qty: 2, colorHex: "#0D0D0D", colorLabel: "Black" },
    { categoryId: "mens", name: "Oversized T-Shirts", basePrice: 240, qty: 1, colorHex: "#F4F1EA", colorLabel: "Off-White" },
  ]},
  { id: "office", title: "Office Ready", sub: "2× Formal shirts + chinos", emoji: "▲", audience: "men", lines: [
    { categoryId: "mens", name: "Shirts (Formal)", basePrice: 360, qty: 2, colorHex: "#F5F5F2", colorLabel: "White" },
    { categoryId: "mens", name: "Chinos", basePrice: 480, qty: 1, colorHex: "#1F2A44", colorLabel: "Navy" },
  ]},
  { id: "her", title: "Her Essentials", sub: "Kurti + leggings + top", emoji: "●", audience: "women", lines: [
    { categoryId: "womens", name: "Kurtis", basePrice: 380, qty: 1, colorHex: "#7C3A5B", colorLabel: "Berry" },
    { categoryId: "womens", name: "Leggings", basePrice: 220, qty: 1, colorHex: "#0D0D0D", colorLabel: "Black" },
    { categoryId: "womens", name: "Tops", basePrice: 260, qty: 1, colorHex: "#F4F1EA", colorLabel: "Off-White" },
  ]},
];

// "Arriving in N days" reads better than a raw date — countdowns are emotion.
function etaCountdown(eta?: string): string | undefined {
  if (!eta || eta === "TBD") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(eta);
  if (!m) return eta;
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - now.getTime()) / 86_400_000);
  if (days < 0)  return "Arriving soon";
  if (days === 0) return "Arriving today";
  if (days === 1) return "Arriving tomorrow";
  return `Arriving in ${days} days`;
}

// ─── Illustrated garment art — hand-drawn SVG tiles so Home has real imagery,
// not just line icons. Each is self-contained and colour-tintable. ────────────
function GarmentArt({ kind, size = 40 }: { kind: "kids" | "men" | "women" | "accessories"; size?: number }) {
  const s = size;
  if (kind === "men") return (
    <svg width={s} height={s} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M9 10 L15 5.5 Q20 9 25 5.5 L31 10 L28.5 15.5 L26.5 13.5 L26.5 32 Q20 34.5 13.5 32 L13.5 13.5 L11.5 15.5 Z" fill="#1F2A44"/>
      <path d="M15 5.5 Q20 9 25 5.5 L23.5 8 Q20 10.5 16.5 8 Z" fill="#141E33"/>
      <path d="M17 18 h6 M17 21.5 h6" stroke="rgba(255,255,255,0.35)" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
  if (kind === "women") return (
    <svg width={s} height={s} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M14.5 5.5 Q20 10 25.5 5.5 L27.5 12 L24.5 16.5 L29 32.5 Q20 36.5 11 32.5 L15.5 16.5 L12.5 12 Z" fill="#B0486F"/>
      <path d="M14.5 5.5 Q20 10 25.5 5.5 L24.5 8.5 Q20 12 15.5 8.5 Z" fill="#93395B"/>
      <path d="M13.5 25 Q20 28 26.5 25" stroke="rgba(255,255,255,0.4)" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
    </svg>
  );
  if (kind === "kids") return (
    <svg width={s} height={s} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M10.5 12 L16 8 Q20 11 24 8 L29.5 12 L27.5 16.5 L25.5 15 L25.5 31 Q20 33.5 14.5 31 L14.5 15 L12.5 16.5 Z" fill="#C8A97E"/>
      <path d="M20 20.5 l1.6 -1.7 q1.7 -1.7 3.2 0 q1.4 1.7 -0.3 3.4 L20 26.5 l-4.5 -4.3 q-1.7 -1.7 -0.3 -3.4 q1.5 -1.7 3.2 0 Z" fill="#fff" opacity="0.85"/>
    </svg>
  );
  return (
    <svg width={s} height={s} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="8" y="16" width="24" height="16" rx="2.5" fill="#047857"/>
      <rect x="8" y="16" width="24" height="5" rx="2.5" fill="#065F46"/>
      <rect x="18.2" y="10" width="3.6" height="22" fill="#C8A97E"/>
      <path d="M20 10 Q14 10 13.5 6.5 Q17.5 5 20 10 Q22.5 5 26.5 6.5 Q26 10 20 10 Z" fill="#C8A97E"/>
    </svg>
  );
}

// ─── Campaign banners (fallbacks — the admin portal's "Garm App Home" tab
// overrides these live, no deploy needed) ─────────────────────────────────────
interface HomeCampaignDef { title: string; sub: string; badge?: string; ctaLabel: string; target: "kids" | "order" | "none"; theme: "purple" | "blue" | "green" | "gold" | "dark"; enabled: boolean }
const DEFAULT_CAMPAIGNS: HomeCampaignDef[] = [
  { title: "Wedding & Events", sub: "Custom fabric orders for weddings, functions & events. Match your theme colours — sarees to sherwanis — with free design consultation.", badge: "New", ctaLabel: "Explore the workflow", target: "none", theme: "purple", enabled: true },
  { title: "School reopening?", sub: "Kids' uniforms, sports tees and house colours — age-based sizing, name tags on request, delivered before the first bell.", ctaLabel: "Start a kids order", target: "kids", theme: "blue", enabled: true },
  { title: "Surplus fabric week", sub: "Premium roll-ends, rescued — the exact same garment, 15% kinder to your wallet and the planet. Pick \"Surplus fabric\" at the Material step.", badge: "Save 15%", ctaLabel: "Order with surplus fabric", target: "order", theme: "green", enabled: true },
];
const CAMPAIGN_THEMES: Record<HomeCampaignDef["theme"], { bg: string; shadow: string }> = {
  purple: { bg: "linear-gradient(135deg,#2d1b4e 0%,#5b2d8e 50%,#c8a84b 100%)", shadow: "0 8px 22px rgba(91,45,142,0.28)" },
  blue:   { bg: "linear-gradient(135deg,#0F2A4A 0%,#1D4ED8 70%,#3B82F6 115%)", shadow: "0 8px 22px rgba(29,78,216,0.25)" },
  green:  { bg: "linear-gradient(135deg,#052E22 0%,#047857 70%,#10B981 115%)", shadow: "0 8px 22px rgba(4,120,87,0.25)" },
  gold:   { bg: "linear-gradient(135deg,#3A2A12 0%,#8A5A18 60%,#C8A97E 115%)", shadow: "0 8px 22px rgba(138,90,24,0.28)" },
  dark:   { bg: "linear-gradient(140deg,#1A1815 0%,#0D0D0D 60%,#14110C 100%)", shadow: "0 8px 22px rgba(13,13,13,0.3)" },
};

// ─── Home content — edit these lists weekly, layout takes care of itself ──────
// "Good to know" cards (horizontal rail). tone: "gold" | "green" | "muted".
const HOME_TIPS: { tone: "gold" | "green" | "muted"; chip: string; icon: React.ReactNode; title: string; body: string }[] = [
  { tone: "green", chip: "Quality",   icon: <ShieldCheck size={10} strokeWidth={1.8}/>, title: "180 vs 230 GSM — feel the difference", body: "Why heavier fabric survives 50+ washes and drapes better. 30-second read." },
  { tone: "gold",  chip: "Colours",   icon: <Palette size={10} strokeWidth={1.8}/>,     title: "Colours that never betray you",        body: "Navy, bottle green & charcoal hide stains, hold dye and match everything." },
  { tone: "muted", chip: "Care",      icon: <Droplets size={10} strokeWidth={1.8}/>,    title: "Why your black tee fades",             body: "Wash inside-out, cold water, skip the dryer. Your tee will thank you." },
  { tone: "gold",  chip: "Real talk", icon: <Smile size={10} strokeWidth={1.8}/>,       title: "Surplus fabric = 15% smug savings",    body: "Ends of premium rolls, rescued. The planet approves. So does your wallet." },
  { tone: "muted", chip: "Craft",     icon: <Scissors size={10} strokeWidth={1.8}/>,    title: "Single-needle stitching, explained",   body: "The tiny detail that separates \"uniform\" from \"tailored\"." },
];
// Bottom "did you know / real talk" cards.
const HOME_FACTS: { icon: React.ReactNode; lead: string; body: string }[] = [
  { icon: <Lightbulb size={14} strokeWidth={1.6}/>, lead: "Did you know?", body: "One cotton tee takes ~2,700 litres of water to make. Made-to-order (no overstock) is the greenest choice in fashion." },
  { icon: <Smile size={14} strokeWidth={1.6}/>,     lead: "Real talk:",    body: "“One size fits all” is the biggest lie in fashion. That's why we don't sell it." },
];

function HomeTab({ onNavigate, onBell, onDrafts, onHelp, onQuickStart, onOpenCollection, onReorderPast, draftCount = 0, notifCount = 0, profile }: {
  onNavigate: (t: Tab, orderId?: string) => void;
  onBell: () => void;
  onDrafts: () => void;
  onHelp?: () => void;
  onQuickStart?: (intent: OrderIntent) => void;
  onOpenCollection?: (c: HomeCollection) => void;
  onReorderPast?: (order: HomePastOrder) => void;
  draftCount?: number;
  notifCount?: number;
  profile?: UserProfile;
}) {
  const [showSwatch, setShowSwatch] = useState(false);

  // Real orders — same source Track uses. The "Order in progress" card only
  // appears once the customer actually has an active order (nothing mocked),
  // so tapping Track always lands on real data. Refreshes on mount + 30s.
  // Instant render: the tiles and the "Order in progress" card come up from the
  // LAST KNOWN orders (same cache Track uses) the moment Home opens — the fresh
  // fetch then updates them silently. No more "0 / 0 / —" flash while loading.
  const readHomeFromOrders = (orders: { status: string; updatedAt?: string; createdAt?: string; orderRef?: string; _id?: string; garmentType?: string; serviceLabel?: string; colors?: { label: string; hex?: string }[]; rating?: number; ratingFeedback?: string; qty?: number; isAccessoryOrder?: boolean; sizes?: { label: string; qty: number }[]; total?: number; lines?: { unit: number }[] }[]) => {
    const active = orders
      .filter((o) => !["Draft", "Delivered", "Completed", "Cancelled"].includes(o.status))
      .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || "") - Date.parse(a.updatedAt || a.createdAt || ""));
    const deliveredList = orders
      .filter((o) => ["Delivered", "Completed"].includes(o.status))
      .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || "") - Date.parse(a.updatedAt || a.createdAt || ""));
    // "Order again" rail — the customer's own past garments, one tap to repeat.
    // Carries enough of the original order (colour, qty) that repeating it
    // still works even when the rich local edit-snapshot isn't on this device.
    const past = deliveredList.slice(0, 6).map((o) => ({
      ref: o.orderRef || `#${(o._id || "").slice(-6).toUpperCase()}`,
      orderId: o.orderRef || o._id,
      name: o.garmentType || o.serviceLabel || "Custom order",
      shade: o.colors?.[0]?.label,
      colorHex: o.colors?.[0]?.hex,
      qty: o.qty || 1,
      isAccessoryOrder: !!o.isAccessoryOrder,
      // Real size split + per-piece price from the original order, so a repeat
      // opens fully assigned (no "0 of N pcs" block) and priced (not ₹0/pc).
      sizes: (o.sizes && o.sizes.length ? o.sizes : undefined),
      unitPrice: o.lines?.[0]?.unit || (o.total && o.qty ? Math.round(o.total / o.qty) : 0),
    }));
    // Social proof — real ratings + the latest written feedback.
    const rated = orders.filter((o) => (o.rating ?? 0) > 0);
    const avg = rated.length ? (rated.reduce((s, o) => s + (o.rating ?? 0), 0) / rated.length) : 0;
    const quotes = orders
      .filter((o) => (o.rating ?? 0) >= 4 && (o.ratingFeedback || "").trim().length > 3)
      .sort((a, b) => Date.parse(b.updatedAt || "") - Date.parse(a.updatedAt || ""))
      .slice(0, 2)
      .map((o) => ({ text: (o.ratingFeedback || "").trim(), stars: o.rating ?? 5 }));
    return {
      cards: active.map((o) => apiOrderToHomeCard(o as Parameters<typeof apiOrderToHomeCard>[0])),
      stats: { active: active.length, delivered: deliveredList.length, onTime: deliveredList.length > 0 ? "100%" : "—" },
      past,
      proof: { count: rated.length, avg: Math.round(avg * 10) / 10, quotes },
    };
  };
  const cachedHome = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem("fl_orders_cache") || "null");
      return Array.isArray(raw) ? readHomeFromOrders(raw) : null;
    } catch { return null; }
  })();
  const [homeOrders, setHomeOrders] = useState<HomeOrderCard[]>(cachedHome?.cards ?? []);
  // Real order stats for the tiles — NEVER hardcoded. A brand-new account shows
  // 0 / 0 / — instead of fake "3 / 4 / 97%" (which looked like someone else's data).
  const [homeStats, setHomeStats] = useState<{ active: number; delivered: number; onTime: string }>(cachedHome?.stats ?? { active: 0, delivered: 0, onTime: "—" });
  const [pastOrders, setPastOrders] = useState<HomePastOrder[]>(cachedHome?.past ?? []);
  const [proof, setProof] = useState<{ count: number; avg: number; quotes: { text: string; stars: number }[] }>(cachedHome?.proof ?? { count: 0, avg: 0, quotes: [] });
  useEffect(() => {
    let alive = true;
    const load = () => ordersApi.list()
      .then(({ orders }) => {
        if (!alive) return;
        const { cards, stats, past, proof: pf } = readHomeFromOrders(orders);
        setHomeOrders(cards);
        setHomeStats(stats);
        setPastOrders(past);
        setProof(pf);
        // Keep the shared cache fresh from Home too (documents stripped — huge).
        try { localStorage.setItem("fl_orders_cache", JSON.stringify(orders.map((o) => ({ ...o, documents: undefined })))); } catch { /* ignore */ }
      })
      .catch(() => { /* offline / cold — keep showing the cached data */ });
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persona-aware hero copy — individuals get warm, personal lines;
  // organisations get the procurement pitch.
  const personalHome = !profile?.accountType || profile.accountType === "personal";

  // Live admin-managed Home content (admin portal → Settings → Garm App Home).
  // Falls back to the built-in defaults until the admin saves their own.
  const liveCfg = useOrderFormConfig();
  const tipsToRender = liveCfg.homeContent?.tips?.length
    ? liveCfg.homeContent.tips.map(t => ({
        tone: t.tone, chip: t.chip, title: t.title, body: t.body,
        icon: t.tone === "green" ? <ShieldCheck size={10} strokeWidth={1.8}/> : t.tone === "gold" ? <Palette size={10} strokeWidth={1.8}/> : <Droplets size={10} strokeWidth={1.8}/>,
      }))
    : HOME_TIPS;
  const campaignsToRender: HomeCampaignDef[] =
    (liveCfg.homeContent?.campaigns?.length ? liveCfg.homeContent.campaigns : DEFAULT_CAMPAIGNS).filter(c => c.enabled !== false);
  const collectionsToRender: HomeCollection[] = liveCfg.homeContent?.collections?.length
    ? liveCfg.homeContent.collections.map(c => ({ emoji: "", ...c }))
    : HOME_COLLECTIONS;

  // Active order drives the horizontal progress tracker. Individuals never get a
  // Quote/Approve stage (that's the organisation quote flow) — their journey is
  // Submitted → Confirmed → Production → QC → Shipped → Delivered.
  const trackStages = personalHome
    ? ["Submitted", "Confirmed", "Production", "QC", "Shipped", "Delivered"]
    : ["Review", "Quote", "Approve", "Production", "QC", "Shipped", "Delivered"];
  const statusToStage: Record<string, number> = personalHome
    ? { "Order placed": 0, "Order submitted": 0, "Order confirmed": 1, "In production": 2, "Quality check": 3, "Shipped": 4, "Delivered": 5, "Completed": 5 }
    : { "Order placed": 0, "Order submitted": 0, "Order confirmed": 1, "Quote pending": 1, "Quote ready": 2, "In production": 3, "Quality check": 4, "Shipped": 5, "Delivered": 6, "Completed": 6 };
  const activeOrder = homeOrders[0] ?? null;
  const curStage = activeOrder ? (statusToStage[activeOrder.status] ?? 0) : 0;
  const hero = personalHome
    ? {
        eyebrow: "Garm · Made to order",
        line1: "Your style, your colours —",
        line2: "stitched just for you",
        body: "One piece or the whole family's. You design it, we make it, track it to your door.",
        cta: "Start my order",
      }
    : {
        eyebrow: "Garm Procurement",
        line1: "Team wear & uniforms,",
        line2: "sorted end to end",
        body: "One coordinator handles quotes, fabric, QA and delivery — you just approve.",
        cta: "Start an order",
      };

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">

      {/* ── Top bar — PINNED (Zomato-tight): only the content below scrolls ── */}
      <div className="px-5 pt-2 pb-3 flex items-center justify-between flex-shrink-0 border-b border-border"
        style={{ background: "rgba(248,247,245,0.96)", backdropFilter: "blur(14px)" }}>
        <div>
          <p className="label-section">Good morning</p>
          <h2 className="text-foreground mt-0.5" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>
            {profile?.name?.split(" ")[0] || "Arjun"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {onHelp && (
            <button onClick={onHelp}
              id="coachmark-help-btn"
              className="w-9 h-9 rounded-full bg-card flex items-center justify-center border border-border"
              style={{ boxShadow: "var(--shadow-sm)" }}
              title="How Garm works" aria-label="How Garm works">
              <HelpCircle size={16} strokeWidth={1.5}/>
            </button>
          )}
          <button onClick={onDrafts}
            className="w-9 h-9 rounded-full bg-card flex items-center justify-center border border-border relative"
            style={{ boxShadow: "var(--shadow-sm)" }}
            title="Drafts">
            <FileText size={16} strokeWidth={1.5}/>
            {draftCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center"
                style={{ background: ACCENT, color: "#fff", fontSize: 9, fontWeight: 700 }}>{draftCount}</span>
            )}
          </button>
          <button onClick={onBell}
            className="w-9 h-9 rounded-full bg-card flex items-center justify-center border border-border relative"
            style={{ boxShadow: "var(--shadow-sm)" }}>
            <Bell size={16} strokeWidth={1.5}/>
            {notifCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center"
                style={{ background: ACCENT, color: "#fff", fontSize: 9, fontWeight: 700 }}>{notifCount > 99 ? "99+" : notifCount}</span>
            )}
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

      {/* ── Scrollable content area ── */}
      <div className="flex-1 overflow-y-auto pb-4 min-h-0 pt-4" style={{ scrollbarWidth: "none" }}>

      {/* ── Hero banner — woven texture + floating brand mark + stitched thread ── */}
      <div className="mx-5 mb-5 rounded-2xl p-5 relative overflow-hidden"
        style={{ background: "linear-gradient(140deg, #1A1815 0%, #0D0D0D 55%, #14110C 100%)", boxShadow: "0 10px 28px rgba(13,13,13,0.22)" }}>
        {/* Basket-weave texture — the Garm mark, woven into the background */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.055 }} aria-hidden="true">
          <defs>
            <pattern id="garmWeavePat" width="36" height="36" patternUnits="userSpaceOnUse">
              <rect x="4" y="4" width="28" height="11" rx="5.5" fill="none" stroke="#fff" strokeWidth="1.5"/>
              <rect x="20" y="20" width="28" height="11" rx="5.5" fill="none" stroke="#fff" strokeWidth="1.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#garmWeavePat)"/>
        </svg>
        {/* Warm glow behind the floating mark */}
        <div className="absolute top-0 right-0 w-44 h-44 rounded-full pointer-events-none"
          style={{ transform: "translate(28%,-28%)", background: "radial-gradient(circle, rgba(200,169,126,0.28) 0%, transparent 70%)" }}/>
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full border border-white/5 pointer-events-none"
          style={{ transform: "translate(-30%,30%)" }}/>
        {/* Floating woven logo tile */}
        <div className="absolute pointer-events-none magic-anim"
          style={{ top: 16, right: 16, animation: "garmHeroFloat 5s ease-in-out infinite", filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.4))" }}>
          <GarmLogo size={46}/>
        </div>

        <p className="mb-2 label-section" style={{ color: "rgba(200,169,126,0.8)" }}>{hero.eyebrow}</p>
        <h1 className="text-white mb-1" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.25 }}>
          {hero.line1}<br/><span style={{ color: ACCENT }}>{hero.line2}</span>
        </h1>
        {/* Running stitch — a thread sewing itself under the headline */}
        <svg width="156" height="10" viewBox="0 0 156 10" className="mb-1.5" aria-hidden="true">
          <path className="magic-anim" d="M2 6 C 32 2, 62 9, 92 5 S 144 4, 154 5" fill="none"
            stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeDasharray="6 5"
            style={{ animation: "garmThread 2.6s linear infinite" }}/>
        </svg>
        <p className="text-white/55 mb-5" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
          {hero.body}
        </p>
        <button onClick={() => onNavigate("order")}
          className="w-full bg-white text-foreground rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-medium"
          style={{ boxShadow: "0 6px 20px rgba(200,169,126,0.28)" }}>
          <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: ACCENT }}>
            <PlusCircle size={13} strokeWidth={2} color="#fff"/>
          </span>
          {hero.cta}
        </button>
      </div>

      {/* ── Order Track progress — right after the hero card, before the stats ── */}
      {activeOrder && (
        <div className="mx-5 mb-5 overflow-hidden" style={{ ...card, cursor: "pointer" }}
          onClick={() => onNavigate("track", activeOrder.orderId ?? activeOrder.id.replace(/^#/, ""))}>
          <div style={{ height: 3, background: "linear-gradient(90deg, #C8A97E 0%, rgba(200,169,126,0.25) 100%)" }}/>
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <p className="label-section">Order in progress</p>
              <p className="text-foreground text-sm font-semibold mt-0.5">{activeOrder.id}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onNavigate("track", activeOrder.orderId ?? activeOrder.id.replace(/^#/, "")); }}
              className="text-xs text-foreground flex items-center gap-1 font-medium">
              Track <ArrowRight size={11} strokeWidth={2}/>
            </button>
          </div>

          <div className="px-4 pt-4 pb-4">
            {/* Stage animation — scene follows the active order's current stage */}
            <div className="mb-4">
              <StageAnimation stage={stageFromLabel(activeOrder.status)} compact/>
            </div>

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
                <p className="text-foreground text-sm" style={{ fontWeight: 600 }}>{activeOrder.name}{activeOrder.shade ? ` — ${activeOrder.shade}` : ""}</p>
                <span className="text-foreground" style={{ fontSize: 11, fontWeight: 600, background: "transparent" }}>{activeOrder.status}</span>
              </div>
              <p className="text-muted-foreground" style={{ fontSize: 12 }}>{[activeOrder.qty, activeOrder.gsm, activeOrder.eta].filter(Boolean).join(" · ")}</p>
            </div>

            {/* Payment prompt — order confirmed, awaiting the customer's payment. */}
            {activeOrder.needsPayment && (
              <button onClick={(e) => { e.stopPropagation(); onNavigate("track", activeOrder.orderId ?? activeOrder.id.replace(/^#/, "")); }}
                className="mt-3 w-full flex items-center justify-between rounded-xl px-3.5 py-3"
                style={{ background: "#0D0D0D", border: "none", cursor: "pointer" }}>
                <span className="flex items-center gap-2 min-w-0">
                  <Wallet size={15} strokeWidth={1.8} style={{ color: "#C8A97E", flexShrink: 0 }}/>
                  <span className="text-left min-w-0">
                    <span className="block" style={{ fontSize: 12.5, fontWeight: 700, color: "#fff" }}>Payment due · ₹{Math.round(activeOrder.payAmount || 0).toLocaleString("en-IN")}</span>
                    <span className="block" style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)" }}>Confirmed by Garm — pay to start production</span>
                  </span>
                </span>
                <span className="rounded-lg px-3 py-1.5 flex-shrink-0" style={{ background: "#C8A97E", color: "#0D0D0D", fontSize: 12, fontWeight: 700 }}>Pay now</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="mx-5 mb-5 grid grid-cols-3 gap-2.5">
        {[
          { label: "Active",    value: String(homeStats.active),    icon: <Clock        size={14} strokeWidth={1.8}/>, tint: "#7C5419", bg: ACCENT_BG },
          { label: "Delivered", value: String(homeStats.delivered), icon: <CheckCircle2 size={14} strokeWidth={1.8}/>, tint: "#047857", bg: "#ECFDF5" },
          { label: "On-time",   value: homeStats.onTime,            icon: <TrendingUp   size={14} strokeWidth={1.8}/>, tint: "#1a4a8a", bg: "#EFF6FF" },
        ].map(s => (
          <div key={s.label} style={card} className="p-3.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: s.bg, color: s.tint }}>{s.icon}</div>
            <p className="text-foreground" style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{s.value}</p>
            <p className="text-muted-foreground mt-0.5" style={{ fontSize: 11 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── "What are we making today?" — quick entry tiles into the order flow ── */}
      {personalHome && (
        <>
          <p className="px-5 mb-2.5 label-section">What are we making today?</p>
          <div className="mx-5 mb-5 grid grid-cols-4 gap-2">
            {[
              // Illustrated garment art on softly tinted tiles — real imagery,
              // still in the app's calm palette.
              { label: "Kids",        sub: "Age sizes",   kind: "kids" as const,        bg: "#FBF3E4", Icon: Users },
              { label: "Men",         sub: "Chest sizes", kind: "men" as const,         bg: "#EAF0F7",  Icon: User },
              { label: "Women",       sub: "UK sizes",    kind: "women" as const,       bg: "#FBEBF1", Icon: Heart },
              { label: "Accessories", sub: "Caps, bags…", kind: "accessories" as const, bg: "#E9F6EF", Icon: Gift },
            ].map(c => (
              <button key={c.label}
                onClick={() => onQuickStart
                  ? onQuickStart(c.label === "Kids" ? "kids" : c.label === "Men" ? "men" : c.label === "Women" ? "women" : "accessories")
                  : onNavigate("order")}
                className="text-center py-3 px-1 rounded-2xl"
                style={{ ...card, cursor: "pointer" }}>
                <span className="mx-auto mb-1.5 flex items-center justify-center rounded-xl"
                  style={{ width: 44, height: 44, background: c.bg }}>
                  <c.Icon size={20} strokeWidth={1.5} style={{ color: DARK }}/>
                </span>
                <span className="block text-foreground" style={{ fontSize: 11.5, fontWeight: 600 }}>{c.label}</span>
                <span className="block text-muted-foreground" style={{ fontSize: 10.5 }}>{c.sub}</span>
              </button>
            ))}
          </div>

          {/* ── Size guide strip — opens the actual size chart, one tap ── */}
          <button onClick={() => onQuickStart ? onQuickStart("sizeguide") : onNavigate("order")}
            className="mx-5 mb-5 w-[calc(100%-2.5rem)] flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left"
            style={{ background: ACCENT_BG, border: `1px solid ${ACCENT}`, cursor: "pointer" }}>
            <Ruler size={18} strokeWidth={1.5} style={{ color: ACCENT_TEXT, flexShrink: 0 }}/>
            <span className="min-w-0 flex-1">
              <span className="block text-foreground" style={{ fontSize: 12.5, fontWeight: 600 }}>Size guide — before production</span>
              <span className="block" style={{ fontSize: 10.5, color: ACCENT_TEXT, marginTop: 1 }}>Measure once, cut once. Literally.</span>
            </span>
            <span className="rounded-xl px-3 py-2 flex-shrink-0" style={{ background: DARK, color: "#fff", fontSize: 10.5, fontWeight: 600 }}>View chart</span>
          </button>

          {/* ── "Good to know" — scrollable tips rail (edit HOME_TIPS to refresh) ── */}
          <p className="px-5 mb-2.5 label-section">Good to know · fresh weekly</p>
          <div className="flex gap-2.5 overflow-x-auto mb-5 px-5" style={{ scrollbarWidth: "none" }}>
            {tipsToRender.map(t => (
              <div key={t.title} className="rounded-2xl p-3.5 flex-shrink-0" style={{ ...card, width: 195 }}>
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 mb-2"
                  style={{
                    fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                    background: t.tone === "gold" ? ACCENT_BG : t.tone === "green" ? "#ECFDF5" : "var(--muted)",
                    color:      t.tone === "gold" ? ACCENT_TEXT : t.tone === "green" ? "#047857" : "var(--muted-foreground)",
                  }}>
                  {t.icon}{t.chip}
                </span>
                <p className="text-foreground" style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.35 }}>{t.title}</p>
                <p className="text-muted-foreground mt-1" style={{ fontSize: 11, lineHeight: 1.55 }}>{t.body}</p>
              </div>
            ))}
          </div>

          {/* ── "Order again" — the customer's own past garments, one tap to repeat ── */}
          {pastOrders.length > 0 && (
            <>
              <p className="px-5 mb-2.5 label-section">Order again</p>
              <div className="flex gap-2.5 overflow-x-auto mb-5 px-5" style={{ scrollbarWidth: "none" }}>
                {pastOrders.map(p => (
                  <button key={p.ref} onClick={() => onReorderPast?.(p)}
                    className="rounded-2xl p-3 flex-shrink-0 text-left" style={{ ...card, width: 150, cursor: "pointer" }}>
                    <span className="flex items-center justify-center rounded-xl mb-2" style={{ width: 30, height: 30, background: "var(--muted)" }}>
                      <RotateCcw size={14} strokeWidth={1.6} className="text-muted-foreground"/>
                    </span>
                    <p className="text-foreground" style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                    <p className="text-muted-foreground" style={{ fontSize: 11 }}>{p.shade ? `${p.shade} · ` : ""}{p.ref}</p>
                    <p style={{ fontSize: 10.5, fontWeight: 700, color: ACCENT_TEXT, marginTop: 5 }}>Repeat order →</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── Collections — curated bundles, opens the order pre-filled at Review ── */}
          <p className="px-5 mb-2.5 label-section">Collections · ready-made bundles</p>
          <div className="flex gap-2.5 overflow-x-auto mb-5 px-5" style={{ scrollbarWidth: "none" }}>
            {collectionsToRender.map(c => (
              <button key={c.id} onClick={() => onOpenCollection?.(c)}
                className="rounded-2xl overflow-hidden flex-shrink-0 text-left" style={{ ...card, width: 176, cursor: "pointer" }}>
                <div className="flex items-center gap-1.5 px-3.5 pt-3">
                  <span className="flex items-center justify-center rounded-lg mr-1" style={{ width: 26, height: 26, background: "var(--muted)" }}>
                    <GarmentArt kind={c.audience === "women" ? "women" : "men"} size={20}/>
                  </span>
                  {c.lines.map((l, i) => (
                    <span key={i} className="rounded-full" style={{ width: 14, height: 14, background: l.colorHex, border: "1px solid rgba(0,0,0,0.15)" }}/>
                  ))}
                  <span className="ml-auto text-muted-foreground" style={{ fontSize: 10.5 }}>{c.lines.reduce((a, l) => a + l.qty, 0)} pcs</span>
                </div>
                <div className="px-3.5 py-2.5">
                  <p className="text-foreground" style={{ fontSize: 12.5, fontWeight: 600 }}>{c.title}</p>
                  <p className="text-muted-foreground" style={{ fontSize: 11, marginTop: 1 }}>{c.sub}</p>
                  <p style={{ fontSize: 10.5, fontWeight: 700, color: ACCENT_TEXT, marginTop: 6 }}>Start this bundle →</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Campaign banner carousel — content managed LIVE from the admin
          portal (Settings → Garm App Home); these render whatever is saved there ── */}
      {(!profile?.accountType || profile.accountType === "personal") && campaignsToRender.length > 0 && (
        <div className="flex gap-3 overflow-x-auto mb-5 px-5" style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory" }}>
          {campaignsToRender.map((cp, i) => {
            const theme = CAMPAIGN_THEMES[cp.theme] ?? CAMPAIGN_THEMES.gold;
            const onTap = cp.target === "kids" ? () => onQuickStart?.("kids")
              : cp.target === "order" ? () => onNavigate("order")
              : undefined;
            return (
              <button key={`${cp.title}-${i}`} onClick={onTap}
                className="text-left overflow-hidden rounded-2xl relative flex-shrink-0"
                style={{ width: "calc(100% - 2.5rem)", scrollSnapAlign: "center", background: theme.bg, border: "none", cursor: onTap ? "pointer" : "default", boxShadow: theme.shadow }}>
                {cp.theme === "purple" && (
                  <>
                    <span className="absolute rounded-full pointer-events-none magic-anim" style={{ top: 12, right: 48, width: 5, height: 5, background: "#fff", animation: "garmTwinkle 1.9s ease-in-out infinite" }}/>
                    <span className="absolute rounded-full pointer-events-none magic-anim" style={{ top: 30, right: 20, width: 3.5, height: 3.5, background: "#fff", animation: "garmTwinkle 1.9s ease-in-out .6s infinite" }}/>
                    <span className="absolute rounded-full pointer-events-none magic-anim" style={{ bottom: 16, right: 76, width: 4, height: 4, background: "#fff", animation: "garmTwinkle 1.9s ease-in-out 1.2s infinite" }}/>
                  </>
                )}
                <div className="px-4 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    {cp.target === "kids" ? <Users size={18} strokeWidth={1.5} color="#fff"/> : cp.theme === "green" ? <Gift size={18} strokeWidth={1.5} color="#fff"/> : <Star size={18} strokeWidth={1.5} color="#fff"/>}
                    <span className="text-white text-sm font-bold">{cp.title}</span>
                    {cp.badge ? <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-medium">{cp.badge}</span> : null}
                  </div>
                  <p className="text-white/80 text-xs leading-relaxed mb-3">{cp.sub}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/60" style={{ fontSize: 11 }}>{cp.ctaLabel}</span>
                    <ChevronRight size={13} color="rgba(255,255,255,0.6)" strokeWidth={2}/>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
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
        {homeOrders.length === 0 && (
          <button onClick={() => onNavigate("order")} className="text-left w-full p-4 rounded-2xl" style={{ ...card, border: "1px dashed var(--border)" }}>
            <p className="text-foreground text-sm" style={{ fontWeight: 600 }}>No orders yet</p>
            <p className="text-muted-foreground" style={{ fontSize: 12, marginTop: 2 }}>Start your first order — it'll show up here to track.</p>
          </button>
        )}
        {homeOrders.map(o => (
          <button key={o.id} onClick={() => onNavigate("track", o.orderId ?? o.id.replace(/^#/, ""))}
            className="text-left w-full overflow-hidden"
            style={{
              ...card,
              border: `1px solid ${o.quoteReady ? ACCENT : "var(--border)"}`,
              borderRadius: 16,
            }}>
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-muted-foreground" style={{ fontSize: 11 }}>{o.id}</p>
                <StatusBadge label={o.status} cls="bg-muted text-foreground"/>
              </div>
              <p className="text-foreground text-sm font-medium mb-1">{o.name}{o.shade ? ` — ${o.shade}` : ""}</p>
              <p className="text-muted-foreground" style={{ fontSize: 12 }}>{[o.qty, o.gsm, o.eta].filter(Boolean).join(" · ")}</p>
              {/* Progress bar — gold thread with a light shimmer running along it */}
              <div className="h-1.5 bg-muted rounded-full mt-3 overflow-hidden">
                <div className="h-full rounded-full transition-all relative overflow-hidden"
                  style={{ width: `${o.pct}%`, background: "linear-gradient(90deg, #B08D58, #C8A97E)" }}>
                  <div className="absolute inset-y-0 w-1/2 magic-anim"
                    style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)", animation: "garmShimmer 2.4s ease-in-out infinite" }}/>
                </div>
              </div>
            </div>
            {o.quoteReady && (
              <div className="px-4 py-2.5 flex items-center justify-between border-t"
                style={{ background: ACCENT_BG, borderColor: "rgba(200,169,126,0.3)" }}>
                <div className="flex items-center gap-2">
                  <TrendingUp size={13} style={{ color: "#7c5419" }}/>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: ACCENT_TEXT }}>{o.quoteText}</p>
                    <p style={{ fontSize: 10, color: "#92400e" }}>Tap to review & approve</p>
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: ACCENT }} strokeWidth={1.5}/>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* ── Social proof — real ratings + latest written feedback ── */}
      {proof.count > 0 && (
        <div className="px-5 mt-5">
          <div className="rounded-2xl p-3.5" style={card}>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1" style={{ background: ACCENT_BG }}>
                <Star size={12} strokeWidth={0} fill={ACCENT} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: ACCENT_TEXT }}>{proof.avg}</span>
              </span>
              <p className="text-muted-foreground" style={{ fontSize: 11.5 }}>
                from {proof.count} rated order{proof.count !== 1 ? "s" : ""} — thank you!
              </p>
            </div>
            {proof.quotes.map((q, i) => (
              <p key={i} className="text-muted-foreground mt-2" style={{ fontSize: 11, lineHeight: 1.5, fontStyle: "italic" }}>
                "{q.text}" <span style={{ fontStyle: "normal", color: ACCENT_TEXT }}>{"★".repeat(q.stars)}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── Did-you-know / humour cards (edit HOME_FACTS to refresh) ── */}
      {personalHome && (
        <div className="px-5 mt-5 flex flex-col gap-2">
          {HOME_FACTS.map(f => (
            <div key={f.lead} className="rounded-2xl px-3.5 py-3 flex gap-2.5" style={card}>
              <span style={{ color: ACCENT_TEXT, flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
              <p className="text-muted-foreground" style={{ fontSize: 11, lineHeight: 1.55 }}>
                <span className="text-foreground" style={{ fontWeight: 600 }}>{f.lead}</span> {f.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {showSwatch && <SwatchBoxModal onClose={() => setShowSwatch(false)}/>}
      </div>
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

// ─── Welcome / Onboarding intro carousel ────────────────────────────────────────
// Shown on first launch, before sign in. Introduces Garm with a few value slides.
function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [replay, setReplay] = useState(0); // bump to re-weave the logo
  // Slides 1 & 2 gate "Continue" until their animation finishes (goal scored / van arrives).
  const COMPLETE_AFTER: Record<number, number> = { 1: 1700, 2: 2900 };
  const [done, setDone] = useState<Record<number, boolean>>({ 0: true });
  useEffect(() => {
    if (done[idx]) return;
    const ms = COMPLETE_AFTER[idx];
    if (!ms) { setDone(d => ({ ...d, [idx]: true })); return; }
    const t = setTimeout(() => setDone(d => ({ ...d, [idx]: true })), ms);
    return () => clearTimeout(t);
  }, [idx, done]);

  const slides = [
    {
      hero: "logo" as const,
      title: "Welcome to Garm",
      body: "Managed textile sourcing for teams and individuals — requirements, quotes, QA and delivery, all in one place.",
    },
    {
      hero: <FootballArt />,
      title: "Sourcing for everyone",
      body: "From a single jersey to a whole squad's kit — browse fabrics and order free swatches before you buy.",
    },
    {
      hero: <DeliveryArt />,
      title: "Tracked to your doorstep",
      body: "Live production, QA and delivery tracking — your order arrives without a single phone call.",
    },
  ];

  const isLast = idx === slides.length - 1;
  const slide = slides[idx];

  return (
    <div className="flex-1 flex flex-col px-6 pt-4 pb-9 min-h-0">
      {/* Top row — wordmark + skip */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <GarmLogo size={26} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.02em", color: DARK }}>Garm</span>
        </div>
        <button onClick={onDone}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--muted-foreground)", fontWeight: 500 }}>
          Skip
        </button>
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {slide.hero === "logo" ? (
          <>
            {/* Tap the woven logo to watch it weave again (Doherty-fast feedback) */}
            <button
              onClick={() => setReplay(r => r + 1)}
              aria-label="Replay logo animation"
              className="relative mb-7 flex items-center justify-center"
              style={{ width: 150, height: 150, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <span className="garm-ring" style={{ position: "absolute", width: 132, height: 132, borderRadius: "50%", border: `1.5px solid ${ACCENT}` }} />
              <span className="garm-ring garm-ring2" style={{ position: "absolute", width: 132, height: 132, borderRadius: "50%", border: `1.5px solid ${ACCENT}` }} />
              <GarmLogo key={replay} size={108} animated />
            </button>
          </>
        ) : (
          <div key={`h${idx}`} className="mb-6 flex items-center justify-center garm-pop" style={{ minHeight: 172 }}>
            {slide.hero}
          </div>
        )}
        <h1 key={`t${idx}`} className="garm-fade-up" style={{ fontSize: 26, fontWeight: 700, color: DARK, lineHeight: 1.2, marginBottom: 12 }}>
          {slide.title}
        </h1>
        <p key={`b${idx}`} className="text-muted-foreground garm-fade-up garm-delay" style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 290 }}>
          {slide.body}
        </p>
      </div>

      <style>{`
        .garm-ring{animation:garmRing 2.8s ease-out infinite}
        .garm-ring2{animation-delay:1.4s}
        @keyframes garmRing{0%{transform:scale(.72);opacity:.5}70%{opacity:0}100%{transform:scale(1.15);opacity:0}}
        .garm-hint{animation:garmHint 2s ease-in-out infinite}
        @keyframes garmHint{0%,100%{opacity:.45}50%{opacity:.9}}
        .garm-pop{animation:garmPop .4s cubic-bezier(.34,1.56,.64,1) both}
        @keyframes garmPop{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}
        .garm-fade-up{animation:garmFadeUp .5s ease both}
        .garm-delay{animation-delay:.1s}
        @keyframes garmFadeUp{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
        .garm-float-soft{animation:garmFloatSoft 4s ease-in-out infinite}
        @keyframes garmFloatSoft{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        .goalBall{animation:goalBall 1.6s cubic-bezier(.3,0,.55,1) forwards}
        @keyframes goalBall{0%{transform:translate(64px,118px) scale(.95);opacity:0}12%{opacity:1}55%{transform:translate(150px,44px) scale(.78)}100%{transform:translate(200px,70px) scale(.6);opacity:1}}
        @media (prefers-reduced-motion: reduce){
          .garm-ring,.garm-hint,.garm-pop,.garm-fade-up,.garm-float-soft,.goalBall{animation:none}
        }
      `}</style>

      {/* Dots */}
      <div className="flex justify-center gap-2 mb-6">
        {slides.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className="transition-all"
            style={{
              height: 7, borderRadius: 99, border: "none", cursor: "pointer", padding: 0,
              width: i === idx ? 22 : 7,
              background: i === idx ? DARK : "var(--border)",
            }}/>
        ))}
      </div>

      {/* CTA — gated until the slide's animation completes */}
      <button
        onClick={() => { if (!done[idx]) return; isLast ? onDone() : setIdx(idx + 1); }}
        disabled={!done[idx]}
        style={done[idx] ? btnPrimary : btnPrimaryDisabled}>
        {!done[idx]
          ? (idx === 1 ? "Scoring…" : "On the way…")
          : <>{isLast ? "Get started" : "Continue"} <ArrowRight size={15} strokeWidth={2} /></>}
      </button>
      <button onClick={onDone}
        className="w-full text-center mt-3"
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--muted-foreground)" }}>
        I already have an account
      </button>
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (identity: { phone?: string; email?: string }, remoteProfile?: ApiUserProfile) => void }) {
  const [mode, setMode]         = useState<"phone" | "email">("phone");
  const [step, setStep]         = useState<"identity" | "sending" | "otp">("identity");
  const [identity, setIdentity] = useState("+91");
  const [otp, setOtp]           = useState("");
  const [resendSecs, setResendSecs] = useState(0);
  const [sendError, setSendError]     = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifying, setVerifying]     = useState(false);
  // Dev-mode OTP echoed back by the backend until a real SMS/email gateway
  // (Twilio/Gmail) is configured — see server/README.md.
  const [devCode, setDevCode]         = useState("");
  const resendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const otpReady = otp.replace(/\s/g, "").length === 6;

  // Validation — strip +91 prefix, then require exactly 10 digits starting with 6-9
  const mobileDigits = identity.replace(/^\+91\s*/, "").replace(/\D/g, "");
  const phoneOk = mode === "phone" && /^[6-9]\d{9}$/.test(mobileDigits);
  const emailOk = mode === "email" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(identity.trim());
  const identityOk = mode === "phone" ? phoneOk : emailOk;
  // Only flag an error once the user has actually entered something (not for the bare "+91" prefix)
  const identityHasInput = mode === "phone" ? mobileDigits.length > 0 : identity.trim().length > 0;

  function switchMode(next: "phone" | "email") {
    setMode(next); setIdentity(next === "phone" ? "+91" : ""); setOtp(""); setStep("identity"); setResendSecs(0);
    setSendError(""); setVerifyError(""); setDevCode("");
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

  // The identity value we key OTP send/verify on — must be IDENTICAL between
  // sendCode/resend and the final verify call, or the backend won't find a match.
  const otpIdentity = mode === "phone" ? mobileDigits : identity.trim();

  async function sendCode() {
    if (!identityOk) return;
    setStep("sending");
    setSendError("");
    try {
      const res = await authApi.sendOTP(otpIdentity, mode);
      setDevCode(res.devCode || "");
      setStep("otp");
      startResendCountdown();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Couldn't send the code. Try again.");
      setStep("identity");
    }
  }

  async function resend() {
    if (resendSecs > 0) return;
    setOtp("");
    setVerifyError("");
    setStep("sending");
    try {
      const res = await authApi.sendOTP(otpIdentity, mode);
      setDevCode(res.devCode || "");
      setStep("otp");
      startResendCountdown();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Couldn't resend the code. Try again.");
      setStep("otp");
    }
  }

  async function verifyAndLogin() {
    if (!otpReady || verifying) return;
    setVerifying(true);
    setVerifyError("");
    try {
      const res = await authApi.verifyOTP(otpIdentity, otp.replace(/\s/g, ""), mode);
      onLogin(mode === "phone" ? { phone: fmtPhone(identity) } : { email: identity.trim() }, res.user);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "That code didn't match. Try again.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col px-5 pt-6 pb-5 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>

      {/* Brand row — top */}
      <div className="flex items-center gap-2.5 mb-5">
        <GarmLogo size={44} />
        <div>
          <p style={{ fontSize: 17, fontWeight: 700, letterSpacing: "0.02em", color: DARK, lineHeight: 1.1 }}>Garm</p>
          <p className="text-muted-foreground" style={{ fontSize: 11 }}>Customise yourself</p>
        </div>
      </div>

      {/* Sign-in heading */}
      <div className="mb-5">
        <p className="text-foreground mb-1" style={{ fontSize: 24, fontWeight: 700 }}>Sign in</p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          We'll send a 6-digit OTP to verify your identity.
        </p>
      </div>

      {/* Animated nature hero — between heading and form. Only on the identity-entry
          step; once the OTP card is up, this decorative animation just adds clutter
          above a form the user needs to focus on and fill in quickly. */}
      {step !== "otp" && (
        <div className="mb-6" style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 6px 16px rgba(0,0,0,0.08)" }}>
          <NatureScene />
        </div>
      )}

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
            value={mode === "phone" ? fmtPhone(identity) : identity}
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
              if (mode === "phone" && (e.key === "Backspace" || e.key === "Delete") && mobileDigits.length === 0) {
                e.preventDefault();
              }
              if (e.key === "Enter") sendCode();
            }}
            placeholder={mode === "phone" ? "+91 98765 43210" : "you@example.com"}
            inputMode={mode === "phone" ? "tel" : "email"}
            maxLength={mode === "phone" ? 16 : undefined}
            style={{ ...inputStyle, marginBottom: 4 }}
          />
          {/* Only flag a problem once the input LOOKS complete — a red error on
              the very first digit reads as "you're doing it wrong" while the
              customer is still typing. */}
          {identityHasInput && !identityOk && (mode === "phone" ? mobileDigits.length >= 10 : /@.+\./.test(identity)) ? (
            <p style={{ fontSize: 11, color: "var(--error)", marginBottom: 12, marginTop: 4 }}>
              {mode === "phone" ? "Enter 10-digit number after +91 (must start with 6, 7, 8 or 9)" : "Enter a valid email address"}
            </p>
          ) : <div style={{ marginBottom: 12 }}/>}
          {sendError && (
            <p style={{ fontSize: 11, color: "var(--error)", marginBottom: 12, marginTop: -8 }}>{sendError}</p>
          )}
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

          {/* Dev-mode banner — shown only until a real SMS/email gateway is
              wired server-side. Codes are verified for real against the
              backend; this just surfaces the code since nothing sends it yet. */}
          {devCode && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-4"
              style={{ background: "rgba(200,169,126,0.12)", border: "1px solid rgba(200,169,126,0.4)" }}>
              <ShieldCheck size={14} style={{ color:"#7c5419", flexShrink:0 }}/>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#7c5419" }}>Dev mode — no SMS/email gateway connected yet</p>
                <p style={{ fontSize: 11, color: "#92400e", lineHeight: 1.4 }}>
                  Your code is <strong>{devCode}</strong>. It's checked for real — wrong codes are rejected.
                </p>
              </div>
            </div>
          )}

          <OTPInput value={otp} onChange={setOtp}/>

          {verifyError && (
            <p style={{ fontSize: 11, color: "var(--error)", marginTop: 8, marginBottom: 4 }}>{verifyError}</p>
          )}

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mb-5 mt-3">
            {Array(6).fill(null).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full transition-all"
                style={{ background: i < otp.replace(/\s/g,"").length ? DARK : "var(--border)" }}/>
            ))}
          </div>

          <button onClick={verifyAndLogin} disabled={!otpReady || verifying}
            style={otpReady && !verifying ? { ...btnPrimary, marginBottom: 10 } : { ...btnPrimaryDisabled, marginBottom: 10 }}>
            {verifying ? "Verifying…" : "Verify & sign in"}
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
      <div className="mt-6 rounded-2xl p-4 bg-muted border border-border">
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

// Example organisation-name placeholder, tailored to the chosen type so the hint
// text always matches what the user picked instead of always showing a school name.
const orgNamePlaceholders: Record<string, string> = {
  school: "e.g. Sri Vidya Mandir School",
  college: "e.g. Delhi College of Engineering",
  corporate: "e.g. Acme Corp Pvt Ltd",
  hospital: "e.g. Apollo Hospital",
  industry: "e.g. Tata Steel Industries",
  hospitality: "e.g. Taj Palace Hotel",
  sports: "e.g. Chennai Sports Club",
  government: "e.g. Municipal Corporation Office",
  ngo: "e.g. Smile Foundation Trust",
};

function OnboardingScreen({ onComplete }: { onComplete: (profile: UserProfile, delivery?: { address: string; city: string; pin: string }) => void }) {
  const [step, setStep] = useState<"name" | "type" | "org-details" | "personal-details">("name");
  const [fullName, setFullName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [orgName, setOrgName] = useState("");
  // No default — the user must actively pick a type before continuing.
  const [orgType, setOrgType] = useState("");
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
    onComplete(
      { name: fullName, avatar: null, accountType: accountType || "personal", orgName, orgType, gstNumber },
      accountType === "personal" ? { address, city, pin } : undefined,
    );
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
          <div className="mb-5">
            <p className="text-foreground mb-1" style={{ fontSize: 24, fontWeight: 700 }}>How will you use Garm?</p>
            <p className="text-muted-foreground text-sm">This helps us tailor your experience.</p>
          </div>

          {/* Brand value banner */}
          <div className="mb-6 flex items-center gap-3 rounded-2xl p-3.5"
            style={{ background: ACCENT_BG, border: "1px solid rgba(200,169,126,0.3)" }}>
            <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 84, height: 104 }}>
              <BrandShowcaseArt size={100} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: ACCENT_TEXT, lineHeight: 1.25 }}>
                Have your own brand in your hand
              </p>
              <p className="text-muted-foreground" style={{ fontSize: 12, lineHeight: 1.45, marginTop: 2 }}>
                Custom-branded uniforms, tags &amp; packaging — made yours.
              </p>
            </div>
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
                <p className="text-muted-foreground" style={{ fontSize: 12 }}>Schools, hospitals, businesses — bulk procurement & invoicing</p>
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
            <p className="text-muted-foreground mb-1.5" style={{ fontSize: 12 }}>Organisation type</p>
            <OrgTypeSelect value={orgType} onChange={setOrgType}/>
            <p className="text-muted-foreground mb-1.5 mt-4" style={{ fontSize: 12 }}>Organisation name</p>
            <input value={orgName} onChange={e => setOrgName(e.target.value)}
              placeholder={orgType ? orgNamePlaceholders[orgType] : "Your organisation's name"} style={inputStyle}/>
          </div>
          <button onClick={handleComplete}
            disabled={!orgName.trim() || !orgType}
            style={orgName.trim() && orgType ? btnPrimary : btnPrimaryDisabled}>
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
                <input value={city} onChange={e => setCity(sanitizeCity(e.target.value))} placeholder="City" style={inputStyle}/>
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

// ─── Drafts Screen ─────────────────────────────────────────────────────────────
// Lists saved (not-yet-submitted) orders. Tap one to reopen it at the Review step.
function DraftsScreen({ drafts, onClose, onCancelDraft, onResumeDraft }: {
  drafts: OrderDraft[];
  onClose: () => void;
  onCancelDraft: (id: string) => void;
  onResumeDraft: (d: OrderDraft) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState<OrderDraft | null>(null);

  function timeAgo(ts: number) {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "var(--background)", borderRadius: 44, overflow: "hidden" }}>
      {/* Header */}
      <div className="px-5 pt-2 pb-4 flex items-center gap-3 border-b border-border flex-shrink-0">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center border border-border">
          <ChevronLeft size={18} strokeWidth={2}/>
        </button>
        <div className="flex-1">
          <p className="text-foreground" style={{ fontSize: 16, fontWeight: 700 }}>Drafts</p>
          <p className="text-muted-foreground" style={{ fontSize: 11 }}>{drafts.length} saved order{drafts.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0" style={{ scrollbarWidth: "none" }}>
        {drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center mt-20">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3 border border-border">
              <FileText size={24} strokeWidth={1.5} className="text-muted-foreground"/>
            </div>
            <p className="text-foreground text-sm" style={{ fontWeight: 600 }}>No drafts yet</p>
            <p className="text-muted-foreground mt-1" style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 240 }}>
              Tap “Save as draft” on the review step and your order waits here until you're ready to finish it.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {drafts.map(d => (
              <div key={d.id} style={{ ...card, borderRadius: 16 }} className="overflow-hidden flex items-center">
                <button onClick={() => onResumeDraft(d)} className="flex-1 min-w-0 text-left p-4 flex items-center gap-3" style={{ background: "transparent", border: "none", cursor: "pointer" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: d.persona === "organisation" ? "#E0F0FF" : ACCENT_BG }}>
                    {d.persona === "organisation"
                      ? <Building2 size={18} strokeWidth={1.5} style={{ color: "#1a4a8a" }}/>
                      : <User size={18} strokeWidth={1.5} style={{ color: ACCENT_TEXT }}/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-sm" style={{ fontWeight: 600 }}>{d.title}</p>
                    <p className="text-muted-foreground" style={{ fontSize: 12 }}>{d.subtitle}</p>
                    <p className="text-muted-foreground" style={{ fontSize: 10.5, marginTop: 2 }}>Saved {timeAgo(d.createdAt)} · Tap to resume</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground flex-shrink-0"/>
                </button>
                <button onClick={() => setConfirmDelete(d)} className="flex-shrink-0 w-10 h-10 mr-2 rounded-xl flex items-center justify-center" style={{ background: "#fef2f2", border: "1px solid #fecaca", cursor: "pointer" }} title="Remove draft">
                  <Trash2 size={15} style={{ color: "#dc2626" }}/>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Remove-draft confirmation */}
      {confirmDelete && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setConfirmDelete(null)}>
          <div className="w-full rounded-2xl p-5 text-center" style={{ background: "var(--background)", maxWidth: 300 }} onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
              <Trash2 size={20} style={{ color: "#dc2626" }}/>
            </div>
            <p className="text-foreground mb-1.5" style={{ fontSize: 16, fontWeight: 700 }}>Remove this draft?</p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-5">
              “{confirmDelete.title}” will be removed from your drafts. This can't be undone.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { onCancelDraft(confirmDelete.id); setConfirmDelete(null); }}
                style={{ ...btnPrimary, background: "#dc2626", padding: "12px 20px" }}>
                <Trash2 size={15}/> Yes, remove draft
              </button>
              <button onClick={() => setConfirmDelete(null)} style={{ ...btnSecondary, padding: "10px 20px" }}>Keep draft</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Help & Support Screen ─────────────────────────────────────────────────────
function HelpSupportScreen({ onBack, onReplayTour }: { onBack: () => void; onReplayTour?: () => void }) {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const faqs = [
    { q: "How do I place a bulk order?",          a: "Go to the Order tab and fill in your material requirements. Our coordinator will confirm your order details and share the next steps within 2–4 hours during business hours." },
    { q: "What is the minimum order quantity?",   a: "Organisation orders start at 100 pieces and accessories at 100 pieces per product. Individual custom orders start at 3 pieces, and individual accessories at just 1 piece per product." },
    { q: "How long does delivery take?",          a: "Standard orders take 7–14 business days. Expedited delivery is available at extra cost." },
    { q: "Can I track my order?",                 a: "Yes! Use the Track tab to see live production status, QA reports, and delivery tracking." },
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
        {/* Replay the guided walkthrough (tutorial slides + tap-here coach-marks on
            Home, New Order and Track) on demand — these only ever show automatically
            once, so this is the way to see them again any time. */}
        {onReplayTour && (
          <button onClick={onReplayTour} style={card} className="w-full flex items-center gap-3 p-4 mb-5 text-left" >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: ACCENT_BG }}>
              <HelpCircle size={17} strokeWidth={1.5} style={{ color: ACCENT_TEXT }}/>
            </div>
            <div className="flex-1">
              <p className="text-foreground text-sm" style={{ fontWeight: 600 }}>Replay app walkthrough</p>
              <p className="text-muted-foreground" style={{ fontSize: 11.5, marginTop: 1 }}>Show the "How Garm works" guide and tap-here tooltips again</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground flex-shrink-0"/>
          </button>
        )}

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

// ─── "How Garm works" tutorial ────────────────────────────────────────────────
// A short, persona-specific walkthrough. Shown once automatically right after
// onboarding, and reopenable any time from Home (the "?" button) so someone can
// revisit it or "practice" the flow in their head before actually placing an order.
const tutorialSlidesByPersona: Record<"organisation" | "personal", { Icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>; title: string; body: string }[]> = {
  organisation: [
    { Icon: Shirt,     title: "Add every garment you need",  body: "Browse by category and add each garment — T-shirts, uniforms, accessories — to one order. Set fabric, colour, quantity and sizes separately for each." },
    { Icon: Wallet,    title: "Get one consolidated quote",   body: "Pricing is calculated per garment as you configure it. Review everything together before you submit — nothing is charged until your coordinator confirms." },
    { Icon: Truck,     title: "Track production end-to-end",  body: "Once confirmed, follow your order through production, QA and delivery in the Track tab — no phone calls needed." },
    { Icon: Building2, title: "Your organisation profile travels with you", body: "Set your business details once in Account — they'll auto-fill on every future order." },
  ],
  personal: [
    { Icon: User,      title: "Tell us who it's for",         body: "Pick Men's, Women's or Kids — or set up a custom order for a family, friend group or a few students." },
    { Icon: Shirt,     title: "Pick fabric, colour & size",    body: "Every garment is fully personalised, starting from just 1 piece — no bulk minimums for individuals." },
    { Icon: Wallet,    title: "Pay & track your order",        body: "Pay securely in-app, then follow it from production all the way to your door in the Track tab." },
    { Icon: RotateCcw, title: "Reorder in seconds",            body: "Drafts and past orders are saved, so reordering the same thing again is just a couple of taps." },
  ],
};

function TutorialModal({ accountType, onClose }: { accountType?: "personal" | "organisation"; onClose: () => void }) {
  const slides = tutorialSlidesByPersona[accountType === "organisation" ? "organisation" : "personal"];
  const [idx, setIdx] = useState(0);
  const isLast = idx === slides.length - 1;
  const slide = slides[idx];
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="bg-background rounded-t-3xl px-6 pt-5 pb-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <p className="text-foreground" style={{ fontSize: 15, fontWeight: 700 }}>How Garm works</p>
          <button onClick={onClose} aria-label="Close" style={{ background: "var(--muted)", border: "none", borderRadius: 999, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={14}/>
          </button>
        </div>

        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "var(--secondary)" }}>
            <slide.Icon size={28} strokeWidth={1.5} style={{ color: DARK }}/>
          </div>
          <p style={{ fontSize: 17, fontWeight: 700, color: DARK, marginBottom: 8 }}>{slide.title}</p>
          <p className="text-muted-foreground" style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 280 }}>{slide.body}</p>
        </div>

        <div className="flex justify-center gap-2 mb-5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              style={{ height: 7, borderRadius: 99, border: "none", cursor: "pointer", padding: 0, width: i === idx ? 22 : 7, background: i === idx ? DARK : "var(--border)" }}/>
          ))}
        </div>

        <button onClick={() => (isLast ? onClose() : setIdx(i => i + 1))} style={btnPrimary}>
          {isLast ? "Got it" : "Next"} <ArrowRight size={15} strokeWidth={2}/>
        </button>
      </div>
    </div>
  );
}

// ─── First-login coach-mark tour ───────────────────────────────────────────────
// Short "tap here → next step" pointers at the real controls, shown only the very
// first time someone reaches the app (tracked by a one-time flag, never reset) —
// after that, people already know where things are, so this doesn't show again.
type CoachStep = { targetId: string; title: string; body: string };
const coachSteps: CoachStep[] = [
  { targetId: "coachmark-tab-order", title: "Start here", body: "Tap New Order to configure your garments and place your first order." },
  { targetId: "coachmark-tab-track", title: "Follow it here", body: "Once your order's confirmed, come back to Track to follow production, QA and delivery." },
  { targetId: "coachmark-help-btn",  title: "Need a refresher?", body: "Tap this any time for a quick walkthrough of how Garm works." },
];

function CoachmarkTour({ onDone }: { onDone: () => void }) {
  const [idx, setIdx]   = useState(0);
  const [frame, setFrame] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const step = coachSteps[idx];
  const isLast = idx === coachSteps.length - 1;

  // Poll continuously (not just once on mount) so this reliably finds its target even
  // if Home is still finishing its first render, or the user switches step mid-tour.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const frameEl  = document.getElementById("garm-phone-frame");
      const targetEl = document.getElementById(step.targetId);
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
  }, [step.targetId]);

  if (!rect || !frame) return null;

  const pad = 6;
  const hole = { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  const placeBelow = hole.top < frame.height * 0.55;
  const bubbleTop = placeBelow ? hole.top + hole.height + 12 : undefined;
  const bubbleBottom = !placeBelow ? frame.height - hole.top + 12 : undefined;

  function advance() {
    if (isLast) onDone();
    else setIdx(i => i + 1);
  }

  return (
    <div style={{ position: "fixed", top: frame.top, left: frame.left, width: frame.width, height: frame.height, zIndex: 9999, overflow: "hidden", borderRadius: 44 }}>
      {/* Four shade panels leave a rectangular "hole" around the target, instead of a
          single full-screen dim layer, so the highlighted control is fully visible. */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: Math.max(0, hole.top), background: "rgba(13,13,13,0.68)" }}/>
      <div style={{ position: "absolute", top: hole.top + hole.height, left: 0, right: 0, bottom: 0, background: "rgba(13,13,13,0.68)" }}/>
      <div style={{ position: "absolute", top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height, background: "rgba(13,13,13,0.68)" }}/>
      <div style={{ position: "absolute", top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height, background: "rgba(13,13,13,0.68)" }}/>
      {/* Highlight ring around the target */}
      <div style={{ position: "absolute", top: hole.top, left: hole.left, width: hole.width, height: hole.height, borderRadius: 16, border: `2px solid ${ACCENT}`, boxShadow: "0 0 0 3px rgba(200,169,126,0.25)" }}/>

      {/* Tooltip bubble */}
      <div style={{
          position: "absolute", top: bubbleTop, bottom: bubbleBottom, left: 20, right: 20,
          background: "var(--background)", borderRadius: 16, padding: 16,
          boxShadow: "0 12px 28px rgba(0,0,0,0.22)", border: "1px solid var(--border)",
        }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 4 }}>{step.title}</p>
        <p className="text-muted-foreground mb-3" style={{ fontSize: 12, lineHeight: 1.5 }}>{step.body}</p>
        <div className="flex items-center justify-between">
          <button onClick={onDone} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--muted-foreground)", padding: 0 }}>
            Skip
          </button>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground" style={{ fontSize: 11 }}>{idx + 1} / {coachSteps.length}</span>
            <button onClick={advance} className="flex items-center gap-1 px-3.5 py-2 rounded-xl" style={{ background: DARK, color: "#fff", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
              {isLast ? "Got it" : "Next"} <ArrowRight size={13} strokeWidth={2}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab items ────────────────────────────────────────────────────────────────
const tabItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "home",    label: "Home",     icon: <Home      size={20} strokeWidth={1.5}/> },
  { id: "order",   label: "Order",    icon: <PlusCircle size={20} strokeWidth={1.5}/> },
  { id: "track",   label: "Track",    icon: <MapPin    size={20} strokeWidth={1.5}/> },
  { id: "account", label: "Account",  icon: <User      size={20} strokeWidth={1.5}/> },
];
const tabTitleMap: Record<Tab, string> = {
  home: "", order: "New Order", track: "My Orders", account: "Account",
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [authStep, setAuthStep]               = useState<"welcome" | "login" | "onboarding" | "app">("welcome");
  const [activeTab, setActiveTab]             = useState<Tab>("home");
  const [showNotifications, setShowNotifications] = useState(false);
  // Real unread count for the bell badge — from the same derivation the
  // Notifications screen uses (src/lib/notifCenter.ts), refreshed every 60s
  // and whenever the Notifications screen closes (reads happened inside).
  const [notifUnread, setNotifUnread] = useState(0);
  const [showNewOrder, setShowNewOrder]       = useState(false);
  useEffect(() => {
    if (authStep !== "app" || showNotifications) return;
    let alive = true;
    const refresh = () => { fetchUnreadCount().then((n) => {
      if (!alive) return;
      // New unread notification arrived since the last poll — chime once.
      setNotifUnread((prev) => { if (n > prev && prev >= 0) playChime(); return n; });
    }); };
    refresh();
    const t = setInterval(refresh, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [authStep, showNotifications]);
  const [newOrderSummary, setNewOrderSummary] = useState<SubmittedOrderSummary | null>(null);
  const [showRatingPopup, setShowRatingPopup] = useState(false);
  const [ratingVal, setRatingVal]             = useState(0);
  const [ratingFeedback, setRatingFeedback]   = useState("");
  const [ratingDone, setRatingDone]           = useState(false);
  const [ratingBusy, setRatingBusy]           = useState(false);
  // The delivered order the popup is rating (id + label), so the rating persists
  // to the RIGHT order on the backend and shows in Track + the admin portal.
  const [ratingOrder, setRatingOrder]         = useState<{ apiId?: string; ref: string; name: string } | null>(null);
  // Ratings just submitted via the popup — passed to Track so its Rating &
  // feedback section reflects them immediately (before the 30s poll confirms).
  const [ratingOverrides, setRatingOverrides] = useState<Record<string, { rating: number; feedback?: string }>>({});
  // Mirror of showRatingPopup for the global auto-prompt effect (so it can bail
  // when a popup is already open without re-subscribing on every open/close).
  const popupOpenRef = useRef(false);
  useEffect(() => { popupOpenRef.current = showRatingPopup; }, [showRatingPopup]);
  // Orders we've already auto-prompted a rating for, so the popup never nags.
  const ratingPromptedRef = useRef<Set<string>>(new Set((() => {
    try { return JSON.parse(localStorage.getItem("fl_rating_prompted") || "[]"); } catch { return []; }
  })()));
  const [targetOrderId, setTargetOrderId]     = useState<string | null>(null);
  const [userProfile, setUserProfile]         = useState<UserProfile>({ name: "", avatar: null, accountType: "personal" });
  // The user's default saved delivery address, so New Order can pre-fill it instead of
  // asking again for an address the user already gave us (at onboarding or in Account).
  const [defaultAddress, setDefaultAddress]   = useState<{ address: string; city: string; pin: string } | null>(null);
  // The Order tab stays MOUNTED once opened (hidden, not destroyed, when the
  // customer switches tabs) so a half-built order is never lost. Bumping the
  // epoch forces a deliberate fresh remount (after "Save as draft").
  const [orderTabMounted, setOrderTabMounted] = useState(false);
  const [orderEpoch, setOrderEpoch]           = useState(0);
  // Home-tile deep link: which exact screen the Order tab should open on next.
  const [orderIntent, setOrderIntent]         = useState<OrderIntent | null>(null);
  // Size chart opened FROM HOME — shown right there as an overlay, never by
  // switching to the Order tab (that left whatever screen the tab was on
  // visible behind/after the chart).
  const [showSizeChart, setShowSizeChart]     = useState(false);
  // Branded splash on every app open (Zomato-style): logo scene first, then the
  // app fades in underneath. Pure presentation — data loading runs behind it.
  const [splashPhase, setSplashPhase] = useState<"show" | "fade" | "done">("show");
  useEffect(() => {
    const t1 = setTimeout(() => setSplashPhase("fade"), 1600);
    const t2 = setTimeout(() => setSplashPhase("done"), 2150);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  // Captured at login (phone or email, whichever the user verified with) and merged
  // into the profile once onboarding finishes, so it's not lost between the two steps.
  const [loginIdentity, setLoginIdentity]     = useState<{ phone?: string; email?: string }>({});
  const [showHelp, setShowHelp]               = useState(false);
  const [showTutorial, setShowTutorial]       = useState(false);
  const [showCoachmarks, setShowCoachmarks]   = useState(false);
  // True only while we're inside the automatic first-time sequence (tutorial, then
  // straight into the coach-mark tour) — a manual reopen of the tutorial from the "?"
  // button should NOT also kick off the coach-mark tour afterwards.
  const firstTimeFlowRef = useRef(false);
  const [showDrafts, setShowDrafts]           = useState(false);
  const [resumeDraft, setResumeDraft]         = useState<OrderDraft | null>(null);
  const [paidOrderIds, setPaidOrderIds]       = useState<string[]>([]);
  const [drafts, setDrafts]                   = useState<OrderDraft[]>(() => {
    try { return JSON.parse(localStorage.getItem("fl_drafts") || "[]"); } catch { return []; }
  });

  // ── Restore the session on app open ──────────────────────────────────────────
  // Closing the app must NOT sign the customer out. If a saved token exists, pull
  // the profile (name, avatar, org…) from the backend and go straight to the app —
  // only a manual "Sign out" clears the token. Runs once on mount.
  useEffect(() => {
    if (!authToken.get()) return; // never signed in on this device
    let alive = true;
    // Retry with backoff — the Render free tier can be COLD on app open, and a
    // failed first request must not bounce a signed-in customer back to the
    // Welcome screen. Only a real auth rejection (401/403) clears the token.
    const attempt = (n: number) => {
      accountApi.getProfile().then(({ user }) => {
        if (!alive) return;
        const mapped: UserProfile = {
          name: user.name || "",
          avatar: user.avatarUrl ?? null,
          accountType: user.accountType === "organisation" ? "organisation" : "personal",
          orgName: user.orgName,
          orgType: user.orgType,
          phone: user.phone,
          email: user.email,
          twoFAEnabled: user.twoFAEnabled,
        };
        setUserProfile(mapped);
        setLoginIdentity({ phone: user.phone, email: user.email });
        // Recognised + onboarded → straight into the app. If somehow not onboarded,
        // let them finish onboarding rather than re-logging in.
        setAuthStep(user.onboardingComplete && user.name ? "app" : "onboarding");
        accountApi.getAddresses().then(res => {
          const def = res.addresses.find(a => a.isDefault) ?? res.addresses[0];
          if (def && alive) setDefaultAddress({ address: def.line1, city: def.city, pin: def.pin });
        }).catch(() => {});
      }).catch((err: Error & { status?: number }) => {
        if (!alive) return;
        if (err.status === 401 || err.status === 403) {
          // Token really is invalid/expired — sign out.
          authToken.clear();
        } else if (n < 3) {
          // Server hiccup / cold start — keep the session, retry shortly.
          setTimeout(() => { if (alive) attempt(n + 1); }, 2500 * (n + 1));
        }
        // After 3 failed non-auth attempts we simply stay on Welcome for this
        // launch but KEEP the token — next app open tries again.
      });
    };
    attempt(0);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-prompt the delivery rating from ANYWHERE in the app (Home included) —
  // the moment an order is delivered and not yet rated, show the feedback popup
  // once. Previously it only fired when the customer opened the order in Track.
  useEffect(() => {
    if (authStep !== "app") return;
    let alive = true;
    const check = () => ordersApi.list().then(({ orders }) => {
      if (!alive || popupOpenRef.current) return;
      const deliveredOf = (o: (typeof orders)[number]) =>
        // A cancelled order is NEVER "delivered" — even if it passed through a
        // delivered admin state before being cancelled/refunded. Never ask the
        // customer to rate an order they didn't receive.
        (o.status === "Delivered" || o.status === "Completed" || o.adminStatus === "DELIVERED")
        && o.status !== "Cancelled" && o.adminStatus !== "CANCELLED";
      // First run on this device: orders delivered BEFORE now are history — do
      // not nag about them one after another on every screen. Mark them all as
      // already-prompted silently; only orders that get delivered from here on
      // trigger the rating popup (genuinely "your order just arrived — how was
      // it?"), and each order asks at most once.
      if (!localStorage.getItem("fl_rating_prompted")) {
        orders.forEach(o => {
          const id = o._id || o.orderRef || "";
          if (id && deliveredOf(o)) ratingPromptedRef.current.add(id);
        });
        try { localStorage.setItem("fl_rating_prompted", JSON.stringify([...ratingPromptedRef.current])); } catch { /* ignore */ }
        return;
      }
      const target = orders.find(o => {
        const id = o._id || o.orderRef || "";
        return deliveredOf(o) && !o.rating && id && !ratingPromptedRef.current.has(id);
      });
      if (!target) return;
      const id = target._id || target.orderRef || "";
      ratingPromptedRef.current.add(id);
      try { localStorage.setItem("fl_rating_prompted", JSON.stringify([...ratingPromptedRef.current])); } catch { /* ignore */ }
      setRatingOrder({ apiId: target._id, ref: target.orderRef || `#${(target._id || "").slice(-6)}`, name: target.garmentType || target.serviceLabel || "Your order" });
      setRatingVal(0); setRatingFeedback(""); setShowRatingPopup(true);
    }).catch(() => {});
    check();
    const t = setInterval(check, 30_000);
    return () => { alive = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStep]);

  // Re-pull the saved default address every time the customer opens the Order
  // tab — an address added in Account → Delivery addresses MID-SESSION must
  // pre-fill the Review step immediately, not only after an app restart.
  // (This was the "I saved my address but Review still asks for it" bug.)
  useEffect(() => {
    if (authStep !== "app" || activeTab !== "order") return;
    let alive = true;
    accountApi.getAddresses().then(res => {
      if (!alive) return;
      const def = res.addresses.find(a => a.isDefault) ?? res.addresses[0];
      if (def) setDefaultAddress({ address: def.line1, city: def.city, pin: def.pin });
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStep, activeTab]);

  // Track that the Order tab has been opened at least once (it then stays
  // mounted-but-hidden across tab switches so in-progress orders survive).
  useEffect(() => {
    if (activeTab === "order") setOrderTabMounted(true);
  }, [activeTab]);

  // Leaving the Order tab with NOTHING actually changed (a browsed collection,
  // an opened draft, a stale success screen) → reset it to a fresh new-order
  // page. Only genuinely dirty in-progress work survives tab switches.
  const orderDirtyRef = useRef(false);
  const prevTabRef = useRef<Tab>("home");
  useEffect(() => {
    if (prevTabRef.current === "order" && activeTab !== "order" && !orderDirtyRef.current) {
      setResumeDraft(null);
      setOrderEpoch(e => e + 1);
    }
    prevTabRef.current = activeTab;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Fire the first-time tutorial (and, after it's closed, the coach-mark tour) the moment
  // someone lands on the main app — whether they just finished onboarding OR skipped
  // straight there because their phone/email was already recognised (identity lock).
  // Gating this on authStep alone (instead of only inside onboarding's onComplete) is what
  // makes it show for returning users too, not just brand-new ones.
  useEffect(() => {
    if (authStep !== "app") return;
    try {
      const tutorialKey = `fl_tutorial_seen_${userProfile.accountType ?? "personal"}`;
      const seenTutorial = !!localStorage.getItem(tutorialKey);
      const seenCoach = !!localStorage.getItem("fl_coachmarks_done");
      if (!seenTutorial) {
        localStorage.setItem(tutorialKey, "1");
        firstTimeFlowRef.current = !seenCoach; // chain straight into the coach-mark tour after
        setShowTutorial(true);
      } else if (!seenCoach) {
        setShowCoachmarks(true);
      }
    } catch { /* ignore storage errors */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStep]);

  // App-level pending-order sync. Any order that couldn't reach the backend at
  // submit (cold/slow backend) is retried here from ANYWHERE in the app —
  // on sign-in, every 20s, and whenever the app regains focus — so it lands in
  // the admin portal without the customer needing to open the Track tab.
  useEffect(() => {
    if (authStep !== "app") return;
    const flush = () => {
      if (!authToken.get()) return;
      flushPendingOrders().catch(() => {});
      flushPendingProfile().catch(() => {});   // keep retrying a failed onboarding-flag save
    };
    flush();
    const t = setInterval(flush, 20_000);
    const onFocus = () => flush();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [authStep]);

  function handleTutorialClose() {
    setShowTutorial(false);
    if (firstTimeFlowRef.current) {
      firstTimeFlowRef.current = false;
      try { if (!localStorage.getItem("fl_coachmarks_done")) setShowCoachmarks(true); } catch { /* ignore */ }
    }
  }

  // Every guide (tutorial + all 3 coach-mark surfaces) is a "show once, ever" flag —
  // by design, so people who already know the app aren't nagged every visit. But that
  // means once this browser/device has seen them, they're gone for good with no way
  // back — which looks exactly like "broken" the next time someone wants to check them,
  // demo them, or a genuinely new teammate wants a refresher. Tapping Home's "?" now
  // clears every one of those flags and replays the whole sequence on demand, in
  // addition to still running automatically the very first time.
  function handleReplayTour() {
    try {
      localStorage.removeItem("fl_tutorial_seen_personal");
      localStorage.removeItem("fl_tutorial_seen_organisation");
      localStorage.removeItem("fl_coachmarks_done");
      localStorage.removeItem("fl_coach_org_continue_done");
      localStorage.removeItem("fl_coach_ind_continue_done");
      localStorage.removeItem("fl_coach_order_footer_done");
      localStorage.removeItem("fl_coach_track_order_done");
    } catch { /* ignore */ }
    firstTimeFlowRef.current = true;
    setShowTutorial(true);
  }
  function handleCoachmarksDone() {
    setShowCoachmarks(false);
    try { localStorage.setItem("fl_coachmarks_done", "1"); } catch { /* ignore */ }
  }

  function persistDrafts(next: OrderDraft[]) {
    setDrafts(next);
    try { localStorage.setItem("fl_drafts", JSON.stringify(next)); } catch { /* ignore */ }
  }
  function handleSaveDraft(payload: DraftPayload) {
    const draft: OrderDraft = { ...payload, id: `draft-${Date.now()}`, createdAt: Date.now() };
    // Re-saving a resumed draft REPLACES it (never duplicates).
    const rest = resumeDraft ? drafts.filter(d => d.id !== resumeDraft.id) : drafts;
    persistDrafts([draft, ...rest]);
    setResumeDraft(null);
    // The order now lives in Drafts — clear the work-in-progress autosave and
    // reset the (kept-mounted) Order tab to a fresh start.
    try { localStorage.removeItem("fl_wip"); } catch { /* ignore */ }
    setOrderEpoch(e => e + 1);
    setActiveTab("home");
  }
  function handleCancelDraft(id: string) {
    persistDrafts(drafts.filter(d => d.id !== id));
  }
  // Reopen a draft in the editor at the Review step. The draft STAYS in the
  // list until the order is actually submitted (or re-saved) — previously it
  // was deleted the moment it was opened, so closing the app mid-edit lost it.
  function handleResumeDraft(d: OrderDraft) {
    setResumeDraft(d);
    setShowDrafts(false);
    setActiveTab("order");
  }

  function handleNavigate(tab: Tab, orderId?: string) {
    // NOTE: this no longer clears resumeDraft — switching tabs must never
    // throw away an order in progress (the Order tab stays mounted and the
    // work-in-progress autosave covers restarts). A draft is consumed only on
    // submit or when it's re-saved from the Review step.
    setActiveTab(tab);
    setTargetOrderId(orderId ?? null);
  }
  // Create the order on the backend AT SUBMIT — the moment the customer taps
  // "Submit order", not when they later tap "Track your order". Previously the
  // create was attached to the Track button, so tapping "Back to Home" lost the
  // order entirely and the admin only received it once the customer opened Track.
  function handleOrderPlaced(summary?: SubmittedOrderSummary) {
    if (!summary) return;
    // Order submitted — the work-in-progress autosave is consumed too.
    try { localStorage.removeItem("fl_wip"); } catch { /* ignore */ }
    // Order submitted — a draft it was resumed from is now consumed.
    if (resumeDraft) persistDrafts(drafts.filter(d => d.id !== resumeDraft.id));
    setNewOrderSummary(summary);
    const payload = summaryToOrderPayload(summary, userProfile);
    // Create with retry/backoff so the order reaches the admin portal even if the
    // backend is briefly cold (Render free tier). On repeated failure it's queued
    // and the app-level poller + Track both keep retrying — never silently lost.
    (async () => {
      const order = await createOrderWithRetry(payload);
      if (order?.orderRef) {
        rememberOrderSummary(order.orderRef, summary);
        // Swap the local placeholder ref for the real one so the "just submitted"
        // card and the live order line up as one — the SAME ref the admin shows.
        setNewOrderSummary({ ...summary, id: order.orderRef });
      } else {
        writePendingOrders([...readPendingOrders(), { payload, summary, queuedAt: Date.now() }]);
      }
    })();
  }

  // "Track your order" button on the success screen. The order is already
  // created (at submit, above), so this only navigates to the Track tab.
  function handleOrderSubmitted(summary?: SubmittedOrderSummary) {
    if (summary) setNewOrderSummary(summary);
    setShowNewOrder(true);
    setResumeDraft(null); // editing finished — don't silently reopen this edit in the New order tab
    setActiveTab("track");
  }
  // Org payment "Paid" must survive card collapse/remount, so it lives here (by order id).
  function handleMarkOrderPaid(id: string) {
    setPaidOrderIds(prev => prev.includes(id) ? prev : [...prev, id]);
  }
  function handleOrderDelivered(order?: { apiId?: string; id: string; name: string; rating?: number }) {
    // Called by TrackTab when the customer opens a delivered order. Show the
    // rating popup for THIS order — but only if it hasn't already been rated
    // (order.rating comes from the backend), so it never nags twice.
    if (!order || order.rating) return;
    setRatingOrder({ apiId: order.apiId, ref: order.id, name: order.name });
    setRatingVal(0);
    setRatingFeedback("");
    setShowRatingPopup(true);
  }

  // Persist the popup rating to the specific order, then close.
  async function submitPopupRating() {
    if (ratingVal < 1 || ratingBusy) return;
    setRatingBusy(true);
    try {
      if (ratingOrder?.apiId) {
        await ordersApi.rate(ratingOrder.apiId, ratingVal, ratingFeedback.trim() || undefined);
        const apiId = ratingOrder.apiId;
        setRatingOverrides(prev => ({ ...prev, [apiId]: { rating: ratingVal, feedback: ratingFeedback.trim() || undefined } }));
      }
      setRatingDone(true);
      setShowRatingPopup(false);
    } catch { /* keep popup open so they can retry */ }
    finally { setRatingBusy(false); }
  }
  // Reopen a submitted order (org, before production) in the editor at the Review step.
  function handleEditOrder(payload?: DraftPayload) {
    if (payload) setResumeDraft({ ...payload, id: `edit-${Date.now()}`, createdAt: Date.now() });
    else setResumeDraft(null);
    setShowNewOrder(false);
    setActiveTab("order");
  }
  // "Order again" from Home — reopen the past order's editable snapshot at
  // Review, exactly like Track's own reorder. The rich snapshot only lives in
  // THIS device's localStorage (saved at submit time), so it's missing after a
  // reinstall, a different device/browser, or for orders seeded/placed
  // elsewhere — that used to silently drop the customer into a BLANK new
  // order with no indication anything went wrong. Now it falls back to
  // rebuilding a one-line pre-filled cart from the order's own saved details
  // (name, colour, qty), so "Repeat order" always opens something meaningful.
  function handleReorderPast(p: HomePastOrder) {
    const ep = readOrderSummaries()[p.orderId ?? p.ref]?.editPayload;
    if (ep) { handleEditOrder(ep); return; }
    // Accessories have a different picker flow (categories/items, not a
    // garment cart) — open a fresh order rather than guess a wrong prefill.
    if (p.isAccessoryOrder) { setResumeDraft(null); setActiveTab("order"); return; }
    const { categoryId, sizeCat, garmentType } = guessGarmentAudience(p.name);
    const contact = {
      name: userProfile.name || "", phone: userProfile.phone || "", email: userProfile.email || "",
      address: defaultAddress?.address || "", city: defaultAddress?.city || "", pin: defaultAddress?.pin || "",
    };
    const colorHex = p.colorHex || "#0D0D0D";
    // Per-cart-line size split (NOT a separate top-level field) — this is what
    // Review actually sums to decide "N of qty pcs assigned". Without it the
    // repeated order always showed "0 of N assigned" and blocked submit.
    // Falls back to a single bucket under the original qty if the original
    // order (unusually) has no size breakdown on record.
    const sizes = p.sizes?.length
      ? Object.fromEntries(p.sizes.map(s => [s.label, s.qty]))
      : { [sizeCat === "school" ? "Age 6-7" : "M"]: p.qty };
    handleEditOrder({
      persona: "individual",
      title: p.name,
      subtitle: "Repeat order",
      orgDetails: null,
      customDetails: { garmentType, groupType: "personal", audience: categoryId === "kids" ? "kids" : categoryId === "womens" ? "women" : "men", ...contact },
      resume: {
        material: { fabric: "", gsm: "", weave: "" },
        fabricSource: "fresh",
        orgColors: [],
        indivColors: { selected: [colorHex], desc: "", qtys: { [colorHex]: p.qty } },
        selectedGarment: null,
        // basePrice comes from the original order's own per-piece price
        // (its line-item unit price, or total ÷ qty) — never a hardcoded ₹0.
        garmentCart: [{ categoryId, name: p.name, basePrice: p.unitPrice || 0, style: undefined, qty: p.qty, colorHex, colorLabel: p.shade || "", sizes }],
        sizeState: { cat: sizeCat, qtys: sizes },
        packaging: { stitch: "single_needle", packing: "bulk_loose" },
        refState: { chosen: null, logoNames: [], inspNames: [] },
        accSpecState: {},
        delivery: contact,
        payment: "upi",
        orgDraft: { name: "", board: "", address: "", city: "", pin: "", contactName: "", contactPhone: "", contactEmail: "" },
        qty: p.qty,
      },
    });
  }
  // A curated Collection — build a ready-made cart and open it at Review.
  function handleOpenCollection(c: HomeCollection) {
    const totalQty = c.lines.reduce((a, l) => a + l.qty, 0);
    const contact = {
      name: userProfile.name || "", phone: userProfile.phone || "", email: userProfile.email || "",
      address: defaultAddress?.address || "", city: defaultAddress?.city || "", pin: defaultAddress?.pin || "",
    };
    handleEditOrder({
      persona: "individual",
      title: c.title,
      subtitle: "Collection",
      orgDetails: null,
      customDetails: { garmentType: "tshirt", groupType: "family", audience: c.audience, ...contact },
      resume: {
        material: { fabric: "", gsm: "", weave: "" },
        fabricSource: "fresh",
        orgColors: [],
        indivColors: { selected: [], desc: "", qtys: {} },
        selectedGarment: null,
        garmentCart: c.lines.map(l => ({ categoryId: l.categoryId, name: l.name, basePrice: l.basePrice, style: l.style, qty: l.qty, colorHex: l.colorHex, colorLabel: l.colorLabel })),
        sizeState: { cat: c.audience === "women" ? "womens" : "mens", qtys: {} },
        packaging: { stitch: "single_needle", packing: "bulk_loose" },
        refState: { chosen: null, logoNames: [], inspNames: [] },
        accSpecState: {},
        delivery: contact,
        payment: "upi",
        orgDraft: { name: "", board: "", address: "", city: "", pin: "", contactName: "", contactPhone: "", contactEmail: "" },
        qty: totalQty,
      },
    });
  }
  function handleNotifNavigate(tab: string, orderId?: string) {
    setShowNotifications(false);
    setActiveTab(tab as Tab);
    setTargetOrderId(orderId ?? null);
  }
  function handleContactAdmin() {
    alert("Calling admin: +91 98765 00000");
  }
  // Any later profile edit (e.g. Account → Business details) should also update the
  // saved registry entry, so a future sign-in with this identity reflects the latest edit.
  function handleProfileUpdate(p: UserProfile) {
    setUserProfile(p);
    rememberIdentity({ phone: p.phone, email: p.email }, p);
    accountApi.updateProfile({
      name: p.name, phone: p.phone, email: p.email,
      accountType: p.accountType, orgName: p.orgName, orgType: p.orgType,
      twoFAEnabled: p.twoFAEnabled,
      // Persist the profile picture so it survives sign-out / app close.
      avatarUrl: p.avatar ?? undefined,
    }).catch(() => {});
  }
  function handleSignOut() {
    // MANUAL sign-out only: actually drop the session token so the restore-on-load
    // effect won't sign the user back in. (Closing the app no longer signs out —
    // the token stays and the session is restored on next open.)
    authToken.clear();
    // A different account may sign in next on this device — never leak the
    // previous user's half-built order, orders or addresses into their session.
    try {
      localStorage.removeItem("fl_wip");
      localStorage.removeItem("fl_orders_cache");
      localStorage.removeItem("fl_addr_cache");
    } catch { /* ignore */ }
    setOrderTabMounted(false);
    setOrderEpoch(e => e + 1);
    setAuthStep("login");
    setActiveTab("home");
    setShowNotifications(false);
    setShowDrafts(false);
    setResumeDraft(null);
    setShowNewOrder(false);
    setNewOrderSummary(null);
    setShowRatingPopup(false);
    setRatingVal(0); setRatingFeedback(""); setRatingDone(false);
    setTargetOrderId(null);
    setShowHelp(false);
    setUserProfile({ name: "", avatar: null, accountType: "personal" });
  }

  // ── Phone frame shell ──
  // Below the `sm` breakpoint (real phones, native app) this fills the whole
  // viewport edge-to-edge and insets its own padding for the notch/home indicator.
  // At `sm` and above (desktop browser) it renders as a centered phone-shaped
  // preview card instead, since there's no device chrome to align to there.
  const phoneShell = (children: React.ReactNode) => (
    <div className="size-full flex items-center justify-center"
      style={{ fontFamily: "DM Sans, system-ui, sans-serif", background: "var(--secondary)" }}>
      <div id="garm-phone-frame"
        className="flex flex-col overflow-hidden w-full h-full sm:w-[375px] sm:h-[812px] rounded-none sm:rounded-[44px] border-0 sm:border sm:border-black/[0.08] shadow-none sm:shadow-[0_40px_80px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.06)]"
        style={{
          position: "relative", background: "var(--background)",
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
        }}>
        {children}
        {/* ── Branded splash overlay ── */}
        {splashPhase !== "done" && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 200,
            background: "#0D0D0D",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            opacity: splashPhase === "fade" ? 0 : 1,
            transition: "opacity .55s ease",
            pointerEvents: splashPhase === "fade" ? "none" : "auto",
          }}>
            <style>{`
              @keyframes garmSplashPop{0%{transform:scale(.7);opacity:0}55%{transform:scale(1.06);opacity:1}100%{transform:scale(1)}}
              @keyframes garmSplashLine{0%{width:0}100%{width:88px}}
              @keyframes garmSplashText{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
              @media (prefers-reduced-motion:reduce){.garm-splash-anim{animation:none!important}}
            `}</style>
            <div className="garm-splash-anim" style={{ animation: "garmSplashPop .7s cubic-bezier(.2,.9,.3,1.2) both" }}>
              <GarmLogo size={64}/>
            </div>
            <p className="garm-splash-anim" style={{
              marginTop: 18, fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "0.02em",
              animation: "garmSplashText .5s ease .35s both",
            }}>Garm</p>
            <p className="garm-splash-anim" style={{
              marginTop: 4, fontSize: 10.5, letterSpacing: "0.22em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.45)", fontWeight: 600,
              animation: "garmSplashText .5s ease .5s both",
            }}>Made to order</p>
            <div className="garm-splash-anim" style={{
              marginTop: 22, height: 2, borderRadius: 1, background: ACCENT,
              animation: "garmSplashLine 1.1s ease .55s both",
            }}/>
          </div>
        )}
      </div>
    </div>
  );

  // ── Auth screens ──────────────────────────────────────────────────────────
  if (authStep === "welcome")     return phoneShell(<WelcomeScreen onDone={() => setAuthStep("login")}/>);
  if (authStep === "login")       return phoneShell(<LoginScreen onLogin={(identity, remoteProfile) => {
    setLoginIdentity(identity);
    if (remoteProfile) {
      // Real, backend-verified account (find-or-create already happened server-side
      // during OTP verification) — this replaces the old localStorage-only lookup.
      const mapped: UserProfile = {
        name: remoteProfile.name || "",
        avatar: remoteProfile.avatarUrl ?? null,
        accountType: remoteProfile.accountType === "organisation" ? "organisation" : "personal",
        orgName: remoteProfile.orgName,
        orgType: remoteProfile.orgType,
        phone: remoteProfile.phone,
        email: remoteProfile.email,
        twoFAEnabled: remoteProfile.twoFAEnabled,
      };
      setUserProfile(mapped);
      // Cache ONLY a real (named) profile. Previously we always overwrote the
      // local registry with the backend profile — and for an account whose name
      // never saved (poisoned data / a failed onboarding PUT) that name is "",
      // so this CLOBBERED a previously-cached good name BEFORE the heal below
      // could read it, and the customer was asked to onboard again forever.
      if (mapped.name && mapped.name.trim()) rememberIdentity(identity, mapped);
      // Returning user? Go straight in. If the backend record is missing the
      // onboarding flag (e.g. it was offline when they first onboarded), fall
      // back to the local registry and HEAL the backend — never ask a returning
      // user their name/location again.
      if (remoteProfile.onboardingComplete && remoteProfile.name) {
        setAuthStep("app");
      } else {
        const key = identityKey(identity);
        const cached = key ? loadIdentityRegistry()[key] : undefined;
        if (cached?.name) {
          setUserProfile({ ...cached, ...identity });
          setAuthStep("app");
          saveProfileWithRetry({
            name: cached.name, accountType: cached.accountType, orgName: cached.orgName,
            orgType: cached.orgType, onboardingComplete: true,
          });
        } else {
          setAuthStep("onboarding");
        }
      }
      // Load the saved default delivery address (if any) so New Order can pre-fill it
      // instead of asking the returning user for it again. Best-effort.
      accountApi.getAddresses().then(res => {
        const def = res.addresses.find(a => a.isDefault) ?? res.addresses[0];
        if (def) setDefaultAddress({ address: def.line1, city: def.city, pin: def.pin });
      }).catch(() => {});
    } else {
      // Safety net only — shouldn't happen now that OTP verification is real.
      const key = identityKey(identity);
      const existing = key ? loadIdentityRegistry()[key] : undefined;
      if (existing) { setUserProfile({ ...existing, ...identity }); setAuthStep("app"); }
      else          { setAuthStep("onboarding"); }
    }
  }}/>);
  if (authStep === "onboarding")  return phoneShell(<OnboardingScreen onComplete={(p, delivery) => {
    const merged = { ...p, ...loginIdentity };
    setUserProfile(merged);
    rememberIdentity(loginIdentity, merged);
    setAuthStep("app");
    // Persist to the real backend so this account is recognised as onboarded on
    // future logins (from this device or any other). Best-effort — local state
    // already reflects the update either way.
    saveProfileWithRetry({
      name: merged.name, phone: merged.phone, email: merged.email,
      accountType: merged.accountType, orgName: merged.orgName, orgType: merged.orgType,
      onboardingComplete: true,
    });
    // Save the address the user just gave us as their default delivery address, so
    // New Order can pre-fill it instead of asking again. Update local state
    // immediately (so it's ready the moment they land on New Order); persist to the
    // backend best-effort.
    if (delivery && delivery.address.trim() && delivery.city.trim()) {
      setDefaultAddress(delivery);
      // Persist with retry — a cold backend on first onboarding must not
      // silently swallow the customer's address (that left the Account address
      // book empty and Review asking again).
      const saveAddr = (n: number) => {
        accountApi.addAddress({
          label: "Home", line1: delivery.address, city: delivery.city, state: "", pin: delivery.pin, isDefault: true,
        }).catch(() => { if (n < 3) setTimeout(() => saveAddr(n + 1), 3000 * (n + 1)); });
      };
      saveAddr(0);
    }
    // Tutorial/coach-mark trigger lives in the authStep === "app" effect above, so it
    // fires here AND for returning users who skip straight past onboarding.
  }}/>);

  return phoneShell(
    <>
      {/* Sub-page header (non-home tabs) */}
      {activeTab !== "home" && !showHelp && (
        <div className="px-5 pt-1 pb-3 flex items-center justify-between border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <GarmLogo size={18} style={{ flexShrink: 0 }} />
            <span className="text-foreground/25 text-xs" style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>Garm</span>
            <span className="text-border">·</span>
            <span className="text-foreground text-sm font-semibold">{tabTitleMap[activeTab]}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowDrafts(true)}
              className="w-8 h-8 rounded-full bg-card flex items-center justify-center border border-border relative" title="Drafts">
              <FileText size={14} strokeWidth={1.5}/>
              {drafts.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full flex items-center justify-center"
                  style={{ background: ACCENT, color: "#fff", fontSize: 8.5, fontWeight: 700 }}>{drafts.length}</span>
              )}
            </button>
            <button onClick={() => setShowNotifications(true)}
              className="w-8 h-8 rounded-full bg-card flex items-center justify-center border border-border relative">
              <Bell size={14} strokeWidth={1.5}/>
              {notifUnread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full flex items-center justify-center"
                  style={{ background: ACCENT, color: "#fff", fontSize: 8.5, fontWeight: 700 }}>{notifUnread > 99 ? "99+" : notifUnread}</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {showHelp ? (
          <HelpSupportScreen onBack={() => setShowHelp(false)} onReplayTour={() => { setShowHelp(false); handleReplayTour(); }}/>
        ) : (
          <>
            {activeTab === "home"    && <HomeTab onNavigate={handleNavigate} onBell={() => setShowNotifications(true)} onDrafts={() => setShowDrafts(true)} onHelp={handleReplayTour} onQuickStart={(i) => { if (i === "sizeguide") { setShowSizeChart(true); } else { setOrderIntent(i); setActiveTab("order"); } }} onOpenCollection={handleOpenCollection} onReorderPast={handleReorderPast} draftCount={drafts.length} notifCount={notifUnread} profile={userProfile}/>}
            {/* Order tab: mounted once, then kept alive (display:none) across tab
                switches — tapping Home/Track/Account and coming back must land the
                customer exactly where they left off, never on a wiped form. */}
            {(activeTab === "order" || orderTabMounted) && (
              <div style={{ display: activeTab === "order" ? "contents" : "none" }}>
                <NewOrderTab key={`${resumeDraft?.id ?? "new"}-${orderEpoch}`} onNavigate={handleNavigate} onOrderPlaced={handleOrderPlaced} onTrackOrder={handleOrderSubmitted} accountType={userProfile.accountType} orgType={userProfile.orgType} orgName={userProfile.orgName} name={userProfile.name} phone={userProfile.phone} email={userProfile.email} address={defaultAddress?.address} city={defaultAddress?.city} pin={defaultAddress?.pin} onSaveDraft={handleSaveDraft} resumeDraft={resumeDraft} intent={orderIntent} onIntentConsumed={() => setOrderIntent(null)} onResetResume={() => setResumeDraft(null)} dirtyRef={orderDirtyRef}/>
              </div>
            )}
            {activeTab === "track"   && (
              <TrackTab
                showNew={showNewOrder}
                newOrderSummary={newOrderSummary}
                targetOrderId={targetOrderId}
                accountType={userProfile.accountType}
                onMessageCoordinator={handleContactAdmin}
                onReorder={() => setActiveTab("order")}
                onEditOrder={handleEditOrder}
                paidOrderIds={paidOrderIds}
                onMarkOrderPaid={handleMarkOrderPaid}
                onOrderDelivered={handleOrderDelivered}
                ratingOverrides={ratingOverrides}
                onRated={(apiId, rating, feedback) => setRatingOverrides(prev => ({ ...prev, [apiId]: { rating, feedback } }))}
              />
            )}
            {activeTab === "account" && (
              <AccountTab
                onNavigate={(tab, orderId) => handleNavigate(tab as Tab, orderId)}
                profile={userProfile}
                onProfileUpdate={handleProfileUpdate}
                onSignOut={handleSignOut}
                onAddressesChange={(addrs) => {
                  // Keep the order flow's pre-filled delivery address in sync the
                  // moment the customer edits their address book — no restart needed.
                  const def = addrs.find(a => a.default) ?? addrs[0];
                  setDefaultAddress(def ? { address: def.line1, city: def.city, pin: def.pin } : null);
                }}
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
              id={`coachmark-tab-${tab.id}`}
              onClick={() => { setShowHelp(false); setActiveTab(tab.id); }}
              className="flex-1 flex flex-col items-center gap-0.5 py-1">
              <span className={`flex items-center justify-center rounded-full ${active ? "magic-anim" : "text-muted-foreground"}`}
                style={{
                  padding: "4px 14px",
                  background: active ? ACCENT_BG : "transparent",
                  color: active ? ACCENT_TEXT : undefined,
                  transition: "background .2s",
                  animation: active ? "garmNavPop .25s ease" : undefined,
                }}>
                {tab.icon}
              </span>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? ACCENT_TEXT : "var(--muted-foreground)" }}>
                {tab.label}
              </span>
            </button>
          );
        })}
        {/* Home indicator */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 rounded-full bg-foreground/20 pointer-events-none"/>
      </div>

      {/* "How Garm works" tutorial — shown once automatically after onboarding (or on first
          Home visit for returning/identity-locked users), and reopenable any time from
          Home's "?" button. */}
      {showTutorial && (
        <TutorialModal accountType={userProfile.accountType} onClose={handleTutorialClose}/>
      )}

      {/* First-login coach-mark tour — "tap here, this is next" pointers at the real nav
          controls, chained right after the tutorial closes (first time only). */}
      {showCoachmarks && activeTab === "home" && !showHelp && (
        <CoachmarkTour onDone={handleCoachmarksDone}/>
      )}

      {/* Notifications overlay */}
      {showNotifications && (
        <NotificationsScreen onClose={() => setShowNotifications(false)} onNavigate={handleNotifNavigate}/>
      )}

      {/* Drafts overlay */}
      {showDrafts && (
        <DraftsScreen
          drafts={drafts}
          onClose={() => setShowDrafts(false)}
          onCancelDraft={handleCancelDraft}
          onResumeDraft={handleResumeDraft}
        />
      )}

      {/* Rating popup — shown once when a delivered order is opened (and not yet
          rated). Persists the rating to THAT order on the backend, so it shows in
          Track and in the admin portal. */}
      {/* Size chart opened from the Home tile — overlays Home directly */}
      {showSizeChart && <SizeGuideModal onClose={() => setShowSizeChart(false)}/>}

      {showRatingPopup && ratingOrder && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowRatingPopup(false)}>
          <div className="bg-background rounded-t-3xl px-5 py-6" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4"/>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <Package size={20} className="text-emerald-500" strokeWidth={1.5}/>
              </div>
              <div>
                <p className="text-foreground text-sm font-semibold">How was your order?</p>
                <p className="text-muted-foreground" style={{ fontSize: 11 }}>{ratingOrder.ref} · {ratingOrder.name}</p>
              </div>
            </div>
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
            {ratingVal > 0 && (
              <textarea value={ratingFeedback} onChange={e => setRatingFeedback(e.target.value)}
                placeholder="Tell us about the quality, delivery, coordinator service…"
                className="w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none resize-none h-16 mb-3"
                style={{ fontFamily: "DM Sans, sans-serif" }}/>
            )}
            <button
              onClick={submitPopupRating}
              disabled={ratingVal === 0 || ratingBusy}
              style={ratingVal > 0 && !ratingBusy ? btnAccent : btnPrimaryDisabled}>
              {ratingBusy ? "Submitting…" : ratingVal > 0 ? "Submit feedback" : "Tap a star to rate"}
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
