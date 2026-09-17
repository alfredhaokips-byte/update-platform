// Shared Gmail SMTP sender, used by every notification Edge Function instead
// of the Resend HTTP API those functions used before — Resend's free tier
// won't deliver to real recipients without a verified sending domain (the
// exact problem that blocked email OTP for a while, see README), while
// Gmail SMTP with an App Password is already confirmed working for real
// delivery. One connection, reused everywhere, same reasoning as the
// "one provider for everything" call made earlier for Auth email.
//
// Requires two function secrets (set once, never in client code):
//   supabase secrets set GMAIL_USER=youraddress@gmail.com
//   supabase secrets set GMAIL_APP_PASSWORD=your_16_char_app_password
// (Google Account → Security → 2-Step Verification → App passwords — the
// same app password already generated for Supabase Auth's SMTP settings
// can be reused here, it's not tied to one consumer.)

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const GMAIL_USER = Deno.env.get("GMAIL_USER");
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");

export async function sendGmailEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<boolean> {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error("GMAIL_USER/GMAIL_APP_PASSWORD not set — skipping send");
    return false;
  }

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
    },
  });

  try {
    await client.send({
      from: `Mohalla Market <${GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("Gmail SMTP error:", err);
    return false;
  } finally {
    try { await client.close(); } catch (_closeErr) { /* already closed/broken — nothing to do */ }
  }
}
