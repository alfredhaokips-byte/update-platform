// Cross-posts a new listing's first photo to @mohallamarketplace on
// Instagram via the Graph API's Content Publishing endpoint, once a real
// photo actually exists for it.
//
// Fires on UPDATE to `listings`, NOT insert — a listing is created with
// images: [] (Store.addListing in js/data.js) and its photos are attached
// in a SEPARATE update once uploads finish (Store.updateListingImages), so
// the first real, publicly-reachable photo URL doesn't exist until that
// second write. Wired up via a Supabase Database Webhook (Dashboard →
// Database → Webhooks) on `listings`, UPDATE — same documented,
// dashboard-driven path as notify-new-message, not a hand-rolled SQL
// trigger.
//
// Every other update to a listings row (a view-count bump on each page
// view, a future edit, ...) fires this same webhook too, so this has to be
// strictly idempotent: listings.instagram_posted is set to true the moment
// this function makes its one attempt, success or failure, before ever
// calling the Graph API — so a rate-limited or failed call is logged and
// dropped, never retried on the next unrelated update. The brief's own
// guidance is not to build a real retry/queue system until listing volume
// actually approaches Instagram's ~25-posts/24h Content Publishing limit;
// this is that "drop and log" behavior, deliberately not a queue.
//
// Requires INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID as
// function secrets (supabase secrets set ...) from the manual Meta
// Developer / Business account setup — never hardcoded, never sent to the
// browser. See README for that one-time setup.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GRAPH_API_VERSION = "v21.0";
const INSTAGRAM_ACCESS_TOKEN = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
const INSTAGRAM_BUSINESS_ACCOUNT_ID = Deno.env.get("INSTAGRAM_BUSINESS_ACCOUNT_ID");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const listing = payload.record; // the full row AFTER this update
    const oldListing = payload.old_record; // the row BEFORE it
    if (!listing) return new Response("no record", { status: 200 });

    const hasPhotoNow = Array.isArray(listing.images) && listing.images.length > 0;
    const hadPhotoBefore = Array.isArray(oldListing?.images) && oldListing.images.length > 0;
    if (!hasPhotoNow || hadPhotoBefore || listing.instagram_posted) {
      return new Response("nothing to do", { status: 200 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // One attempt per listing, ever — recorded before the Graph API call
    // itself so a failure below can never cause a retry on a later,
    // unrelated update to this same row.
    await admin.from("listings").update({ instagram_posted: true }).eq("id", listing.id);

    const { data: settings } = await admin
      .from("app_settings").select("instagram_auto_post").eq("id", 1).maybeSingle();
    if (settings && settings.instagram_auto_post === false) {
      return new Response("auto-post paused", { status: 200 });
    }

    if (!INSTAGRAM_ACCESS_TOKEN || !INSTAGRAM_BUSINESS_ACCOUNT_ID) {
      console.error("INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_BUSINESS_ACCOUNT_ID not set — skipping post");
      return new Response("instagram not configured", { status: 200 });
    }

    const imageUrl = listing.images[0];
    // The Content Publishing container endpoint used here takes a single
    // static image, not video — a listing whose first upload is a video
    // clip (see README's photo/video upload section) is skipped rather
    // than sent to an endpoint that will just reject it.
    if (!/\.(jpe?g|png)(\?|$)/i.test(imageUrl)) {
      console.log(`Listing ${listing.id}'s first media isn't a postable image — skipping Instagram post`);
      return new Response("not a postable image", { status: 200 });
    }

    const { data: seller } = await admin.from("profiles").select("name").eq("id", listing.seller_id).single();
    const firstName = (seller?.name || "A neighbour").split(" ")[0];
    const priceText = "₹" + Number(listing.price).toLocaleString("en-IN");
    const caption =
      `${listing.title} — ${priceText}\n` +
      `Posted by ${firstName} on Mohalla Market.\n` +
      `New on Mohalla Market — link in bio to see more 🛍️`;

    const containerRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl, caption, access_token: INSTAGRAM_ACCESS_TOKEN }),
      }
    );
    const containerData = await containerRes.json();
    if (!containerRes.ok || !containerData.id) {
      // Covers every failure mode the brief calls out — rate limit, expired
      // token, any other API error — with the same generic handling: log
      // what the Graph API actually said, never throw, never touch the
      // listing row again.
      console.error(`Instagram container creation failed for listing ${listing.id}:`, JSON.stringify(containerData));
      return new Response("container failed", { status: 200 });
    }

    const publishRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: containerData.id, access_token: INSTAGRAM_ACCESS_TOKEN }),
      }
    );
    const publishData = await publishRes.json();
    if (!publishRes.ok) {
      console.error(`Instagram publish failed for listing ${listing.id}:`, JSON.stringify(publishData));
      return new Response("publish failed", { status: 200 });
    }

    return new Response("posted", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 200 });
  }
});
