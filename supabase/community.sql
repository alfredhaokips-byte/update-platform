-- Community discussion forum — separate from direct messages (message_threads).
-- Mirrors the qa_questions/qa_votes/cast_qa_vote pattern from schema.sql:
-- one self-referencing table (parent_id null = top-level post, set = a reply),
-- a vote table, and an atomic vote RPC. Run after schema.sql.

create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  parent_id uuid references community_posts(id) on delete cascade,
  category text, -- only meaningful on top-level posts; null on replies
  title text,    -- only meaningful on top-level posts; null on replies
  body text not null,
  votes integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists community_posts_parent_idx on community_posts(parent_id);
create index if not exists community_posts_category_idx on community_posts(category) where parent_id is null;

create table if not exists community_votes (
  post_id uuid not null references community_posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  primary key (post_id, user_id)
);

create or replace function cast_community_vote(p_id uuid, new_value smallint)
returns void as $$
declare
  old_value smallint;
begin
  select value into old_value from community_votes where post_id = p_id and user_id = auth.uid();

  if old_value is null then
    insert into community_votes (post_id, user_id, value) values (p_id, auth.uid(), new_value);
    update community_posts set votes = votes + new_value where id = p_id;
  elsif old_value = new_value then
    delete from community_votes where post_id = p_id and user_id = auth.uid();
    update community_posts set votes = votes - old_value where id = p_id;
  else
    update community_votes set value = new_value where post_id = p_id and user_id = auth.uid();
    update community_posts set votes = votes - old_value + new_value where id = p_id;
  end if;
end;
$$ language plpgsql security definer;

alter table community_posts enable row level security;
alter table community_votes enable row level security;

drop policy if exists "community posts are publicly readable" on community_posts;
create policy "community posts are publicly readable" on community_posts for select using (true);
drop policy if exists "users can post as themselves" on community_posts;
create policy "users can post as themselves" on community_posts for insert with check (auth.uid() = author_id);
drop policy if exists "users can delete their own posts" on community_posts;
create policy "users can delete their own posts" on community_posts for delete using (auth.uid() = author_id);

drop policy if exists "users manage their own community votes" on community_votes;
create policy "users manage their own community votes" on community_votes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
