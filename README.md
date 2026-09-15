# Marketplace — Landing Page + Trust System + Email Notifications

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
5. Same again with `supabase/vouches.sql` — the lightweight "I vouch for this
   seller" endorsement table (separate from reviews, which require a real
   message thread first).
6. Same again with `supabase/design-system.sql` — adds the optional,
   cosmetic `profiles.avatar_type` column for the character avatar picker.
7. Same again with `supabase/pan-india.sql` — adds `state`/`lat`/`lng` to
   `profiles` and `listings`, and drops the old Delhi-NCR-only default on
   `city` now that location comes from Google Places (see §4 below).
8. Same again with `supabase/newsletter.sql` — the `newsletter_subscribers`
   table (publicly writable, not readable back — collection only, see
   "Newsletter signup" below).
9. Same again with `supabase/community.sql` — the Community forum (General
   discussion, Feedback with vouching + status, Notice Board), and adds
   `profiles.is_admin`. **After running it**, make yourself an admin (needed
   to post to the Notice Board and set Feedback status chips) — SQL Editor:
   ```sql
   update profiles set is_admin = true where id = (select id from auth.users where email = 'you@example.com');
   ```
10. Same again with `supabase/profile-photos.sql` — the `profile-photos`
    Storage bucket (same ownership pattern as `listing-photos`) plus
    `profiles.avatar_url`/`status_text` for the profile photo + bio (Edit
    profile, from Account).
11. **Settings → API** → copy the **Project URL** and the **`anon` `public`**
    key (not `service_role`).
12. Paste them into `js/supabase-client.js`:
   ```js
   const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "ey...";
   ```

That's it — no other config. The `anon` key is meant to be public; access
control is enforced by the Row Level Security policies in `schema.sql` and
`storage-policies.sql`, not by hiding that key.

## 2. Set up Google Maps (Places Autocomplete)

