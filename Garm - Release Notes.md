# Garm — Release Notes

**"Customise yourself."**
Prototype build summary · July 2026
Designed and developed by **Haneef M.**

---

## What Garm is

Garm is a mobile-first custom apparel and accessories ordering platform that takes someone from "I need uniforms/merch/custom clothing" all the way through to "it's on my doorstep" — inside one guided app, for two very different kinds of buyers:

- **Individuals** ordering a small, personalised batch (a custom tee, a family order, a one-off design).
- **Organisations** — schools, colleges, corporates, hospitals, industries, hotels, sports clubs, government bodies, NGOs/trusts — ordering uniforms or branded apparel in bulk, with quotes, approvals and coordination built in.

The core idea: replace the informal, error-prone way this business is usually done today (WhatsApp photos, phone calls, spreadsheets, "let me check with the tailor") with a structured, trackable, self-serve digital flow — without losing the human coordinator who confirms specs and production.

---

## Pain points this solves

- **No visibility.** Buyers historically had no way to see where their order stood between "placed" and "delivered." Garm gives a live status timeline for every order — Home shows an at-a-glance progress pill (Review → Quote → Approve → Production → QA → Shipped → Delivered), and each order's Track page walks through the same journey in detail (order placed, sourcing, production, quality check, shipping, delivery) with real dates.
- **Spec mistakes.** Wrong fabric, wrong size split, wrong colour — usually caught too late. Garm blocks progress at every step until fabric, quantity, size distribution and colour are actually complete, so an incomplete order can't be submitted.
- **Account confusion.** The same phone number could previously be used to register as an individual one day and an organisation the next, creating duplicate or mismatched accounts. Garm now locks a phone/email to the account type it first registered as — return sign-ins go straight to the right account, no re-asking.
- **"What am I actually approving?"** Sample-approval used to show generic placeholders. It now reflects the real fabric, colour and logo/reference the buyer selected during ordering.
- **No first-time guidance.** New users didn't know where to start. Garm now walks first-time users through Home, placing an order, and tracking it — automatically once, and replayable any time from Help & Support.
- **Payment confusion.** Buyers didn't know when or how they were expected to pay. Garm now shows the exact payable amount at checkout and collects payment there and then (UPI or card) to place the order — no separate follow-up step. Every order then carries a clear payment status (e.g. "Payment received") with a transaction reference, plus a downloadable invoice and payment receipt.
- **Losing progress.** Multi-step bulk orders are long — Garm lets organisations and individuals save a draft and resume later instead of starting over.

---

## Features & workflows now live

### 1. Onboarding & identity
- Mobile or email OTP sign-in.
- First-time users choose **Individual** or **Organisation**, with organisation type captured during setup — School, College, Corporate, Hospital, Industry, Hotel, Sports Club, Government, or NGO/Trust.
- **Identity lock:** once a number/email registers as one account type, it's fixed. Signing out and back in with the same identity restores that exact account and type automatically — no re-onboarding, no accidental duplicate account.
- Organisation type is locked after registration; changing it requires contacting support (routed straight from Business Details).

### 2. New Order
- **Organisation flow:** multi-garment cart across Men's, Women's and Kids (minimum 100 pcs per garment) — add every garment first, then configure each one independently: style, fabric/GSM/weave, one or more brand colours (picked from a palette or entered as hex/Pantone with placement notes), quantity, size distribution, stitching & packaging, and reference/sample method, all inside one card per garment.
- **Individual flow:** custom single or multi-garment orders (from just **1 piece** — no bulk minimum for individuals), with the same fabric/colour/size control and a garment mockup preview showing the chosen colour with logo placement (left chest, front centre, right sleeve, back centre).
- **Accessories ordering** for both personas, with separate minimum-order and step-quantity rules (organisation: 100 pcs/step 10; individual: 1 pc/step 1).
- **Reference & sample options:** upload a logo/design file, share a style photo, match an existing uniform sample, or request a fabric swatch box.
- **Live pricing engine** — price per piece updates in real time as fabric and weave are changed.
- **Two ways to pay, matched to order size:** standard catalog orders show an exact fixed price and are paid immediately by UPI or card to place the order; organisation bulk/custom-fabric orders instead show an indicative estimated range and are **submitted for the coordinator to confirm a final quote** before payment — no price is charged until that quote is approved.
- **Draft saving and resuming** for orders left mid-way.
- **Validation gating throughout:** an organisation cannot reach Review without every garment having quantity ≥ minimum, sizes fully distributed, **and at least one colour selected** — closing a gap where orders could previously be submitted with no colour chosen.
- Persona- and org-type-aware tips at each step (e.g. hospital vs. school vs. corporate guidance), dismissible once read.
- **Occasion-based ordering** — a "Wedding & Events" entry point on Home for custom fabric orders around weddings and functions (theme colours, coordinated family outfits), alongside the everyday individual and organisation flows.

