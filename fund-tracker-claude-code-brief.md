# Build a Fund Tracker Web App

## Objective
Build a web application where a **fund manager** can create and track multiple funds, add credit (income) to each fund, and share individual funds with other people who can then log **expense** transactions against them. Each fund shows a running balance (credits − expenses) and a transaction history.

## Tech stack
- **Frontend:** Vite + React (TypeScript), React Router, TanStack Query for data fetching, Tailwind CSS.
- **Backend / DB / Auth:** Supabase (Postgres + Auth + Row-Level Security). Use Supabase email/password auth plus magic link.
- **Deployment target:** static frontend (Vercel/Netlify) talking to Supabase. No custom server needed.

> If you prefer a different backend, keep the same data model and enforce the same permissions server-side — do **not** rely on the client to enforce access control.

## Roles & permissions
There are two roles, scoped **per fund** (a user can be an owner of one fund and a collaborator on another):

| Capability | Owner (manager) | Collaborator (shared user) |
|---|---|---|
| Create / rename / delete the fund | ✅ | ❌ |
| Add **credit** transactions | ✅ | ❌ |
| Add **expense** transactions | ✅ | ✅ |
| Edit / delete a transaction | Any transaction in the fund | Only their own |
| View fund balance & history | ✅ | ✅ |
| Create / revoke share links, remove members | ✅ | ❌ |

## Data model (Postgres)

```sql
-- Mirror of auth.users for joins and display
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text unique,
  created_at timestamptz default now()
);

create table funds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  currency text not null default 'SAR',
  owner_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now()
);

-- Membership. Owner also gets a row here with role='owner'.
-- Rows are only ever created for real, signed-in users (owner at creation,
-- collaborators when they redeem a share link).
create table fund_members (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references funds(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('owner','collaborator')),
  created_at timestamptz default now(),
  unique (fund_id, user_id)
);

-- Share links. Owner generates a link; anyone signed in who opens it becomes
-- a collaborator on the fund. Links are revocable and optionally expiring / capped.
create table fund_share_links (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references funds(id) on delete cascade,
  token text not null unique,            -- high-entropy, URL-safe (e.g. 32+ random bytes, base64url)
  role text not null default 'collaborator' check (role in ('collaborator')),
  created_by uuid not null references profiles(id),
  expires_at timestamptz,                -- null = never expires
  max_uses int,                          -- null = unlimited
  use_count int not null default 0,
  revoked boolean not null default false,
  created_at timestamptz default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references funds(id) on delete cascade,
  created_by uuid not null references profiles(id),
  type text not null check (type in ('credit','expense')),
  amount numeric(14,2) not null check (amount > 0),
  description text,
  category text,
  occurred_at date not null default current_date,
  created_at timestamptz default now()
);

-- Balances as a view (credits positive, expenses negative)
create view fund_balances as
select
  fund_id,
  coalesce(sum(case when type='credit'  then amount else 0 end), 0) as total_credit,
  coalesce(sum(case when type='expense' then amount else 0 end), 0) as total_expense,
  coalesce(sum(case when type='credit'  then amount else -amount end), 0) as balance
from transactions
group by fund_id;
```

## Row-Level Security (enforce all of this in RLS, not the client)
Enable RLS on every table. Implement these rules:

- **funds** — a user can `SELECT` a fund if they have a row in `fund_members` for it. `INSERT` allowed when `owner_id = auth.uid()`. `UPDATE`/`DELETE` only by the owner.
- **fund_members** — a user can `SELECT` rows for funds they belong to. Only the fund owner can `INSERT`/`DELETE` members directly (used for revoking access). Collaborators are **not** inserted through direct client writes — they join only via the `redeem_share_link` function below.
- **fund_share_links** — only the fund owner can `SELECT`/`INSERT`/`UPDATE`/`DELETE` links for their fund. The token is therefore never exposed through normal table reads to non-owners; redemption goes through the RPC.
- **transactions** — `SELECT` allowed for any member of the fund. `INSERT` of type `expense` allowed for any member; `INSERT` of type `credit` allowed **only** for the owner. `UPDATE`/`DELETE` allowed on a row if the user is that row's `created_by`, or is the fund owner.

Use `security definer` helper functions (e.g. `is_fund_member(fund_id)` / `is_fund_owner(fund_id)`) to avoid recursive RLS lookups between `funds` and `fund_members`.

