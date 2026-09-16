/* Shared chrome: bottom nav, headers, toast, product cards. Runs on every page. */

/* Vercel Web Analytics — a no-op on any host other than Vercel (the script
   404s harmlessly), and only actually collects data once "Web Analytics" is
   turned on for the project in the Vercel dashboard (one toggle, free tier). */
(function loadVercelAnalytics() {
  const s = document.createElement("script");
  s.defer = true;
  s.src = "/_vercel/insights/script.js";
  document.head.appendChild(s);
})();

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

/* ---------- Dark mode ---------- */
const THEME_STORAGE_KEY = "mm-theme";
const THEME_SUN_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
const THEME_MOON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>`;

function getTheme() {
  try { return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light"; }
  catch (e) { return "light"; }
}

function setTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (e) { /* private browsing, etc. — non-critical */ }
  const fab = document.getElementById("theme-toggle-fab");
  if (fab) {
    fab.querySelector(".opt-light").classList.toggle("active", theme === "light");
    fab.querySelector(".opt-dark").classList.toggle("active", theme === "dark");
  }
}

function mountThemeToggle() {
  setTheme(getTheme());
  if (document.getElementById("theme-toggle-fab")) return;
  const fab = document.createElement("div");
  fab.id = "theme-toggle-fab";
  fab.className = "theme-toggle-fab";
  fab.setAttribute("role", "button");
  fab.setAttribute("aria-label", "Toggle dark mode");
  fab.innerHTML = `<span class="opt-light">${THEME_SUN_SVG}</span><span class="opt-dark">${THEME_MOON_SVG}</span>`;
  fab.addEventListener("click", () => setTheme(document.body.getAttribute("data-theme") === "dark" ? "light" : "dark"));
  document.body.appendChild(fab);
  setTheme(getTheme());
}
mountThemeToggle();

/* ---------- Bottom tab bar ---------- */
/* One consistent line-icon set (24x24 viewBox, 1.8 stroke, round caps/joins)
   for the bottom nav — plain Unicode glyphs (⌂ ➕ 👤 ...) rendered at
   inconsistent optical sizes/weights depending on the system font, which is
   exactly what made the envelope icon look out of place next to the rest. */
const NAV_ICONS = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>`,
  community: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  messages: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>`,
  sell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`,
  account: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg>`,
};

/* "My ads" was dropped — it's redundant with the identical entry already on
   the Account page, and five well-spaced items beat six cramped ones. */
const NAV_ITEMS = [
  { key: "home", icon: NAV_ICONS.home, label: "Home", href: "index.html" },
  { key: "community", icon: NAV_ICONS.community, label: "Community", href: "community.html" },
  { key: "sell", icon: NAV_ICONS.sell, label: "Sell", href: "post-ad.html" },
  { key: "messages", icon: NAV_ICONS.messages, label: "Messages", href: "messages.html" },
  { key: "account", icon: NAV_ICONS.account, label: "Account", href: "account.html" },
];

function bottomNavHtml(activeKey) {
  return `
    <div class="bottom-nav">
      ${NAV_ITEMS.map((item) => `
        <a class="nav-item ${item.key === activeKey ? "active" : ""}" href="${item.href}">
          <span class="nav-icon">${item.icon}</span>${item.label}
          ${item.key === "messages" ? `<span class="dot" id="nav-msg-dot" hidden></span>` : ""}
        </a>
      `).join("")}
    </div>
  `;
}

function mountBottomNav(activeKey) {
  const root = document.getElementById("bottom-nav-root");
  if (root) root.innerHTML = bottomNavHtml(activeKey);
}

/* Call once near the top of every page's init, before rendering anything
   that depends on Store.getUser()/isSaved(). Signed-out visitors still get
   a working read-only browse experience — only actions that need an
   identity (saving, chatting, posting, reviewing, reporting) redirect to
   login.html when attempted. */
async function initPage(activeNavKey) {
  requireSupabaseConfigured();
  await Store.primeCache();
  mountBottomNav(activeNavKey);

  if (Store.isLoggedIn()) {
    try {
      const threads = await Store.getThreads();
      const unread = threads.reduce((sum, t) => sum + t.unread, 0);
      const dot = document.getElementById("msg-dot"); // a page's own header bell, where present
      if (dot) dot.hidden = unread === 0;
      const navDot = document.getElementById("nav-msg-dot"); // the bottom-nav Messages tab badge
      if (navDot) navDot.hidden = unread === 0;
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
