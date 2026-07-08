# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install deps
npm run dev        # Vite dev server (prints localhost URL)
npm run build      # production build → dist/
npm run preview    # serve the built dist/ locally
```

There is no test suite, linter, or formatter configured. `npm run build` is the only automated check.

Requires a `.env` (copy from `.env.example`) with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Without them `src/supabase.js` logs an error and the app renders blank.

## Architecture

A single-page React + Vite PWA — a personal ledger tracking spending against a fixed gift amount (default 50,000 SAR), with Supabase Postgres as the entire backend (no server code of our own).

- **`src/App.jsx`** — the whole UI lives here. Three components: `App` (session gate), `Auth` (email/password sign-in), `Tracker` (the ledger). Styling is inline JS objects keyed off the `C` palette constant; there is no CSS framework or stylesheet. All copy is bilingual via the `STR` object (`en`/`ar`) with RTL handled by `dir` and `insetInline*`/`marginInline*` logical properties — when adding UI text, add both languages and prefer logical CSS properties.
- **`src/supabase.js`** — the single Supabase client, imported wherever data is touched.
- **`supabase/schema.sql`** — the source of truth for the database. Run once in the Supabase SQL Editor. Two tables: `transactions` (one row per expense) and `fund_settings` (per-user starting balance).

### How data access works (important)

Every table has Row-Level Security keyed on `auth.uid() = user_id`, so a logged-out or wrong-user request simply returns nothing rather than erroring. Two consequences to keep in mind when editing queries:

- On **insert**, `user_id` is *not* set in JS — the column defaults to `auth.uid()` in Postgres (see `transactions` insert in `Tracker`). `fund_settings` upserts *do* pass `user_id` explicitly because it's the conflict target. Follow whichever pattern the existing table uses.
- Reads never filter by `user_id` in JS (`select("*")`); RLS scopes them. Don't add redundant `.eq("user_id", ...)` filters.

State is optimistic: the UI updates local React state immediately, then fires the Supabase call (e.g. `addTx`, `removeTx`). There is no realtime subscription — cross-device sync happens on page load/refresh, not live.

The `anon` key is public by design and ships in the browser bundle; data protection is RLS, never key secrecy. Never introduce the `service_role` key into this frontend.
