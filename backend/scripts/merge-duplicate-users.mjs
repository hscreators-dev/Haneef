#!/usr/bin/env node
/**
 * merge-duplicate-users.mjs — one-time clean-up for the Garm customer database.
 * ---------------------------------------------------------------------------
 * Finds customer accounts that are really the SAME person (same phone number,
 * or same email) but exist as two or more separate records from before the
 * login code normalised phone formats. It keeps ONE surviving account per
 * person, moves that person's orders / quotes / support tickets / login events
 * onto the survivor, heals the phone into the canonical "+91XXXXXXXXXX" form,
 * and deletes the leftover husks.
 *
 * SAFE BY DEFAULT: running it with no flags is a DRY RUN — it only prints what
 * it *would* do and changes nothing. Add --apply to actually perform the merge.
 *
 *   # 1. see what would happen (safe, read-only):
 *   MONGODB_URI="<your atlas string>" node scripts/merge-duplicate-users.mjs
 *
 *   # 2. actually do it (after you're happy with the dry-run report):
 *   MONGODB_URI="<your atlas string>" node scripts/merge-duplicate-users.mjs --apply
 *
 * The MongoDB connection string is the SAME one your backend uses (Render →
 * garm-app-backend → Environment → MONGODB_URI). Take a backup / snapshot in
 * MongoDB Atlas before running with --apply.
 *
 * Requires the `mongoose` package, which the backend already depends on, so run
 * this from inside the backend/ folder (where node_modules lives).
 */

import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const URI = process.env.MONGODB_URI;

// Last-10-digits key: "+916380339944", "916380339944" and "6380339944" all
// collapse to the same key, so any format of the same number groups together.
const phoneKey = (p) => {
  const d = String(p || "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
};
const emailKey = (e) => String(e || "").trim().toLowerCase();
const canonPhone = (p) => {
  const k = phoneKey(p);
  return k ? `+91${k}` : String(p || "");
};

// Pick the record everyone else folds into. Best = already onboarded, then has
// a real name, then the oldest (first created) so we keep the original account.
export function pickSurvivor(list) {
  return [...list].sort((a, b) => {
    const ao = a.onboardingComplete ? 1 : 0, bo = b.onboardingComplete ? 1 : 0;
    if (ao !== bo) return bo - ao;
    const an = (a.name || "").trim() ? 1 : 0, bn = (b.name || "").trim() ? 1 : 0;
    if (an !== bn) return bn - an;
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  })[0];
}

// PURE planning step — no database access. Given all user records, decide which
// accounts merge into which, and what each survivor's healed value should be.
// Kept side-effect-free so it can be unit-tested without a live MongoDB.
export function computeMergePlan(allUsers) {
  const groups = new Map();
  for (const u of allUsers) {
    const key = u.phone ? `phone:${phoneKey(u.phone)}` : (u.email ? `email:${emailKey(u.email)}` : "");
    if (!key || key === "phone:" || key === "email:") continue; // skip malformed
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(u);
  }
  const plan = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue; // only groups with real duplicates
    const isPhone = key.startsWith("phone:");
    const survivor = pickSurvivor(list);
    const losers = list.filter((u) => String(u._id) !== String(survivor._id));
    const canonVal = isPhone ? canonPhone(survivor.phone) : emailKey(survivor.email);
    plan.push({ key, isPhone, survivor, losers, canonVal });
  }
  return plan;
}

