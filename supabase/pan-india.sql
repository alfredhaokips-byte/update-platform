-- Pan-India expansion: profiles.city / listings.city now hold a real city
-- name from Google Places (e.g. "Mumbai") instead of the old hardcoded
-- "Delhi NCR" default, and both tables gain state + lat/lng for possible
-- future distance-based sorting. Run after schema.sql.
--
-- The `localities` table (a fixed NCR-only dropdown) no longer drives the
-- location INPUT — that's now Google Places Autocomplete, restricted to
-- India (see js/maps-client.js). It's left in place rather than dropped:
-- existing rows aren't referenced by a foreign key anywhere, so nothing
-- breaks either way, and it's harmless reference data if it's useful again
-- later (e.g. a "browse by known locality" shortcut). No app code queries
-- it for the signup/post-ad location field anymore.

alter table profiles add column if not exists state text;
alter table profiles add column if not exists lat double precision;
alter table profiles add column if not exists lng double precision;
alter table profiles alter column city drop default;
alter table profiles alter column city drop not null;

alter table listings add column if not exists state text;
alter table listings add column if not exists lat double precision;
alter table listings add column if not exists lng double precision;
alter table listings alter column city drop default; -- was the stale 'Guwahati, Assam' default; every insert already sets a real city explicitly
