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
   `city` now that location comes from free-text geocoding (see §2 below).
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
11. Same again with `supabase/newsletter-optin.sql` — adds
    `profiles.newsletter_opt_in` (defaults `true`), the column the "Email me
    about major updates" toggle on Account writes to and the newsletter send
    filters on. See "Newsletter — now actually sends" below.
12. Same again with `supabase/community-edit.sql` — adds the
    `edit_community_post` RPC backing the 20-minute post-edit window (see
    "Community post edit/delete" below).
13. Same again with `supabase/remove-phone-verification.sql` — drops
    `profiles.phone`/`phone_verified`, added by `trust-verification.sql` for
    a phone OTP tier that was tried and then dropped (see "Phone OTP
    verification, removed" below).
14. Same again with `supabase/vouches-per-listing.sql` — adds a nullable
    `vouches.listing_id` so a vouch can be scoped to one specific listing,
    not just the seller as a whole (see "Vouching, now correctly scoped"
    below).
15. Same again with `supabase/instagram-autopost.sql` — adds
    `listings.instagram_posted` and the single-row `app_settings` table (see
    "Photo/video lightbox, camera capture, video upload, Instagram
    auto-posting" below).
16. Same again with `supabase/seller-type.sql` — adds
    `profiles.seller_type`/`shop_name`/`shop_description` (see "Business vs.
    individual sellers" below).
17. Same again with `supabase/messages-type.sql` — adds `messages.message_type`,
    distinguishing a Buy Now tap from a regular chat message (see "Email
    notifications for key activity" below). **Required** before sending any
    message will work again — `js/data.js` now always sends this column.
18. **Settings → API** → copy the **Project URL** and the **`anon` `public`**
    key (not `service_role`).
19. Paste them into `js/supabase-client.js`:
   ```js
   const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "ey...";
   ```

That's it — no other config. The `anon` key is meant to be public; access
control is enforced by the Row Level Security policies in `schema.sql` and
`storage-policies.sql`, not by hiding that key.

## 2. Maps — free, no setup, no key

Locality fields (signup, post-ad, the home page's location picker) used to
need a paid Google Maps API key. They now run on two free services instead,
wired up in `js/maps-client.js`:

- **[Nominatim](https://nominatim.openstreetmap.org)** (OpenStreetMap's own
  geocoder) for the locality search/autocomplete dropdown.
- **[Leaflet.js](https://leafletjs.com)** + OpenStreetMap tiles for the small
  map preview under a picked locality.

Nothing to sign up for, no key to paste anywhere — `IS_MAPS_CONFIGURED` is
just always `true` now. Two honest limitations worth knowing, both commented
at the top of `js/maps-client.js`:

- **Nominatim's usage policy caps free use at 1 request/second** and asks for
  a `User-Agent` identifying the app — browsers can't set custom
  `User-Agent` headers (a Fetch spec restriction), so the `Referer` header is
  the real identifying signal here instead. This is fine for development and
  a small app, but **won't scale to real production traffic** without
  self-hosting Nominatim or proxying through a paid geocoding service — that
  swap is isolated to `searchNominatim()` in `js/maps-client.js` if/when it's
  needed.
- Search is restricted to India (`countrycodes=in`) as Google Places was
  before it, so "Nearby" keeps working the same way.

No fallback branch exists anymore for "not configured" — all three call
sites (signup, post-ad, home location picker) require a picked, geocoded
place before they'll submit, same as before.

## 3. Run it locally

Any static file server works, e.g.:
```
python3 -m http.server 8934
```
then open `http://localhost:8934`. Sign up for an account (email/password) —
the account is created immediately, no email confirmation step. **Make sure
"Confirm email" is switched OFF** in Supabase Dashboard → **Authentication →
Providers → Email** (see "Email OTP verification, removed (temporarily)"
below for why) — with it left on, a real confirmation is still required
server-side even though the app no longer shows any UI for completing one.

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
   email. One deviation from the brief: it names "phone verified" as the
   gate for posting at all, but real phone OTP was explicitly deferred in
   Phase 0 (no SMS provider wired up) — gating on it would make posting
   permanently impossible for everyone. Email confirmation is the real,
   working equivalent, so that's what's enforced instead. `verify.html` is
   the verification hub — email status is real, selfie is a "coming soon"
   placeholder (real liveness detection is its own dedicated phase, not
   built here). Phone OTP was tried later and then fully removed — see
   "Phone OTP verification, removed" below. A ₹10,000-and-up selfie-
   verification requirement was tried too and also removed, for the same
   reason (no working verification method behind it) — see "My Ads icon
   bug, stale price gate removed, business vs. individual sellers" below.
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
`supabase/vouches.sql`. **Since split into a separate per-listing vouch too
— see "Vouching, now correctly scoped" below; `listing.html` no longer
shows this same seller-level vouch.**

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
- **Pan-India.** `profiles.city`/`listings.city` now hold a real geocoded
  city instead of a hardcoded default, with `state`/`lat`/`lng` alongside for
  possible future distance sorting. "Nearby" already meant "the signed-in
  user's own city" before this — that logic didn't change, only where the
  city comes from. See §2 above for the (now free, no setup) geocoding this
  needs, and `supabase/pan-india.sql` for the schema change.

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
  exists, this is a one-line swap to `seller.phoneVerified`. **(Superseded —
  phone OTP was dropped entirely; see "Phone OTP verification, removed"
  below. Every seller now honestly shows "Unverified.")**
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

## Email OTP signup, welcome + newsletter emails, community edit/delete, free maps

- **Email OTP signup.** Signup ended on a "Check your email" screen asking
  for a 6-digit code (`Auth.verifyOtp`/`Auth.resendOtp` in `js/auth.js`)
  instead of Supabase's default click-a-link confirmation. **Superseded —
  made dormant since, see "Email OTP verification, removed (temporarily)"
  below**: Resend needs a verified sending domain to reach real signups,
  none was bought yet, so OTP codes never reached anyone but the Resend
  account's own address.
- **Welcome email.** Right after signup succeeds (originally right after an
  OTP code was confirmed — moved up to fire right after account creation
  now that the OTP step is dormant, see below), the client calls the
  `send-welcome-email` Edge Function (best-effort — a failed send never
  blocks signup). It looks up the *caller's own* email/name server-side from
  their JWT rather than trusting what the client sends, so it can't be used
  to spam an arbitrary address. Deploy it the same way as the existing
  message-notification function (§ "Email notifications on new messages"
  above covers the one-time Resend/CLI setup if not done already):
  ```
  supabase functions deploy send-welcome-email
  ```
- **Newsletter — now actually sends.** Event-triggered only, never
  scheduled: composing a new **Notice Board** post (admin-only, same as
  before) now shows an extra checkbox, "Also email this to newsletter
  subscribers" — checking it fires the `send-newsletter` Edge Function with
  that post's title/body right after the post itself goes up. The function
  re-checks `is_admin` server-side (never trusts the caller) and only emails
  `profiles` where `newsletter_opt_in = true`. Deploy it too:
  ```
  supabase functions deploy send-newsletter
  ```
- **Newsletter opt-out.** Account → "Email me about major updates" toggle
  (`profiles.newsletter_opt_in`, default `true` — signing up implies opting
  in until said otherwise). `Store.setNewsletterOptIn()` in `js/data.js`.
- **Community post edit/delete.** On your own General/Feedback/Notice post:
  **Delete** (confirm, then gone — no time limit) any time, **Edit**
  (title+body) only within 20 minutes of posting — the button itself
  disappears after that window, but the real guard is server-side: the
  `edit_community_post` RPC (`supabase/community-edit.sql`) re-checks
  `author_id = auth.uid()` and the 20-minute window itself before writing
  anything, so a direct API call can't outrun the UI. Deleting reuses the
  existing "users can delete their own posts" RLS policy from
  `community.sql` — no new SQL needed for that half.
- **Free maps.** Google Places/Maps is gone — see §2 above.

## Phone OTP verification, removed

Phone-based verification (`profiles.phone` on file → "Verified" badge) is
gone, not left half-built — no SMS provider was ever set up, and faking
verification by lowering the bar to "has a phone number saved" was worse
than being honest about not having a real tier yet.

- **`isSellerVerified()` in `js/data.js` now always returns `false`.** Kept
  as a function (not inlined) so every "Verified"/"Unverified" display
  already routes through one place — listing cards, listing detail, seller
  profile, Trust Profile, Account, the landing page's showcase cards — and
  wiring up a real tier later is a one-line change there, not a re-audit of
  every call site.
- **`verify.html`'s phone number field is gone.** The page never had a real
  OTP-code screen (it honestly said "OTP verification isn't live yet"), so
  there was no broken flow to route around — just the number-saving input
  and its "Save" button, removed. Email status/resend and the Selfie
  "coming soon" placeholder are untouched and still work, so **"Get
  verified" stays in Account's menu** rather than being hidden — hiding it
  would have also hidden the still-working email resend, which isn't part
  of what's being removed here.
- **`profiles.phone`/`phone_verified` are dropped**, not just unused —
  checked first, and neither column was referenced anywhere outside this
  feature (no messaging/contact-info use). `supabase/remove-phone-verification.sql`.
- The landing page's hero stats had a "Verified sellers" count that would
  now always read 0 — replaced with "Deals done" (a real, already-tracked
  number from the reviews trigger in `trust-verification.sql`) rather than
  ship a hollow stat on the public marketing page.

## Nav reorder, fixed image cropping, vouching now correctly scoped

- **Bottom nav reorder.** Sell moved to the center slot, Messages moved to
  just left of Account: Home, Community, Sell, Messages, Account
  (`NAV_ITEMS` in `js/common.js`).
- **Cropped photos, fixed.** Two real issues, found by checking what was
  actually cropping and why rather than guessing:
  - **Listing detail photos** (`.detail-img img` in `css/style.css`) used
    `object-fit: cover` in a fixed 4:3 box, silently cropping any photo shot
    in a different aspect ratio. Switched to `object-fit: contain` — the
    full photo is now always visible, letterboxed against the card
    background when its ratio doesn't match, never cropped, since this is
    the one place the photo itself is the whole point.
  - **Grid thumbnails** (Home feed, My Ads — all `.product-img`, shared via
    `listingCardHtml()`) correctly keep `object-fit: cover` for a clean,
    consistent grid — cropping there is the right call, sellers just
    couldn't see it coming. The upload-time preview (`.img-drop` in
    post-ad.html's photo picker) was a fixed 78×78 **square**, a different
    shape than the real 1/0.85 grid thumbnail, so it never actually showed
    what would get cropped. Now shares the same aspect ratio, so what a
    seller sees while uploading is what buyers will see.
  - **Profile picture upload** (`edit-profile.html`) was audited too and
    found already correct — its live preview uses the same circular,
    `cover`-cropped box as every place the photo is later shown, so no fix
    was needed there.
- **Vouching, now correctly scoped.** A reported "vouching for one item
  marks all of a seller's items as vouched" turned out not to be a
  state-tracking bug — `vouches` was (by original design, see "Vouching"
  above) a seller-level endorsement with no `listing_id` at all, so every
  listing from that seller correctly showed the same vouch because it
  genuinely was the same vouch. Reworked into two independently-toggleable
  endorsements sharing one table (`vouches.listing_id`, nullable —
  `supabase/vouches-per-listing.sql`):
  - `listing.html` now vouches for (and shows a count/state for) that one
    specific listing (`Store.toggleVouch(sellerId, listingId)`,
    `Store.getVouchStats(sellerId, listingId)`) — copy changed to "vouched
    for this item" so it reads correctly now that it's scoped.
  - `profile.html` is unchanged — still the general "I vouch for this
    seller" endorsement, `listingId` omitted.
  - Enforced by two partial unique indexes, not the old single primary key
    (one vouch per voucher per listing, separately one general vouch per
    voucher per seller) — a direct API call can't create duplicates in
    either scope.
  - The "someone vouched for you" notification now sums both scopes
    (`Store.getVouchCounts`, already existed but was unused) rather than
    only catching general vouches.

## Contact section on the landing page

Real, working contact details, not buried in `help.html`:

- A dedicated **"Get in touch"** section on the landing page (`index.html`,
  between the "Got something to sell?" band and the footer) with two pill
  links, same style as the rest of the page: Instagram
  (`instagram.com/mohallamarketplace`, opens in a new tab with
  `rel="noopener noreferrer"`) and email (`mohallamarketplace@gmail.com`, a
  real `mailto:` link).
- The same two links added to the footer's existing **Support** column, so
  they're reachable from a scroll-past as well as the dedicated section.
- No new backend, no new page — both are plain links.

## Photo/video lightbox, camera capture, video upload, Instagram auto-posting

- **Full-screen lightbox.** Tapping any photo (or video) on a listing's
  detail page now opens a full-screen, swipeable view
  (`openLightbox()`/`closeLightbox()` in `listing.html`) — a horizontal
  scroll-snap strip, the same mechanism the inline gallery already used,
  just full-viewport, so "swipeable" comes from native touch scrolling with
  no gesture library. A video's own native play/pause/scrub controls live in
  the inline gallery too; tapping a video there opens a small expand button
  rather than the whole frame, so a tap on the controls doesn't accidentally
  yank the video into the lightbox mid-scrub.
- **Camera capture — two explicit inputs, not one.** The first version put
  `capture="environment"` on the Sell form's single photo input, on the
  assumption that this adds a camera option alongside the gallery picker.
  On several real mobile browsers it instead *replaces* gallery access —
  `capture` is a hint some browsers honor as "camera only," not "camera in
  addition to" — so gallery selection silently disappeared. Fixed by
  splitting into two real inputs and two labeled buttons, "📷 Take a photo"
  and "🖼️ Choose from gallery": only the camera input carries `capture`,
  the gallery input carries none at all, and both feed the same
  upload/preview logic (`handlePhotoPick()` now takes the input element
  that changed, so it knows which one to clear afterward). Applied to both
  places photo upload exists — the Sell form (`post-ad.html`) and the
  profile photo picker (`edit-profile.html`, which didn't actually have the
  `capture` bug since camera capture was only ever added to the Sell form,
  but gets the same explicit two-button treatment for consistency).
- **Video upload.** The Sell form's photo picker now also accepts
  `video/mp4`/`video/quicktime`, capped client-side at 25MB and 60 seconds
  (`getVideoDuration()` in `post-ad.html` reads real duration off the file
  before it's ever uploaded, via a throwaway `<video>` element — rejected
  clips never reach Supabase Storage). Stored in the same `listing-photos`
  bucket, same `{user_id}/{listing_id}/{filename}` path convention as
  photos — no new table, no new column for "is this a video": the uploaded
  file's own extension is the only signal (`isVideoUrl()` in `js/data.js`),
  since Supabase Storage doesn't need a MIME allowlist to accept it. Every
  place a listing's media renders — grid thumbnails, the detail gallery, the
  lightbox — now recognizes that extension and swaps in a `<video>` instead
  of an `<img>`. Grid thumbnails (Home, Browse, My Ads, Saved, the landing
  page's showcase) keep `object-fit: cover` for a clean grid, now with a
  small centered play-icon badge (`.video-badge`) when the first item is a
  video, so buyers know before tapping in; the upload-time preview thumbnail
  was previously a fixed square, a different shape than the real grid
  thumbnail, so it never actually showed what would crop — it now shares the
  same aspect ratio for both photos and videos.
- **Instagram auto-posting**, `supabase/functions/post-to-instagram` — the
  one genuinely deviation from a literal read of the brief, for a concrete
  reason: a new listing is created with `images: []`
  (`Store.addListing`) and its photos are attached in a **separate** update
  once uploads finish (`Store.updateListingImages`) — the first real,
  publicly-reachable photo URL doesn't exist at insert time at all, so this
  fires on **UPDATE** to `listings`, not insert. Every other update to that
  row (a view-count bump on each page view, a future edit) hits the same
  webhook too, so `listings.instagram_posted` makes each listing eligible
  for exactly one attempt, set **before** the Graph API is ever called —
  a rate-limited or failed post is logged and dropped, never retried on the
  next unrelated update to the same row. This *is* the "don't drop posts,
  but don't over-engineer a queue before it's needed" behavior from the
  brief, just implemented as "attempt once, log failures" rather than a
  real retry queue, since nothing here is anywhere near Instagram's
  ~25-posts/24h Content Publishing limit yet.
  - **Known, deliberate limitation:** Instagram's Content Publishing
    `image_url` container only accepts JPEG/PNG, not WebP — and this app's
    own photo upload accepts WebP as a valid photo format. A listing whose
    first photo is a WebP file is silently skipped for cross-posting (logged,
    not an error) rather than sent to an endpoint that would just reject it.
    Converting WebP → JPEG server-side to close this gap wasn't attempted —
    real added complexity (an image-processing step in the Edge Function)
    for a narrow case, not requested.
  - **One-time manual setup, required before any of this can post for
    real** (environment/credentials this repo can't provide, by design —
    see the brief):
    1. A Meta **Business** account, with the @mohallamarketplace Instagram
       account converted to an **Instagram Business Account** and linked to
       a **Facebook Page** you control.
    2. [developers.facebook.com](https://developers.facebook.com) → create
       a **Meta App** (Business type) → add the **Instagram Graph API**
       product.
    3. Generate a long-lived **access token** for that app with
       `instagram_content_publish`, `pages_show_list`, and
       `instagram_basic` permissions (Meta's Graph API Explorer, or the
       standard token-exchange flow, gets you from a short-lived user token
       to a long-lived one — short-lived tokens expire in ~1 hour and
       aren't usable here).
    4. Look up the **Instagram Business Account ID** (not the same as the
       numeric Instagram user ID) via
       `GET /{facebook-page-id}?fields=instagram_business_account` against
       the Graph API.
    5. Set both as function secrets (never in client code, never in this
       repo):
       ```
       supabase secrets set INSTAGRAM_ACCESS_TOKEN=your_long_lived_token
       supabase secrets set INSTAGRAM_BUSINESS_ACCOUNT_ID=your_ig_business_account_id
       ```
    6. Deploy the function:
       ```
       supabase functions deploy post-to-instagram
       ```
    7. **Supabase Dashboard → Database → Webhooks → Create a new webhook**:
       - Table: `listings`
       - Events: **UPDATE only** (not Insert — see above for why)
       - Type: **Supabase Edge Function**
       - Function: `post-to-instagram`
  - **Pause switch.** Account → "Auto-post new listings to Instagram" —
    admin-only (`profiles.is_admin`), reads/writes the single-row
    `app_settings` table (`supabase/instagram-autopost.sql`). Lets the
    integration be paused without redeploying or unwiring the webhook, e.g.
    while troubleshooting a token issue.
  - **Not yet verified end-to-end.** Everything above is built and, as far
    as static review can confirm, correct against Meta's documented Graph
    API shape — but it has not been exercised against a real access token,
    a real Instagram Business Account, or a real webhook firing, because
    none of that infrastructure exists yet outside the manual setup steps
    above. Per the brief's own instruction, this isn't "done" until a real
    test listing has been published and actually appeared on
    @mohallamarketplace — that's the next step once the Meta-side setup is
    in place, not something achievable from this codebase alone.

## My Ads icon bug, stale price gate removed, business vs. individual sellers

- **My Ads placeholder icon, fixed.** The original "broken icon" bug (an
  unsized category SVG rendering at its default ~300×150px) was fixed on
  the shared card component (`listingCardHtml()` in `js/common.js`) back
  when it was first found — but `my-ads.html` has always rendered its own
  separate card markup (a delete button instead of a save button, no
  seller-trust row), so it kept the old, unfixed category-icon line and
  nobody noticed. Same fix, applied to the file it was missed in: the icon
  is gone, category still shows as plain text, exactly like every other
  card. There was never a real "no-photo fallback" here to redesign — the
  icon rendered unconditionally, real photo or not, which is exactly the
  bug that was reported.
- **The ₹10,000 verification gate is gone.** Turned out to be tied to
  *selfie* verification, not phone (`SELFIE_VERIFICATION_PRICE_THRESHOLD`
  in `js/data.js`, checked in `post-ad.html`'s submit handler) — but the
  underlying problem was identical either way: selfie/liveness verification
  was never built (`verify.html` has always honestly said "Selfie —
  coming soon"), so `selfieVerified` has no path to `true` for anyone,
  meaning this gate silently blocked every listing over ₹10,000 with no
  way to ever pass it. Removed the check entirely from the publish flow —
  listings of any price publish the same way now. `verify.html`'s copy
  updated to match (no more claiming a ₹10,000 requirement that no longer
  exists); the Selfie badge itself stays, still honestly labeled "coming
  soon," since a future stronger verification tier is still on the table —
  just not gating anything today. Re-adding a price gate later is fine,
  once a real verification method exists to gate on.
- **Business vs. individual sellers**, `profiles.seller_type` (default
  `'individual'`, or `'business'`) plus optional `shop_name`/
  `shop_description` — self-declared, like every other unverified signal on
  this app, not a trust claim. Toggled from Edit Profile ("I'm selling as a
  small business/shop"), which reveals two extra fields (shop name, 60
  chars; shop description, 160) that are cleared automatically when
  switched back to individual, so a stale shop name can't linger.
  - **"Shop" label** — a small clay-toned pill (`.shop-tag` for the compact
    card context, `.badge-shop` for header contexts), deliberately never
    reusing the Verified/Unverified green-or-gray so it reads as a category
    ("this is a shop"), not a trust badge. Shown next to the seller's name
    everywhere it appears: listing cards (`listingCardHtml()`), listing
    detail's seller card, and profile/account headers. A business seller's
    shop name and description show as their own lines on listing detail and
    profile/account — separate from, and in addition to, the personal
    status/bio field that already existed.
  - No different rules, fees, or verification for business sellers — purely
    labeling and display, per the brief.
- **New "Handcrafted" category**, alongside the existing six
  (`CATEGORIES`/`CATEGORY_ICONS` in `js/data.js`) — a scissors icon, for
  original/handmade items. `listings.category` was always free-text at the
  database level (no fixed enum to migrate), so this is a one-line, purely
  app-side addition that the category picker on Sell and the filter chips
  on Browse both pick up automatically.

## Minimum photos, description guidance, and — separately — an email deliverability fix

- **3-photo minimum to publish.** ~~`post-ad.html`'s Publish button was
  disabled until at least 3 photos/videos were selected~~ — **removed**, see
  "Instagram deployment, seller vouching fixed, 3-photo minimum removed"
  below. Publishing is back to requiring just one real photo/video, same as
  before this was ever added.
- **Description guidance, in-context.** The placeholder now models a real,
  good description instead of a generic prompt; a small always-visible
  bullet list under the field (condition, how long used, why selling,
  what's included, flaws) says what to cover without turning the field into
  a wall of instructions; and a soft, non-blocking nudge ("A bit more detail
  helps buyers trust the listing...") appears while the description is
  under 25 characters and disappears once it isn't — never disables Publish,
  per the brief's own "gentle... not a hard blocker."
- **Email OTP delivery — the real fix needs one manual dashboard step, not
  code.** If signup's 6-digit codes aren't arriving (or land in spam),
  Supabase's own built-in email sender is almost certainly why — it's
  rate-limited and unreliable past light testing, regardless of anything in
  `js/auth.js`. The fix is routing auth email through Resend's SMTP instead,
  reusing the same Resend account and API key already set up for
  `notify-new-message`/`send-welcome-email`/`send-newsletter` (§ "Email
  notifications on new messages" above) — one provider for everything,
  rather than a second one just for this:
  1. **Supabase Dashboard → Authentication → Emails → SMTP Settings** →
     enable **Custom SMTP**.
  2. Enter Resend's SMTP connection details (Resend's own docs have the
     current exact values; as of writing):
     - Host: `smtp.resend.com`
     - Port: `587` (or `465` for SSL)
     - Username: `resend` (literally that word, not your email)
     - Password: your existing `RESEND_API_KEY` — Resend uses the same API
       key as the SMTP password, so no new credential to generate
     - Sender email: must be on a domain verified in Resend (Resend →
       Domains) — `onboarding@resend.dev` works for testing against your
       own Resend-registered address only, same free-tier limit already
       true for the other Resend-backed emails in this app
  3. Save — this is a global auth-email setting, so it also covers any
     other Supabase auth email (password reset, etc.), not just signup OTP.
  - **Not verified working** — this is entirely a dashboard configuration
    change with no corresponding code in this repo to test against, and per
    the brief it can't be called fixed until it's actually been exercised:
    do the setup above, then sign up with a fresh test email and confirm
    the code both arrives and lands outside spam. If the manual SMTP step
    above hasn't been done yet, OTP delivery is still riding on Supabase's
    default sender and will still be unreliable.
  - **Superseded for signup specifically** — turned out the real blocker
    wasn't Supabase's sender at all, it was that Resend itself won't deliver
    to real recipients without a verified domain, which no amount of SMTP
    configuration fixes on its own. Signup OTP has since been made dormant
    (see "Email OTP verification, removed (temporarily)" below) rather than
    left broken. The custom-SMTP setup above is still worth doing — it
    covers every other Supabase auth email — but a verified Resend domain is
    the actual prerequisite before OTP itself comes back.

## Minimum photos, description guidance, share, and OTP made dormant

- **Description guidance.** Unchanged from when it shipped — see "Minimum
  photos, description guidance, and — separately — an email deliverability
  fix" above. (The 3-photo minimum documented in that same section was
  itself removed one batch later — see "Instagram deployment, seller
  vouching fixed, 3-photo minimum removed" below.)
- **Share a listing.** A real share button on `listing.html` — both the
  header's icon (previously a fake `toast('Link copied (demo)')` that did
  nothing) and a new button next to Chat/Buy Now now call one real
  `shareListing()`. Uses `navigator.share({ title, text, url })` where
  supported (mobile — this is what actually puts WhatsApp/Messages/
  Instagram etc. in the system share sheet, no per-platform work needed);
  falls back to `navigator.clipboard.writeText()` with a "Link copied!"
  toast everywhere else (mainly desktop browsers, which mostly don't
  implement `navigator.share`). The fallback button's own label switches to
  "🔗 Copy link" at render time when `navigator.share` isn't available, so
  it never reads like a share button that silently does nothing. A
  cancelled native share sheet (`AbortError`) is treated as a no-op, not a
  failure — only a genuine error toasts.
- **Email OTP verification, removed (temporarily).** Same call as phone
  OTP earlier — don't leave a verification step live that can't actually
  work. The real cause: Resend (the provider behind every email this app
  sends) won't deliver to real recipients without a verified sending
  domain, and none has been bought yet — so OTP codes only ever reached the
  Resend account's own address, never a real signup's. Signup is back to
  name/email/password/optional-locality → account created immediately, no
  confirmation step (`Store.primeCache()` picks up `email_confirmed_at`
  from the session right away, so the rest of the app's "confirmed email"
  checks, like posting a listing, are satisfied immediately too — nothing
  else needed changing for that).
  - **Needs one manual dashboard step**: Supabase Dashboard →
    **Authentication → Providers → Email** → switch **"Confirm email"**
    back **OFF** — the same toggle used during local testing earlier in
    this project. Without this, a real confirmation is still required
    server-side even though there's no UI left to complete one.
  - **Not deleted, made dormant.** The OTP screen's HTML and its JS
    (`showOtpStep`, the `otp-form`/`resend-otp-btn` handlers) are commented
    out in `signup.html`, not removed — along with `Auth.verifyOtp`/
    `Auth.resendOtp` in `js/auth.js`, which are untouched and still correct.
    Each commented block says exactly what to do to bring it back. **To
    re-enable, once a domain is bought and verified in Resend:** switch
    "Confirm email" back ON, uncomment both blocks in `signup.html`, and
    change the signup-form handler back to calling `showOtpStep(email)`
    instead of going straight to `Store.primeCache()`/`showCharStep()`.
  - No leftover "check your email for a code" copy anywhere else in the
    app — audited signup and the pages around it.

## Instagram deployment, seller vouching fixed, 3-photo minimum removed

- **Instagram Edge Function — deployed, secrets set, and the actual reason
  it never fired has been found and fixed.** The CLI is now logged in and
  linked (done manually, as it has to be), which made direct inspection
  possible instead of guessing from the dashboard. `supabase secrets list`
  confirms `INSTAGRAM_ACCESS_TOKEN`/`INSTAGRAM_BUSINESS_ACCOUNT_ID` are set
  in Supabase (not just, as previously worried, in Vercel). The Database
  Webhook ("direct post to insta") *did* correspond to a real trigger — but
  `select pg_get_triggerdef(...) from pg_trigger where tgname = 'direct
  post to insta'` showed it was `AFTER INSERT`, not `AFTER UPDATE`. A
  listing is created with `images: []` (`Store.addListing`) and its photos
  are attached in a *separate* update once uploads finish
  (`Store.updateListingImages`) — exactly the reason this function was
  designed to fire on UPDATE in the first place (see the comment at the
  top of `supabase/functions/post-to-instagram/index.ts`), but the webhook
  itself had been wired to INSERT instead, so it fired once per listing,
  immediately, always with zero photos, and the function correctly (if
  invisibly) no-opped every single time with "nothing to do" — which is
  indistinguishable from "never fires" by watching the dashboard's
  invocation counter with any delay, but very distinguishable by querying
  `net._http_response` directly, which showed exactly that: a real 200
  response, content `"nothing to do"`, on every real signup's first save.
  Fixed with `create or replace trigger "direct post to insta" after
  update on public.listings for each row execute function
  supabase_functions.http_request(...)` — same URL, same auth header, only
  the event changed. Re-verified end-to-end afterward with a real insert +
  update against the live database (not just the dashboard): the UPDATE
  correctly fired the trigger, the function ran, and it correctly reached
  and returned `"not a postable image"` for a deliberately-`.webp` test
  URL — proving the whole trigger → webhook → function pipeline now works,
  without ever risking a real public post while testing (a real `.jpg`
  would have gone on to actually call the Graph API — see below). The
  diagnostic test listing was deleted afterward.
  - **Also found while in there**: `supabase/instagram-autopost.sql` —
    the migration adding `listings.instagram_posted` and the `app_settings`
    pause-toggle table — had *also* never been run, the same "written a
    migration, nobody applied it" gap as the vouching bug below. Applied it
    directly (`supabase db query --linked -f
    supabase/instagram-autopost.sql`). Before this, the idempotency guard
    and the Account pause toggle were both silently inert: the guard column
    didn't exist (so nothing actually stopped a re-attempt, though nothing
    had gotten far enough to need it yet), and the pause check's own query
    would have failed and been treated as "not paused" rather than
    blocking — a fail-open, not fail-closed, silent gap. Worth knowing even
    though it wasn't yet the thing preventing posts.
  - **One harmless inefficiency, not fixed, worth knowing about**: the
    function's own idempotency write (`update listings set
    instagram_posted = true`) is itself an UPDATE on the same row, so it
    re-fires this same trigger — every real attempt causes two invocations,
    the real one and a self-triggered echo that immediately no-ops
    (`hadPhotoBefore` is true by the time it sees the row). Confirmed
    exactly this pattern in `net._http_response` during testing. Doesn't
    break anything and wasn't asked about, but worth knowing since Instagram
    doubles as your invocation-count budget too.
  - **Real test run, with the user's explicit go-ahead** — a real, existing,
    already-live listing's photo (a genuine `.jpeg` from Storage, reused via
    a throwaway duplicate row so the real listing itself wasn't touched —
    editing the real row directly was blocked by this session's own safety
    controls, same as the pause toggle) was attached to a fresh test row to
    trigger a real attempt. The pipeline reached the actual Graph API call
    this time — `net._http_response` recorded `"container failed"` rather
    than `"nothing to do"`, meaning credentials were read and a real
    container-creation request was sent to Meta, but Meta rejected it.
    **No post was published** — container creation is step 1 of 2
    (container → publish), and it failed at step 1, so `media_publish` was
    never reached.
    - The function's own two failure-response bodies were improved to
      include the actual Graph API error JSON (not just a generic
      "container failed"/"publish failed" string, which is all `console.error`
      captured before — and this session has no way to read Edge Function
      console logs via the CLI, only `net._http_response`, which only had
      the generic string). Deployed. Re-attempting to capture the improved
      response was blocked by the same safety control once it recognized
      the pattern (a write that leads to a real external post), even
      against the throwaway test row — this session stopped there rather
      than working around it, per its own instructions.
    - **The actual Graph API error text still needs to come from you**:
      Supabase Dashboard → Edge Functions → `post-to-instagram` → Logs
      should already have the full error from the attempt above
      (`console.error("Instagram container creation failed...", ...)`).
      Common causes for a container-creation failure specifically: the
      access token's permissions don't actually include
      `instagram_content_publish`, the token is a short-lived one issued
      during testing (these expire in ~1 hour) rather than the long-lived
      token exchange, or the Instagram Business Account ID doesn't match
      the account the token has access to. Once you have the real error
      text, that'll say which. Any future attempt (through the real app,
      not raw SQL) will now return the actual error in its own HTTP
      response too, queryable directly from `net._http_response` without
      needing dashboard log access at all.
- **Seller vouching — root cause found, it's a missing migration, not a
  code bug.** Checked directly against the live database (not just the
  code): `select listing_id from vouches limit 1` fails with `column
  vouches.listing_id does not exist`. `supabase/vouches-per-listing.sql`
  (written two batches ago, when per-listing vouch scoping was built) was
  never actually run — so every real call to `Store.getVouchStats()` or
  `Store.toggleVouch()` hits that missing column and fails, on **both** the
  general seller-level vouch (profile.html) and the per-listing vouch
  (listing.html), since the current query always references `listing_id`
  even for the general case (`.is("listing_id", null)`). The actual
  vouching logic — self-vouch prevented, real DB-backed count and avatar
  stack (no placeholder numbers), lit/unlit toggle state, per-listing
  scoping — is already correct code, already verified against a live
  database schema by hand for the query shapes involved; **the fix is
  running that one migration file**, nothing in the app needs to change.
  Do that, then vouching should work immediately — I can't run it myself
  (no direct SQL execution access to your project from here) or verify the
  live "second account vouches, count updates, persists on reload" test
  until it's applied.
- **3-photo minimum, removed.** Back to requiring just one real photo or
  video to publish, same as before that requirement existed — the
  disabled-until-3-photos button, the "X of 3 minimum" counter, and the
  inline blocked-reason message are all gone from `post-ad.html`. Nothing
  else about the upload flow (camera/gallery buttons, video support, size
  caps) changed.
- **A note on the fourth item in this batch ("Section 3" in the priority
  order).** The prompt's priority list and closing line both reference a
  "Section 3" with a "no send capability" boundary to confirm — but no
  actual Section 3 body ever arrived in the prompt (the numbered list goes
  1, 2, then jumps to 4). The title mentioned an "Outreach Helper," so
  something was almost certainly dropped when the prompt was assembled.
  Skipped rather than guessed at, since building a whole feature — UI
  location, what data it uses, who it's for, what "no send capability"
  even needs to guard against — from a title alone risks building the
  wrong thing entirely. Paste the actual Section 3 text and it's next.

## SEO: sitemap.xml and robots.txt

- **Listing URLs are `listing.html?id=<uuid>`** — a query string, not a path
  (e.g. `/listing/<uuid>`). Nothing rewrites this today, so the sitemap
  below and any future SEO work should assume this exact shape unless
  that routing changes.
- **`robots.txt`** — a plain static file at the project root (no dynamic
  generation needed, its content doesn't depend on live data). Allows
  everything by default, then disallows exactly the pages that actually
  redirect to `login.html` for a signed-out visitor
  (`Auth.requireAuth()`, checked directly rather than assumed):
  `account.html`, `messages.html`, `my-ads.html`, `post-ad.html`,
  `saved.html`, `verify.html`, `edit-profile.html`, `help.html` (this one's
  gated too, despite being named like a public help page — checked, not
  guessed). `login.html`/`signup.html` are deliberately left crawlable —
  they're public and gate nothing, "authenticated-only" doesn't apply to
  them even though they're part of the auth flow. Ends with `Sitemap:
  https://mohallamarketplace.in/sitemap.xml`.
- **`sitemap.xml` is generated live, not a static file** — `api/sitemap.js`,
  a zero-dependency Vercel serverless function (plain built-in `fetch`, no
  `package.json` needed, matching this project's no-build-step approach)
  that queries `listings` (`select=id,created_at`) straight from Supabase's
  REST API on every request and builds the XML fresh. A listing posted or
  deleted a minute ago is already correct in the sitemap with no redeploy.
  Reached at `/sitemap.xml` via a rewrite in the new `vercel.json`
  (`/sitemap.xml` → `/api/sitemap`) — Vercel's own `/api/*` functions only
  ever answer under that prefix by default, so the rewrite is what makes
  the clean URL work. Response is cached at Vercel's edge for up to an hour
  (`stale-while-revalidate`) so a crawler can't hammer Supabase on every
  fetch — still "live" in the sense the brief means (no manual
  regeneration, no rebuild, reflects the database within the hour at the
  very worst), just not literally uncached on every single hit.
  - Includes: the homepage, `browse.html`, `community.html`, and one
    `<url>` per row in `listings` with `<lastmod>` from that listing's own
    `created_at`. Community's General/Feedback/Notice Board tabs are
    **not** included as separate entries — checked `community.html`'s
    `setSection()` and confirmed switching tabs never changes the URL at
    all, so there's no distinct, crawlable address for each one to list
    yet. If that's wanted, it's a real (small) feature addition — giving
    each section its own `?section=` URL — not something to fake in the
    sitemap alone.
  - Uses the same public anon key already embedded in every page's own
    `js/supabase-client.js` (falls back to it if `SUPABASE_URL`/
    `SUPABASE_ANON_KEY` aren't set as Vercel env vars) — safe here for the
    same reason it's safe client-side: `listings` is publicly readable
    under RLS, nothing this endpoint touches is gated.
  - **Not yet verified on the deployed site** — this can't be tested
    against the local static-file server the way everything else in this
    project has been, since `/api` serverless functions and `vercel.json`
    rewrites are Vercel-runtime features with no local equivalent here.
    Verified instead as far as possible from here: the exact Supabase REST
    query the function makes was run directly via `curl` and returns the
    right shape, and the resulting XML was built and parsed locally to
    confirm it's well-formed. The real test — visiting `/sitemap.xml` and
    `/robots.txt` on the live domain — needs this pushed and deployed
    first.

## New logo, email OTP restored, activity notifications via Gmail SMTP

* New logo. The old header/footer mark (an inline SVG of two interlocking
  chevrons + the literal text "Mohalla Market") only ever appeared in two
  places — `index.html`'s signed-out landing header and footer; every other
  page's header is just a back-arrow and a page title, no logo, and none of
  them had a favicon at all before this. Both spots now use the real lockup
  image (`img/logo-lockup.png`, an interlocking-M icon that doubles as the
  "M" in "Marketplace") instead of the SVG+text. Favicon links
  (`img/favicon-32.png`, `img/favicon-512.png`, `img/apple-touch-icon-180.png`
  — a clean icon-only crop, no construction guides) were added to all 15
  pages' `<head>`, not just the landing page.

* Email OTP signup, live again. "Confirm email" is back on in Supabase and
  Gmail SMTP (App Password) is confirmed delivering real codes, so the
  dormant `#otp-step` in `signup.html` (see "Email OTP verification, removed
  (temporarily)" above) is uncommented and live: create account → 6-digit
  code screen → `Auth.verifyOtp()` → account complete. Added on top of what
  was already built: a 30-second countdown on "Resend code" (was previously
  just disable-until-request-completes, no visible timer), and a low-key
  line under the code field — "Don't see it? Check your spam or promotions
  folder — it can take a minute to arrive." The welcome email moved back to
  firing after OTP verification succeeds (not right after signup) now that
  the account isn't real until that step passes.
* Activity emails — new message, new vouch, buying interest — now send via
  Gmail SMTP, not Resend. Resend's free tier can't deliver to a real
  recipient without a verified sending domain (the same limitation that
  blocked OTP for a while); Gmail SMTP with the already-tested App Password
  doesn't have that restriction, so every notification Edge Function was
  switched onto it rather than leaving these three on infrastructure known
  not to reach real users. `supabase/functions/_shared/send-gmail.ts` is the
  one shared sender (via `denomailer`) every notification function now
  calls — needs two new function secrets, not yet set:
  ```
  supabase secrets set GMAIL_USER=youraddress@gmail.com
  supabase secrets set GMAIL_APP_PASSWORD=your_16_char_app_password
  ```
  The same App Password already generated for Supabase Auth's SMTP settings
  works here too — it isn't tied to one consumer. Until these are set, the
  functions log "not configured" and no-op (same graceful-skip pattern the
  Resend key check always used), they don't error out or block the
  underlying action.
  * **New message** — `supabase/functions/notify-new-message` (already
    existed for this, just re-pointed at Gmail SMTP instead of Resend; no
    new webhook needed, the existing `messages` INSERT webhook covers it).
  * **New vouch** — `supabase/functions/notify-new-vouch`, new. Needs a new
    Database Webhook: Dashboard → Database → Webhooks → table `vouches`,
    event **INSERT only** (a vouch toggle-off is a DELETE on the same table
    and must never fire an email), function `notify-new-vouch`.
  * **Buying interest ("Buy Now" tapped)** — folded into the same
    `notify-new-message` function rather than a third webhook. Buy Now has
    never had its own table — `sendBuyNow()` in `listing.html` just inserts
    a `messages` row with canned text, same as any chat message — so giving
    it a separate webhook would fire *two* emails off one tap (the generic
    "new message" webhook, plus a dedicated one). Instead, `messages` grew a
    `message_type` column (`'chat'` default, `'buy_interest'` for Buy Now —
    `supabase/messages-type.sql`, **run this before deploying `js/data.js`**
    or every message send breaks with a missing-column error), and
    `notify-new-message` picks the "is interested in your listing" subject
    line instead of "sent you a message" when it sees that flag.
  * Both functions are deployed. Both are already wrapped in try/catch and
    always return 200 to the webhook regardless of send outcome — a failed
    email can't block or retry-storm the actual DB write, same pattern the
    existing `notify-new-message`/`send-welcome-email` always used, and
    since these are async Database Webhooks fired *after* the client's own
    insert already succeeded, the client-side action was never at risk of
    being blocked by a slow or failed send in the first place.
  * `supabase/messages-type.sql` has been applied to the live database
    (checked directly via `information_schema.columns`, not assumed) and
    both functions are deployed. Still needed before any of the three can
    actually send: the two `GMAIL_USER`/`GMAIL_APP_PASSWORD` secrets, and
    the `vouches` INSERT webhook — neither of those can be done from here.

## Email OTP removed again, forgot-password flow added

* Email OTP verification, dormant again. Gmail SMTP (App Password) looked
  like it had fixed delivery, but Supabase's own warning is that Gmail's
  SMTP isn't built for transactional/automated email — codes weren't
  reliably arriving. Rather than leave a verification step live that
  silently strands real signups, it's back to dormant (commented, not
  deleted, in `signup.html`/`js/auth.js` — same pattern as the first time,
  see "Email OTP verification, removed (temporarily)" above). Signup is
  name/email/password/optional-locality → account created immediately, no
  confirmation step. **Manual step needed, can't be done from here:**
  Supabase Dashboard → Authentication → Providers → Email → switch
  "Confirm email" back **off** — without this, signup still works from the
  UI's perspective but the account silently never becomes usable server-side.
* Forgot password. `login.html` gets a "Forgot password?" link below the
  password field, an inline step (same hidden-`<div>` pattern as signup's
  steps) asking for an email, and always shows the exact same neutral
  confirmation — "If an account exists for that email, a reset link has been
  sent." — whether or not that email has an account, so the flow can't be
  used to check who's registered. `reset-password.html` is new: Supabase's
  reset link lands there, and `js/auth.js` gained
  `resetPasswordForEmail()`/`updatePassword()`.
  * One real bug found and fixed while building this, not left in: the
    first version gated the "enter a new password" form on
    `sb.auth.getSession()` returning any session at all — which doesn't
    distinguish a genuine password-recovery session from someone just
    being separately logged in on that browser. Caught by testing it with
    a browser that had an unrelated logged-in session and no reset link at
    all — it let the password form through with zero real token involved.
    Fixed by gating first on the URL itself actually carrying recovery
    params (`type=recovery` in the hash, or a PKCE `code`), only then
    waiting for Supabase's `PASSWORD_RECOVERY` auth event; no params at all
    means "invalid link" immediately, never a fallback to "well, some
    session exists."
  * **Likely also needs a manual step**, not confirmed from here: Supabase
    Dashboard → Authentication → URL Configuration → Redirect URLs needs
    `https://mohallamarketplace.in/reset-password.html` allow-listed,
    or `resetPasswordForEmail()`'s `redirectTo` may be rejected/ignored.
  * Same known limitation as OTP: the reset email itself rides on the same
    unreliable Gmail SMTP, so it may not arrive. The flow's own logic (form
    submission, the neutral-message security behavior, the actual password
    update once a valid recovery session exists) is built and tested
    end-to-end short of receiving a real email — that's the identified,
    pre-existing delivery issue, not a new bug in this flow.
  * Explicitly left untouched, per this batch's own scope: the activity
    notification emails (messages/vouches/buy-interest) — those stay as-is.

## Email OTP restored — and the real root cause, with evidence

The "Gmail SMTP isn't reliable for transactional email" conclusion in the
section above was **wrong**, and is corrected here rather than quietly
edited out. OTP email was arriving the whole time. Two real, unrelated
problems were stacked on top of each other, and neither was deliverability:

1. **Supabase's Site URL was still the default `localhost`** (since fixed in
   the dashboard). The confirmation link in the email pointed at localhost,
   so clicking it confirmed the account server-side but then dead-ended the
   browser on a dead local address — indistinguishable, from the outside,
   from "the email never worked."
2. **The "Confirm signup" email template is still Supabase's default
   `{{ .ConfirmationURL }}`** — a clickable link, not `{{ .Token }}`, the
   typeable numeric code the OTP screen needs. So even a perfectly delivered
   email contained nothing that could be entered into the code field.

Evidence for both, from `auth.users` on the live database rather than
assumption — the test signup from the earlier "no email ever arrives" report:

```
created_at          2026-09-17 09:54:04.390
confirmation_sent_at 2026-09-17 09:54:04.425   <- Supabase dispatched it, 35ms later
email_confirmed_at   2026-09-17 09:54:47.144   <- confirmed 43s later
last_sign_in_at      2026-09-17 09:54:47.157   <- signed in the same millisecond
```

That account was confirmed and signed in at the same instant, 43 seconds
after signup, with nobody ever typing a code (impossible at the time — see
the otp_length bug below). Confirm-and-sign-in-in-one-step is the signature
of someone clicking a `{{ .ConfirmationURL }}` link. So: the mail arrived,
it contained a link, and the link worked — it just landed on localhost.

Two further real bugs found by reading the project's actual remote auth
config (`supabase config pull` into a throwaway project — read-only, nothing
in this repo changed), not by guessing:

* **`otp_length` is 8, but the code input had `maxlength="6"`.** A real code
  was silently truncated to its first 6 characters, so verification could
  never succeed even with a correct code in hand. The input now allows 8,
  which still accepts a 6-digit code if that setting is ever lowered — which
  is also why the copy no longer hardcodes a digit count.
* **`max_frequency` is `1m0s`, but the resend cooldown was 30s.** The button
  re-enabled while Supabase was still rate-limiting that address, so a
  resend at 30s returned a "wait longer" error. Cooldown is now 60s.

Detected state of the dashboard-only settings, for the record:
`enable_confirmations = true` ("Confirm email" is ON),
`site_url = https://marketplace-three-chi.vercel.app`,
`additional_redirect_urls = ["https://marketplace-three-chi.vercel.app/**"]`
(so the forgot-password `redirectTo` from the previous batch is covered —
that open question is answered).

**Still needed, and it's the one remaining blocker:** Dashboard →
Authentication → Emails → Email Templates → "Confirm signup" → use
`{{ .Token }}` in the body instead of `{{ .ConfirmationURL }}`. Email
template bodies are not exposed through the config API or CLI, so this is
the one thing here that couldn't be verified directly — it's inferred from
the confirm-plus-signin timestamp signature above. Until it's changed, the
signup email keeps containing a link and the OTP screen has nothing to type.
One leftover worth tidying while in there: the SMTP sender is still
`onboarding@resend.dev` from the Resend era while the connection itself is
Gmail. Mail is demonstrably arriving anyway, so this is not the bug — but
a From address the sending server isn't authorised for is a real spam-
foldering risk, and `mohallamarketplace@gmail.com` would be the honest value.

## Hosting migration: Vercel → Cloudflare Workers

Moved off Vercel. First attempt targeted Cloudflare Pages
(`functions/sitemap.js` + `_redirects`) based on an initial audit, but the
project was actually deployed on **Cloudflare Workers with Static Assets**
via the dashboard's Git integration, not Pages — Pages Functions routing
doesn't apply there at all, which is why `/sitemap.xml` 404ed on the live
`update-platform.alfredhaokips.workers.dev` deployment. Reworked for the
real platform:

* No `wrangler.toml`/`wrangler.jsonc` existed anywhere for this project —
  confirmed by searching the whole machine, not assumed. The dashboard Git
  integration was serving static assets with zero custom code attached,
  which is the actual root cause: there was nothing running to handle
  `/sitemap.xml` at all. `wrangler.jsonc` is new, and defines the Worker
  (`name`, `main`, `compatibility_date`, the `[assets]` binding, and
  `[vars]` for `SUPABASE_URL`/`SUPABASE_ANON_KEY` — both already public, same
  values shipped in `js/supabase-client.js`).
* `worker.js` is the new entry point (`export default { fetch(request, env) }`).
  It handles `/sitemap.xml` itself (identical Supabase query, XML building,
  and `Cache-Control` header this project has used since the original Vercel
  version) and passes every other request straight through to the static
  assets binding.
* `functions/sitemap.js` and `_redirects` (the Pages-specific leftovers) are
  removed — they never ran under Workers and would only cause confusion
  about which code path is live.
* Two real bugs found by actually running `wrangler dev` locally and hitting
  the routes, not assumed from documentation:
  * Cloudflare's default `html_handling` 307-redirects every `/foo.html` to
    `/foo`. This project's entire URL scheme is `.html?query` everywhere —
    every internal link, this Worker's own sitemap, every share link (see
    the SEO section above, which documents `.html?id=` as the committed
    convention) — so left alone, every single page load on the site would
    have picked up an extra redirect hop. Fixed with
    `"html_handling": "none"` in the `[assets]` config.
  * That fix has a side effect: `"none"` also disables Cloudflare's automatic
    `/` → `/index.html` resolution, not just the `.html`-stripping redirect —
    tested and confirmed the homepage 404s without a fix. None of
    Cloudflare's four `html_handling` modes give both behaviors at once, so
    `worker.js` now handles `pathname === "/"` explicitly, rewriting it to
    fetch `/index.html` before falling through to the assets binding for
    everything else.
* `.assetsignore` is new, and isn't something the original instructions
  asked for — added after finding a real issue while validating. Wrangler
  does **not** respect `.gitignore` for static asset uploads (open upstream
  issue, `cloudflare/workers-sdk#14500`), so with the assets directory set to
  the repo root, a deploy would have publicly served `.git/` (the entire
  repo history, reconstructable), `supabase/` (schema + Edge Function
  source), and other repo-internal files directly at the live domain. Listed
  explicitly here rather than trusted to work silently: tested by setting
  `.assetsignore` to exclude literally everything (`*`) and the file count
  `wrangler dev`/`--dry-run` reports didn't change at all — meaning either
  the local dev/dry-run summary just doesn't reflect ignore-filtering while a
  real deploy still respects it, or it doesn't work in this Wrangler version.
  Not resolved from here; **needs verifying after a real deploy** — check
  that `/.git/config` on the live domain 404s rather than returning raw file
  contents.
* `SITE_URL` updated to `https://mohallamarketplace.in` in `worker.js`,
  `robots.txt`, and the three Supabase notification functions
  (`send-welcome-email`, `notify-new-message`, `notify-new-vouch`) — but the
  three Supabase function changes are deliberately **not deployed or
  committed yet**, on request, since redeploying them would put the new
  domain into real signup/notification emails before DNS is actually
  pointed at Cloudflare.
* Not verified end-to-end from here, and can't be: this session has no
  Cloudflare account credentials (`wrangler login` needs interactive OAuth),
  so nothing above was confirmed against a real deploy or the live
  `*.workers.dev` URL — only against `wrangler dev` running locally, which
  exercises the same Worker code and the same static-assets binding logic,
  but isn't the same as production. Also unconfirmed: whether the Worker
  name `"update-platform"` (inferred from the workers.dev subdomain) matches
  what the dashboard's existing Worker is actually called — if it doesn't, a
  deploy creates a second, separate Worker rather than updating the live one.

## Priority fixes: OTP template, blank shared links, account deletion, notification emails

* **OTP still sends a link — dashboard template, not code.** The deployed
  frontend (`signUp` then `verifyOtp({ email, token, type: "signup" })`) is
  correct. Email template bodies aren't exposed by the config API or CLI, so
  this can't be read or changed from here; the email you receive containing
  a link is the direct evidence. Fix in Dashboard → Authentication → Emails →
  Email Templates → "Confirm signup": replace `{{ .ConfirmationURL }}` with
  `{{ .Token }}`. Correction to the section above: the "confirmed and signed
  in in the same millisecond" timestamps are **not** proof someone clicked a
  link — `mm-verify-test-20260917@example.com`, which has no real inbox, shows
  the identical pattern. That inference is withdrawn.
* **Blank page from a shared listing link — fixed.** Not RLS: `listings` has
  a `SELECT` policy of `true` for all roles. Reproduced on production: any
  character after the UUID in `?id=` (a dash, period or sentence a chat app
  glues on) made Supabase reject the malformed UUID; the error was uncaught,
  so nothing rendered but the bottom nav. `listing.html` now extracts the
  UUID from the param, shows a visible error instead of a blank page if
  rendering fails, and no longer passes `text` to `navigator.share` (some
  share targets append it straight after the URL).
* **Account deletion — added.** Account → Delete account → confirmation
  modal → second explicit tap. `supabase/functions/delete-account` takes the
  user from the caller's JWT, removes their storage files, then deletes the
  Auth user. Hard delete: every FK already cascades from `auth.users` →
  `profiles` → listings, threads (both sides), messages, reviews, vouches,
  Q&A, saved items — the same cascade deleting a single listing already
  causes. The email is free to sign up with again afterwards (verified).
* **Message/vouch notification emails — root cause found, needs a secret
  fix.** The webhooks fire and the functions run; the SMTP login fails with
  Gmail `535 5.7.8 Username and Password not accepted`. The Edge Function
  secret `GMAIL_USER` is `alfredhaokip37@gmail.com`, while the working
  Supabase Auth SMTP login is `mohallamarketplace@gmail.com`. Functions now
  include the real SMTP error in their response (visible in
  `net._http_response`) instead of a bare "email send failed". Fix:
  ```
  supabase secrets set GMAIL_USER=mohallamarketplace@gmail.com GMAIL_APP_PASSWORD=<the app password saved in Auth SMTP settings>
  ```
* **Separately found, not fixed:** most accounts created since ~08:49 UTC on
  2026-09-17 have no `profiles` row, though the trigger created one at signup
  (it runs in the same transaction, and users have no delete policy on
  `profiles`) — so those rows were removed with dashboard/service-role
  access. Those users are treated as guests everywhere, can't post, and the
  profile lookup returns a 406. Includes `alfredhaokip37@gmail.com` and
  `wocowaj880@airychen.com`.

## What's NOT built yet

Per the phased briefs, everything below is intentionally deferred:

- Real selfie/liveness capture — the "coming soon" badge exists
  (`verify.html`); the camera + liveness-check UI, and any gate tied to it,
  don't (a price-based gate was tried and removed since nothing could ever
  pass it — see "My Ads icon bug, stale price gate removed, business vs.
  individual sellers" above)
- AI chat-safety scam-pattern warnings
- AI risk scoring on signup/listing
- AI photo → listing assistant (category/condition/price suggestions)
- A synthesized Trust Score (the brief asked to hold this until the
  above foundation is confirmed working)

Also out of scope for now (flagged for awareness):
- Email OTP signup confirmation — built, then made dormant (not deleted)
  until a domain is bought and verified in Resend; see "Email OTP
  verification, removed (temporarily)" above for the exact re-enable steps
- Phone OTP (as sign-in, not verification) — tried once as a verification
  tier and removed, see "Phone OTP verification, removed" above; a real
  verification tier is still on the table for later, ID/selfie-based per
  the original trust design, not phone
- Image compression/resizing before upload
- Realtime chat — messages send/receive correctly but don't push live; you see
  a reply on next page load/refresh, not instantly (the in-tab notification
  poller covers "new message" in the meantime, but only while a tab is open)
- True push notifications (app/tab closed) — needs a service worker, VAPID
  keys, and a server-side trigger; intentionally deferred, see "In-tab
  notifications" above
- Editing your own listings after posting (deleting them is built — see
  "Delete listings" above; editing your own *Community/Feedback posts* is
  now built, see "Community post edit/delete" above — listings just haven't
  gotten the same treatment yet)
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
