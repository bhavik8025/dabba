# Deployment — already live ✅

| What | Where |
|---|---|
| **App (production)** | https://getdabba.vercel.app |
| Website (planned) | https://dabba-tiffin.vercel.app (domain reserved) |
| Legacy aliases (still work) | tiffin-tracker-app.vercel.app, tiffin-tracker-zeta.vercel.app |
| Vercel project | `bhavik-thakkar-s-projects/tiffin-tracker` → [dashboard](https://vercel.com/bhavik-thakkar-s-projects/tiffin-tracker) |
| Supabase project | ref `bklkhixrkwfbdxcttmls`, Mumbai `ap-south-1` → [dashboard](https://supabase.com/dashboard/project/bklkhixrkwfbdxcttmls) |
| Plans | Supabase Free + Vercel Hobby — **₹0/month, no card on file** |

Deployed 12 Jun 2026 as "Tiffin Tracker"; rebranded the same day to
**Dabba: The Tiffin Tracker** (short name "Dabba") with `getdabba.vercel.app`
as the primary URL. The old URLs stay attached to the project so any
previously shared link keeps working. Schema from `supabase/schema.sql` is
applied; auth has **Confirm email = OFF** (required for phone+PIN logins);
realtime publication includes entries/settlements/groups/group_members.

> Internal note: the synthetic login emails stay on `@tiffin-tracker.app`
> on purpose — the email IS the account identity, so changing it would orphan
> every existing login. It's invisible plumbing; never rename it.

## Day-to-day

There is nothing to maintain. Things you might eventually need:

### Ship a code change
```powershell
cd C:\Users\admin\tiffin-tracker
npm run build          # sanity check locally
npx vercel deploy --prod
```
The first command run after the deploy token expires (13 Jun 2026) will ask you
to log in — `npx vercel login`, pick "Continue with GitHub", done. The project
is already linked (`.vercel/` folder), so no other setup is needed.

### Someone forgot their PIN
Supabase dashboard → Authentication → Users → search their phone number
(emails look like `p98XXXXXXXX@tiffin-tracker.app`) → ⋯ → **Update user** →
new password = their new 6-digit PIN. Takes ~1 minute. (Also in README.md.)

### Free-tier pause (only if NOBODY uses the app for 7 days)
Supabase pauses idle free projects. Daily tiffin logging keeps it alive
automatically. If it ever pauses (e.g. everyone on vacation), the dashboard
shows a **Restore** button — one click, free, data intact.

### Env vars
Local: `.env` (already filled). Vercel: project → Settings → Environment
Variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — already set).
The anon/publishable key is browser-public by design; row-level security is
what protects the data.

## Marketing files (for the LinkedIn launch)

- **LinkedIn:** upload `marketing/dabba-carousel.pdf` (document post →
  the slide-9 link is clickable). Post text + first comment: `marketing/linkedin-post.md`.
- **WhatsApp / Instagram:** use `marketing/slides/slide-1.png … slide-9.png`.
- QR code (`marketing/shots/qr.png`) and all of the above already point to the
  live `-app` URL.

## Security hardening (12 Jun 2026, after first deploy)

`supabase/migration-2026-06-12-hardening.sql` is applied to production
(and `schema.sql` already includes it for any fresh install):

1. **Profiles are private** — visible only to yourself, groupmates, and people
   referenced in your groups' records. A stranger who signs up sees nobody.
2. **Hard delete is impossible** — entries/settlements can only be
   soft-deleted (visible tombstones), even via the raw API.
3. **Phone normalization** (app code) — `+91 98765 43210`, `09876543210` and
   `9876543210` all map to the same account.

All three verified live with throwaway accounts; the test data was then
deleted — the database currently has **zero** users/groups/entries, so the
first real signup is you.
