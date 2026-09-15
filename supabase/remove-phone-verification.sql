-- Phone OTP verification was tried and dropped (no SMS provider) — see
-- README. `profiles.phone`/`phone_verified` (added in trust-verification.sql)
-- were only ever used to back that one feature (checked before writing this:
-- not referenced anywhere else — no messaging/contact-info use), so they're
-- safe to drop outright rather than leave as dead columns.
alter table profiles drop column if exists phone;
alter table profiles drop column if exists phone_verified;
