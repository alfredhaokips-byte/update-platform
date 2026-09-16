-- Self-declared distinction between an individual seller and a small
-- business/shop — a label, not a trust claim: nothing here is verified any
-- more strongly than any other unverified profile field. See README.
alter table profiles add column if not exists seller_type text not null default 'individual'
  check (seller_type in ('individual', 'business'));
alter table profiles add column if not exists shop_name text;
alter table profiles add column if not exists shop_description text;
