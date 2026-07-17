# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install deps
npm run dev          # Vite dev server against .env (production Supabase project)
npm run dev:staging  # Vite dev server against .env.staging (staging project)
npm run build        # tsc -b && vite build — the main automated check
npm run typecheck    # tsc -b only
```

There is no test suite, linter, or formatter configured. `npm run build` is the
gate for TypeScript errors. Database-level behavior is verified with
`supabase/tests/rls_verification.sql` (self-contained, rolls back, prints `ok:`
notices) — run it in the Supabase SQL Editor or through an MCP `execute_sql` call.

Requires `.env` (copy `.env.example`) with `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. `.env.staging` (gitignored) points `dev:staging` at the
staging project. `.mcp.json` has two Supabase MCP servers: `supabase` is the
**staging** project — safe for experiments — and `supabase_prod` is **production**:
real user data, touch only to apply already-verified migrations or to inspect.
Develop and verify against staging first; migrations must be committed to
`supabase/migrations/` and applied to both projects so they run identical SQL.

## Architecture

Multi-fund, multi-user fund tracker: owners create funds and add credit;
collaborators join via share links and log expenses. React SPA + Supabase
(Postgres/Auth/RLS) with no server code of our own.

### Frontend (`src/`)

- **Stack**: TypeScript (strict), React Router 7, TanStack Query 5, Tailwind 4
  (via `@tailwindcss/vite`; theme tokens in `src/index.css` — the `C` palette of
  the old app lives there as `--color-*` variables).
- **`main.tsx`** — providers (QueryClient → Lang → Auth → Router) and all routes.
  Protected routes nest inside `RequireAuth` + `Shell` (header with language
  toggle/sign-out); `/login`, `/signup`, `/join/:token` are public.
- **`auth.tsx`** — `AuthProvider` (session state) and `useProfile`. On
  `SIGNED_OUT` the entire query cache is cleared — never let one account's
  cached data show under the next sign-in.
- **`hooks/`** — all Supabase data access: `funds.ts`, `transactions.ts`
  (infinite query + optimistic add with rollback), `sharing.ts` (members, share
  links, `PENDING_JOIN_KEY`). Query keys always include `user?.id`.
- **`i18n.tsx`** — every UI string exists in `en` and `ar` (typed: `ar` must
  match `en`'s shape). RTL comes from `dir` on `<html>`; use logical CSS
  (`ms-*`/`me-*`, `insetInline*`) so layouts mirror automatically. When adding
  copy, always add both languages.
- **`types.ts`** — generated from the live schema (MCP
  `generate_typescript_types` or `supabase gen types`); regenerate after any
  migration, keep the hand-written aliases at the bottom. Don't hand-edit the
  generated section: supabase-js needs the `Relationships` arrays or every row
  type silently degrades to `never`.

### Database (`supabase/`)

- **`migrations/`** — the source of truth, applied in filename order. The init
  migration also contains the legacy-app data port (renames old tables to
  `legacy_*`, rebuilds them as funds, self-verifies balances).
  `schema.sql` is the **legacy** single-fund schema, kept only as reference for
  the port.
- Tables: `profiles` (mirror of `auth.users`, created by trigger), `funds`,
  `fund_members`, `fund_share_links`, `transactions`, plus the `fund_balances`
  view (`security_invoker`).
- **`seed.sql`** — staging/demo data (demo-owner / demo-collab, password
  `demo-password-123`); idempotent; never run on production.

### How data access works (important)

RLS is the enforcement layer; UI role checks are cosmetic. Per-fund roles come
from `fund_members` (owner also has a row, inserted by the `on_fund_created`
trigger). Rules to preserve when editing queries:

- Reads never filter by user in JS — RLS scopes them. `.eq("fund_id", ...)` is
  fine; redundant owner/member filters are not.
- `funds.owner_id` and `transactions.created_by` must be set explicitly on
  insert (policies check them against `auth.uid()`; no column defaults).
- Collaborator memberships are created **only** by the `redeem_share_link`
  RPC (security definer). Never insert into `fund_members` from the client.
- An UPDATE blocked by RLS returns 0 rows, not an error — treat empty
  `.select()` results after update as permission denials (see `useUpdateTx`).
- `anon` has no table grants at all; every read happens signed-in.
- New SECURITY DEFINER functions: revoke PUBLIC/anon execute (see the
  harden_function_grants migration) or the Supabase advisor flags them.

### Verification pattern

Schema changes: run the RLS test after applying. Frontend changes: drive the
real app with Playwright against `npm run dev:staging` (demo users above) —
launch headless Chrome with `channel: "chrome"`; PGlite (`@electric-sql/pglite`)
emulates Supabase Postgres well for offline SQL checks (create `anon`,
`authenticated`, `service_role` roles, `auth.users`, `auth.uid()` reading
`request.jwt.claims`).
