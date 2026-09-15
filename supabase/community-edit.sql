-- Lets a user edit their own Community/Feedback post's title+body, but only
-- within 20 minutes of posting — enforced here, not just in the UI, so a
-- direct API call can't bypass the window. A dedicated RPC (same pattern as
-- cast_community_vote/set_feedback_status) rather than a blanket UPDATE RLS
-- policy, so it can only ever touch title/body — never votes, status,
-- author_id, or section.
create or replace function edit_community_post(p_id uuid, new_title text, new_body text)
returns void as $$
begin
  update community_posts
  set title = new_title, body = new_body
  where id = p_id
    and author_id = auth.uid()
    and now() - created_at < interval '20 minutes';

  if not found then
    raise exception 'This post can no longer be edited';
  end if;
end;
$$ language plpgsql security definer;

-- Deleting your own post (any time — no window) was already covered by
-- "users can delete their own posts" in community.sql; nothing new needed
-- here for that half.
