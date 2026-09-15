-- Newsletter signup — collection only, this does not send anything (see the
-- comment in index.html next to the signup form). Same privacy pattern as
-- `reports`: publicly writable, not readable back through the anon/
-- authenticated client at all (no select policy exists).
create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table newsletter_subscribers enable row level security;

drop policy if exists "anyone can subscribe" on newsletter_subscribers;
create policy "anyone can subscribe" on newsletter_subscribers for insert with check (true);
