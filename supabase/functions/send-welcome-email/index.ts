// Called directly from the client (signup.html) right after a new account's
// email OTP is verified — not a Database Webhook, since "right after this
// specific frontend step" is simpler to express as a direct call than as a
// webhook on Supabase's own `auth` schema.
//
// The caller's JWT (sent automatically by `sb.functions.invoke`, since
// verify_jwt is left on) is used to look up the real signed-in user's own
// email/name server-side, rather than trusting the `email`/`name` the client
// passed in the body — so this can't be used to send a "welcome" email to an
// arbitrary address. The service_role key is only used for the admin lookup;
// it never reaches the browser.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://marketplace-three-chi.vercel.app";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) return new Response("not signed in", { status: 401 });
    if (!user.email) return new Response("no email on account", { status: 200 });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: profile } = await admin.from("profiles").select("name").eq("id", user.id).single();
    const name = (profile?.name || "there").split(" ")[0];

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not set — skipping send");
      return new Response("email not configured", { status: 200 });
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Marketplace <onboarding@resend.dev>",
        to: user.email,
        subject: "Welcome to Marketplace",
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;">
            <p style="font-size:15px;color:#17171a;">Hey ${name}, welcome to Marketplace 👋</p>
            <p style="font-size:14px;color:#55544c;line-height:1.5;">Your account's confirmed and ready. The fastest way to get a feel for it is to post your first listing — takes under a minute.</p>
            <a href="${SITE_URL}/post-ad.html" style="display:inline-block;margin-top:12px;background:#17171a;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;">Post your first listing</a>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      console.error("Resend error:", await emailRes.text());
      return new Response("email send failed", { status: 200 });
    }
    return new Response("sent", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 200 });
  }
});
