// Deletes the CALLER's own account. Identity comes from the caller's JWT
// (sb.functions.invoke sends it automatically), never from the request body,
// so nobody can delete someone else's account through this.
//
// Deleting the auth user is what frees the email for a fresh signup. It
// cascades through profiles (profiles.id references auth.users on delete
// cascade) to listings, message threads on both sides, messages, reviews,
// vouches, Q&A and saved items. Storage files aren't covered by that cascade,
// so this removes them explicitly first.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// Storage list() is one level deep; listing photos live at {uid}/{listing_id}/file.
async function listAllPaths(admin: ReturnType<typeof createClient>, bucket: string, prefix: string): Promise<string[]> {
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return [];
  const paths: string[] = [];
  for (const item of data) {
    const full = `${prefix}/${item.name}`;
    if (item.id) paths.push(full);
    else paths.push(...(await listAllPaths(admin, bucket, full)));
  }
  return paths;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) return json({ error: "Not signed in" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    for (const bucket of ["listing-photos", "profile-photos"]) {
      const paths = await listAllPaths(admin, bucket, user.id);
      if (paths.length) {
        const { error } = await admin.storage.from(bucket).remove(paths);
        if (error) console.error(`storage cleanup failed for ${bucket}:`, error.message);
      }
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) return json({ error: delErr.message }, 500);

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: "Couldn't delete account" }, 500);
  }
});
