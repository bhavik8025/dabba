# Architecture — Dabba: The Tiffin Tracker

A deliberately small system: one React PWA, one Postgres (Supabase), zero
servers of our own, ₹0/month.

```
┌──────────────────────┐     HTTPS / WebSocket      ┌─────────────────────────┐
│  React PWA (Vite)    │ ◄────────────────────────► │  Supabase (Mumbai)      │
│  Vercel static CDN   │   supabase-js + Realtime   │  Postgres + Auth + RLS  │
└──────────────────────┘                            └─────────────────────────┘
```

## Stack

- **Frontend:** React 18 + TypeScript + Vite 6, plain CSS, `vite-plugin-pwa`
  (service worker, installable). No state library — server state is refetched
  on every mutation and on Realtime/visibility signals.
- **Backend:** Supabase free tier — Postgres, GoTrue auth, PostgREST API,
  Realtime. No custom server. The browser talks straight to Postgres through
  row-level security.
- **Hosting:** Vercel Hobby (static build). `getdabba.vercel.app`.

## Key decisions

### Phone + PIN auth without SMS cost
SMS OTP costs money. Instead a phone number maps to a synthetic email
(`p<10digits>@tiffin-tracker.app`) and the 6-digit PIN is the password,
using stock Supabase email/password auth with "Confirm email" disabled.
PIN resets are a dashboard operation (documented in README) — acceptable for
trusted friend groups, ₹0 forever. The synthetic domain is identity plumbing;
renaming it would orphan accounts, so it survives rebrands.

### Trust = transparency, enforced server-side
The product's core promise is "nobody can cheat":

- Every entry/payment shows **who created it**; edits show **edited by**;
  deletes are **soft tombstones** ("deleted by X"), restorable for entries,
  immutable-once-recorded for payments.
- These stamps are written by `BEFORE INSERT/UPDATE` **Postgres triggers**
  (`stamp_entry_attribution`, `stamp_settlement_attribution`) that overwrite
  whatever the client sends with `auth.uid()` — attribution can't be faked
  even with hand-crafted API calls.
- RLS policies deliberately have **no DELETE** on entries/settlements, so the
  tombstone trail can't be bypassed.

### Row-level security model
- `is_group_member(gid)` — SECURITY DEFINER helper, avoids policy recursion.
- Groups, entries, items, settlements: visible/writable only to group members.
- `profiles`: visible via `profile_visible(id)` — yourself, current
  groupmates, and people referenced in your groups' records (names survive
  member removal). Strangers who sign up see nobody.
- Invite-only joining via SECURITY DEFINER RPCs (`create_group`, `join_group`,
  `regenerate_invite`) with 6-char rotating codes.
- `leads` / `feedback` / `events`: write-only via API (insert-only policies),
  read in the dashboard. Powers the marketing site forms + install counter.

### Money math
Prices live on the group but are **snapshotted onto each entry**, so editing
rates never rewrites history. An entry has individual items (per-person
tiffin/roti/extras) plus a shared pool split equally among ticked members,
exact to the paisa. All math is derived at read time (`src/lib/balance.ts`,
`src/lib/types.ts`) and covered by vitest (`npm test`).

### Live sync
Supabase Realtime (`postgres_changes` on entries/settlements/members/groups)
plus a refetch on `visibilitychange` — phones see each other's changes
instantly without polling.

### Demo mode
`src/lib/demo.ts` is a localStorage mock of the Supabase client with seeded
sample data — the full app runs without any backend ("Try the demo" on the
welcome screen). Great for demos and for development without keys.

## Repo map

```
src/
  lib/        supabase client, demo mock, money math, types, install prompt
  screens/    Welcome, Auth, Onboarding, MainShell + Add/History/Balances/Settings
supabase/
  schema.sql                      full schema — run once on a fresh project
  migration-*.sql                 changes applied to prod after first deploy
marketing/    carousel + capture/render scripts (screenshots/PDF gitignored)
scripts/      icon + OG image generators
```

## Deploy

See [DEPLOY.md](DEPLOY.md). Short version: static build on Vercel, schema on
Supabase, two `VITE_*` env vars connect them.
