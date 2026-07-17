-- ⚠️ LEGACY — the old single-fund app's schema, kept only as reference for the
-- data port in supabase/migrations/20260711000000_init.sql. Do NOT run this;
-- apply the files in supabase/migrations/ instead.

-- 1. Transactions: one row per recorded expense or credit.
--    `kind` = 'expense' subtracts from the fund; 'credit' adds to it.
create table if not exists public.transactions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount      numeric(14, 2) not null check (amount > 0),
  description text not null,
  kind        text not null default 'expense' check (kind in ('expense', 'credit')),
  created_at  timestamptz not null default now()
);

-- Add `kind` to transactions tables created before this column existed.
alter table public.transactions add column if not exists kind text not null default 'expense';
alter table public.transactions drop constraint if exists transactions_kind_check;
alter table public.transactions add constraint transactions_kind_check check (kind in ('expense', 'credit'));

-- 2. Per-user settings: the starting gift amount and the fund's title.
create table if not exists public.fund_settings (
  user_id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  starting_balance numeric(14, 2) not null default 50000,
  title            text
);

-- Add `title` to fund_settings created before this column existed.
alter table public.fund_settings add column if not exists title text;

-- 3. Row-Level Security: each user sees and edits only their own rows.
alter table public.transactions  enable row level security;
alter table public.fund_settings enable row level security;

create policy "own transactions" on public.transactions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own settings" on public.fund_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Helpful index for listing newest first.
create index if not exists transactions_user_created_idx
  on public.transactions (user_id, created_at desc);
