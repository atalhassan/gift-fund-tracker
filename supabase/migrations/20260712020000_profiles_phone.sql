-- Phone sign-in support: carry phone on profiles and keep it in sync with
-- auth.users (GoTrue stores '' for "no phone", hence the nullifs).

alter table public.profiles add column phone text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone, display_name)
  values (
    new.id,
    new.email,
    nullif(new.phone, ''),
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1),
      nullif(new.phone, '')
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Adding/changing email or phone on an existing account (e.g. an email user
-- attaching a phone number) must reach profiles too.
create or replace function public.handle_user_updated()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = new.email,
      phone = nullif(new.phone, ''),
      display_name = coalesce(
        display_name,
        new.raw_user_meta_data ->> 'display_name',
        split_part(new.email, '@', 1),
        nullif(new.phone, '')
      )
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of email, phone, raw_user_meta_data on auth.users
  for each row execute function public.handle_user_updated();

revoke execute on function public.handle_user_updated() from public, anon, authenticated;

-- Backfill for accounts that already have a phone.
update public.profiles p
set phone = nullif(u.phone, '')
from auth.users u
where u.id = p.id and p.phone is null;
