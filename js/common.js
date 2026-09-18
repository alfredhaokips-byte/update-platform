/* Shared chrome: bottom nav, headers, toast, product cards. Runs on every page. */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function qs(name) { return new URLSearchParams(window.location.search).get(name); }

function toast(msg) {
  let el = document.getElementById("global-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "global-toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2200);
}

function openModal(id) { const m = document.getElementById(id); if (m) m.hidden = false; }
function closeModal(id) { const m = document.getElementById(id); if (m) m.hidden = true; }

/* Bottom tab bar removed site-wide — navigation now happens only through
   each page's top header (logo, Browse/Community/Messages/Help/Account,
   "Sell something"). #bottom-nav-root divs are left in every page's markup
   harmlessly unfilled rather than edited out of each file individually. */

/* Call once near the top of every page's init, before rendering anything
   that depends on Store.getUser()/isSaved(). Signed-out visitors still get
   a working read-only browse experience — only actions that need an
   identity (saving, chatting, posting, reviewing, reporting) redirect to
   login.html when attempted. */
async function initPage(activeNavKey) {
  requireSupabaseConfigured();
  await Store.primeCache();

  if (Store.isLoggedIn()) {
    try {
      const threads = await Store.getThreads();
      const unread = threads.reduce((sum, t) => sum + t.unread, 0);
      const dot = document.getElementById("msg-dot"); // a page's own header bell, where present
      if (dot) dot.hidden = unread === 0;
      startNotificationPoller(unread);
    } catch (e) { /* non-critical — leave the dot hidden on failure */ }
  }
}

/* ---------- In-tab notifications (item 3a) ----------
   This covers only "the tab is open" notifications via setInterval polling +
   the Notification API. True push (app/tab closed) needs a service worker,
   VAPID keys, and a server-side trigger (e.g. a Supabase Edge Function on
   message insert) — meaningfully more infrastructure, intentionally deferred
   as its own follow-up rather than attempted here. */
const NOTIFICATIONS_PREF_KEY = "mm-notifications-enabled";
const NOTIFICATION_POLL_MS = 45000;
let _notifPollerStarted = false;

function getNotificationsEnabled() {
  try { return localStorage.getItem(NOTIFICATIONS_PREF_KEY) === "1" && Notification.permission === "granted"; }
  catch (e) { return false; }
}

async function setNotificationsEnabled(want) {
  if (!("Notification" in window)) throw new Error("Notifications aren't supported on this device/browser");
  if (want) {
    const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (perm !== "granted") { try { localStorage.setItem(NOTIFICATIONS_PREF_KEY, "0"); } catch (e) {} return false; }
    try { localStorage.setItem(NOTIFICATIONS_PREF_KEY, "1"); } catch (e) {}
    startNotificationPoller();
    return true;
  } else {
    try { localStorage.setItem(NOTIFICATIONS_PREF_KEY, "0"); } catch (e) {}
    return false;
  }
}

function notifyIfEnabled(title, body) {
  if (!getNotificationsEnabled()) return;
  try { new Notification(title, { body, icon: "/favicon.ico" }); } catch (e) { /* non-critical */ }
}

/* Curated to four genuinely major events (item B5) — deliberately NOT
   listing views, profile edits, or other low-signal activity. */
let _lastKnownUnread = null;
let _lastKnownVouchCount = null;
let _lastKnownPostVotes = null;
let _lastKnownReplyCount = null;
let _lastKnownNoticeId = null;

