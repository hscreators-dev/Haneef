import React from "react";

// ─── Stage-aware animated scene ───────────────────────────────────────────────
// A small, self-contained animated illustration shown above order trackers.
// Purely decorative — picks a looping scene based on the order's current stage.
// Follows the app's existing pattern of inline <style> keyframes inside SVGs
// (see GarmLogo / FootballArt in App.tsx), incl. prefers-reduced-motion.

const ACCENT = "#C8A97E";
const DARK   = "#0D0D0D";
const SUCCESS = "#059669";

export type OrderStage = "placed" | "sourcing" | "production" | "qc" | "shipped" | "delivered";

export const stageCaption: Record<OrderStage, string> = {
  placed:     "Order placed",
  sourcing:   "Sourcing material",
  production: "In production",
  qc:         "Quality check",
  shipped:    "Shipped",
  delivered:  "Delivered",
};

// Maps any status / step label used across the app to a scene.
export function stageFromLabel(label: string): OrderStage {
  const l = label.toLowerCase();
  if (l.includes("deliver") || l.includes("complete")) return "delivered";
  if (l.includes("ship"))                              return "shipped";
  if (l.includes("quality") || l.includes("qa"))       return "qc";
  if (l.includes("production"))                        return "production";
  // Confirmation + payment sit between "just placed" and production — the
  // sourcing/paperwork scene reads closest for both.
  if (l.includes("sourc") || l.includes("quote") || l.includes("review") || l.includes("approv") ||
      l.includes("confirm") || l.includes("payment")) return "sourcing";
  return "placed";
}

const styleSheet = `
  .stg-svg *{transform-box:fill-box}
  .stg-pulse{transform-origin:center;animation:stgPulse 2s ease-in-out infinite}
  .stg-pop{transform-origin:center;animation:stgPop 2.4s ease-in-out infinite}
  .stg-twinkle{animation:stgTwinkle 1.8s ease-in-out infinite}
  .stg-spin{transform-origin:center;animation:stgSpin 6s linear infinite}
  .stg-spin-fast{transform-origin:center;animation:stgSpin 1.1s linear infinite}
  .stg-flow{animation:stgFlow 1.4s linear infinite}
  .stg-flow-slow{animation:stgFlow 2.2s linear infinite}
  .stg-needle{animation:stgNeedle .5s cubic-bezier(.6,0,.4,1) infinite}
  .stg-fabric{animation:stgFabric 2.8s linear infinite}
  .stg-sweep{animation:stgSweep 3.2s ease-in-out infinite}
  .stg-bob{animation:stgBob 1s ease-in-out infinite}
  .stg-drop{transform-origin:center bottom;animation:stgDrop 2.6s ease-in-out infinite}
  .stg-line1{animation:stgSpeed 1s linear infinite}
  .stg-line2{animation:stgSpeed 1s linear .33s infinite}
  .stg-line3{animation:stgSpeed 1s linear .66s infinite}
  .stg-write1{transform-origin:left center;animation:stgWrite 3s ease-in-out infinite}
  .stg-write2{transform-origin:left center;animation:stgWrite 3s ease-in-out .4s infinite}
  .stg-write3{transform-origin:left center;animation:stgWrite 3s ease-in-out .8s infinite}
  @keyframes stgPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.12);opacity:.85}}
  @keyframes stgPop{0%,100%{transform:scale(1)}12%{transform:scale(1.18)}24%{transform:scale(1)}}
  @keyframes stgTwinkle{0%,100%{opacity:.15}50%{opacity:1}}
  @keyframes stgSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
  @keyframes stgFlow{from{stroke-dashoffset:24}to{stroke-dashoffset:0}}
  @keyframes stgNeedle{0%,100%{transform:translateY(0)}50%{transform:translateY(9px)}}
  @keyframes stgFabric{from{transform:translateX(10px)}to{transform:translateX(-14px)}}
  @keyframes stgSweep{0%,100%{transform:translateX(-24px)}50%{transform:translateX(26px)}}
  @keyframes stgBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}
  @keyframes stgDrop{0%,100%{transform:translateY(0) scale(1)}45%{transform:translateY(-6px) scale(1)}60%{transform:translateY(0) scale(1.06,.94)}72%{transform:translateY(0) scale(1)}}
  @keyframes stgSpeed{0%{transform:translateX(0);opacity:0}25%{opacity:1}100%{transform:translateX(-26px);opacity:0}}
  @keyframes stgWrite{0%{transform:scaleX(0)}30%,80%{transform:scaleX(1)}100%{transform:scaleX(1);opacity:0}}
  @keyframes stgDotBlink{0%,100%{opacity:1}50%{opacity:.25}}
  @media (prefers-reduced-motion:reduce){.stg-svg *{animation:none!important}}
`;

