-- Fund Tracker — initial schema, RLS, helper functions, and RPCs.
-- Run via `supabase db push` or the SQL Editor. Safe on a fresh Supabase
-- project AND on a project running the legacy single-fund schema
-- (supabase/schema.sql): legacy tables are renamed to legacy_* below and
-- their data is ported into the new model at the end of this file.

-- gen_random_bytes for share-link tokens
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Legacy single-fund schema: move it out of the way so the new tables can be
-- created under the original names. The legacy `transactions` is recognised
-- by having user_id but no fund_id, so this never touches the new table.
-- Data is ported at the end of this file; nothing is dropped.
-- ---------------------------------------------------------------------------

do $$
declare
  c record;
  has_legacy_tx boolean :=
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'transactions'
        and column_name = 'user_id'
    )
    and not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'transactions'
        and column_name = 'fund_id'
    );
  has_legacy_settings boolean := to_regclass('public.fund_settings') is not null;
begin
  if has_legacy_tx <> has_legacy_settings then
    raise exception 'Found only part of the legacy schema (transactions: %, fund_settings: %) — restore the missing table or drop both before migrating',
      has_legacy_tx, has_legacy_settings;
  end if;
  if not has_legacy_tx then
    return;
  end if;

  alter table public.transactions rename to legacy_transactions;
  alter table public.fund_settings rename to legacy_fund_settings;

  -- Renaming a table does not rename its constraints (or their indexes);
  -- free up names like transactions_pkey / transactions_amount_check that
  -- the new table will need.
  for c in
    select t.relname, con.conname
    from pg_constraint con
    join pg_class t on t.oid = con.conrelid
    where t.relname in ('legacy_transactions', 'legacy_fund_settings')
  loop
    execute format('alter table public.%I rename constraint %I to %I',
                   c.relname, c.conname, 'legacy_' || c.conname);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Mirror of auth.users for joins and display
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text unique,
  created_at timestamptz default now()
);

create table public.funds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  currency text not null default 'SAR',
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);

-- Membership. The owner's row is created automatically by a trigger on funds;
-- collaborator rows are created ONLY by the redeem_share_link() RPC.
create table public.fund_members (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'collaborator')),
  created_at timestamptz default now(),
  unique (fund_id, user_id)
);

