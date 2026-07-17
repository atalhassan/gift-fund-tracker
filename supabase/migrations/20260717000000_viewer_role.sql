-- Read-only fund sharing: a third per-fund role, 'viewer', who can see the
-- fund, its balance, and its history but cannot log or edit anything. Share
-- links now carry the role a joiner receives, and redeem_share_link copies
-- that role into fund_members.

-- Widen the role vocabularies (both constraints carry the default names they
-- got in the init migration).
alter table public.fund_members drop constraint fund_members_role_check;
alter table public.fund_members add constraint fund_members_role_check
  check (role in ('owner', 'collaborator', 'viewer'));

alter table public.fund_share_links drop constraint fund_share_links_role_check;
alter table public.fund_share_links add constraint fund_share_links_role_check
  check (role in ('collaborator', 'viewer'));

-- True when the caller may write transactions in the fund: a member who is
-- not just a viewer. Reads keep using is_fund_member, which covers viewers.
create or replace function public.is_fund_contributor(f_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.fund_members
    where fund_id = f_id and user_id = auth.uid()
      and role in ('owner', 'collaborator')
  );
$$;

-- Same grant pattern as the other RLS helpers (see harden_function_grants):
-- policies evaluate this as the querying role, so authenticated needs execute.
revoke execute on function public.is_fund_contributor(uuid) from public, anon;
grant execute on function public.is_fund_contributor(uuid) to authenticated;

-- Writing transactions now requires contributor, not just member. Viewers
-- never author rows, so the author-or-owner update/delete rules are already
-- safe; the with check moves to contributor anyway so no edit can ever land
-- a row a viewer "owns".
drop policy transactions_insert on public.transactions;
create policy transactions_insert on public.transactions
  for insert with check (
    created_by = auth.uid()
    and (
      (type = 'expense' and public.is_fund_contributor(fund_id))
      or (type = 'credit' and public.is_fund_owner(fund_id))
    )
  );

drop policy transactions_update on public.transactions;
create policy transactions_update on public.transactions
  for update
  using (created_by = auth.uid() or public.is_fund_owner(fund_id))
  with check (
    public.is_fund_contributor(fund_id)
    and (created_by = auth.uid() or public.is_fund_owner(fund_id))
    and (type = 'expense' or public.is_fund_owner(fund_id))
  );

-- redeem_share_link: the joiner now gets the role stored on the link instead
-- of a hard-coded 'collaborator'. (create or replace keeps the existing
-- grants: authenticated only.)
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

  -- Already a member (including the owner): succeed without changes. A link
  -- never changes an existing member's role.
  if exists (
    select 1 from public.fund_members
    where fund_id = link.fund_id and user_id = uid
  ) then
    return link.fund_id;
  end if;

  insert into public.fund_members (fund_id, user_id, role)
  values (link.fund_id, uid, link.role);

  update public.fund_share_links
  set use_count = use_count + 1
  where id = link.id;

  return link.fund_id;
end;
$$;