// ── Individual scenes (viewBox 0 0 240 80) ────────────────────────────────────

function ScenePlaced() {
  return (
    <g>
      {/* clipboard */}
      <rect x="94" y="13" width="52" height="56" rx="8" fill="#fff" stroke={DARK} strokeWidth="2"/>
      <rect x="110" y="8" width="20" height="10" rx="4" fill={ACCENT} stroke={DARK} strokeWidth="1.5"/>
      {/* lines writing themselves */}
      <rect className="stg-write1" x="103" y="28" width="34" height="4" rx="2" fill="rgba(13,13,13,0.22)"/>
      <rect className="stg-write2" x="103" y="38" width="26" height="4" rx="2" fill="rgba(13,13,13,0.16)"/>
      <rect className="stg-write3" x="103" y="48" width="30" height="4" rx="2" fill="rgba(13,13,13,0.16)"/>
      {/* check badge */}
      <g className="stg-pop">
        <circle cx="144" cy="60" r="11" fill={ACCENT} stroke="#fff" strokeWidth="2"/>
        <path d="M139 60 l3.5 3.5 L149.5 56" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
      {/* sparkles */}
      <circle className="stg-twinkle" cx="78" cy="24" r="2.4" fill={ACCENT}/>
      <circle className="stg-twinkle" cx="164" cy="20" r="2" fill={ACCENT} style={{ animationDelay: ".5s" }}/>
      <circle className="stg-twinkle" cx="70" cy="52" r="1.8" fill="rgba(13,13,13,0.3)" style={{ animationDelay: ".9s" }}/>
      <circle className="stg-twinkle" cx="172" cy="48" r="2.2" fill="rgba(13,13,13,0.25)" style={{ animationDelay: "1.3s" }}/>
    </g>
  );
}

function SceneSourcing() {
  return (
    <g>
      {/* fabric roll */}
      <g className="stg-spin">
        <circle cx="66" cy="40" r="21" fill="#fff" stroke={DARK} strokeWidth="2"/>
        <circle cx="66" cy="40" r="13.5" fill="none" stroke={ACCENT} strokeWidth="2" strokeDasharray="5 4"/>
        <circle cx="66" cy="40" r="6" fill="none" stroke={ACCENT} strokeWidth="2"/>
        <circle cx="66" cy="40" r="2" fill={DARK}/>
      </g>
      {/* flowing thread */}
      <path className="stg-flow" d="M87 40 C 118 18, 138 62, 168 40" fill="none"
        stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="7 5"/>
      {/* swatches being gathered */}
      <g className="stg-twinkle"><rect x="172" y="22" width="15" height="15" rx="4" fill="#1f2f46"/></g>
      <g className="stg-twinkle" style={{ animationDelay: ".6s" }}><rect x="180" y="42" width="15" height="15" rx="4" fill={ACCENT}/></g>
      <g className="stg-twinkle" style={{ animationDelay: "1.2s" }}><rect x="163" y="47" width="13" height="13" rx="4" fill="#fff" stroke={DARK} strokeWidth="1.5"/></g>
    </g>
  );
}

