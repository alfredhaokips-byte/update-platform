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

/* ---------- Shared line-icon set (replaces emoji app-wide) ---------- */
const ICONS = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>`,
  community: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>`,
  myads: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6M9 13h6M9 17h3"/></svg>`,
  account: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`,
  filter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M7 12h10M10 18h4"/></svg>`,
  tag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41 12 22l-9.41-9.41A2 2 0 0 1 2 11.17V4a2 2 0 0 1 2-2h7.17a2 2 0 0 1 1.42.59l9.41 9.41a2 2 0 0 1 0 2.83z"/><circle cx="7" cy="7" r="1.5"/></svg>`,
  check: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 10l4 4 8-8"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  heartFill: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>`,
  flag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 21V4"/><path d="M5 4h13l-3 4 3 4H5"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>`,
  compose: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>`,
  reply: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  upvote: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 22s8-4.5 8-11V5l-8-3-8 3v6c0 6.5 8 11 8 11z"/></svg>`,
  handshake: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M11 12l2 2 4-4M3 12l4-4 4 2 3-3 4 3-1 5-3 3-4-2-4 2z"/></svg>`,
  card: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`,
  scroll: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 4h11a2 2 0 0 1 2 2v13a1 1 0 0 1-1.7.7L15 18H8a2 2 0 0 1-2-2V4z"/><path d="M6 4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2"/></svg>`,
  box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-2h5L16 7"/></svg>`,
  external: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 17L17 7M9 7h8v8"/></svg>`,
  paperclip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 12.5l-8.5 8.5a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8"/></svg>`,
  tagIconOutline: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.59 13.41 12 22l-9.41-9.41A2 2 0 0 1 2 11.17V4a2 2 0 0 1 2-2h7.17a2 2 0 0 1 1.42.59l9.41 9.41a2 2 0 0 1 0 2.83z"/><circle cx="7" cy="7" r="1.5"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>`,
  flame: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2s-6 6.5-6 11a6 6 0 0 0 12 0c0-1.7-.7-3-1.5-4 0 2-1 3-1 3s.5-4-3.5-8c0 2-1 3-2 4-1 1-1.5 2.3-1.5 4"/></svg>`,
};

/* ---------- Bottom tab bar ---------- */
const NAV_ITEMS = [
  { key: "home", icon: ICONS.home, label: "Home", href: "index.html" },
  { key: "community", icon: ICONS.community, label: "Community", href: "community.html" },
  { key: "sell", icon: ICONS.plus, label: "Sell", href: "post-ad.html", raised: true },
  { key: "myads", icon: ICONS.myads, label: "My ads", href: "my-ads.html" },
  { key: "account", icon: ICONS.account, label: "Account", href: "account.html" },
];

function bottomNavHtml(activeKey) {
  return `
    <div class="bottom-nav">
      ${NAV_ITEMS.map((item) => `
        <a class="nav-item ${item.raised ? "sell" : ""} ${item.key === activeKey ? "active" : ""}" href="${item.href}">
          <span class="nav-icon">${item.icon}</span>${item.label}
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
      const dot = document.getElementById("msg-dot");
      if (dot) dot.hidden = unread === 0;
    } catch (e) { /* non-critical — leave the dot hidden on failure */ }
  }
}

/* ---------- Back-row header for sub-pages ---------- */
function backRowHtml(title, rightHtml) {
  return `
    <div class="back-row row between">
      <a href="javascript:history.back()" class="icon-btn" aria-label="Back">${ICONS.back}</a>
      ${title ? `<span class="header-title">${escapeHtml(title)}</span>` : "<span></span>"}
      ${rightHtml || `<span style="width:40px;"></span>`}
    </div>
  `;
}

/* ---------- Product card ---------- */
function listingCardHtml(listing) {
  const seller = getSellerById(listing.sellerId);
  const saved = Store.isSaved(listing.id);
  const trust = seller && seller.verified
    ? `<span class="verified">${ICONS.check}</span><span class="muted">${escapeHtml(trustLine(seller))}</span>`
    : `<span class="muted">New seller</span>`;
  return `
    <a href="listing.html?id=${listing.id}" class="product-card">
      <div class="product-img">
        <img src="${listingThumbUrl(listing, 400, 340)}" alt="${escapeHtml(listing.title)}" loading="lazy" />
        <span class="cond-tag">${listing.condition}</span>
        <button class="save-btn ${saved ? "active" : ""}" data-save-id="${listing.id}" title="Save" onclick="handleSaveClick(event, '${listing.id}')">${saved ? ICONS.heartFill : ICONS.heart}</button>
      </div>
      <div class="product-body">
        <p class="product-title">${escapeHtml(listing.title)}</p>
        <p class="product-price">${formatPrice(listing.price)}</p>
        <p class="product-tag">${tagIcon(listing.category)} ${escapeHtml(listing.category)}</p>
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
  btn.innerHTML = isSaved ? ICONS.heartFill : ICONS.heart;
  toast(isSaved ? "Saved to your list" : "Removed from saved");
}
