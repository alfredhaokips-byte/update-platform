/* Thin wrapper around Supabase Auth (email/password for Phase 0 — phone OTP can
   be added later by swapping the calls in signUp/signIn without touching callers). */

const Auth = {
  async getSession() {
    requireSupabaseConfigured();
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /* `place` is { locality, city, state, lat, lng } from the Nominatim-backed
     location search (see js/maps-client.js) — or null if the user skipped
     location entirely, which is allowed; they can set it later from the
     home page's location picker. */
  async signUp({ email, password, name, place }) {
    requireSupabaseConfigured();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;

    // The DB trigger creates the profile row; give it a beat, then fill in
    // the fields the trigger can't know. Harmless if it races — the user
    // can always change this later from the home page's location picker.
    if (data.user && place) {
      await sb.from("profiles").update({
        locality: place.locality, city: place.city, state: place.state, lat: place.lat, lng: place.lng,
      }).eq("id", data.user.id);
    }
    return data;
  },

  /* `type: "signup"` is what tells Supabase this code is for confirming a
     brand-new account, not a password-reset or sign-in code. */
  async verifyOtp({ email, token }) {
    requireSupabaseConfigured();
    const { data, error } = await sb.auth.verifyOtp({ email, token, type: "signup" });
    if (error) throw error;
    return data;
  },

  async resendOtp({ email }) {
    requireSupabaseConfigured();
    const { error } = await sb.auth.resend({ type: "signup", email });
    if (error) throw error;
  },

  async signIn({ email, password }) {
    requireSupabaseConfigured();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    requireSupabaseConfigured();
    await sb.auth.signOut();
  },

  /* Redirects to login.html (preserving where you were headed) if signed out.
     Call at the top of any page that requires a real account. Returns the
     session on success. */
  async requireAuth() {
    const session = await this.getSession();
    if (!session) {
      const here = window.location.pathname.split("/").pop() + window.location.search;
      window.location.href = "login.html?redirect=" + encodeURIComponent(here);
      return null;
    }
    return session;
  },
};
