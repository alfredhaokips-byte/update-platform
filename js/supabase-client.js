/* Supabase connection. The anon key is designed to be public — Supabase's
   security model is enforced by the Row Level Security policies in
   supabase/schema.sql, not by hiding this key. Never put the service_role
   key here or anywhere client-side. */

const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL"; // e.g. https://xxxxxxxx.supabase.co
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

const IS_SUPABASE_CONFIGURED = !SUPABASE_URL.startsWith("YOUR_") && !SUPABASE_ANON_KEY.startsWith("YOUR_");

if (!IS_SUPABASE_CONFIGURED) {
  console.warn(
    "Supabase isn't configured yet — edit js/supabase-client.js with your project URL and anon key " +
    "(Supabase dashboard → Settings → API). The app will not load real data until this is set."
  );
}

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