**Redeeming a share link** — provide a `security definer` RPC `redeem_share_link(token text)` that runs with elevated rights so a not-yet-member can join:
- Look up the link by `token`. Reject if missing, `revoked`, past `expires_at`, or `use_count >= max_uses`.
- If the caller (`auth.uid()`) is already a member of that fund, return success without changes (idempotent).
- Otherwise insert a `fund_members` row with `role = 'collaborator'` for the caller and increment `use_count`.
- Return the `fund_id` so the client can redirect into the fund. The function is the **only** path that creates collaborator memberships.

## Core features / user stories
1. **Auth** — sign up, sign in, sign out. On first sign-in, create a `profiles` row (via a trigger on `auth.users`). If the user signed up after opening a share link, redeem that pending link immediately after their profile exists (see story 7).
2. **Create fund** — owner sets name, optional description, and currency (default SAR). Creating a fund also inserts the owner's `fund_members` row with `role='owner'`.
3. **Dashboard** — list all funds the user can access, each card showing name, balance, currency, role badge, and last activity. Separate or clearly label funds you own vs. funds shared with you.
4. **Fund detail** — show balance, total credit, total expense, and a paginated transaction list (newest first) with type, amount, category, description, who logged it, and date. Filter by type/category/date range.
5. **Add credit** — owner-only form: amount, date, description, category. Adds a `credit` transaction.
6. **Add expense** — available to owner and collaborators: amount, date, description, category. Adds an `expense` transaction.
7. **Share a fund (link + token)** — owner generates a share link for a fund.
   - Creating a link inserts a `fund_share_links` row with a high-entropy `token`; the shareable URL is `/join/:token`. Optionally let the owner set an expiry and/or a max-use cap when generating it.
   - Anyone who opens `/join/:token` while signed in has the token redeemed via the `redeem_share_link` RPC and is added as a collaborator, then redirected into the fund.
   - If the visitor is **not** signed in, stash the token, send them through sign-in/sign-up, and redeem it automatically once they land back (after their profile exists).
   - Owner can view active links, copy them, and **revoke** any link (sets `revoked = true`), which immediately invalidates it without affecting members who already joined.
   - Owner can view current members and remove access (delete the `fund_members` row).
8. **Edit / delete transactions** — per the permission table above, with a confirm step on delete.

## Screens
- `/login`, `/signup`
- `/` — funds dashboard
- `/funds/new` — create fund
- `/funds/:id` — fund detail (balance summary + transactions + "Add credit"/"Add expense" actions)
- `/funds/:id/members` — manage sharing (owner only): generate/copy/revoke share links, view and remove members
- `/join/:token` — redeem a share link; handles the signed-out → sign-in → auto-redeem flow, then redirects to the fund
- Empty states for "no funds yet" and "no transactions yet".

## UX notes
- Mobile-first, responsive. Amounts formatted with the fund's currency and thousands separators.
- Expenses shown in a distinct color from credits; running balance prominent at the top of the fund view.
- Optimistic UI on transaction add via TanStack Query, rolling back on error.
- Guard owner-only actions in the UI **and** rely on RLS as the real enforcement.
- Add-transaction should be a fast, low-friction modal or inline form (this is the most frequent action).

## Non-functional
- TypeScript throughout; a shared `types.ts` generated from the Supabase schema.
- Input validation on amount (> 0), required fields, and date.
- `.env.example` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; never commit real keys.
- Basic error/loading states on every data view.

## Deliverables
1. A `supabase/migrations` SQL file with tables, the `fund_balances` view, helper functions, the `redeem_share_link` RPC, RLS policies, and the profile-creation trigger.
2. The React app implementing all screens and features above.
3. A `README.md` with setup steps: create Supabase project, run migration, set env vars, `npm install`, `npm run dev`.
4. Seed script or instructions to create a demo owner + collaborator + one shared fund with a few transactions.

## Build order (do it in these milestones, and pause after each for review)
1. Supabase schema + RLS + trigger + `fund_balances` view. Verify policies with a quick SQL test for owner vs. collaborator.
2. Auth flow + profile bootstrap + protected routes.
3. Fund CRUD + dashboard.
4. Transactions (credit + expense) + balance display + history/filters.
5. Sharing: `redeem_share_link` RPC, generate/copy/revoke links, `/join/:token` flow (including signed-out → sign-in → auto-redeem), member management.
6. Polish: empty states, formatting, optimistic updates, README + seed.

Start with milestone 1 and confirm the RLS behaves correctly before building UI on top of it.
