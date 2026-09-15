// Manually triggered by an admin — see community.html's "Also email
// newsletter subscribers" checkbox on a new Notice Board post. There is no
// schedule/cron here on purpose: the brief calls for event-triggered sends
// only (tied to major updates an admin actually posts), never a recurring
// blast.
//
// Admin-ness is checked here, server-side, against the caller's own JWT —
// never trusted from the request body — since this endpoint can email every
// opted-in user at once.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) return new Response("not signed in", { status: 401 });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: callerProfile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
    if (!callerProfile?.is_admin) return new Response("admin only", { status: 403 });

    const { subject, html } = await req.json();
    if (!subject || !html) return new Response("subject and html required", { status: 400 });
    if (!RESEND_API_KEY) return new Response("email not configured", { status: 200 });

    const { data: subscribers, error: subErr } = await admin
      .from("profiles")
      .select("id")
      .eq("newsletter_opt_in", true);
    if (subErr) throw subErr;

    // profiles doesn't hold email — that lives on auth.users, so resolve it
    // per id via the admin API rather than duplicating it into a public table.
    const emails: string[] = [];
    for (const p of subscribers || []) {
      const { data } = await admin.auth.admin.getUserById(p.id);
      if (data?.user?.email) emails.push(data.user.email);
    }

    let sent = 0;
    for (const batch of chunk(emails, 100)) {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch.map((to) => ({
          from: "Marketplace <onboarding@resend.dev>",
          to,
          subject,
          html,
        }))),
      });
      if (res.ok) sent += batch.length;
      else console.error("Resend batch error:", await res.text());
    }

    return new Response(JSON.stringify({ recipients: emails.length, sent }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 });
  }
});
