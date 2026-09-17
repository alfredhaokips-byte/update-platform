-- Distinguishes a "Buy now" message from a regular chat message, purely so
-- the new-message notification email (supabase/functions/notify-new-message)
-- can pick a different subject/template for buying interest ("X is
-- interested in your listing") instead of the generic "new message" one —
-- Buy Now has never had its own row/table, it just inserts into `messages`
-- with canned text (see listing.html's sendBuyNow()). Run after schema.sql.

alter table messages add column if not exists message_type text not null default 'chat'
  check (message_type in ('chat', 'buy_interest'));
