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

  /* Live again — see signup.html. This verifies a typed 6-digit code, so it
     depends on the "Confirm signup" email template using {{ .Token }} rather
     than Supabase's default {{ .ConfirmationURL }}; with the default link
     template the user gets nothing typeable and this can never be reached.
     `type: "signup"` is what tells Supabase this code is for confirming a
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

  /* `redirectTo` must be an absolute URL Supabase is configured to allow
     (Dashboard → Authentication → URL Configuration → Redirect URLs) —
     that's where the reset link in the email sends the user, landing them
     on reset-password.html with a real recovery session already active. */
  async resetPasswordForEmail(email) {
    requireSupabaseConfigured();
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password.html`,
    });
    if (error) throw error;
  },

  /* Only works with an active recovery session — i.e. only right after
     following a real reset-password link, which is what establishes one. */
  async updatePassword(password) {
    requireSupabaseConfigured();
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw error;
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