async function checkForNotifiableEvents() {
  if (!Store.isLoggedIn()) return;

  // New message received.
  try {
    const threads = await Store.getThreads();
    const unread = threads.reduce((sum, t) => sum + t.unread, 0);
    if (_lastKnownUnread !== null && unread > _lastKnownUnread) {
      notifyIfEnabled("New message", "You've got a new message on Marketplace.");
    }
    _lastKnownUnread = unread;
  } catch (e) { /* non-critical */ }

  // Someone vouched for you — generally, or on one of your listings.
  try {
    const counts = await Store.getVouchCounts([Store.getUser().id]);
    const total = counts.get(Store.getUser().id) || 0;
    if (_lastKnownVouchCount !== null && total > _lastKnownVouchCount) {
      notifyIfEnabled("Someone vouched for you", "Your trust on Marketplace just grew a little.");
    }
    _lastKnownVouchCount = total;
  } catch (e) { /* non-critical */ }

  // Someone vouched for one of your Community/Feedback posts, or replied to one.
  try {
    const summary = await Store.getMyCommunityActivitySummary();
    if (_lastKnownPostVotes !== null && summary.totalVotes > _lastKnownPostVotes) {
      notifyIfEnabled("Someone vouched for your post", "One of your Community posts just got a vouch.");
    }
    _lastKnownPostVotes = summary.totalVotes;

    if (_lastKnownReplyCount !== null && summary.totalReplies > _lastKnownReplyCount) {
      notifyIfEnabled("New reply", "Someone replied to your post in Community.");
    }
    _lastKnownReplyCount = summary.totalReplies;
  } catch (e) { /* non-critical — community.sql may not be run yet */ }

  // A new Notice Board announcement.
  try {
    const latestNoticeId = await Store.getLatestNoticeId();
    if (latestNoticeId && _lastKnownNoticeId !== null && latestNoticeId !== _lastKnownNoticeId) {
      notifyIfEnabled("New announcement", "There's a new post on the Notice Board.");
    }
    if (latestNoticeId) _lastKnownNoticeId = latestNoticeId;
  } catch (e) { /* non-critical — community.sql may not be run yet */ }
}

/* `seedUnread`, when passed, skips one redundant getThreads() call by
   reusing what initPage() just fetched for the unread dot. */
function startNotificationPoller(seedUnread) {
  if (_notifPollerStarted || !getNotificationsEnabled()) return;
  _notifPollerStarted = true;
  if (typeof seedUnread === "number") _lastKnownUnread = seedUnread;
  checkForNotifiableEvents(); // establishes remaining baselines without notifying on the first tick
  setInterval(checkForNotifiableEvents, NOTIFICATION_POLL_MS);
}

/* ---------- Back-row header for sub-pages ---------- */
function backRowHtml(title, rightHtml) {
  return `
    <div class="back-row row between">
      <a href="javascript:history.back()" class="icon-btn" aria-label="Back">←</a>
      ${title ? `<span class="header-title">${escapeHtml(title)}</span>` : "<span></span>"}
      ${rightHtml || `<span style="width:40px;"></span>`}
    </div>
  `;
}

/* ---------- Product card ---------- */
function listingCardHtml(listing) {
  const seller = getSellerById(listing.sellerId);
  const saved = Store.isSaved(listing.id);
  const sellerName = seller ? seller.name.split(" ")[0] : "Unknown seller";
  const verified = isSellerVerified(seller);
  const trust = `
    <span class="seller-name-sm">${escapeHtml(sellerName)}</span>
    ${seller && seller.isBusiness ? `<span class="shop-tag">Shop</span>` : ""}
    <span class="verify-label ${verified ? "yes" : "no"}">${verified ? "Verified" : "Unverified"}</span>
  `;
  return `
    <a href="listing.html?id=${listing.id}" class="product-card">
      <div class="product-img">
        ${listingThumbHtml(listing, 400, 340)}
        <span class="cond-tag">${listing.condition}</span>
        <button class="save-btn ${saved ? "active" : ""}" data-save-id="${listing.id}" title="Save" onclick="handleSaveClick(event, '${listing.id}')">${saved ? "♥" : "♡"}</button>
      </div>
      <div class="product-body">
        <p class="product-title">${escapeHtml(listing.title)}</p>
        <p class="product-price">${formatPrice(listing.price)}</p>
        <p class="product-tag">${escapeHtml(listing.category)}</p>
        ${listing._distanceKm != null ? `<p class="product-distance">${formatDistance(listing._distanceKm)}</p>` : ""}
        <div class="trust-row">${trust}</div>
      </div>
    </a>
  `;
}

async function handleSaveClick(evt, id) {
  evt.preventDefault();
  evt.stopPropagation();
  if (!Store.isLoggedIn()) {
    window.location.href = "login.html?redirect=" + encodeURIComponent(window.location.pathname.split("/").pop() + window.location.search);
    return;
  }
  const btn = evt.currentTarget;
  btn.disabled = true;
  const isSaved = await Store.toggleSaved(id);
  btn.disabled = false;
  btn.classList.toggle("active", isSaved);
  btn.textContent = isSaved ? "♥" : "♡";
  toast(isSaved ? "Saved to your list" : "Removed from saved");
}
