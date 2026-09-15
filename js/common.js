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
const NAV_ITEMS = [
  { key: "home", icon: "⌂", label: "Home", href: "index.html" },
  { key: "community", icon: "💬", label: "Community", href: "messages.html" },
  { key: "sell", icon: "➕", label: "Sell", href: "post-ad.html" },
  { key: "myads", icon: "📋", label: "My ads", href: "my-ads.html" },
  { key: "account", icon: "👤", label: "Account", href: "account.html" },
];

function bottomNavHtml(activeKey) {
  return `
    <div class="bottom-nav">
      ${NAV_ITEMS.map((item) => `
        <a class="nav-item ${item.key === activeKey ? "active" : ""}" href="${item.href}">
          <span class="nav-icon">${item.icon}</span>${item.label}
          ${item.key === "community" ? `<span class="dot" id="msg-dot" hidden></span>` : ""}
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
  const trust = seller && seller.verified
    ? `<span class="verified">✓</span><span class="muted">${escapeHtml(trustLine(seller))}</span>`
    : `<span class="muted">New seller</span>`;
  return `
    <a href="listing.html?id=${listing.id}" class="product-card">
      <div class="product-img">
        <img src="${listingThumbUrl(listing, 400, 340)}" alt="${escapeHtml(listing.title)}" loading="lazy" />
        <span class="cond-tag">${listing.condition}</span>
        <button class="save-btn ${saved ? "active" : ""}" data-save-id="${listing.id}" title="Save" onclick="handleSaveClick(event, '${listing.id}')">${saved ? "♥" : "♡"}</button>
      </div>
      <div class="product-body">
        <p class="product-title">${escapeHtml(listing.title)}</p>
        <p class="product-price">${formatPrice(listing.price)}</p>
        <p class="product-tag">${CATEGORY_ICONS[listing.category] || ""} ${escapeHtml(listing.category)}</p>
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
