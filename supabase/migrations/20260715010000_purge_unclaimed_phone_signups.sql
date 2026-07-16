-- Abandoned phone signups squat their number forever.
--
-- signInWithOtp({ phone, shouldCreateUser: true }) — the only way to send a
-- signup code to a number GoTrue has never seen — writes the auth.users row
-- *before* the code is verified. Walk away from the SMS and that row stays,
-- unverified, holding the number: GoTrue's uniqueness check reads
-- auth.users.phone whether or not it was ever confirmed, so nobody can claim
-- the number again — including the same person later trying to attach it to
-- their email account. Supabase does not merge identities, so there is no way
-- out of it from inside the app.
--
-- So sweep the never-verified ones back up after a day. A real signup takes
-- seconds; 24h is only slack for someone who lost signal mid-flow, and they
-- can simply sign up again afterwards.

create extension if not exists pg_cron;

create or replace function public.purge_unclaimed_phone_signups()
returns integer
language plpgsql
-- Not SECURITY DEFINER: pg_cron runs the job as postgres, which already has
-- the rights to delete. Leaving it INVOKER means a leaked grant can't be used
-- to delete accounts.
set search_path = ''
as $$
declare
  n integer;
begin
  delete from auth.users u
  where u.phone is not null
    and u.phone <> ''
    and u.phone_confirmed_at is null            -- never proved they own the number
    and u.email is null                         -- phone-only; never touch an email account
    and u.email_confirmed_at is null
    and u.last_sign_in_at is null               -- never actually got in
    and u.created_at < now() - interval '24 hours'
    -- Belt and braces. An account that never authenticated cannot own any of
    -- this, but deleting auth.users cascades to profiles -> funds ->
    -- transactions: never delete a row with anything hanging off it.
    and not exists (select 1 from public.funds f            where f.owner_id   = u.id)
    and not exists (select 1 from public.fund_members m     where m.user_id    = u.id)
    and not exists (select 1 from public.transactions t     where t.created_by = u.id)
    and not exists (select 1 from public.fund_share_links l where l.created_by = u.id);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Housekeeping, not an API: no client may call this.
revoke all on function public.purge_unclaimed_phone_signups() from public, anon, authenticated;

-- Hourly at :17. Nothing here is urgent, and an odd minute keeps it out of the
-- stampede every other job schedules on the hour.
select cron.unschedule('purge-unclaimed-phone-signups')
where exists (select 1 from cron.job where jobname = 'purge-unclaimed-phone-signups');

select cron.schedule(
  'purge-unclaimed-phone-signups',
  '17 * * * *',
  $$select public.purge_unclaimed_phone_signups()$$
);
