// Fires on every new row in `messages`. Looks up the OTHER participant in
// the thread (not the sender), emails them via Resend. Wired up via a
// Supabase Database Webhook (Dashboard → Database → Webhooks), not a hand
// -rolled SQL trigger — the webhook UI is the documented, reliable path and
// doesn't risk a silently-broken trigger nobody can see failing.
//
// Uses the service_role key — safe here because this code runs on
// Supabase's servers, never in a browser. Never put this key in any
// client-side file (js/supabase-client.js etc.).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://marketplace-three-chi.vercel.app";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const message = payload.record; // { id, thread_id, sender_id, text, read, created_at }
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
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not set — skipping send");
      return new Response("email not configured", { status: 200 });
    }

    const senderName = senderProfile?.name || "Someone";
    const listingTitle = thread.listings?.title || "your listing";
    const conversationUrl = `${SITE_URL}/messages.html?open=${message.thread_id}`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Marketplace <onboarding@resend.dev>",
        to: recipientEmail,
        subject: `${senderName} sent you a message — ${listingTitle}`,
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;">
            <p style="font-size:15px;color:#17171a;"><strong>${senderName}</strong> sent you a message about <strong>${listingTitle}</strong>:</p>
            <p style="font-size:14px;color:#55544c;background:#f4f3ee;padding:14px 16px;border-radius:10px;">${message.text}</p>
            <a href="${conversationUrl}" style="display:inline-block;margin-top:12px;background:#17171a;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;">Reply on Marketplace</a>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      console.error("Resend error:", await emailRes.text());
      return new Response("email send failed", { status: 200 }); // still 200 — don't retry-storm the webhook
    }

    return new Response("sent", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 200 });
  }
});
