// Fires on every new row in `messages`. Looks up the OTHER participant in
// the thread (not the sender), emails them via Gmail SMTP. Wired up via a
// Supabase Database Webhook (Dashboard → Database → Webhooks), not a hand
// -rolled SQL trigger — the webhook UI is the documented, reliable path and
// doesn't risk a silently-broken trigger nobody can see failing.
//
// Also covers "Buy Now" — that button has never had its own table, it just
// inserts a `messages` row with canned text and message_type='buy_interest'
// (see listing.html's sendBuyNow() and supabase/messages-type.sql). Same
// webhook, different subject/template based on that column, rather than a
// second webhook that would double-email one Buy Now tap.
//
// Uses the service_role key — safe here because this code runs on
// Supabase's servers, never in a browser. Never put this key in any
// client-side file (js/supabase-client.js etc.).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendGmailEmail } from "../_shared/send-gmail.ts";

const SITE_URL = "https://marketplace-three-chi.vercel.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const message = payload.record; // { id, thread_id, sender_id, text, message_type, read, created_at }
    if (!message) return new Response("no record", { status: 200 });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: thread } = await admin
      .from("message_threads")
      .select("buyer_id, seller_id, listing_id, listings(title)")
      .eq("id", message.thread_id)
      .single();
    if (!thread) return new Response("thread not found", { status: 200 });

    const recipientId = message.sender_id === thread.buyer_id ? thread.seller_id : thread.buyer_id;

    const [{ data: recipientAuth }, { data: senderProfile }] = await Promise.all([
      admin.auth.admin.getUserById(recipientId),
      admin.from("profiles").select("name").eq("id", message.sender_id).single(),
    ]);

    const recipientEmail = recipientAuth?.user?.email;
    if (!recipientEmail) return new Response("recipient has no email", { status: 200 });

    const senderName = senderProfile?.name || "Someone";
    const listingTitle = thread.listings?.title || "your listing";
    const conversationUrl = `${SITE_URL}/messages.html?open=${message.thread_id}`;

    const isBuyInterest = message.message_type === "buy_interest";
    const subject = isBuyInterest
      ? `${senderName} is interested in your listing: ${listingTitle}`
      : `${senderName} sent you a message — ${listingTitle}`;
    const intro = isBuyInterest
      ? `<strong>${senderName}</strong> is interested in buying <strong>${listingTitle}</strong>:`
      : `<strong>${senderName}</strong> sent you a message about <strong>${listingTitle}</strong>:`;

    const sent = await sendGmailEmail({
      to: recipientEmail,
      subject,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;">
          <p style="font-size:15px;color:#17171a;">${intro}</p>
          <p style="font-size:14px;color:#55544c;background:#f4f3ee;padding:14px 16px;border-radius:10px;">${message.text}</p>
          <a href="${conversationUrl}" style="display:inline-block;margin-top:12px;background:#17171a;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;">Reply on Mohalla Market</a>
        </div>
      `,
    });

    return new Response(sent ? "sent" : "email send failed", { status: 200 }); // always 200 — don't retry-storm the webhook
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 200 });
  }
});
