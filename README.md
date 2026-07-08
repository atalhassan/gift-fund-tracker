# Gift Fund Tracker

A small personal ledger for tracking spending from a fixed gift (default 50,000 SAR),
synced across phone and laptop via Supabase Postgres. Arabic/English, install-to-home-screen.

---

## What you get

- **Cross-device sync** — same ledger on every device you sign in on.
- **Private** — email + password auth, Row-Level Security so only you see your data.
- **Offline-friendly install** — add to home screen and it behaves like an app.

---

## Setup (about 10 minutes)

### 1. Create the database (Supabase)

1. Sign up at supabase.com and create a new project. Pick a region close to you (Frankfurt or Bahrain are nearest to Riyadh). Save the database password somewhere safe.
2. When the project is ready, open **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and run it. This creates the two tables and the security policies.
3. (Optional, removes signup friction) Go to **Authentication → Sign In / Providers → Email** and turn **off** "Confirm email." With it off, creating an account signs you straight in. Leave it on if you'd rather click a confirmation link.
4. Open **Project Settings → API** and copy two things: the **Project URL** and the **anon public** key.

### 2. Configure and run locally

```bash
npm install
cp .env.example .env      # then paste your URL + anon key into .env
npm run dev               # open the printed localhost URL
```

Create your account on the sign-in screen, then record a transaction to confirm it saves. Refresh — it should still be there.

### 3. Deploy (Vercel example; Netlify/Cloudflare Pages work the same way)

1. Push this folder to a GitHub repo.
2. On vercel.com → **Add New → Project → import the repo**. Vite is auto-detected (build `npm run build`, output `dist`).
3. Before deploying, add two **Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. You get a public URL like `your-app.vercel.app`.
5. Back in Supabase → **Authentication → URL Configuration**, add that URL to the allowed redirect/site URLs.

### 4. Install on your phone

Open the deployed URL on your phone → browser menu → **Add to Home Screen**. Sign in once; the session persists, so it opens straight to your ledger after that.

---

## Notes

- The `anon` key is meant to be public — it ships in the browser bundle. Your data is protected by Row-Level Security, not by hiding the key. **Never** expose the `service_role` key.
- To change the starting amount, tap the pencil next to "of 50,000" in the app.
- Everything is one Supabase project on the free tier, which is comfortably enough for personal use.
