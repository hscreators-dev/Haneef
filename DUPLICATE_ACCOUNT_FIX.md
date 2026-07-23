# Fixing the "same number makes a duplicate account" problem

This note explains what was happening, what I changed in the code, and the exact
steps to make it stop — including a one-time clean-up of the duplicate accounts
already in your database.

---

## What was actually wrong

Your login code was **already correct**. When someone signs in, the app always
sends just the 10-digit number (it strips the `+91` first), and the backend turns
every format of a number — `+91 63803 39944`, `6380339944`, `+916380339944` — into
one single `+91XXXXXXXXXX` account. So two devices with the same number are *meant*
to land on the same account.

**Confirmed root cause (from your Customer Log):** the number was being saved in
two different styles — once as `+919944005331` (no spaces) and once as
`+91 99440 05331` (with spaces) — so they became two separate accounts. This
happened because when a customer finishes onboarding / edits their profile, the
app sent the *pretty display* version of the number (with spaces) and the backend
saved it exactly as sent. That overwrote the clean number the login had stored, so
the next login (which uses the plain digits) no longer matched it and created a
second account. Same number, two styles, two accounts.

Two more things could each make it worse:

- **A fake "Guest" account fallback.** The app had a developer shortcut that, on a
  hiccup reaching the backend (Render's free tier sleeps after 15 minutes),
  silently created a temporary fake account *on the device*. It never reached the
  database but looked like a duplicate.
- **Old duplicate accounts already saved** from earlier, which don't clean
  themselves up.

---

## What I changed in the code

Five files, all defensive so this can't come back:

- **`backend/src/models/User.ts`** *(the real fix)* — every phone number is now
  forced into **one single style, `+91XXXXXXXXXX` (no spaces)**, automatically,
  the moment it's saved — no matter which part of the code writes it. This is the
  change that makes it impossible for the same number to exist in two styles.

- **`backend/src/routes/account.ts`** — the profile-update endpoint (the exact spot
  that was saving the spaced number) now cleans the number to the canonical style
  before saving, instead of trusting whatever the app sent.

- **`src/lib/api.ts`** — the fake "Guest" fallback is now **only ever possible on a
  local dev machine** (`localhost`). On any real website it can never fabricate a
  fake account again — a hiccup now shows a normal error instead of a phantom login.
  The old `VITE_DEV_OTP` shortcut that could re-enable it by mistake was removed.

- **`backend/src/routes/auth.ts`** — when someone logs in, if any leftover duplicate
  records for their number still exist, the backend now **folds them together on the
  spot**: it moves their orders, quotes, support tickets and login history onto the
  one surviving account, deletes the extras, and fixes the number format — safely,
  without ever crashing the login.

- **`backend/src/index.ts`** — the backend can now accept **more than one website
  address** for the app (set `FRONTEND_URL` to a comma-separated list). This stops a
  second URL from being blocked and falling back to a phantom account.

---

## Step 1 — Deploy the updated code

1. Commit and push these changes to your repo (the same repo Render builds from):
   ```
   git add -A
   git commit -m "Stop duplicate accounts: prod-safe login, self-healing merge, multi-origin CORS"
   git push
   ```
   (Or use your existing `push-to-live.command`.)
2. In the **Render dashboard**, confirm **both** services redeploy from the new
   commit:
   - `garm-app-backend` (the backend)
   - `garm-shop` (the website)
   If they don't auto-deploy, click **Manual Deploy → Deploy latest commit** on each.

## Step 2 — Check the environment variables (Render dashboard)

On **`garm-app-backend` → Environment**:

- `MONGODB_URI` — your MongoDB Atlas string (must be the one with your real data).
- `FRONTEND_URL` — your live website address, e.g. `https://garm-shop.onrender.com`.
  If you use more than one address, separate them with commas and **no spaces**,
  e.g. `https://garm-shop.onrender.com,https://yourcustomdomain.com`.

On **`garm-shop` → Environment**:

- `VITE_API_URL` — `https://garm-app-backend.onrender.com/api`
- **Remove `VITE_DEV_OTP` if it exists** (it should not be set to `true` in
  production). The code no longer honours it, but delete it to avoid confusion.

After changing any variable on `garm-shop`, redeploy it (env changes need a rebuild).

## Step 3 — Refresh the iPhone

If you added Garm to your iPhone home screen earlier, it may be running an old
cached copy:

1. Delete the Garm icon from the home screen.
2. In Safari, open the Garm link fresh, then (optionally) re-add it to the home
   screen from there.

## Step 4 — Merge the duplicate accounts already in the database

This one-time script finds accounts that are the same person and merges them into
one, keeping all their orders and history.

1. Take a backup/snapshot of your database in **MongoDB Atlas** first (safety net).
2. On your computer, open a terminal in the **backend** folder:
   ```
   cd "Latest version of FAB/backend"
   ```
3. **Dry run first** (this changes nothing — it just shows what it would do). Paste
   your MongoDB connection string in place of the `<...>`:
   ```
   MONGODB_URI="<your MongoDB Atlas string>" node scripts/merge-duplicate-users.mjs
   ```
   Read the report. It lists each number/email that has duplicates, which account it
   would keep, and what it would move.
4. When you're happy with the report, run it **for real** by adding `--apply`:
   ```
   MONGODB_URI="<your MongoDB Atlas string>" node scripts/merge-duplicate-users.mjs --apply
   ```

The script keeps the account that finished onboarding (or the oldest one), moves
everything onto it, fixes the number to `+91…` form, and deletes the empty extras.

---

## How to confirm it's fixed

1. Sign in with your number on your **iPhone** → note your name/orders.
2. Sign in with the **same number** on the **website** → you should see the **same**
   account and the same data, not a fresh empty one.
3. In the **Garm Admin Portal**, the customer list should show that number **once**,
   not twice.

If a brand-new empty account still appears after all four steps, the most likely
remaining cause is that the website's `VITE_API_URL` is pointing at a different
backend/database than the iPhone — double-check they match in Step 2.
