// Generates sitemap.xml on every request by querying Supabase live — not a
// build-time file, so a listing posted (or deleted) five minutes ago is
// already reflected without a redeploy. Reached at /sitemap.xml via the
// rewrite in vercel.json (Vercel's own /api/* functions only ever respond
// under that prefix by default). Zero npm dependencies on purpose, to
// match the rest of this project — just the platform's built-in fetch.
//
// Public data only: `listings` is publicly readable under RLS (see
// supabase/schema.sql), so the anon key is safe here the same way it's
// safe embedded in every page's own client-side JS (js/supabase-client.js).
// Reads from Vercel env vars if set, otherwise falls back to the same
// public values already shipped client-side, so this works with zero
// additional Vercel configuration.

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ecdsteardeybzfnnidym.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjZHN0ZWFyZGV5Ynpmbm5pZHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNzQ4MjIsImV4cCI6MjEwNDk1MDgyMn0.UbEGXbtLxOyesowBr4bhDFm3ntgoXf--QbVgU21JCd8";
const SITE_URL = "https://marketplace-three-chi.vercel.app";

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

module.exports = async (req, res) => {
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

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    [...staticEntries, ...listingEntries].join("\n") +
    `\n</urlset>\n`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  // Regenerated live on every request per the brief, but cached at the edge
  // briefly so a crawler hammering this endpoint doesn't hammer Supabase —
  // stale-while-revalidate means visitors never wait on a slow Supabase
  // round-trip, they just occasionally get a sitemap up to an hour stale.
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(body);
};
