import { useEffect, useState } from "react";
import { catalog, type Category, type Product } from "./api";

export interface ExtraAccessoryCategory { id: string; emoji: string; label: string; sub: string; items: string[] }

/**
 * Lets the Garm Admin Portal control which of the app's existing garment/
 * accessory categories and products are currently orderable — without
 * replacing the app's own rich catalog (photo galleries, spec fields, fabric
 * options). An admin deactivating a product (or removing a category) in the
 * admin's Catalog page hides it here; everything else stays exactly as
 * hand-built. Matching is by name, case-insensitive.
 *
 * It also surfaces `extraAccessoryCategories`: brand-new categories created
 * in the admin portal that have no matching hardcoded counterpart in this
 * app. Pass `knownLabels` (the labels this screen already renders) so those
 * aren't duplicated, and `audience` ("B2C" for individual, "B2B" for
 * organisation) so a category only shows where the admin marked it for.
 * These render as simple accessory-style categories (name + product list) —
 * this covers the accessories flows only; the deep garment configurator
 * (fabric/GSM/photo galleries) is unaffected and keeps using the hand-built
 * catalog with availability toggling only.
 *
 * Fails open: until the admin data has loaded (or if the request fails —
 * e.g. offline, backend not running), nothing is hidden and no extras show.
 */
// ─── Module-level cache of the admin's products ──────────────────────────────
// Some of the order flow's option lists (garment styles, fabric/GSM/weave,
// colour palette) are computed by PURE functions that can't call hooks. This
// cache — filled the moment any screen using useCatalogAvailability loads —
// lets those pure helpers consult the admin's per-product lists too, with the
// exact same fails-open contract: null/empty ⇒ caller uses its built-in list.
let adminProductsCache: Product[] | null = null;

function optionPriceCount(p: Product): number {
  const op = p.optionPrices;
  if (!op) return 0;
  return Object.keys(op.style || {}).length + Object.keys(op.fabric || {}).length
    + Object.keys(op.gsm || {}).length + Object.keys(op.weave || {}).length;
}

function cachedGarment(name: string, audience?: "B2C" | "B2B"): Product | null {
  if (!adminProductsCache) return null;
  const n = name.trim().toLowerCase();
  const matches = adminProductsCache.filter((p) => p.name.trim().toLowerCase() === n
    && p.status === "ACTIVE"
    && (p.productType ?? "GARMENT") === "GARMENT"
    && (!audience || p.appliesTo?.includes(audience)));
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  // A stray DUPLICATE product with the same name must not shadow the one the
  // admin actually configured — prefer the record that has option prices set
  // (then the most option data). This keeps prices working even before the
  // backend de-dupes the catalog.
  return [...matches].sort((a, b) =>
    (optionPriceCount(b) - optionPriceCount(a))
    || (((b.fabricOptions?.length || 0) + (b.gsmOptions?.length || 0) + (b.weaveOptions?.length || 0) + (b.styles?.length || 0))
      - ((a.fabricOptions?.length || 0) + (a.gsmOptions?.length || 0) + (a.weaveOptions?.length || 0) + (a.styles?.length || 0)))
  )[0];
}

/** Admin Style list for a garment — null ⇒ use the app's built-in list. */
export function adminStylesFor(name: string, audience?: "B2C" | "B2B"): string[] | null {
  const p = cachedGarment(name, audience);
  return p?.styles && p.styles.length > 0 ? p.styles : null;
}

/** Admin material lists — each list null ⇒ use the app's built-in one. */
export function adminMaterialsFor(name: string, audience?: "B2C" | "B2B"): {
  fabricOptions: string[] | null; gsmOptions: string[] | null; weaveOptions: string[] | null;
} {
  const p = cachedGarment(name, audience);
  return {
    fabricOptions: p?.fabricOptions && p.fabricOptions.length > 0 ? p.fabricOptions : null,
    gsmOptions: p?.gsmOptions && p.gsmOptions.length > 0 ? p.gsmOptions : null,
    weaveOptions: p?.weaveOptions && p.weaveOptions.length > 0 ? p.weaveOptions : null,
  };
}

