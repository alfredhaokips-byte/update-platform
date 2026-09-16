-- Backs supabase/functions/post-to-instagram — see that file for the full
-- flow. Two pieces:
--
-- 1. listings.instagram_posted: a listing is only ever attempted once. A
--    new listing is created with images: [] (Store.addListing) and photos
--    are attached in a SEPARATE update once uploads finish
--    (Store.updateListingImages) — so the Edge Function has to listen for
--    UPDATEs, not INSERTs, and this flag is what stops it from re-firing on
--    every later update to the same row (a view-count bump, an edit, etc.).
alter table listings add column if not exists instagram_posted boolean not null default false;

-- 2. app_settings: a single-row table (id is always 1) for small, global,
-- admin-editable toggles — instagram_auto_post is the first one. Kept as
-- its own tiny table rather than a one-off column somewhere, since more
-- toggles like this are a plausible future need.
create table if not exists app_settings (
  id integer primary key default 1 check (id = 1),
  instagram_auto_post boolean not null default true
);
insert into app_settings (id, instagram_auto_post) values (1, true) on conflict (id) do nothing;

alter table app_settings enable row level security;

drop policy if exists "app_settings readable by everyone" on app_settings;
create policy "app_settings readable by everyone" on app_settings for select using (true);

drop policy if exists "only admins can update app_settings" on app_settings;
create policy "only admins can update app_settings" on app_settings for update
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin = true));
