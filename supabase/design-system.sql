-- Visual redesign migration: adds the optional, cosmetic character-avatar
-- column. Everything else in the redesign (design tokens, dark mode, the
-- fixed 6-category set, the pillars section) is frontend-only and needs no
-- schema change. Run after schema.sql.

alter table profiles add column if not exists avatar_type text not null default 'neutral';

alter table profiles drop constraint if exists profiles_avatar_type_check;
alter table profiles add constraint profiles_avatar_type_check
  check (avatar_type in ('female', 'male', 'neutral'));
