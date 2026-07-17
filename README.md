# Fund Tracker

A bilingual (English/العربية) web app where a **fund manager** creates funds, adds
credit, and shares individual funds with other people, who can then log expenses
against them. Every fund shows a running balance (credits − expenses) and a full
transaction history. Installable to the home screen as a PWA.

Built with Vite + React (TypeScript), React Router, TanStack Query, and Tailwind CSS,
on Supabase (Postgres + Auth + Row-Level Security). No custom server — all access
control is enforced in the database by RLS.

## Roles

Roles are per fund — you can own one fund and collaborate on another.

| Capability | Owner | Collaborator |
|---|---|---|
| Create / rename / delete the fund | ✅ | ❌ |
| Add credit | ✅ | ❌ |
| Add expenses | ✅ | ✅ |
| Edit / delete a transaction | any in the fund | only their own |
| View balance & history | ✅ | ✅ |
| Share links & member management | ✅ | ❌ |

Collaborators join by opening a share link (`/join/<token>`); links are revocable
and can carry an expiry date and a max-use cap.

## Setup

### 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a project (free tier
   is fine; pick a region near you).
2. Apply the migrations, in filename order, either way:
   - **SQL Editor**: paste each file from `supabase/migrations/` into
     SQL Editor → New query and run them oldest-first, or
   - **CLI**: `supabase login`, `supabase link --project-ref <ref>`,
     `supabase db push`.
3. Verify the security model (recommended): paste
   `supabase/tests/rls_verification.sql` into the SQL Editor and run it. Every
   check prints an `ok:` notice and the script rolls itself back; it fails loudly
   if any policy is wrong.
4. In **Authentication → URL Configuration**, set the Site URL to your app's URL
   (during development: `http://localhost:5173`) so confirmation and magic-link
   emails land back on the app.

> **Upgrading from the old single-fund app?** The first migration detects the
> legacy `transactions`/`fund_settings` tables, renames them to `legacy_*`, and
> ports every user's data into a fund named after their fund title (the starting
> balance becomes an opening credit). It verifies the ported balances match and
> aborts — changing nothing — on any mismatch. The `legacy_*` tables are kept;
> drop them once you've confirmed the numbers.

### 2. Run the app

```bash
npm install
cp .env.example .env      # paste your Project URL + anon/publishable key
npm run dev               # open the printed localhost URL
```

Sign up, create a fund, record a transaction, refresh — it should persist.

### 3. Demo data (optional)

Run `supabase/seed.sql` in the SQL Editor (**not on production**) to get two
confirmed users sharing one fund with a few transactions:

- `demo-owner@example.com` / `demo-password-123` (owner)
- `demo-collab@example.com` / `demo-password-123` (collaborator)

The script is idempotent — re-running it does nothing.

### 4. Staging environment (optional)

Keep a second Supabase project for testing and point the app at it with a
separate env file:

```bash
cp .env.staging.example .env.staging   # staging project URL + key
npm run dev:staging                    # same app, staging database
```

### 5. Deploy

Any static host works (Vercel / Netlify / Cloudflare Pages):

1. Import the repo; Vite is auto-detected (`npm run build`, output `dist/`).
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables.
3. Since this is an SPA with client-side routing, make sure unknown paths
   rewrite to `/index.html` (Vercel and Netlify do this automatically for Vite;
   on Cloudflare Pages add a `_redirects` file with `/* /index.html 200`).
4. Add the deployed URL in Supabase **Authentication → URL Configuration**.

## Commands

```bash
npm run dev          # dev server against .env
npm run dev:staging  # dev server against .env.staging
npm run build        # typecheck (tsc -b) + production build
npm run typecheck    # typecheck only
npm run preview      # serve the built dist/ locally
```

## Security notes

- The `anon`/publishable key ships in the browser bundle by design; every table
  is protected by Row-Level Security keyed on fund membership. **Never** put the
  `service_role` key in frontend code.
- Share-link tokens are 24 random bytes generated in Postgres and are only
  readable by the fund owner; redemption goes through a `security definer` RPC
  (`redeem_share_link`) — the sole path that creates collaborator memberships.
