/* Thin wrapper around Supabase Auth (email/password for Phase 0 — phone OTP can
   be added later by swapping the calls in signUp/signIn without touching callers). */

const Auth = {
  async getSession() {
    requireSupabaseConfigured();
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async signUp({ email, password, name, locality }) {
    requireSupabaseConfigured();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;

    // The DB trigger creates the profile row; give it a beat, then fill in
    // the fields the trigger can't know (locality, and the city it belongs
    // to — see Store.cityForLocality). Harmless if it races — the user can
    // always change this later from the home page's location picker.
    if (data.user && locality) {
      const city = (typeof Store !== "undefined" && Store.cityForLocality) ? Store.cityForLocality(locality) : undefined;
      await sb.from("profiles").update(city ? { locality, city } : { locality }).eq("id", data.user.id);
    }
    return data;
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
