// Worker entry point for Cloudflare Workers Static Assets. Every request
// hits this fetch handler first — /sitemap.xml is generated dynamically
// (same logic the earlier Pages Functions attempt used, before this project
// moved from Pages to plain Workers), everything else passes straight
// through to the static assets binding untouched.
//
// Ported from the earlier functions/sitemap.js (Cloudflare Pages Functions
// convention, onRequestGet({ env })), which doesn't run under plain Workers
// at all — Pages Functions and a Workers `main` script are two different
// routing systems, and the deployed site was serving assets with no custom
// script attached until now, which is why /sitemap.xml was 404ing.

// Same title/description/alt wording rules the browser uses (js/seo.js is a
// plain script that registers globalThis.MMSeo; imported here for that side
// effect, and wrangler bundles it into the Worker).
import "./js/seo.js";

const FALLBACK_SUPABASE_URL = "https://ecdsteardeybzfnnidym.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjZHN0ZWFyZGV5Ynpmbm5pZHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNzQ4MjIsImV4cCI6MjEwNDk1MDgyMn0.UbEGXbtLxOyesowBr4bhDFm3ntgoXf--QbVgU21JCd8";
const SITE_URL = "https://mohallamarketplace.in";

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc, lastmod) {
  return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
}

// Public data only: `listings` is publicly readable under RLS (see
// supabase/schema.sql), so the anon key is safe here the same way it's
// safe embedded in every page's own client-side JS (js/supabase-client.js).
// Reads from the Worker's env bindings (wrangler.jsonc [vars], or Cloudflare
// dashboard → Settings → Variables) if set, otherwise falls back to the
// same public values already shipped client-side, so this works with zero
// additional configuration.
async function buildSitemap(env) {
  const SUPABASE_URL = (env && env.SUPABASE_URL) || FALLBACK_SUPABASE_URL;
  const SUPABASE_ANON_KEY = (env && env.SUPABASE_ANON_KEY) || FALLBACK_SUPABASE_ANON_KEY;

  let listings = [];
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?select=id,created_at&order=created_at.desc`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (r.ok) listings = await r.json();
    else console.error("sitemap: listings fetch returned", r.status, await r.text());
  } catch (err) {
    // Still serve the static pages below rather than a hard 500 — a
    // sitemap missing listings once is far better than no sitemap at all.
    console.error("sitemap: failed to fetch listings", err);
  }

  const now = new Date().toISOString();
  // Community's General/Feedback/Notice Board tabs are client-side state
  // only (setSection() in community.html never changes the URL) — there's
  // no distinct, crawlable URL for each yet, so only the one real page URL
  // is listed here.
  const staticEntries = [
    urlEntry(`${SITE_URL}/`, now),
    urlEntry(`${SITE_URL}/browse.html`, now),
    urlEntry(`${SITE_URL}/community.html`, now),
  ];
  const listingEntries = listings
    .filter((l) => l && l.id)
    .map((l) => urlEntry(`${SITE_URL}/listing.html?id=${l.id}`, new Date(l.created_at).toISOString()));

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    [...staticEntries, ...listingEntries].join("\n") +
    `\n</urlset>\n`
  );
}

// ---------------------------------------------------------------------------
// Listing pages: real title / description / Open Graph tags in the HTML
// itself. listing.html also sets these with JavaScript once the listing
// loads, which is enough for Google, but WhatsApp, Instagram, Reddit, Slack
// and most other link-preview bots read only the raw HTML and never run
// scripts. Without this, every shared listing previewed as "Listing |
// MohallaMarketplace". If anything here fails, the page is served exactly as
// before (the client-side code still fixes the title in the browser).
// ---------------------------------------------------------------------------
const LISTING_ID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

async function fetchListingForMeta(env, id) {
  const SUPABASE_URL = (env && env.SUPABASE_URL) || FALLBACK_SUPABASE_URL;
  const SUPABASE_ANON_KEY = (env && env.SUPABASE_ANON_KEY) || FALLBACK_SUPABASE_ANON_KEY;
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/listings?select=id,title,price,locality,city,images&id=eq.${id}&limit=1`,
    {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      // Short edge cache: a burst of preview bots hitting one shared link
      // makes one Supabase call, and an edited title shows within minutes.
      cf: { cacheTtl: 300, cacheEverything: true },
    }
  );
  if (!r.ok) return null;
  const rows = await r.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function listingPageWithMeta(request, env, assetResponse) {
  const id = ((new URL(request.url).searchParams.get("id") || "").match(LISTING_ID_RE) || [null])[0];
  if (!id || !assetResponse.ok) return assetResponse;

  let listing = null;
  try {
    listing = await fetchListingForMeta(env, id);
  } catch (err) {
    console.error("listing meta: fetch failed", err);
  }
  if (!listing) return assetResponse;

  const SEO = globalThis.MMSeo;
  const title = SEO.listingTitle(listing);
  const description = SEO.listingDescription(listing);
  const image = SEO.listingImage(listing);
  const pageUrl = `${SITE_URL}/listing.html?id=${listing.id}`;

  // content values are escaped by HTMLRewriter's setAttribute / setInnerContent.
  const content = (value) => ({ element(el) { if (value) el.setAttribute("content", value); } });
  let rewriter = new HTMLRewriter()
    .on("title", { element(el) { el.setInnerContent(title); } })
    .on('meta[name="description"]', content(description))
    .on('meta[property="og:title"]', content(title))
    .on('meta[property="og:description"]', content(description))
    .on('meta[property="og:image"]', content(image))
    .on("head", {
      element(el) {
        // Tags that only make sense per listing, so they aren't in the
        // static file at all.
        const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        el.append(`<meta property="og:url" content="${esc(pageUrl)}">\n`, { html: true });
        el.append(`<link rel="canonical" href="${esc(pageUrl)}">\n`, { html: true });
        el.append(`<meta name="twitter:title" content="${esc(title)}">\n`, { html: true });
        el.append(`<meta name="twitter:description" content="${esc(description)}">\n`, { html: true });
        if (image) el.append(`<meta name="twitter:image" content="${esc(image)}">\n`, { html: true });
      },
    });

  const out = rewriter.transform(assetResponse);
  const headers = new Headers(out.headers);
  // Page body now depends on live data; don't let a stale copy stick around.
  headers.set("Cache-Control", "public, max-age=0, s-maxage=300");
  return new Response(out.body, { status: out.status, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/sitemap.xml") {
      const body = await buildSitemap(env);
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          // Regenerated live on every request per the brief, but cached at
          // the edge briefly so a crawler hammering this endpoint doesn't
          // hammer Supabase — stale-while-revalidate means visitors never
          // wait on a slow Supabase round-trip, they just occasionally get
          // a sitemap up to an hour stale. Same value used since the
          // original Vercel version.
          "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
        },
      });
    }

    // wrangler.jsonc sets html_handling to "none" so /foo.html is served
    // directly instead of 307-redirecting to /foo (this project's URLs are
    // all .html?query, everywhere — that redirect broke every internal link
    // and every shared listing URL). "none" also means Cloudflare no longer
    // auto-resolves / to /index.html the way its default mode would, so
    // that one case needs handling here explicitly — confirmed by testing
    // locally, not assumed: without this, the homepage itself 404s.
    if (url.pathname === "/") {
      return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
    }

    if (url.pathname === "/listing.html" && request.method === "GET") {
      const asset = await env.ASSETS.fetch(request);
      return listingPageWithMeta(request, env, asset);
    }

    // Everything else — every .html/.css/.js/image — is served by the
    // static assets binding, unmodified.
    return env.ASSETS.fetch(request);
  },
};