### 3. Track
- Live status timeline per order — Home shows a compact progress pill (Review → Quote → Approve → Production → QA → Shipped → Delivered), and each order's own Track page shows a detailed timeline with real dates (Order placed → Sourcing material → In production → Quality check → Shipped → Delivered).
- Expandable order cards with full garment, fabric, colour, size and pricing breakdown, plus a direct line to the assigned procurement coordinator (call, WhatsApp, email).
- **Sample approval** (organisations): Approve / Request change, now showing the *actual* fabric, colour and logo/reference chosen for that order — not placeholder swatches.
- **Payment status & documents** — each order shows its payment status (e.g. "Payment received") with a transaction reference, plus an invoice and payment receipt available to view once ready.
- Reorder from past orders, rating & feedback on delivered orders, and filtering between active and past orders.

### 4. Account
- Profile management with organisation business details (name, registration/board/affiliation field tailored to org type, contact, address).
- Organisation type shown read-only post-registration, with a direct link to support for changes.
- Org-type-aware FAQ, Terms & Conditions, Privacy Policy and Security content.
- Single, consistent "Edit profile" entry point (a duplicate was removed).

### 5. Guided onboarding experience
- **"How Garm works"** — a short, persona-specific tutorial shown automatically the first time someone reaches the app (including returning users recognised via identity lock).
- **Coach-mark tour** — "tap here, this is next" pointers across Home (nav + help), New Order (continue actions, footer navigation) and Track (tapping into an order), shown once automatically to walk a new user through the full place-order-then-track-it workflow.
- **Replay walkthrough** — available any time from Home's "?" icon or Help & Support, so the guide isn't a one-shot that becomes unreachable once seen.
- Help & Support screen with FAQs and a direct contact card.

---

## Why this matters for corporate vs. personal use

**Corporate / institutional (organisation persona):** built for buyers who need to outfit groups of people — bulk quantities, size-range distribution across a workforce or student body, a single sample-approval step before production, a coordinator-prepared quote for custom bulk fabric, and a record of registration/GST-type details for procurement purposes. This turns a process that usually runs through phone calls and manual coordination into a structured, auditable workflow with one person able to configure, approve and track everything — with an invoice and payment receipt on file for every order.

**Personal use (individual persona):** built for someone ordering for themselves or a small group — a 1-piece minimum, a lighter flow, and a garment mockup preview to check colour and logo placement before paying, with the same tracking and payment visibility as the organisation flow, just scaled down.

---

## Roadmap achieved

1. **Foundation** — OTP-based onboarding, persona selection, identity lock across sessions.
2. **Ordering core** — organisation multi-garment cart and individual custom order flow (now from 1 piece), accessories, live pricing, drafts.
3. **Tracking & fulfilment visibility** — Home progress pill (Review/Quote/Approve/Production/QA/Shipped/Delivered) plus a detailed per-order Track timeline, sample approval, coordinator contact.
4. **Payments & documentation** — in-app payment at checkout (UPI/card) with a clear payable amount, payment status with transaction reference, and invoice/payment receipt documents per order.
5. **Trust & compliance content** — org-type-aware FAQs, Terms, Privacy, Security; locked organisation type with a clear change process.
6. **Guided adoption** — automatic first-time tutorial and coach-mark tour across Home, New Order and Track, with an on-demand replay so the guidance isn't lost after first use.
7. **Hardening** — fixed a quantity-input bug, closed the gap that let organisation orders skip colour selection, and made sample approval reflect real order data instead of placeholders.

---

## Development timeline & iteration history

Built by Haneef M. through AI-assisted iterative development, June 22 – July 1, 2026 — **9 calendar days, 14 commits** to the repository. Within that window the build went through **40 discrete, tracked iterations**: a mix of ground-up features (identity-locked onboarding, the full New Order rebuild for both personas, the coach-mark/tutorial system, legal & FAQ content, the payment and tracking flows) and hardening passes (bug fixes, live-deployment verification, copy and accessibility corrections).

