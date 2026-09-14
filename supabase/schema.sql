-- MohallaMarket — Phase 0 schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run: every statement is guarded with IF NOT EXISTS / OR REPLACE where possible.

-- ============================================================================
-- PROFILES
-- One row per auth.users row. Created automatically by the trigger below
-- the moment someone signs up, so the app never has to insert this manually.
-- ============================================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'New user',
  avatar_seed text not null default gen_random_uuid()::text,
  locality text,
  city text not null default 'Guwahati, Assam',
  verified boolean not null default false,
  deals integer not null default 0,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever someone signs up via Supabase Auth.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, avatar_seed)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.id::text
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- LISTINGS
-- category is free-text (user-chosen tag), not a fixed enum — see the
-- tag_stats view below for how "featured category" graduation is computed.
-- ============================================================================
create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  category text not null,
  price integer not null check (price >= 0),
  locality text not null,
  city text not null default 'Guwahati, Assam',
  condition text not null check (condition in ('New', 'Used')),
  description text not null default '',
  images text[] not null default '{}',
  views integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists listings_seller_idx on listings(seller_id);
create index if not exists listings_category_idx on listings(category);
create index if not exists listings_city_idx on listings(city);

-- Featured-category graduation, computed live instead of stored — a tag
-- becomes "official" once TAG_GRADUATION_THRESHOLD (2, matched in app code)
-- listings share it. Mirrors js/data.js's getTagCounts()/getOfficialTags().
create or replace view tag_stats as
  select category as tag, count(*) as count
  from listings
  group by category
  order by count desc;

-- ============================================================================
-- REVIEWS
-- ============================================================================
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references profiles(id) on delete cascade,
  reviewer_id uuid not null references profiles(id) on delete cascade,
  listing_id uuid references listings(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  text text not null,
  created_at timestamptz not null default now(),
  check (seller_id <> reviewer_id)
);

create index if not exists reviews_seller_idx on reviews(seller_id);

-- ============================================================================
-- REPORTS  ("raise a concern")
-- Private to the reporter — nobody else can read these via RLS below.
-- ============================================================================
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  description text not null,
  listing_id uuid references listings(id) on delete set null,
  reported_seller_id uuid references profiles(id) on delete set null,
  status text not null default 'Under review',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- COMMUNITY Q&A (per listing, one level of replies, upvote/downvote)
-- ============================================================================
create table if not exists qa_questions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  parent_id uuid references qa_questions(id) on delete cascade,
  text text not null,
  votes integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists qa_listing_idx on qa_questions(listing_id);

create table if not exists qa_votes (
  question_id uuid not null references qa_questions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  primary key (question_id, user_id)
);

-- Atomic vote: call this instead of read-then-write so concurrent votes
-- from different users never clobber each other.
create or replace function cast_qa_vote(q_id uuid, new_value smallint)
returns void as $$
declare
  old_value smallint;
begin
  select value into old_value from qa_votes where question_id = q_id and user_id = auth.uid();

  if old_value is null then
    insert into qa_votes (question_id, user_id, value) values (q_id, auth.uid(), new_value);
    update qa_questions set votes = votes + new_value where id = q_id;
  elsif old_value = new_value then
    delete from qa_votes where question_id = q_id and user_id = auth.uid();
    update qa_questions set votes = votes - old_value where id = q_id;
  else
    update qa_votes set value = new_value where question_id = q_id and user_id = auth.uid();
    update qa_questions set votes = votes - old_value + new_value where id = q_id;
  end if;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- MESSAGING
