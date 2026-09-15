-- Lets a user opt out of "major update" newsletter emails (the transactional
-- new-message emails are unaffected — this only gates the admin-triggered
-- newsletter send in supabase/functions/send-newsletter). Defaults to true
-- so existing users are opted in until they say otherwise, matching what
-- signing up for the site already implies.
alter table profiles add column if not exists newsletter_opt_in boolean not null default true;
