/* Supabase connection. The anon key is designed to be public — Supabase's
   security model is enforced by the Row Level Security policies in
   supabase/schema.sql, not by hiding this key. Never put the service_role
   key here or anywhere client-side. */

const SUPABASE_URL = "https://ecdsteardeybzfnnidym.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjZHN0ZWFyZGV5Ynpmbm5pZHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNzQ4MjIsImV4cCI6MjEwNDk1MDgyMn0.UbEGXbtLxOyesowBr4bhDFm3ntgoXf--QbVgU21JCd8";

const IS_SUPABASE_CONFIGURED = !SUPABASE_URL.startsWith("YOUR_") && !SUPABASE_ANON_KEY.startsWith("YOUR_");

if (!IS_SUPABASE_CONFIGURED) {
  console.warn(
    "Supabase isn't configured yet — edit js/supabase-client.js with your project URL and anon key " +
    "(Supabase dashboard → Settings → API). The app will not load real data until this is set."
  );
}

/* An emailed confirmation link lands here with the session in the URL fragment
   (#access_token=...&type=signup). supabase-js consumes it and then clears the
   fragment, leaving a bare "/#" — so note it *before* the client is created,
   for initPage() to acknowledge. */
window.__cameFromEmailLink = /[#&]type=signup(&|$)/.test(window.location.hash) && /access_token=/.test(window.location.hash);

const sb = IS_SUPABASE_CONFIGURED
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

function requireSupabaseConfigured() {
  if (!IS_SUPABASE_CONFIGURED) {
    document.body.innerHTML = `
      <div style="max-width:480px;margin:60px auto;padding:24px;font-family:-apple-system,sans-serif;text-align:center;">
        <div style="font-size:36px;margin-bottom:10px;">🔌</div>
        <h2 style="margin-bottom:8px;">Supabase isn't connected yet</h2>
        <p style="color:#666;font-size:14px;line-height:1.5;">
          Edit <code>js/supabase-client.js</code> and set <code>SUPABASE_URL</code> and
          <code>SUPABASE_ANON_KEY</code> from your Supabase project's
          Settings → API page, then reload.
        </p>
      </div>`;
    throw new Error("Supabase not configured");
  }
}
