-- Profile picture upload + status/bio text. Same ownership pattern as
-- listing-photos (see storage-policies.sql) — public read, path
-- {user_id}/{filename}, upload/update/delete restricted to the owner.
-- Run after schema.sql.

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

drop policy if exists "profile photos are publicly viewable" on storage.objects;
create policy "profile photos are publicly viewable" on storage.objects
  for select using (bucket_id = 'profile-photos');

drop policy if exists "authenticated users can upload their profile photo" on storage.objects;
create policy "authenticated users can upload their profile photo" on storage.objects
  for insert with check (
    bucket_id = 'profile-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner can update their profile photo" on storage.objects;
create policy "owner can update their profile photo" on storage.objects
  for update using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner can delete their profile photo" on storage.objects;
create policy "owner can delete their profile photo" on storage.objects
  for delete using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists status_text text check (char_length(status_text) <= 140);
