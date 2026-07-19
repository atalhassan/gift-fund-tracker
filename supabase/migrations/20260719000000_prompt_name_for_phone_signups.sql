-- New phone-only signups previously fell back to the phone number as their
-- display name (see profiles_phone migration), so nothing broke downstream.
-- We now prompt these accounts for a real name on first sign-in (RequireName
-- gate in the frontend); a null display_name is the signal that gate uses, so
-- the phone fallback has to go or the gate would never fire.

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
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.handle_user_updated()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = new.email,
      phone = nullif(new.phone, ''),
      display_name = coalesce(display_name, new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  where id = new.id;
  return new;
end;
$$;

-- Existing phone-only profiles whose display_name is just their own phone
-- number (the old fallback) go back to null so they hit the prompt too.
update public.profiles
set display_name = null
where display_name is not null and display_name = phone;
