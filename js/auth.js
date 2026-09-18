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
  /* With "Confirm email" on there is no session until the email is confirmed,
     so nothing can be written to `profiles` here (its RLS needs auth.uid() =
     id — a write attempted at this point silently affects zero rows, which is
     how a locality picked at signup used to vanish). The choices ride along on
     the account itself as user_metadata instead, and Store.applySignupExtras()
     applies them on the first authenticated page load — whether the user
     confirms by typing the emailed code or by clicking the emailed link (which
     lands on a fresh page load, possibly on another device).
     `emailRedirectTo` states where a confirmation link should land instead of
     leaving it to the request's Referer header; if the URL isn't allow-listed
     in the dashboard, Supabase falls back to its Site URL, as before. */
  async signUp({ email, password, name, place, sellerType }) {
    requireSupabaseConfigured();
    const extras = { signup_pending: true };
    if (place) {
      extras.signup_place = { locality: place.locality, city: place.city, state: place.state, lat: place.lat, lng: place.lng };
    }
    if (sellerType) extras.signup_seller = sellerType;
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { name, ...extras }, emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) throw error;
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