async function main() {
  if (!URI) {
    console.error("✖ MONGODB_URI is not set. Run like:\n" +
      '  MONGODB_URI="mongodb+srv://…" node scripts/merge-duplicate-users.mjs [--apply]');
    process.exit(1);
  }
  await mongoose.connect(URI);
  const db = mongoose.connection.db;
  console.log(`\n✅ Connected to ${mongoose.connection.host} / db "${db.databaseName}"`);
  console.log(APPLY
    ? "⚠️  APPLY mode — changes WILL be written.\n"
    : "🔍 DRY RUN — nothing will be changed. Add --apply to perform the merge.\n");

  const users        = db.collection("users");
  const childColls   = ["orders", "quotes", "supporttickets", "loginevents"];

  const all = await users.find({}).toArray();
  console.log(`Scanned ${all.length} user records.\n`);

  // Decide the whole merge up-front (pure, no DB writes) — see computeMergePlan.
  const plan = computeMergePlan(all);

  if (plan.length === 0) {
    console.log("🎉 No duplicate accounts found. Nothing to merge.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${plan.length} identit${plan.length === 1 ? "y" : "ies"} with duplicates:\n`);

  let totalDeleted = 0, totalMoved = 0;

  for (const { key, isPhone, survivor, losers, canonVal } of plan) {
    console.log(`● ${key}  →  ${losers.length + 1} records`);
    console.log(`   keep    : ${survivor._id}  name="${survivor.name || ""}"  onboarded=${!!survivor.onboardingComplete}  ${isPhone ? survivor.phone : survivor.email}`);

    for (const loser of losers) {
      // Count / move child documents from loser → survivor.
      const counts = {};
      for (const c of childColls) {
        const coll = db.collection(c);
        const n = await coll.countDocuments({ userId: loser._id });
        counts[c] = n;
        totalMoved += n;
        if (APPLY && n > 0) {
          await coll.updateMany({ userId: loser._id }, { $set: { userId: survivor._id } });
        }
      }
      const moved = Object.entries(counts).filter(([, n]) => n > 0)
        .map(([c, n]) => `${n} ${c}`).join(", ") || "no child docs";
      console.log(`   ${APPLY ? "merged" : "would merge"} : ${loser._id}  name="${loser.name || ""}"  (${moved})`);

      // Carry a profile the survivor is missing so we never lose a name/onboarding.
      const patch = {};
      if (!(survivor.name || "").trim() && (loser.name || "").trim()) { patch.name = loser.name; survivor.name = loser.name; }
      if (!survivor.onboardingComplete && loser.onboardingComplete) { patch.onboardingComplete = true; survivor.onboardingComplete = true; }
      if (isPhone) { if (!survivor.accountType && loser.accountType) { patch.accountType = loser.accountType; } }
      if (APPLY && Object.keys(patch).length) {
        await users.updateOne({ _id: survivor._id }, { $set: patch });
      }

      if (APPLY) await users.deleteOne({ _id: loser._id });
      totalDeleted++;
    }

    // Heal the survivor's identity into canonical form.
    if (isPhone && survivor.phone !== canonVal) {
      console.log(`   ${APPLY ? "healed" : "would heal"} : phone ${survivor.phone} → ${canonVal}`);
      if (APPLY) await users.updateOne({ _id: survivor._id }, { $set: { phone: canonVal } });
    } else if (!isPhone && survivor.email !== canonVal) {
      console.log(`   ${APPLY ? "healed" : "would heal"} : email ${survivor.email} → ${canonVal}`);
      if (APPLY) await users.updateOne({ _id: survivor._id }, { $set: { email: canonVal } });
    }
    console.log("");
  }

  console.log("──────────────────────────────────────────────");
  console.log(`${APPLY ? "Deleted" : "Would delete"} ${totalDeleted} duplicate account(s).`);
  console.log(`${APPLY ? "Moved" : "Would move"} ${totalMoved} child document(s) onto survivors.`);
  if (!APPLY) console.log("\n➡  Re-run with --apply to perform these changes (take an Atlas backup first).");
  else console.log("\n✅ Merge complete.");

  await mongoose.disconnect();
}

// Only run when executed directly (node scripts/merge-duplicate-users.mjs),
// NOT when imported by a test that just wants the pure helpers above.
const invokedDirectly = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  main().catch(async (err) => {
    console.error("\n✖ Error:", err.message);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  });
}
