-- Vouching was seller-level only (see vouches.sql) — vouching from any one
-- of a seller's listing pages endorsed the seller as a whole, so every one
-- of their listings correctly (if confusingly) showed the same "vouched"
-- state. Splitting it: a vouch can now optionally be scoped to one specific
-- listing (nullable `listing_id`) — null keeps meaning "a general vouch for
-- this seller" (profile.html), a real id means "a vouch for this listing"
-- (listing.html). Existing rows are all general vouches, which is exactly
-- right — nothing to backfill.

alter table vouches add column if not exists listing_id uuid references listings(id) on delete cascade;

-- The old primary key (voucher_id, seller_id) can't express "one general
-- vouch AND one vouch per listing, per voucher" — replaced with two partial
-- unique indexes instead (Postgres treats NULLs as distinct in a plain
-- unique constraint, so a partial index is the correct way to say "unique
-- among the general vouches" separately from "unique among the per-listing
-- ones").
alter table vouches drop constraint if exists vouches_pkey;
create unique index if not exists vouches_general_uniq on vouches (voucher_id, seller_id) where listing_id is null;
create unique index if not exists vouches_listing_uniq on vouches (voucher_id, listing_id) where listing_id is not null;

-- RLS policies from vouches.sql (public read, manage your own row) already
-- cover the new column with no changes needed.
