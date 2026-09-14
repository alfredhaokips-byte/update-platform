# Marketplace — Landing Page + Trust System

Static HTML/CSS/vanilla JS site, backed by Supabase (Postgres + Auth + Storage).
No build step, no framework — open any `.html` file's script tags to see
exactly what's happening.

## 1. Set up Supabase

1. [supabase.com](https://supabase.com) → sign up → **New project**.
2. Once it's provisioned: **SQL Editor** → New query → paste the entire contents
   of `supabase/schema.sql` → **Run**. This creates every table, the
   `tag_stats` view, the vote/RLS logic, and seeds the localities list.
3. Same again with `supabase/storage-policies.sql` — creates the
   `listing-photos` bucket (public read, uploads locked to the owner) that
   real listing photos get uploaded to.
4. Same again with `supabase/trust-verification.sql` — adds verification
   columns to `profiles`, the transaction-gated review policy, the
   deals-count trigger, and the `seller_response_stats` view.
5. **Settings → API** → copy the **Project URL** and the **`anon` `public`**
   key (not `service_role`).
6. Paste them into `js/supabase-client.js`:
   ```js
   const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "ey...";
   ```

That's it — no other config. The `anon` key is meant to be public; access
control is enforced by the Row Level Security policies in `schema.sql` and
`storage-policies.sql`, not by hiding that key.

## 2. Run it locally

Any static file server works, e.g.:
```
python3 -m http.server 8934
```
then open `http://localhost:8934`. Sign up for an account (email/password —
Supabase sends a confirmation email by default; you can turn that off under
**Authentication → Providers → Email → Confirm email** while testing) and
start posting listings.

## 3. Deploy (Vercel)

1. Push this folder to a GitHub repo.
2. [vercel.com](https://vercel.com) → **New Project** → import the repo.
   No build command, no output directory override needed — it's static HTML.
3. Deploy. Then in the project dashboard: **Analytics** tab → enable **Web
   Analytics** (free tier, no cookie banner needed — the script is already
   wired up in `js/common.js`).

Two people, two devices, two accounts, real shared listings — that's Phase 0 done.

## Phase 0.5 — real photos, real Nearby

Two things Phase 0 faked are now real:

- **Photos.** `post-ad.html` has a real file picker (up to 5, JPG/PNG/WebP,
  5MB max each, live thumbnail previews, a remove button per photo). On
  publish, each file uploads to the `listing-photos` Storage bucket under
  `{user_id}/{listing_id}/{filename}` with a step-by-step progress indicator,
  and the resulting public URLs are saved to the listing. A different signed-in
  user cannot overwrite or delete your photos — enforced by
  `storage-policies.sql`'s RLS, not just hidden by the UI.
- **Nearby.** Signup already asked for a locality; that now actually drives
  the Home feed. The location row is a real picker (`js/data.js`'s
  `Store.setLocality`) that saves to your profile and refreshes results
  immediately. "Nearby" = listings sharing your city (the `localities` table's
  `city` column *is* the "broader area" grouping the brief asked for — Six Mile
  and Zoo Road are both `Guwahati, Assam`, so no separate mapping table was
  needed). Signed-out visitors, or signed-in users who haven't picked a
  locality yet, default to **All India** rather than being blocked by a
  location prompt.

## Landing page + trust system

`index.html` now branches on auth state: signed-out visitors get a real
marketing landing page (hero, trust strip, how-it-works, real trending
listings, real top sellers, value props, footer); signed-in users get the
existing feed. Six things were built here:

1. **Landing page** — pulls real listings/sellers from the DB, no placeholder content.
2. **Trust Profile** (extends `profile.html`) — verification badges, deals
   (now auto-incremented by a DB trigger on each new review, not manual),
   response rate (derived from real message history via
   `seller_response_stats`), account age. "Completion rate" and
   "cancellation count" from the brief are shown as **"Not tracked yet"**
   rather than faked — this app has no order/transaction lifecycle to derive
   them from honestly.
3. **Progressive verification** — posting a listing requires a confirmed
   email; listings over ₹10,000 require selfie verification
   (`SELFIE_VERIFICATION_PRICE_THRESHOLD` in `js/data.js`). One deviation
   from the brief: it names "phone verified" as the gate for posting at all,
   but real phone OTP was explicitly deferred in Phase 0 (no SMS provider
   wired up) — gating on it would make posting permanently impossible for
   everyone. Email confirmation is the real, working equivalent, so that's
   what's enforced instead. `verify.html` is the verification hub — email
   status is real, phone number can be saved (not yet OTP-verified, clearly
   labeled), selfie is a "coming soon" placeholder (real liveness detection
   is its own dedicated phase, not built here).
4. **Trust signals on listings** — the seller card on `listing.html` now
   shows response rate and verification badges, plus a "Listing confidence"
   checklist (real photos / condition disclosed / description complete /
   seller verified).
5. **Transaction-gated reviews** — you can only review a seller you've
   actually messaged. Enforced twice: the UI hides "Write a review" unless
   `Store.canReview()` confirms a thread exists, *and* the RLS insert policy
   on `reviews` independently checks for that same thread — a direct API
   call can't bypass it.
6. **Reporting on chat threads** — a ⋯ button in each conversation now
   reports that thread (listings and profiles already had this from an
   earlier phase).

## Bug fixes (found during this pass)

The brief flagged two exact bug patterns as having broken the project before.
Auditing against them found **one real, live-breaking bug**: `Store.addListing()`
never set `seller_id` on insert, which would fail Row Level Security on every
single listing post against a real database. Fixed, along with three bare
`profiles(*)` embeds (in `getListings`, `getListingById`, `getQA`) that were
unambiguous today but fragile — all six profile embeds in `js/data.js` now
explicitly name their foreign key.

## What's NOT built yet

Per the phased briefs, everything below is intentionally deferred:

- Real selfie/liveness capture (the verification *gate* exists; the camera +
  liveness-check UI itself doesn't)
- AI chat-safety scam-pattern warnings
- AI risk scoring on signup/listing
- AI photo → listing assistant (category/condition/price suggestions)
- A synthesized Trust Score (the brief asked to hold this until the
  above foundation is confirmed working)

Also out of scope for now (flagged for awareness):
- Phone OTP auth/verification (Phase 0 ships email/password only; phone
  numbers can be saved on `verify.html` but nothing verifies them yet)
- Image compression/resizing before upload
- True GPS distance-based "X km away" sorting — Nearby is locality/city-based
- Realtime chat — messages send/receive correctly but don't push live; you see
  a reply on next page load/refresh, not instantly
- Editing/deleting your own listings after posting
- Order/transaction lifecycle (accept/complete/cancel) — nothing tracks this,
  so "completion rate" and "cancellations" on the Trust Profile are honestly
  labeled "Not tracked yet" instead of showing fabricated numbers

## What changed from the old prototype

- `js/data.js`'s `Store` object now talks to Supabase instead of
  `localStorage` — every data method is `async` now.
- The fake "seller auto-reply" simulation in chat has been **removed**. It
  made sense in a single-browser demo; it would be actively misleading in a
  real product with real other users.
- `login.html` / `signup.html` are new. Anonymous visitors can still browse
  everything read-only; saving, chatting, posting, reviewing, and reporting
  all redirect to `login.html` (returning to where you were after signing in).
