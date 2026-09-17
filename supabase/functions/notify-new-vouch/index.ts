// Fires on every new row in `vouches`. Emails the seller being vouched for
// via Gmail SMTP. Wired up via a Supabase Database Webhook (Dashboard →
// Database → Webhooks) on INSERT only — a vouch toggle-off is a DELETE on
// the same table and should never send an email.
//
// Uses the service_role key — safe here because this code runs on
// Supabase's servers, never in a browser.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendGmailEmail } from "../_shared/send-gmail.ts";

const SITE_URL = "https://marketplace-three-chi.vercel.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const vouch = payload.record; // { voucher_id, seller_id, listing_id, created_at }
    if (!vouch) return new Response("no record", { status: 200 });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const [{ data: sellerAuth }, { data: voucherProfile }, listingRes] = await Promise.all([
      admin.auth.admin.getUserById(vouch.seller_id),
      admin.from("profiles").select("name").eq("id", vouch.voucher_id).single(),
      vouch.listing_id
        ? admin.from("listings").select("title").eq("id", vouch.listing_id).single()
        : Promise.resolve({ data: null }),
    ]);

    const sellerEmail = sellerAuth?.user?.email;
    if (!sellerEmail) return new Response("seller has no email", { status: 200 });

    const voucherName = voucherProfile?.name || "Someone";
    const listingTitle = listingRes.data?.title || null;
    const profileUrl = `${SITE_URL}/profile.html?id=${vouch.seller_id}`;

    const subject = `${voucherName} just vouched for you on Mohalla Market`;
    const body = listingTitle
      ? `<strong>${voucherName}</strong> just vouched for your listing <strong>${listingTitle}</strong> on Mohalla Market.`
      : `<strong>${voucherName}</strong> just vouched for you on Mohalla Market.`;

    const sent = await sendGmailEmail({
      to: sellerEmail,
      subject,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;">
          <p style="font-size:15px;color:#17171a;">${body}</p>
          <a href="${profileUrl}" style="display:inline-block;margin-top:12px;background:#17171a;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;">See your profile</a>
        </div>
      `,
    });

    return new Response(sent ? "sent" : "email send failed", { status: 200 }); // always 200 — don't retry-storm the webhook
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 200 });
  }
});