Locality fields (signup, post-ad, the home page's location picker) use
Google Places Autocomplete, restricted to India — this is what makes "Nearby"
work correctly for any city, not just Delhi NCR.

1. [console.cloud.google.com](https://console.cloud.google.com) → create a
   project (or use an existing one).
2. **Billing** → attach a billing account. This is required for the Places
   API to respond at all — usage for a project this size stays within
   Google's free monthly Places credit, but Google won't serve any calls
   without a billing account on file, free tier or not.
3. **APIs & Services → Library** → search **Places API** → **Enable**.
4. **APIs & Services → Credentials** → **Create credentials → API key**.
5. Click the new key → **Application restrictions → HTTP referrers** → add
   your domain(s) (e.g. `https://your-app.vercel.app/*`) and
   `http://localhost:*` while developing. This referrer restriction — not
   secrecy — is what makes it safe to ship this key client-side, the same
   way Supabase's `anon` key relies on RLS rather than being hidden.
6. Paste the key into `js/maps-client.js`:
   ```js
   const GOOGLE_MAPS_API_KEY = "AIza...";
   ```

**Not set up yet?** The app still works — every locality field falls back to
a plain text input (no autocomplete suggestions, and whatever's typed is used
as both the locality and the city verbatim) with an inline note explaining
why. Nothing is blocked on this being configured.

## 3. Run it locally

Any static file server works, e.g.:
```
python3 -m http.server 8934
```
then open `http://localhost:8934`. Sign up for an account (email/password —
Supabase sends a confirmation email by default; you can turn that off under
**Authentication → Providers → Email → Confirm email** while testing) and
start posting listings.

## 4. Deploy (Vercel)

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

## Email notifications on new messages

Each user gets emailed when they receive a new chat message — not just an
in-app dot. Setup, one time:

1. **Sign up at [resend.com](https://resend.com)** (free tier is plenty to
   start) → **API Keys** → create one → copy it.
2. **Install & link the Supabase CLI** (already installed via Homebrew here):
   ```
   supabase login
   supabase link --project-ref ecdsteardeybzfnnidym
   ```
   `login` opens a browser to authorize — has to be you, not something I can
   do on your behalf.
3. **Set the Resend key as a function secret** (never goes in client code):
   ```
   supabase secrets set RESEND_API_KEY=re_your_key_here
   ```
4. **Deploy the function**:
   ```
   supabase functions deploy notify-new-message
   ```
5. **Wire it up to new messages** — Supabase Dashboard → **Database →
   Webhooks** → **Create a new webhook**:
   - Table: `messages`
   - Events: `INSERT`
   - Type: **Supabase Edge Function**
   - Function: `notify-new-message`

That's it — send a test message between two accounts and the recipient
should get an email within a few seconds.

**Free-tier limit worth knowing**: until you verify a sending domain in
Resend, you can only send *from* `onboarding@resend.dev` and *to* the email
address your Resend account itself is registered with — fine for testing
with your own account, but real users won't receive anything until a domain
is verified (Resend → Domains → Add Domain → a few DNS records). Not
blocking for building/testing this now, just for it working on strangers.

## Vouching

A lightweight "I vouch for this seller" endorsement, separate from reviews —
anyone signed in (other than the seller) can vouch for a seller once;
vouching again removes it. Shown on the seller's profile (`profile.html`,
with a real avatar stack of who's vouched and a toggle button) and as a
read-only count next to the trust badges on `listing.html`. Backed by
`supabase/vouches.sql`.

## Visual redesign, delete listings, pan-India expansion

- **Design system.** New light/dark palette (warm ivory / near-black, sage,
  clay, marigold), toggled via a floating switch on every page and persisted
  in `localStorage` (`data-theme` on `<body>`; all colors are CSS custom
  properties in `css/style.css`, so this is the only place theme colors
  live). Fraunces for headlines, Inter for everything else. Categories are
  now a fixed set of six (Electronics, Stationary, Books, Utilities,
  Accessories, Fashion) with line icons, replacing the old free-text/
  graduating-tag system — the category picker on Sell and the filter chips
  on Browse both use `CATEGORIES`/`CATEGORY_ICONS` in `js/data.js`. The
  landing page's "Trust, built into every step" section is now the
  Sustainability/Trust/Community pillars section. An optional, cosmetic
  character avatar (female/male/neutral, `profiles.avatar_type`) replaces
  the old identicon-style avatars everywhere — pick one at signup (always
  skippable) or change it later from Account.
- **Delete listings.** My ads → the trash icon on a listing's photo →
  confirm → gone immediately (optimistic UI update, no reload). RLS in
  `schema.sql` already restricted deletes to the listing's own `seller_id`;
  this was purely the missing frontend action (`Store.deleteListing`).
- **Pan-India.** `profiles.city`/`listings.city` now hold a real city from
  Google Places instead of a hardcoded default, with `state`/`lat`/`lng`
  alongside for possible future distance sorting. "Nearby" already meant
  "the signed-in user's own city" before this — that logic didn't change,
  only where the city comes from. See §2 above for the Google Maps setup
  this needs, and `supabase/pan-india.sql` for the schema change.

## Dark-mode nav fix, GPS Nearby, notifications, newsletter, Community forum

- **Bottom nav dark mode.** Was hardcoded to a white background — now uses
  `var(--surface)` like everything else, so it flips with the rest of the
  page.
- **GPS-based Nearby.** Tapping "Nearby" on the home feed now offers real
  device-location sorting (`js/data.js`'s `haversineKm`/`Store.requestGeo`) —
  only on that tap, never on page load, with a plain-language reason shown
  before the browser's own permission prompt. Decline, no-`geolocation`
  support, or a timeout all fall back to the existing city match silently.
  The location itself is cached in memory for the session only, never
  persisted. Cards show "X km/m away" when sorted this way
  (`.product-distance` in `listingCardHtml`).
- **In-tab notifications.** Account → Notifications toggle requests browser
  `Notification` permission and, while enabled, polls every 45s
  (`js/common.js`'s `checkForNotifiableEvents`) for a deliberately curated
  set of major events only — new messages, someone vouching for you or one
  of your Community/Feedback posts, a reply to one of your posts, and new
  Notice Board announcements — firing a `Notification` for each. Routine
  activity (listing views, minor profile edits, etc.) is intentionally
  excluded so the notifications a user gets are worth checking. This only
  fires while a tab is open — real push for when the app/tab is closed
  needs a service worker, VAPID keys, and a server-side trigger (e.g. a
  Supabase Edge Function on message insert, the same shape as the
  email-notification function above); that's flagged in
  the code as an intentionally separate, bigger follow-up, not attempted here.
- **Newsletter signup.** Footer of the landing page — collects an email into
  `newsletter_subscribers` (`Store.subscribeNewsletter`). Collection only;
  it doesn't send anything. Actually emailing subscribers is flagged in the
  code as the next step, once there's a cadence/content decision to build
  toward — Resend (already used for message notifications) is the natural
  choice there too.
- **Community forum.** The bottom nav's Community tab now goes to
  `community.html` (direct messages moved to the bell icon on Home and a
  header icon inside Community, same as before) with three sections:
  - **General** — open discussion, upvote/downvote, replies.
  - **Feedback** — bug reports and suggestions about the app itself (kept
    separate from General on purpose — different audience/purpose). Reuses
    the seller-vouch mechanic (same avatar-stack + marigold-seal look) as
    the vote, and carries a status chip — Open / Acknowledged / Fixed /
    Won't fix — settable only by an admin (`profiles.is_admin`, set via SQL,
    see §1 above; enforced server-side by the `set_feedback_status` RPC, not
    just hidden in the UI).
  - **Notice Board** — read-mostly announcements; only an admin can post
    (enforced in `community.sql`'s RLS insert policy).
  All three share one self-referencing table (`community_posts`), mirroring
  the `qa_questions` pattern from `schema.sql`.

## Dark mode redo, real seller names, phone-based verification, Messages tab

- **Dark mode, properly layered.** The previous dark palette was too flat
  (surfaces barely separated from the background). Redone with a genuine
  three-tier scale — `--bg` (page) / `--surface` (cards, search bar, nav
  pill, chat items) / `--elevated` (bottom nav, modals, floating buttons) —
  each a visibly distinct shade, plus higher-contrast muted text
  (`--muted: #9c9887`, checked at ~6:1 against `--surface`, comfortably over
  WCAG's 4.5:1 minimum).
- **Listing cards.** Real seller first name now shows on every card
  (`listingCardHtml` in `js/common.js`) instead of a hardcoded "New seller."
  A CSS bug meant the category icon SVG on cards had no size constraint and
  rendered at its default ~300×150px — that's the "broken icon" — fixed by
  dropping the icon from cards entirely (category still shows as text).
  Icon sizing bumped moderately elsewhere (`.icon-btn`, `.cat-chip`,
  `.chip-select` icons).
- **Verification.** "Verified" now means a phone number is on file
  (`isSellerVerified()` in `js/data.js`, checked everywhere a Verified badge
  or "New seller"/"Unverified" label shows) rather than the old unused
  `profiles.verified` flag that nothing ever set. Once real phone OTP
  exists, this is a one-line swap to `seller.phoneVerified`.
- **Nearby/All India order.** All India is now the left pill and the
  default active view everywhere this toggle appears; Nearby is explicit,
  on the right.
- **Community "+" compose** was already wired (verified working, signed-in,
  in this pass); added on top: the Notice Board's "+" is now hidden
  entirely for non-admins (not just rejected on tap), and a successful post
  returns to the list with the new post at the top instead of jumping to
  its detail page.
- **Profile photos + status/bio.** Edit profile (Account → Edit profile,
  now real instead of a demo-mode placeholder) — tap the avatar to upload a
  real photo (`profile-photos` bucket, `profiles.avatar_url`), plus an
  optional ~140-character status line (`profiles.status_text`) shown under
  the name on profile/seller cards. `avatarHtml()` in `js/data.js` is now
  the one function every avatar render goes through — real photo first,
  falling back to the existing character avatar.
- **Messages, as its own bottom-nav tab.** Previously only reachable via a
  bell icon. The bottom nav is six items now (Home / Community / Messages /
  Sell / My ads / Account) with slightly reduced icon/label sizing to fit —
  checked at 375px width for clipping/overlap.
- **Notifications, curated.** The poller (item 3a, above) now fires for
  exactly four things — new message, a vouch on you or one of your
  Community/Feedback posts, a reply to your post, a new Notice Board
  announcement — and deliberately nothing else (no more listing-view or
  price-change noise).
- **Vouch icon.** Swapped from a checkmark-in-a-circle (too close to the
  Verified badge's own checkmark) to a filled heart (`VOUCH_ICON` in
  `js/data.js`) — same marigold seal + avatar-stack treatment everywhere,
  only the glyph changed.
- **Landing page illustrations.** Two original flat-SVG illustrations
  (no stock photography) in the same geometric style as the logo: a mohalla
  skyline + two neighbours exchanging a parcel, layered low-opacity behind
  the hero text; a parcel-with-a-sprig graphic above the "Got something to
  sell?" band.

## Nav cleanup, vouch lit/unlit state, a real dark-mode text bug

- **Bottom nav, five items.** "My ads" removed (redundant with the identical
  entry on Account); Home/Community/Messages/Sell/Account now share one
  consistent SVG icon set (`NAV_ICONS` in `js/common.js` — 24×24, 1.8
  stroke) instead of mismatched Unicode glyphs, and sizing went back up now
  that five items don't need six-item cramping.
- **Account page audit.** Checked at 375×667 and 320×568 (real mobile
  heights, not desktop) — all nine menu items are present, reachable by
  scroll, and never covered by the fixed bottom nav. No bug found here;
  noted rather than a fix invented to match the report.
- **Vouch buttons now have a real lit/unlit state** — marigold outline +
  marigold heart when not vouched, solid marigold fill + white heart when
  vouched (`.vouch-toggle-btn` / `.on` in `css/style.css`) — on seller
  profiles, and now also on listing detail pages, which previously only
  showed a read-only vouch *count* with no way to vouch at all
  (`Store.toggleVouch` wired to a real button in `listing.html`). Feedback
  posts in Community get the same treatment instead of generic ▲/▼ arrows;
  `getCommunityPosts()`/`getCommunityPost()` now return `myVote` so the UI
  actually knows whether the signed-in user has already vouched.
- **Dark-mode name contrast — real root cause found.** Names weren't
  reading as literally invisible; every button-based card (`.thread-card`,
  `.chat-item`, `.menu-item`, ...) was silently using the *browser's own
  default button text color* instead of inheriting the page's, because
  nothing had ever set `color` on the global `button` rule. Fixed with one
  line (`button { color: inherit; }`) — which also happens to fix every
  other button-nested text across the app, not just names, since it was
  never actually about `.thread-user`/`.chat-name` specifically.

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
- Realtime chat — messages send/receive correctly but don't push live; you see
  a reply on next page load/refresh, not instantly (the in-tab notification
  poller covers "new message" in the meantime, but only while a tab is open)
- True push notifications (app/tab closed) — needs a service worker, VAPID
  keys, and a server-side trigger; intentionally deferred, see "In-tab
  notifications" above
- Actually sending newsletter emails — collection only for now, see
  "Newsletter signup" above
- Editing your own listings after posting (deleting them is built — see
  "Delete listings" above)
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