create table public.fund_share_links (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  -- 24 random bytes, base64url-encoded (32 chars)
  token text not null unique
    default rtrim(replace(replace(encode(extensions.gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'), '='),
  role text not null default 'collaborator' check (role in ('collaborator')),
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz,                -- null = never expires
  max_uses int,                          -- null = unlimited
  use_count int not null default 0,
  revoked boolean not null default false,
  created_at timestamptz default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  type text not null check (type in ('credit', 'expense')),
  amount numeric(14,2) not null check (amount > 0),
  description text,
  category text,
  occurred_at date not null default current_date,
  created_at timestamptz default now()
);

create index fund_members_user_id_idx on public.fund_members (user_id);
create index funds_owner_id_idx on public.funds (owner_id);
create index fund_share_links_fund_id_idx on public.fund_share_links (fund_id);
create index transactions_fund_id_occurred_at_idx
  on public.transactions (fund_id, occurred_at desc, created_at desc);
create index transactions_created_by_idx on public.transactions (created_by);

-- ---------------------------------------------------------------------------
-- Balances view. security_invoker so the caller's RLS on transactions applies.
-- ---------------------------------------------------------------------------

create view public.fund_balances
  with (security_invoker = true)
as
select
  fund_id,
  coalesce(sum(case when type = 'credit'  then amount else 0 end), 0) as total_credit,
  coalesce(sum(case when type = 'expense' then amount else 0 end), 0) as total_expense,
  coalesce(sum(case when type = 'credit'  then amount else -amount end), 0) as balance
from public.transactions
group by fund_id;

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so RLS policies can consult
-- funds/fund_members without recursive policy lookups)
-- ---------------------------------------------------------------------------

create or replace function public.is_fund_member(f_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.fund_members
    where fund_id = f_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_fund_owner(f_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.funds
    where id = f_id and owner_id = auth.uid()
  );
$$;

-- True when the caller and `other` are members of at least one common fund
-- (used so members can see each other's profiles for display).
create or replace function public.shares_fund_with(other uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.fund_members a
    join public.fund_members b using (fund_id)
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Bootstrap a profiles row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users who signed up before this migration ran
-- (the trigger above only fires for new sign-ups).
insert into public.profiles (id, email, display_name)
select u.id, u.email,
       coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

-- Creating a fund also creates the owner's membership row.
create or replace function public.handle_new_fund()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.fund_members (fund_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (fund_id, user_id) do nothing;
  return new;
end;
$$;

create trigger on_fund_created
  after insert on public.funds
  for each row execute function public.handle_new_fund();

-- ---------------------------------------------------------------------------
-- redeem_share_link — the ONLY path that creates collaborator memberships.
-- ---------------------------------------------------------------------------

create or replace function public.redeem_share_link(link_token text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  link public.fund_share_links%rowtype;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'You must be signed in to redeem a share link';
  end if;

  select * into link
  from public.fund_share_links
  where token = link_token
  for update;

  if not found
     or link.revoked
     or (link.expires_at is not null and link.expires_at < now())
     or (link.max_uses is not null and link.use_count >= link.max_uses)
  then
    raise exception 'This share link is invalid or has expired';
  end if;

  -- Already a member (including the owner): succeed without changes.
  if exists (
    select 1 from public.fund_members
    where fund_id = link.fund_id and user_id = uid
  ) then
    return link.fund_id;
  end if;

  insert into public.fund_members (fund_id, user_id, role)
  values (link.fund_id, uid, 'collaborator');

  update public.fund_share_links
  set use_count = use_count + 1
  where id = link.id;

  return link.fund_id;
end;
$$;

revoke execute on function public.redeem_share_link(text) from public, anon;
grant execute on function public.redeem_share_link(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.funds enable row level security;
alter table public.fund_members enable row level security;
alter table public.fund_share_links enable row level security;
alter table public.transactions enable row level security;

-- profiles: your own row, plus anyone you share a fund with.
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.shares_fund_with(id));

create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- funds: members read; only the owner creates/renames/deletes. The explicit
-- owner_id check (besides membership) matters on INSERT ... RETURNING: the
-- SELECT policy is enforced on the new row before the on_fund_created AFTER
-- trigger has added the owner's membership row.
create policy funds_select on public.funds
  for select using (owner_id = auth.uid() or public.is_fund_member(id));

create policy funds_insert on public.funds
  for insert with check (owner_id = auth.uid());

create policy funds_update on public.funds
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy funds_delete on public.funds
  for delete using (owner_id = auth.uid());

-- fund_members: members see the roster. Direct inserts are limited to the
-- owner's own 'owner' row (normally done by the on_fund_created trigger);
-- collaborators join only via redeem_share_link(). Owner can remove
-- collaborators (revoke access) but never the owner row itself.
create policy fund_members_select on public.fund_members
  for select using (public.is_fund_member(fund_id));

create policy fund_members_insert on public.fund_members
  for insert with check (
    public.is_fund_owner(fund_id) and user_id = auth.uid() and role = 'owner'
  );

create policy fund_members_delete on public.fund_members
  for delete using (public.is_fund_owner(fund_id) and role <> 'owner');

-- fund_share_links: owner-only, all commands. Tokens are never readable by
-- non-owners; redemption goes through the security definer RPC.
create policy fund_share_links_select on public.fund_share_links
  for select using (public.is_fund_owner(fund_id));

create policy fund_share_links_insert on public.fund_share_links
  for insert with check (public.is_fund_owner(fund_id) and created_by = auth.uid());

create policy fund_share_links_update on public.fund_share_links
  for update using (public.is_fund_owner(fund_id))
  with check (public.is_fund_owner(fund_id));

create policy fund_share_links_delete on public.fund_share_links
  for delete using (public.is_fund_owner(fund_id));

-- transactions: members read; any member logs expenses, only the owner logs
-- credits; edit/delete by the row's author or the fund owner. The with check
-- on update stops a collaborator from turning their expense into a credit or
-- moving a row into a fund they don't belong to.
create policy transactions_select on public.transactions
  for select using (public.is_fund_member(fund_id));

create policy transactions_insert on public.transactions
  for insert with check (
    created_by = auth.uid()
    and (
      (type = 'expense' and public.is_fund_member(fund_id))
      or (type = 'credit' and public.is_fund_owner(fund_id))
    )
  );

create policy transactions_update on public.transactions
  for update
  using (created_by = auth.uid() or public.is_fund_owner(fund_id))
  with check (
    public.is_fund_member(fund_id)
    and (created_by = auth.uid() or public.is_fund_owner(fund_id))
    and (type = 'expense' or public.is_fund_owner(fund_id))
  );

create policy transactions_delete on public.transactions
  for delete using (created_by = auth.uid() or public.is_fund_owner(fund_id));

-- ---------------------------------------------------------------------------
-- Grants. Projects created after April 2026 no longer expose new public
-- tables to the API roles automatically, so grant explicitly; on older
-- projects this also normalizes the legacy defaults. anon gets no table
-- access at all — every read in this app happens signed-in — and RLS above
-- is what scopes rows for authenticated.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Data port from the legacy single-fund schema (no-op on fresh projects).
-- Each legacy user becomes the owner of one fund named after their
-- fund_settings.title; their starting_balance becomes an opening credit
-- dated just before their first legacy transaction, and every legacy row is
-- copied across (kind → type). The resulting balance is re-checked against
-- the legacy data; any mismatch aborts the whole migration, leaving the
-- database untouched. The legacy_* tables are kept — drop them manually once
-- you have confirmed the numbers in the new app.
-- ---------------------------------------------------------------------------

do $$
declare
  v_user uuid;
  v_fund uuid;
  v_title text;
  v_start numeric(14,2);
  v_first timestamptz;
  v_expected numeric;
  v_actual numeric;
begin
  if to_regclass('public.legacy_transactions') is null then
    return;
  end if;

  for v_user in
    select user_id from public.legacy_transactions
    union
    select user_id from public.legacy_fund_settings
  loop
    -- min() so the query still returns one row when there is no settings row;
    -- the legacy app's defaults were title null, starting balance 50000.
    select coalesce(min(s.title), 'Gift fund'), coalesce(min(s.starting_balance), 50000)
    into v_title, v_start
    from public.legacy_fund_settings s
    where s.user_id = v_user;

    select min(t.created_at) into v_first
    from public.legacy_transactions t
    where t.user_id = v_user;

    insert into public.funds (name, owner_id, currency)
    values (v_title, v_user, 'SAR')
    returning id into v_fund;

    if v_start > 0 then
      insert into public.transactions
        (fund_id, created_by, type, amount, description, occurred_at, created_at)
      values
        (v_fund, v_user, 'credit', v_start, 'Starting balance',
         coalesce((v_first - interval '1 second')::date, current_date),
         coalesce(v_first - interval '1 second', now()));
    end if;

    insert into public.transactions
      (fund_id, created_by, type, amount, description, occurred_at, created_at)
    select v_fund, t.user_id, t.kind, t.amount, t.description,
           t.created_at::date, t.created_at
    from public.legacy_transactions t
    where t.user_id = v_user;

    select v_start + coalesce(sum(case when t.kind = 'credit' then t.amount else -t.amount end), 0)
    into v_expected
    from public.legacy_transactions t
    where t.user_id = v_user;

    select coalesce((select balance from public.fund_balances where fund_id = v_fund), 0)
    into v_actual;

    if v_actual is distinct from v_expected then
      raise exception 'Legacy port mismatch for user %: expected balance %, got %',
        v_user, v_expected, v_actual;
    end if;
  end loop;

  raise notice 'Legacy data ported. Once balances are confirmed in the new app, reclaim space with:';
  raise notice '  drop table public.legacy_transactions; drop table public.legacy_fund_settings;';
end;
$$;