function SceneProduction() {
  return (
    <g>
      {/* moving fabric + stitches */}
      <g className="stg-fabric">
        <rect x="46" y="51" width="76" height="9" rx="3.5" fill="rgba(200,169,126,0.28)" stroke={ACCENT} strokeWidth="1.5"/>
      </g>
      <line className="stg-flow-slow" x1="50" y1="55.5" x2="118" y2="55.5" stroke={DARK} strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round"/>
      {/* sewing machine */}
      <rect x="60" y="62" width="122" height="8" rx="4" fill={DARK}/>
      <rect x="150" y="16" width="16" height="48" rx="6" fill={DARK}/>
      <rect x="112" y="16" width="52" height="13" rx="6.5" fill={DARK}/>
      <rect x="112" y="16" width="14" height="26" rx="6" fill={DARK}/>
      {/* needle bar */}
      <g className="stg-needle">
        <rect x="117" y="38" width="4" height="15" rx="2" fill={DARK}/>
        <rect x="115" y="34" width="8" height="6" rx="2" fill={ACCENT}/>
      </g>
      {/* hand wheel */}
      <g className="stg-spin-fast">
        <circle cx="172" cy="26" r="7" fill="#fff" stroke={DARK} strokeWidth="2"/>
        <line x1="172" y1="20.5" x2="172" y2="31.5" stroke={DARK} strokeWidth="1.6"/>
      </g>
      {/* thread spool */}
      <rect x="146" y="8" width="9" height="8" rx="2" fill={ACCENT} stroke={DARK} strokeWidth="1.4"/>
    </g>
  );
}

function SceneQC() {
  return (
    <g>
      {/* fabric under inspection */}
      <rect x="66" y="24" width="108" height="34" rx="7" fill="#fff" stroke={DARK} strokeWidth="2"/>
      <line x1="74" y1="34" x2="166" y2="34" stroke="rgba(200,169,126,0.7)" strokeWidth="2" strokeDasharray="5 4"/>
      <line x1="74" y1="41" x2="166" y2="41" stroke="rgba(200,169,126,0.45)" strokeWidth="2" strokeDasharray="5 4"/>
      <line x1="74" y1="48" x2="166" y2="48" stroke="rgba(200,169,126,0.7)" strokeWidth="2" strokeDasharray="5 4"/>
      {/* sweeping magnifier */}
      <g className="stg-sweep">
        <circle cx="120" cy="38" r="14" fill="rgba(255,255,255,0.88)" stroke={DARK} strokeWidth="2.5"/>
        <line x1="130" y1="49" x2="139" y2="60" stroke={DARK} strokeWidth="4" strokeLinecap="round"/>
        <path className="stg-twinkle" d="M114 38.5 l4 4 L127 33.5" stroke={SUCCESS} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
      {/* ticks */}
      <circle className="stg-twinkle" cx="58" cy="18" r="2.2" fill={SUCCESS} style={{ animationDelay: ".4s" }}/>
      <circle className="stg-twinkle" cx="184" cy="16" r="2" fill={ACCENT} style={{ animationDelay: "1s" }}/>
    </g>
  );
}

function SceneShipped() {
  return (
    <g>
      {/* road */}
      <line className="stg-flow" x1="34" y1="66" x2="206" y2="66" stroke="rgba(13,13,13,0.28)" strokeWidth="2.5" strokeDasharray="9 7" strokeLinecap="round"/>
      {/* speed lines */}
      <line className="stg-line1" x1="52" y1="34" x2="70" y2="34" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round"/>
      <line className="stg-line2" x1="46" y1="43" x2="66" y2="43" stroke="rgba(13,13,13,0.3)" strokeWidth="2.5" strokeLinecap="round"/>
      <line className="stg-line3" x1="54" y1="52" x2="70" y2="52" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round"/>
      {/* truck */}
      <g className="stg-bob">
        <rect x="84" y="22" width="58" height="32" rx="5" fill="#fff" stroke={DARK} strokeWidth="2.2"/>
        <rect x="93" y="31" width="40" height="4" rx="2" fill="rgba(200,169,126,0.5)"/>
        <rect x="93" y="39" width="28" height="4" rx="2" fill="rgba(200,169,126,0.35)"/>
        <path d="M142 30 h18 a4 4 0 0 1 3.2 1.6 l7.4 9.9 a4 4 0 0 1 .8 2.4 V50 a4 4 0 0 1 -4 4 h-25.4 Z" fill={DARK}/>
        <rect x="146" y="33" width="11" height="9" rx="2" fill="#F8F7F5"/>
      </g>
      {/* wheels */}
      <g className="stg-spin-fast">
        <circle cx="103" cy="58" r="7.5" fill={DARK}/>
        <circle cx="103" cy="58" r="3" fill="#F8F7F5"/>
        <line x1="103" y1="52.5" x2="103" y2="63.5" stroke="#F8F7F5" strokeWidth="1.4"/>
      </g>
      <g className="stg-spin-fast" style={{ animationDelay: ".15s" }}>
        <circle cx="156" cy="58" r="7.5" fill={DARK}/>
        <circle cx="156" cy="58" r="3" fill="#F8F7F5"/>
        <line x1="156" y1="52.5" x2="156" y2="63.5" stroke="#F8F7F5" strokeWidth="1.4"/>
      </g>
    </g>
  );
}

