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

    // Everything else — every .html/.css/.js/image — is served by the
    // static assets binding, unmodified.
    return env.ASSETS.fetch(request);
  },
};
