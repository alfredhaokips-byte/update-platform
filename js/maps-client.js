/* Free mapping/geocoding — Leaflet + OpenStreetMap tiles for the map, and
   Nominatim (OSM's free geocoding service) for location search. No API key,
   no billing account, unlike the Google Maps/Places approach this replaces.

   Honest limits, worth knowing before this gets real traffic:
   - Nominatim's public instance enforces max 1 request/second per client
     and asks that requests identify the calling application. Browsers
     forbid scripts from setting a custom `User-Agent` header (a Fetch spec
     restriction, not something we can work around client-side), so the
     `Referer` header the browser sends automatically is what stands in for
     that here — acceptable for Nominatim's own stated browser-app carve-out,
     but not equivalent to a real identifying header.
   - This is fine for an early-stage app's usage level. It will NOT scale to
     real production traffic — at that point this needs either a small
     server-side proxy (so a proper User-Agent can be set) or a self-hosted
     Nominatim instance. Flagging this now so it isn't a surprise later.
   - The 1 req/sec limit is enforced client-side below (a simple queue/
     throttle) so rapid typing doesn't hammer the public server. */

const IS_MAPS_CONFIGURED = true; // Nominatim needs no key/billing at all — always on
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

let _lastNominatimRequestAt = 0;
let _nominatimQueue = Promise.resolve();

/* Client-side throttle to stay within Nominatim's 1 req/sec policy even if
   several parts of the page fire searches close together. */
function throttledNominatimFetch(path, params) {
  const run = async () => {
    const wait = Math.max(0, 1100 - (Date.now() - _lastNominatimRequestAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    _lastNominatimRequestAt = Date.now();
    const url = `${NOMINATIM_BASE}${path}?${new URLSearchParams(params)}`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    if (!res.ok) throw new Error("Location search failed");
    return res.json();
  };
  _nominatimQueue = _nominatimQueue.then(run, run);
  return _nominatimQueue;
}

async function searchNominatim(query) {
  if (!query || query.trim().length < 3) return [];
  const data = await throttledNominatimFetch("/search", {
    q: query, format: "jsonv2", addressdetails: "1", countrycodes: "in", limit: "6",
  });
  return (data || []).map((r) => ({
    label: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    address: r.address || {},
  }));
}

function placeFromNominatimResult(r) {
  const a = r.address || {};
  const locality = a.suburb || a.neighbourhood || a.village || a.town || a.city_district || (r.label || "").split(",")[0];
  const city = a.city || a.town || a.county || a.state_district || a.state || locality;
  const state = a.state || null;
  return { locality, city, state, lat: r.lat, lng: r.lng };
}

let _leafletLoadPromise = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (_leafletLoadPromise) return _leafletLoadPromise;
  _leafletLoadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS_URL;
      document.head.appendChild(link);
    }
    const s = document.createElement("script");
    s.src = LEAFLET_JS_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load the map"));
    document.head.appendChild(s);
  });
  return _leafletLoadPromise;
}

/* Renders a small read-only Leaflet map into containerEl, centered on
   lat/lng with a single marker. Returns the map instance (or null if
   lat/lng aren't real numbers yet — nothing to show). */
async function mountLeafletMap(containerEl, lat, lng, opts) {
  if (lat == null || lng == null || Number.isNaN(+lat) || Number.isNaN(+lng)) {
    containerEl.hidden = true;
    return null;
  }
  await loadLeaflet();
  containerEl.hidden = false;
  containerEl.innerHTML = "";
  const map = L.map(containerEl, { zoomControl: false, attributionControl: true }).setView([lat, lng], (opts && opts.zoom) || 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  L.marker([lat, lng]).addTo(map);
  return map;
}

/* Wires a free-text, debounced Nominatim search onto a text input, with a
   simple dropdown of results (Nominatim has no ready-made widget the way
   Google Places did, so this is hand-built). onPlace({ locality, city,
   state, lat, lng }) fires only when the user picks a real suggestion. */
function mountPlacesAutocomplete(inputEl, onPlace) {
  const dropdown = document.createElement("div");
  dropdown.className = "nominatim-dropdown";
  dropdown.hidden = true;
  inputEl.insertAdjacentElement("afterend", dropdown);
  if (getComputedStyle(inputEl.parentElement).position === "static") {
    inputEl.parentElement.style.position = "relative";
  }

  let debounceTimer = null;
  let currentResults = [];

  function closeDropdown() { dropdown.hidden = true; dropdown.innerHTML = ""; }

  inputEl.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const q = inputEl.value.trim();
    if (q.length < 3) { closeDropdown(); return; }
    debounceTimer = setTimeout(async () => {
      try {
        currentResults = await searchNominatim(q);
        if (currentResults.length === 0) { closeDropdown(); return; }
        dropdown.innerHTML = currentResults.map((r, i) =>
          `<button type="button" class="nominatim-item" data-i="${i}">${escapeHtml(r.label)}</button>`
        ).join("");
        dropdown.hidden = false;
        dropdown.querySelectorAll(".nominatim-item").forEach((btn) => {
          btn.addEventListener("click", () => {
            const r = currentResults[+btn.dataset.i];
            inputEl.value = r.label;
            closeDropdown();
            onPlace(placeFromNominatimResult(r));
          });
        });
      } catch (err) { closeDropdown(); /* non-critical — user can keep typing or try again */ }
    }, 500); // debounced well past Nominatim's 1 req/sec floor
  });

  document.addEventListener("click", (e) => {
    if (e.target !== inputEl && !dropdown.contains(e.target)) closeDropdown();
  });

  return { close: closeDropdown };
}