/**
 * Admin-priced garment total = base price + the ₹ deltas the admin set for the
 * chosen fabric / GSM / weave / style. Returns null when the admin hasn't
 * configured option prices (or no base) for this product, so the caller falls
 * back to its built-in multiplier pricing. This is what makes each fabric / GSM
 * / weave / style individually priceable from the admin Catalog.
 */
export function adminGarmentPrice(
  name: string,
  sel: { fabric?: string; gsm?: string; weave?: string; style?: string },
  audience?: "B2C" | "B2B",
): number | null {
  const p = cachedGarment(name, audience);
  if (!p || !p.price) return null;
  const op = p.optionPrices;
  const nKeys = (m?: Record<string, number>) => (m ? Object.keys(m).length : 0);
  const hasDeltas = !!op && (nKeys(op.fabric) + nKeys(op.gsm) + nKeys(op.weave) + nKeys(op.style)) > 0;
  if (!hasDeltas) return null; // admin hasn't priced options — use built-in pricing
  const d = (m?: Record<string, number>, k?: string) => (m && k && m[k]) ? m[k] : 0;
  const total = p.price + d(op!.fabric, sel.fabric) + d(op!.gsm, sel.gsm) + d(op!.weave, sel.weave) + d(op!.style, sel.style);
  return Math.max(1, Math.round(total));
}

/**
 * The admin's ₹ delta for ONE option within ONE dimension (fabric / GSM / weave /
 * style) of a product — i.e. the exact amount the Catalog says that choice adds
 * to the base price. Returns null when the admin hasn't priced this dimension for
 * this product, so the caller falls back to its built-in per-option labels.
 * This lets each dropdown in the app show the SAME per-option price the admin set
 * (e.g. Weave · Twill +₹20, Jersey +₹30), instead of a built-in guess.
 */
export function adminOptionDelta(
  name: string,
  dim: "fabric" | "gsm" | "weave" | "style",
  option: string,
  audience?: "B2C" | "B2B",
): number | null {
  const p = cachedGarment(name, audience);
  const m = p?.optionPrices?.[dim];
  if (!m || Object.keys(m).length === 0) return null; // dimension not priced by admin
  return m[option] ?? 0;
}

/** The admin base price for a product (null ⇒ not admin-priced) — the ₹ the
 * per-option deltas are added on top of, so the app can show an itemised breakdown. */
export function adminBasePrice(name: string, audience?: "B2C" | "B2B"): number | null {
  const p = cachedGarment(name, audience);
  return p?.price && p.price > 0 && p.optionPrices ? p.price : null;
}

