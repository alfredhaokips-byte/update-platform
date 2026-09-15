-- Vouches: a lightweight "I trust this person" endorsement — separate from
-- reviews, which require a real message thread with the seller first.
-- Any signed-in user (other than the seller themselves) can vouch for a
-- seller once; vouching again removes it (a toggle, same pattern as
-- saved_items). Run after schema.sql.

create table if not exists vouches (
  voucher_id uuid not null references profiles(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (voucher_id, seller_id),
  check (voucher_id <> seller_id)
);

alter table vouches enable row level security;

drop policy if exists "vouches are publicly readable" on vouches;
create policy "vouches are publicly readable" on vouches for select using (true);

drop policy if exists "users manage their own vouches" on vouches;
create policy "users manage their own vouches" on vouches for all
  using (auth.uid() = voucher_id) with check (auth.uid() = voucher_id);
