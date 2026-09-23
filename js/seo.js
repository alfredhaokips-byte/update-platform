/* SEO metadata built from real listing data: <title>, meta description,
   Open Graph tags and photo alt text.

   One copy of the wording rules, used in two places:
   - in the browser (listing.html, browse.html load it as a normal <script>),
     after the listing data arrives, so Google sees the right title when it
     renders the page;
   - in worker.js (imported for its side effect), which writes the same tags
     into the HTML before it is sent. WhatsApp, Instagram, Reddit and most
     other link-preview bots never run JavaScript, so without this step a
     shared link would only ever show the page's placeholder title.

   Written as a plain script that hangs its functions on globalThis.MMSeo
   (no import/export) so both of those can load it unchanged. */
(function () {
  const SITE_NAME = "MohallaMarketplace";
  const MAX_DESCRIPTION = 155; // roughly what Google shows before cutting off

  /* Older listings can hold an empty string where a field is now required,
     and a stray "undefined"/"null" string would be worse than nothing in a
     live title, so all of those count as missing. */
  function clean(value) {
    if (value == null) return "";
    const s = String(value).replace(/\s+/g, " ").trim();
    return /^(undefined|null)$/i.test(s) ? "" : s;
  }

  /* ₹2,500 / ₹1,25,000: Indian digit grouping done by hand, so the output is
     identical in every browser and in the Worker runtime. */
  function formatRupees(n) {
    const digits = String(Math.round(n));
    if (digits.length <= 3) return "₹" + digits;
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    return "₹" + rest + "," + last3;
  }

  function itemName(listing) {
    return clean(listing && listing.title) || "Item for sale";
  }

  /* Locality first ("Rohini"); the city only when there's no locality, so a
     listing that has just a city still gets a place in its title. Empty
     string when neither is set — callers leave the place out entirely. */
  function placeName(listing) {
    return clean(listing && listing.locality) || clean(listing && listing.city);
  }

  /* "Rohini, Delhi" for descriptions; drops the city when it's missing or is
     the same word as the locality (avoids "Delhi, Delhi"). */
  function fullPlace(listing) {
    const locality = clean(listing && listing.locality);
    const city = clean(listing && listing.city);
    if (locality && city && locality.toLowerCase() !== city.toLowerCase()) return locality + ", " + city;
    return locality || city;
  }

  function listingTitle(listing) {
    const place = placeName(listing);
    return itemName(listing) + (place ? " in " + place : "") + " | " + SITE_NAME;
  }

  function listingDescription(listing) {
    const price = Number(listing && listing.price);
    const priceText = Number.isFinite(price) && price >= 0 ? (price === 0 ? " for free" : " for " + formatRupees(price)) : "";
    const place = fullPlace(listing);
    const where = place ? " in " + place : "";
    let name = itemName(listing);

    // Longest ending that still fits; a very long item name gets trimmed
    // rather than pushing the price and place out of view.
    const endings = [
      " Buy directly from a local seller on " + SITE_NAME + ".",
      " Buy locally on " + SITE_NAME + ".",
      "",
    ];
    for (const ending of endings) {
      const text = name + priceText + where + "." + ending;
      if (text.length <= MAX_DESCRIPTION) return text;
    }
    const room = MAX_DESCRIPTION - (priceText + where + ".").length - 1;
    name = name.slice(0, Math.max(room, 20)).trim() + "…";
    return (name + priceText + where + ".").slice(0, MAX_DESCRIPTION);
  }

  function listingImageAlt(listing) {
    const place = placeName(listing);
    return itemName(listing) + (place ? " in " + place : "");
  }

  /* First uploaded photo (not a video), for og:image. Null when the listing
     has no photo; the page then falls back to the site logo. */
  function listingImage(listing) {
    const images = (listing && listing.images) || [];
    return images.find((u) => typeof u === "string" && /^https?:\/\//.test(u) && !/\.(mp4|mov|webm)(\?|$)/i.test(u)) || null;
  }

  function browseTitle(category, locality) {
    const cat = clean(category);
    const loc = clean(locality);
    if (cat && loc) return cat + " in " + loc + " | " + SITE_NAME;
    if (cat) return "Browse " + cat + " | " + SITE_NAME;
    if (loc) return "Listings in " + loc + " | " + SITE_NAME;
    return "Browse Listings | " + SITE_NAME;
  }

  /* Browser only: sets document.title and creates/updates the description
     and Open Graph tags. Keys left undefined are not touched. */
  function applyMeta(meta) {
    if (typeof document === "undefined") return;
    if (meta.title) document.title = meta.title;
    const set = (attr, key, value) => {
      if (!value) return;
      let tag = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attr, key);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", value);
    };
    set("name", "description", meta.description);
    set("property", "og:title", meta.title);
    set("property", "og:description", meta.description);
    set("property", "og:image", meta.image);
    set("property", "og:url", meta.url);
    set("name", "twitter:title", meta.title);
    set("name", "twitter:description", meta.description);
    set("name", "twitter:image", meta.image);
  }

  globalThis.MMSeo = {
    SITE_NAME,
    MAX_DESCRIPTION,
    clean,
    formatRupees,
    listingTitle,
    listingDescription,
    listingImageAlt,
    listingImage,
    browseTitle,
    applyMeta,
  };
})();
