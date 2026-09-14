-- Phase "Landing Page + Trust System". Run in the SQL Editor after
-- schema.sql and storage-policies.sql. Safe to re-run.

-- ============================================================================
-- VERIFICATION FIELDS
-- email_verified mirrors auth.users.email_confirmed_at (synced client-side in
-- Store.primeCache — see js/data.js) since RLS can't read the auth schema
-- directly. phone/phone_verified are structural for now: phone OTP was
-- explicitly deferred in Phase 0 (needs a paid SMS provider), so
-- phone_verified has no path to true yet. selfie_verified is likewise a
-- placeholder for the dedicated Hinge-style liveness-check phase — nothing
-- here performs real liveness detection.
-- ============================================================================
alter table profiles add column if not exists email_verified boolean not null default false;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists phone_verified boolean not null default false;
alter table profiles add column if not exists selfie_verified boolean not null default false;

-- ============================================================================
-- TRANSACTION-GATED REVIEWS
-- A review is only insertable if the reviewer has an existing message thread
-- with that seller — enforced here, not just hidden in the UI, so the rule
-- holds even against a direct API call.
-- ============================================================================
drop policy if exists "users can write reviews as themselves" on reviews;
create policy "users can write reviews as themselves" on reviews for insert
  with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from message_threads t
      where t.seller_id = reviews.seller_id and t.buyer_id = reviews.reviewer_id
    )
  );

-- ============================================================================
-- DEALS COUNT — derived, not manual
-- A review can now only exist after a real message thread, so treating
-- "received a review" as a real-world completed-deal signal is reasonable.
-- Increments profiles.deals automatically; no client code writes this column.
-- ============================================================================
create or replace function increment_seller_deals()
returns trigger as $$
begin
  update profiles set deals = deals + 1 where id = new.seller_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_review_increment_deals on reviews;
create trigger on_review_increment_deals
  after insert on reviews
  for each row execute function increment_seller_deals();

-- ============================================================================
-- RESPONSE RATE — derived from real message history, no new tracking needed.
-- threads_received: message threads where this user is the seller.
-- threads_replied: of those, how many they sent at least one message in.
-- No "completion rate" / "cancellation count" here — this app has no
-- order/transaction lifecycle (no accept/complete/cancel state machine), so
-- those two brief-requested metrics would have to be fabricated. Omitted
-- rather than faked; the Trust Profile page shows "Not tracked yet" for them.
-- ============================================================================
-- Created without `security_invoker`, so (per Postgres default view semantics)
-- it runs with the view owner's privileges — the role running this script,
-- which bypasses RLS. That's intentional: message_threads/messages RLS only
-- lets a user see threads they're a participant in, but a response rate has
-- to aggregate across *every* buyer who's messaged that seller, not just the
-- querying visitor's own threads.
create or replace view seller_response_stats as
select
  t.seller_id,
  count(distinct t.id) as threads_received,
  count(distinct t.id) filter (
    where exists (select 1 from messages m where m.thread_id = t.id and m.sender_id = t.seller_id)
  ) as threads_replied
from message_threads t
group by t.seller_id;

grant select on seller_response_stats to anon, authenticated;