-- "buying" vs "selling" tag is derived client-side from whether the
-- current user is the thread's buyer_id or seller_id — not stored.
-- ============================================================================
create table if not exists message_threads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references message_threads(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_thread_idx on messages(thread_id);

-- ============================================================================
-- SAVED ITEMS
-- ============================================================================
create table if not exists saved_items (
  user_id uuid not null references profiles(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- ============================================================================
-- LOCALITIES (reference data for the location picker)
-- ============================================================================
create table if not exists localities (
  id serial primary key,
  name text not null,
  city text not null default 'Guwahati, Assam'
);

insert into localities (name, city)
select * from (values
  ('Zoo Road', 'Guwahati, Assam'), ('Ganeshguri', 'Guwahati, Assam'), ('Six Mile', 'Guwahati, Assam'),
  ('Dispur', 'Guwahati, Assam'), ('Beltola', 'Guwahati, Assam'), ('Chandmari', 'Guwahati, Assam'),
  ('Paltan Bazaar', 'Guwahati, Assam'), ('Rukminigaon', 'Guwahati, Assam'), ('Hatigaon', 'Guwahati, Assam'),
  ('Narengi', 'Guwahati, Assam'), ('Bhangagarh', 'Guwahati, Assam'), ('Ulubari', 'Guwahati, Assam')
) as v(name, city)
where not exists (select 1 from localities);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Everything is public-read where it should be (listings, profiles, reviews,
-- Q&A) and locked to the owning user everywhere data is private (reports,
-- messages, saved items, votes).
-- ============================================================================
alter table profiles enable row level security;
alter table listings enable row level security;
alter table reviews enable row level security;
alter table reports enable row level security;
alter table qa_questions enable row level security;
alter table qa_votes enable row level security;
alter table message_threads enable row level security;
alter table messages enable row level security;
alter table saved_items enable row level security;
alter table localities enable row level security;

drop policy if exists "profiles are publicly readable" on profiles;
create policy "profiles are publicly readable" on profiles for select using (true);
drop policy if exists "users can update their own profile" on profiles;
create policy "users can update their own profile" on profiles for update using (auth.uid() = id);

drop policy if exists "listings are publicly readable" on listings;
create policy "listings are publicly readable" on listings for select using (true);
drop policy if exists "users can create their own listings" on listings;
create policy "users can create their own listings" on listings for insert with check (auth.uid() = seller_id);
drop policy if exists "users can update their own listings" on listings;
create policy "users can update their own listings" on listings for update using (auth.uid() = seller_id);
drop policy if exists "users can delete their own listings" on listings;
create policy "users can delete their own listings" on listings for delete using (auth.uid() = seller_id);

drop policy if exists "reviews are publicly readable" on reviews;
create policy "reviews are publicly readable" on reviews for select using (true);
drop policy if exists "users can write reviews as themselves" on reviews;
create policy "users can write reviews as themselves" on reviews for insert with check (auth.uid() = reviewer_id);
drop policy if exists "users can edit their own reviews" on reviews;
create policy "users can edit their own reviews" on reviews for update using (auth.uid() = reviewer_id);
drop policy if exists "users can delete their own reviews" on reviews;
create policy "users can delete their own reviews" on reviews for delete using (auth.uid() = reviewer_id);

drop policy if exists "users see only their own reports" on reports;
create policy "users see only their own reports" on reports for select using (auth.uid() = reporter_id);
drop policy if exists "users can file reports as themselves" on reports;
create policy "users can file reports as themselves" on reports for insert with check (auth.uid() = reporter_id);

drop policy if exists "qa is publicly readable" on qa_questions;
create policy "qa is publicly readable" on qa_questions for select using (true);
drop policy if exists "users can post qa as themselves" on qa_questions;
create policy "users can post qa as themselves" on qa_questions for insert with check (auth.uid() = user_id);
drop policy if exists "users can delete their own qa" on qa_questions;
create policy "users can delete their own qa" on qa_questions for delete using (auth.uid() = user_id);

drop policy if exists "users manage their own votes" on qa_votes;
create policy "users manage their own votes" on qa_votes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "participants can see their threads" on message_threads;
create policy "participants can see their threads" on message_threads for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
drop policy if exists "buyers can start threads" on message_threads;
create policy "buyers can start threads" on message_threads for insert with check (auth.uid() = buyer_id);

drop policy if exists "participants can read thread messages" on messages;
create policy "participants can read thread messages" on messages for select
  using (exists (
    select 1 from message_threads t
    where t.id = thread_id and (auth.uid() = t.buyer_id or auth.uid() = t.seller_id)
  ));
drop policy if exists "participants can send messages" on messages;
create policy "participants can send messages" on messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from message_threads t
      where t.id = thread_id and (auth.uid() = t.buyer_id or auth.uid() = t.seller_id)
    )
  );
drop policy if exists "participants can mark messages read" on messages;
create policy "participants can mark messages read" on messages for update
  using (exists (
    select 1 from message_threads t
    where t.id = thread_id and (auth.uid() = t.buyer_id or auth.uid() = t.seller_id)
  ));

drop policy if exists "users manage their own saved items" on saved_items;
create policy "users manage their own saved items" on saved_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "localities are publicly readable" on localities;
create policy "localities are publicly readable" on localities for select using (true);
