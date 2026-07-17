-- Staging/demo seed — run in the SQL Editor AFTER the migration.
-- Creates two confirmed email/password users, a fund owned by one and
-- shared with the other, a few transactions, and an active share link.
-- Idempotent: skips itself if the demo owner already exists.
-- DO NOT run against production.
--
--   owner:        demo-owner@example.com  / demo-password-123
--   collaborator: demo-collab@example.com / demo-password-123

do $$
declare
  owner_id  uuid := gen_random_uuid();
  collab_id uuid := gen_random_uuid();
  v_fund    uuid;
  v_token   text;
begin
  if exists (select 1 from auth.users where email = 'demo-owner@example.com') then
    raise notice 'Seed skipped: demo users already exist.';
    return;
  end if;

  -- Confirmed users the way GoTrue expects them: bcrypt password, an
  -- auth.identities row per email identity, empty-string token columns
  -- (GoTrue chokes on NULLs there).
  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
     raw_app_meta_data, raw_user_meta_data,
     confirmation_token, recovery_token, email_change, email_change_token_new,
     created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', owner_id, 'authenticated', 'authenticated',
     'demo-owner@example.com', crypt('demo-password-123', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"display_name":"Demo Owner"}',
     '', '', '', '', now(), now()),
    ('00000000-0000-0000-0000-000000000000', collab_id, 'authenticated', 'authenticated',
     'demo-collab@example.com', crypt('demo-password-123', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"display_name":"Demo Collaborator"}',
     '', '', '', '', now(), now());

  insert into auth.identities
    (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), owner_id, owner_id::text, 'email',
     jsonb_build_object('sub', owner_id::text, 'email', 'demo-owner@example.com', 'email_verified', true),
     now(), now(), now()),
    (gen_random_uuid(), collab_id, collab_id::text, 'email',
     jsonb_build_object('sub', collab_id::text, 'email', 'demo-collab@example.com', 'email_verified', true),
     now(), now(), now());

  -- profiles rows were created by the on_auth_user_created trigger;
  -- the owner's fund_members row comes from the on_fund_created trigger.
  insert into public.funds (name, description, owner_id)
  values ('Family trip fund', 'Demo fund seeded for staging', owner_id)
  returning id into v_fund;

  -- Seeding runs as postgres, so inserting the collaborator directly is fine
  -- (the app itself can only do this through redeem_share_link).
  insert into public.fund_members (fund_id, user_id, role)
  values (v_fund, collab_id, 'collaborator');

  insert into public.transactions
    (fund_id, created_by, type, amount, description, category, occurred_at)
  values
    (v_fund, owner_id,  'credit',  10000,  'Opening amount',  null,     current_date - 30),
    (v_fund, owner_id,  'expense',  1500,  'Hotel deposit',   'travel', current_date - 20),
    (v_fund, collab_id, 'expense',  350.50,'Groceries',       'food',   current_date - 5),
    (v_fund, collab_id, 'expense',   89.99,'Museum tickets',  'fun',    current_date - 2);

  insert into public.fund_share_links (fund_id, created_by)
  values (v_fund, owner_id)
  returning token into v_token;

  raise notice 'Seeded fund % (balance should read 8059.51).', v_fund;
  raise notice 'Sign in: demo-owner@example.com / demo-password-123 (owner)';
  raise notice '         demo-collab@example.com / demo-password-123 (collaborator)';
  raise notice 'Share link to test /join later: /join/%', v_token;
end;
$$;
