-- Phase 0.5 — real photo upload.
-- Run this once in the SQL Editor, same as schema.sql. Safe to re-run.

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

-- Path convention: {user_id}/{listing_id}/{filename} — storage.foldername(name)
-- splits that into ['{user_id}', '{listing_id}'], so [1] is always the uploader's id.
-- This mirrors the `auth.uid() = seller_id` ownership check already used on the
-- listings table itself (see schema.sql).

drop policy if exists "listing photos are publicly viewable" on storage.objects;
create policy "listing photos are publicly viewable" on storage.objects
  for select using (bucket_id = 'listing-photos');

drop policy if exists "authenticated users can upload listing photos" on storage.objects;
create policy "authenticated users can upload listing photos" on storage.objects
  for insert with check (
    bucket_id = 'listing-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "uploader can update their listing photos" on storage.objects;
create policy "uploader can update their listing photos" on storage.objects
  for update using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "uploader can delete their listing photos" on storage.objects;
create policy "uploader can delete their listing photos" on storage.objects
  for delete using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