function SceneDelivered() {
  return (
    <g>
      {/* ground shadow */}
      <ellipse cx="120" cy="67" rx="34" ry="4" fill="rgba(13,13,13,0.08)"/>
      {/* parcel */}
      <g className="stg-drop">
        <rect x="98" y="34" width="44" height="32" rx="5" fill="#fff" stroke={DARK} strokeWidth="2.2"/>
        <line x1="120" y1="34" x2="120" y2="66" stroke={ACCENT} strokeWidth="3"/>
        <path d="M98 42 l-8 -8 h18 Z" fill="rgba(200,169,126,0.35)" stroke={DARK} strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M142 42 l8 -8 h-18 Z" fill="rgba(200,169,126,0.35)" stroke={DARK} strokeWidth="1.6" strokeLinejoin="round"/>
      </g>
      {/* success check */}
      <g className="stg-pop">
        <circle cx="120" cy="18" r="11" fill={SUCCESS} stroke="#fff" strokeWidth="2"/>
        <path d="M115 18 l3.5 3.5 L125.5 14" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
      {/* confetti */}
      <circle className="stg-twinkle" cx="80" cy="26" r="2.4" fill={ACCENT}/>
      <rect className="stg-twinkle" x="160" y="22" width="5" height="5" rx="1.4" fill={ACCENT} style={{ animationDelay: ".4s" }}/>
      <circle className="stg-twinkle" cx="170" cy="44" r="2" fill={SUCCESS} style={{ animationDelay: ".8s" }}/>
      <rect className="stg-twinkle" x="70" y="46" width="4.5" height="4.5" rx="1.3" fill="rgba(13,13,13,0.3)" style={{ animationDelay: "1.2s" }}/>
    </g>
  );
}

const scenes: Record<OrderStage, () => React.ReactElement> = {
  placed: ScenePlaced, sourcing: SceneSourcing, production: SceneProduction,
  qc: SceneQC, shipped: SceneShipped, delivered: SceneDelivered,
};

// ── Container ─────────────────────────────────────────────────────────────────
export function StageAnimation({ stage, compact, showLabel = true }: {
  stage: OrderStage; compact?: boolean; showLabel?: boolean;
}) {
  const Scene = scenes[stage];
  return (
    <div style={{
      position: "relative", overflow: "hidden",
      borderRadius: 14, height: compact ? 76 : 96,
      background: "linear-gradient(135deg, rgba(200,169,126,0.16) 0%, rgba(200,169,126,0.05) 55%, rgba(200,169,126,0.12) 100%)",
      border: "1px solid rgba(200,169,126,0.28)",
    }}>
      <svg className="stg-svg" viewBox="0 0 240 80" width="100%" height="100%"
        preserveAspectRatio="xMidYMid meet" role="img" aria-label={stageCaption[stage]}>
        <style>{styleSheet}</style>
        <Scene/>
      </svg>
      {showLabel && (
        <span className="absolute flex items-center gap-1.5"
          style={{
            top: 8, left: 10, padding: "3px 9px", borderRadius: 999,
            background: "rgba(255,255,255,0.85)", backdropFilter: "blur(4px)",
            border: "1px solid rgba(200,169,126,0.35)",
            fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em",
            textTransform: "uppercase", color: "#7C5419",
          }}>
          <span style={{
            width: 5, height: 5, borderRadius: 999,
            background: stage === "delivered" ? SUCCESS : ACCENT,
            animation: "stgDotBlink 1.4s ease-in-out infinite",
          }}/>
          {stageCaption[stage]}
        </span>
      )}
    </div>
  );
}