/** Admin colour palette for a garment — null ⇒ use the app's built-in palette. */
export function adminPaletteFor(name: string, audience?: "B2C" | "B2B"): { label: string; hex: string }[] | null {
  const p = cachedGarment(name, audience);
  const colors = (p?.colors ?? []).filter((c) => c.label && /^#[0-9a-fA-F]{3,8}$/.test(c.hex));
  return colors.length > 0 ? colors : null;
}

export function useCatalogAvailability(opts?: { knownLabels?: string[]; audience?: "B2C" | "B2B" }) {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      catalog.categories().then((d) => { if (alive) setCategories(d.categories); }).catch(() => {});
      catalog.products().then((d) => {
        adminProductsCache = d.products; // feed the pure helpers above
        if (alive) setProducts(d.products);
      }).catch(() => {});
    };
    load();
    // Live refresh: admin catalog edits (new category/product, stock, colours,
    // spec fields) show up without the customer reloading the app. 45s is a
    // gentle interval; the fetch fails open so a blip never breaks the flow.
    const t = setInterval(load, 45000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const categoryNames = categories ? new Set(categories.map((c) => c.name.trim().toLowerCase())) : null;
  const inactiveProductNames = products
    ? new Set(products.filter((p) => p.status !== "ACTIVE").map((p) => p.name.trim().toLowerCase()))
    : null;
  // Out-of-stock products stay VISIBLE but greyed out and not orderable —
  // toggled live from the admin portal's Catalog page (stock switch).
  const outOfStockNames = products
    ? new Set(products.filter((p) => p.inStock === false).map((p) => p.name.trim().toLowerCase()))
    : null;

  function isCategoryActive(label: string): boolean {
    if (!categoryNames) return true;
    return categoryNames.has(label.trim().toLowerCase());
  }
  function isItemActive(name: string): boolean {
    if (!inactiveProductNames) return true;
    return !inactiveProductNames.has(name.trim().toLowerCase());
  }
  function isItemInStock(name: string): boolean {
    if (!outOfStockNames) return true; // fails open until admin data loads
    return !outOfStockNames.has(name.trim().toLowerCase());
  }

  // NEW products the admin added inside an EXISTING category (e.g. "Towel"
  // under Men's Wear, or a new mug under Bottles & Mugs) — they don't exist in
  // the app's hand-built lists, so surface them into that category directly.
  function extraItemsForCategory(categoryLabel: string, knownItems: string[], type?: "GARMENT" | "ACCESSORY"): { name: string; price: number }[] {
    if (!categories || !products) return [];
    const cat = categories.find((c) =>
      c.name.trim().toLowerCase() === categoryLabel.trim().toLowerCase() &&
      (!opts?.audience || c.appliesTo?.includes(opts.audience)));
    if (!cat) return [];
    const known = new Set(knownItems.map((n) => n.trim().toLowerCase()));
    return products
      .filter((p) => p.categoryId === cat.id && p.status === "ACTIVE"
        && (!type || (p.productType ?? "GARMENT") === type)
        && (!opts?.audience || p.appliesTo?.includes(opts.audience!))
        && !known.has(p.name.trim().toLowerCase()))
      .map((p) => ({ name: p.name, price: p.price || 0 }));
  }

  // Full admin record for a product (colours, admin spec fields, price) —
  // lets the order flow show admin-managed colour choices and spec dropdowns.
  function productMeta(name: string): Product | null {
    if (!products) return null;
    return products.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()
      && p.status === "ACTIVE"
      && (!opts?.audience || p.appliesTo?.includes(opts.audience!))) ?? null;
  }

  // The app's three built-in garment categories already power the garment
  // configurator above — never surface them again in the accessories list
  // (that once duplicated the whole wardrobe). Matched by name so it doesn't
  // matter what product types they contain.
  const GARMENT_CATEGORY_LABELS = new Set(["men's wear", "women's wear", "kids wear"]);
  const knownSet = new Set((opts?.knownLabels ?? []).map((l) => l.trim().toLowerCase()));
  const extraAccessoryCategories: ExtraAccessoryCategory[] =
    categories && products
      ? categories
          .filter((c) => !knownSet.has(c.name.trim().toLowerCase()))
          .filter((c) => !GARMENT_CATEGORY_LABELS.has(c.name.trim().toLowerCase()))
          .filter((c) => !opts?.audience || c.appliesTo?.includes(opts.audience))
          .map((c) => ({
            id: `admin_${c.id}`,
            emoji: "sparkle",
            label: c.name,
            sub: "Added by Garm admin",
            // Any active product the admin filed under this NEW category shows
            // here — regardless of its product type. (A brand-new admin category
            // like "Caps" or "Corporate Gifts" isn't part of the app's garment
            // configurator, so its products are orderable as simple items here.)
            items: products
              .filter((p) => p.categoryId === c.id && p.status === "ACTIVE" && (!opts?.audience || p.appliesTo?.includes(opts.audience!)))
              .map((p) => p.name),
          }))
          .filter((c) => c.items.length > 0)
      : [];

  return { isCategoryActive, isItemActive, isItemInStock, extraAccessoryCategories, extraItemsForCategory, productMeta };
}