**On "how many hours":** there's no timesheet for this project — it was built conversationally, iteration by iteration, not on manually-clocked coding sessions, so a precise hour figure would be invented rather than measured. As a rough reference point only: a hand-coded equivalent of this app (~11,400 lines of TypeScript across the four main screens, plus onboarding, legal content and the coach-mark system) would typically take a small team **3–5 weeks (roughly 120–200 hours)** to build manually from scratch. The actual elapsed time here was compressed into 9 days specifically because of the AI-assisted workflow — that gap is real, not a rounding error, and the figure above should be read as context, not a logged number.

## UX principles applied

- **Visibility of system status** (Nielsen) — the Home progress pill and per-order Track timeline mean a buyer is never left wondering where an order stands.
- **Progressive disclosure / Hick's Law** — New Order builds one garment, one decision at a time inside its own card, instead of one long form.
- **Chunking (Miller's Law)** — fabric, colour, quantity, sizing and packaging are grouped into small, labelled decision blocks per garment rather than one undifferentiated list.
- **Error prevention** — Review is gated until quantity, size distribution and colour are all complete, so an incomplete spec can't reach production.
- **Fitts's Law** — primary actions (Continue, Submit, Pay) sit in a fixed sticky footer with a large tap target, not buried at the end of a scroll.
- **Recognition over recall** (Nielsen) — the coach-mark tour and "How Garm works" tutorial teach the flow contextually instead of requiring the user to remember instructions from elsewhere.
- **User control & freedom** — drafts can be saved and resumed, and the tutorial is replayable on demand rather than a one-shot the user can lose.
- **Consistency & standards** — the same fabric/colour/size interaction pattern is reused across individual and organisation flows, so learning one teaches the other.
- **Doherty Threshold** — the pricing engine recalculates live as fabric/weave/quantity change, so the cost consequence of a decision is felt immediately, not after a delay.
- **Peak–End Rule** — rating and feedback are captured right at delivery, the emotional "peak/end" of the journey, rather than buried in a separate menu.
- **Jakob's Law** — OTP sign-in, bottom tab navigation and card-based lists follow patterns buyers already know from other consumer apps, reducing learning cost.

## UI style & design system

- **Foundation:** shadcn/ui components built on Radix UI primitives (dialog, tabs, accordion, popover, tooltip, switch, etc.), styled with Tailwind CSS utility classes.
- **Typography:** DM Sans throughout, a single humanist sans-serif for both UI and body text.
- **Colour system:** warm off-white background (`#F8F7F5`) with near-black text/primary (`#0D0D0D`) and a single warm-gold brand accent (`#C8A97E`) — plus a full semantic palette for success, warning, error and info states so status colour is never ambiguous.
- **Spacing & shape:** a 4-pt spacing grid and a defined corner-radius scale (8px for chips up to 24px for primary buttons and modal sheets) — small elements stay crisp, larger surfaces feel softer.
- **Icons & motion:** the Lucide icon set for consistency; Motion (the Framer Motion successor) for transitions and micro-interactions, with `canvas-confetti` used for celebratory moments like order placement.
- **Navigation shell:** persistent bottom tab bar (Home / Order / Track / Account) — a familiar mobile app pattern rather than a bespoke one.

## Market context — is the demand real?

- The **workwear/uniforms market** (the organisation side of Garm) is valued between roughly **$76.75B and $116.2B in 2026** depending on the research firm, growing at a **3.6–5.3% CAGR** through 2035; corporate uniforms are already used by an estimated 66% of service organisations for branding and compliance reasons.
- The **custom apparel/personalization market** (the individual side of Garm) is valued at roughly **$66–72B in 2026**. An estimated 53% of apparel brands now offer AI-driven customization, 47% of custom-apparel purchases already happen through online customization tools, and APAC is the fastest-growing region for personalized apparel.
- **Reading of this:** Garm sits across two large, independently growing, actively-digitizing markets rather than a niche or invented one. The specific pain point it targets — replacing WhatsApp-photo/phone-call ordering with a structured, trackable flow — matches a documented industry shift already underway, not a hypothetical problem.

Sources: [Uniform Market Size and Trends Research 2026-2035](https://www.businessresearchinsights.com/market-reports/uniform-market-119075) · [Workwear and Uniforms Market Size](https://www.businessresearchinsights.com/market-reports/workwear-and-uniforms-market-101776) · [Custom Apparel Market Growth Analysis — Technavio](https://www.technavio.com/report/custom-apparel-market-industry-analysis) · [Custom Clothing Market Share and Size](https://www.businessresearchinsights.com/market-reports/custom-clothing-market-117606)

## Overall assessment — a genuine rating

This is a candid self-assessment, not a marketing summary — strengths and gaps both included.

- **UX flow — 8/10.** Validation gating, live pricing and persona-aware guidance are genuinely strong. Docked point: the Home progress pill and the Track detail page still use two different label sets for the same journey — a real inconsistency worth fixing before this goes further.
- **UI polish — 8/10.** Consistent design tokens, a real type/colour/icon system, and a restrained single-accent palette read as considered rather than default. Docked point: garment previews and catalog imagery are still placeholder-level, not production photography.
- **Feature completeness (as an MVP) — 7/10.** Covers onboarding through delivery for two distinct personas end-to-end. Docked points: payment is UI-level only with no confirmed real payment-gateway integration, and there's no visible coordinator-side tooling — the other half of the marketplace that would actually process these orders.
- **Business readiness — 5/10.** As a demo, it's compelling and the market data above supports real demand. But turning this into a live business needs backend infrastructure this build doesn't yet have: a real payment gateway, real order/production data storage (today's identity lock lives in browser `localStorage`, which doesn't survive a device change or app reinstall), and actual coordinator/ops tooling — a materially larger effort than the UI work captured here.
- **Overall — 7.5/10.** A strong, coherent UX prototype that validates the concept convincingly. The gap between this and a shippable product is mostly backend and operations, not interface design.

---

*This is a working prototype under active iteration — the notes above reflect what's implemented and functioning as of this build.*

---

# Version 1.1 — "Atelier" update · 3 July 2026

A major design-and-experience release focused on three things: bringing the interface to life ("magic"), making the individual ordering flow family-ready, and closing real usability gaps found in testing. No ordering logic, pricing or validation behaviour was regressed — every change below is additive or corrective.

## 1. Live order-stage animations (Track + Home)

- **Six animated stage scenes** — each order now shows a looping illustration matching its current stage: *Order placed* (clipboard writing itself + check), *Sourcing material* (spinning fabric roll + flowing thread + swatches), *In production* (sewing machine with bobbing needle and hand wheel), *Quality check* (magnifier sweeping fabric), *Shipped* (truck with spinning wheels and speed lines), *Delivered* (parcel drop with confetti).
- Shown **inside every expanded Track order card** (scene follows that order's active step) and **on Home's "Order in progress" card** (compact variant), each with a pulsing stage-label chip.
- All animations respect `prefers-reduced-motion`.

## 2. Home & app-wide design refresh

- **Hero banner rebuilt:** woven basket-weave texture (the Garm mark itself), floating logo tile with warm gold glow, an animated running-stitch thread under the headline, and a CTA with a gold icon chip.
- **Persona-aware hero copy:** individuals see *"Your style, your colours — stitched just for you"* with a "Start my order" CTA; organisations see *"Team wear & uniforms, sorted end to end."* The old one-size-fits-all B2B copy is gone.
- Stats row icons now sit in colour-coded chips (gold/green/blue); "Order in progress" and expanded Track cards carry a gold thread strip; request-card progress bars are a gold gradient with a running shimmer; the Wedding & Events banner twinkles; the bottom nav's active tab is a gold pill with a spring-in animation; soft layered shadows across all cards; Track filter tabs are now an iOS-style segmented control; Track timeline connectors darken as steps complete and the active step pulses.

## 3. Family orders — "Add more order" (Individual)

- One order can now dress **Men + Women + Kids together.** In Garments & Colours, a top-of-page invitation card ("Ordering for someone else too?", with overlapping mini avatars) opens a warm picker — **For him / For her / For the kids** — with the reassurance "They join this same order — one payment, one delivery."
- Enabled audiences appear as category tabs with live piece counts; each cart line keeps its own audience, size chart, materials and colours.
- Review, header pill and Track all reflect mixed orders ("Kids + Men + Women sizing", per-line audience labels).

## 4. Size distribution — redesigned and garment-correct

- The tall tile grid is replaced by a **compact tap-a-size chip picker** with a live prompt ("Tap a size to place 2 remaining pieces" → "All pieces sized ✓"), count badges on chips, and slim adjust rows only for chosen sizes.
- **Right size system per garment:** adult bottom-wear (jeans, trousers, chinos, joggers, leggings, palazzos, shorts, track pants) now uses **waist-in-inches** sizes (men 28–40", women 26–36"); tops show their measurement on every chip (M · 38–40" chest, M · UK 10–12); kids stay age-based; the prompt names the system in use.
- **Free-size garments** (sarees, dupattas, stoles, shawls, aprons) skip the size chart entirely — auto-allocated with a "Free size ✓" card.
- A garment can be **removed directly from the Sizes step** (two-tap "Remove?" confirm).

## 5. References & samples — upload first, live atelier mockup

- **Flow reordered:** design upload now sits above the preview ("Add your design or logo — then see it live on your garment below"), with a green "Design on ✓" badge once uploaded.
- **The mockup is now a studio product shot:** the garment hangs from a wooden hanger on a rail over a lit backdrop with a blurred floor shadow; the fabric has side shading, chest highlight, drape folds, knit texture, armhole seams, and hem/sleeve stitching.
- **Living details:** the garment sways gently on its hanger, a light sheen sweeps the fabric, colour changes crossfade, and when a design first lands a **gold stitch runs around it with sparkles** — plus a drag-lift effect while positioning and a fabric chip (e.g. "Oxford Cotton") anchoring the material choice.
- **Shape-aware silhouettes:** polos get collars and plackets; shirts/kurtas/jackets get pointed collars, buttons and a pocket; hoodies get a real hood, drawstrings, kangaroo pocket and ribbed hem; dresses flare A-line with a waist seam; pants show waistband, fly and pockets; **sarees render as a true drape** — pleats and a gold zari border folded over the hanger.
- **Order-line selector as product tiles:** a "Preview a garment" grid of icon-on-colour-swatch cards (auto light/dark icon contrast, check on the selected tile) — visually distinct from the placement pills below, wrapping instead of horizontal scrolling.
- **Placement options per garment family:** tops keep chest/sleeve/back; pants offer thigh, hip/pocket and back pocket; hoodies offer hood (back); dresses offer hem border; sarees are free-drag only.

## 6. Garment catalog — styles, fits and sets

- **Every category now has style/fit options.** Bottoms gained modern fits (Slim / Straight / Regular / Relaxed / Skinny / **Baggy-wide leg / Korean fit**), trousers add Formal/Pleated; and previously-empty categories are covered: sarees, salwar suits, churidar sets, kurta sets, ethnic wear (boys & girls separately), lehenga/skirt sets, gowns, frocks, dresses, tops, night suits, rompers, co-ords, uniforms, lab coats, safety jackets, aprons. Jackets got their own set (Bomber/Denim/Windcheater/Varsity) instead of borrowing blazer options.
- **Set garments are explicit:** cards state "3-piece set" or "top only" up front; opening one shows *"Full set includes: Kurta · Salwar · Dupatta"* (or *"Top only — bottom & dupatta not included"* for kurtis).
- **Per-piece colours for sets:** each included piece (salwar, dupatta, pyjama, bottom…) gets its own swatch row with a "Match kurta" default — and the choices flow into Review and Track ("Navy Blue · Salwar: White · Dupatta: Gold").
- **Minimalist card redesign:** selected garments glow gold instead of heavy black, captions shortened to "From ₹190/pc", lighter colour rows, gold totals chip, and tiny thumbnails no longer cram placeholder text.

## 7. Organisation flow — matching design pass (blue identity)

- Garment pick-list rows light up **blue** (soft wash, border, shadow) when added; configure cards drop the heavy black frame for soft shadows with a blue highlight on the open card; "Add more" is a dashed blue pill; captions shortened.

## 8. Removing things is now always possible (bug fixes)

- **Unselect a garment anywhere:** from the garment list header (added cards have an ×), from each Material card, from each Sizes card, and — for organisations — the previously-dead "Added" pill is now tap-to-remove. All removals use a **two-tap "Remove?" confirm** that auto-resets, so a stray touch never deletes anything.
- **Review overlap fixed:** long garment lines ("Men · Polo T-Shirts · Classic collar · Navy Blue × 2") now wrap instead of colliding with the per-piece price.
- Copy diet across the flow: garment-step intro, tip banners and hints reduced to single readable lines.

## Notes on the 1 July assessment

- *"Garment previews are placeholder-level"* — partially addressed: the live mockup is now an illustrated studio scene with per-family silhouettes and real-time colour/design compositing; real product photography remains the next step (the photo-folder system is in place).
- Backend items (real payment gateway, server-side identity, coordinator tooling) remain open as before.

---

*Version 1.1 built 2–3 July 2026 by Haneef M. with AI-assisted iterative development. Sections above this entry describe the 1 July 2026 build.*
