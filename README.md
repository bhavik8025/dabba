# 🍱 Dabba: The Tiffin Tracker

**Live:** https://getdabba.vercel.app

[Architecture](ARCHITECTURE.md) · [Deploy guide](DEPLOY.md) · [Contributing](CONTRIBUTING.md) · MIT licensed · ₹0/month infra

A minimal Splitwise-style app, built only for tracking shared tiffin (food) expenses.
Mobile-first PWA — everyone in the group installs it from a link, logs in with
**phone number + 6-digit PIN** (no SMS, no cost), and shares one live ledger.

## What it does

- **Add entry** — date, who paid the vendor, then two sections: **Individual**
  (pick people from a dropdown, set their own tiffin/roti counts, ½ steps allowed)
  and **Shared** (e.g. 2 tiffins shared by 3 people — cost splits equally among
  whoever you tick, exact to the paisa). A live **amount preview** shows each
  person's payable before you save. "Same as last time" for one-tap repeat days.
  Multiple entries per day allowed (lunch + dinner).
- **Prices set once** — tiffin & roti rates live in Settings. Each entry snapshots the
  rate at save time, so editing prices later never rewrites old records.
- **Balances** — net per-person balance (paid − ate ± settlements), plus
  "who pays whom" simplification like Splitwise.
- **Record payments** — when someone pays you back (partial is fine), log it and
  balances update.
- **Audit report** — quick ranges (last 7 days / this month / last month / all time)
  or a custom date range; per-person breakdown (days, tiffins, rotis, ate/paid/net),
  copy as text for WhatsApp.
- **History** — grouped by month with monthly totals, per-person amount chips on
  every entry, tap to edit. Deleting never erases: the entry stays as a visible
  "deleted by X" tombstone (restorable), excluded from all totals.
- **Full audit trail** — every entry shows who paid, who added it, and who last
  edited it; every payment shows who recorded it. The server enforces these
  stamps, so they can't be faked even by calling the API directly.
- **Per-person ledger** — tap any name on the Balances tab to see line by line
  how their balance adds up (ate / paid vendor / paid back / received).
- **Extras** — one-off ₹ amounts per person (sweet, papad, cold drink) on top
  of tiffin/roti counts.
- **Members** — anyone can leave a group or remove someone who left the mess;
  their old records keep their name. Invite codes can be regenerated if leaked.
- **Live sync** — phones with the app open see each other's changes instantly
  (Supabase Realtime).
- **Demo mode** — "Try demo" on the first screen runs the entire app on sample
  data in the browser, no account or backend needed.

## Get started

**[getdabba.vercel.app](https://getdabba.vercel.app)** — open on any phone, tap *Try demo* (no signup) or create a free account. Browser → *Add to Home Screen* installs it like a native app.

### Self-hosting

1. Create a free [Supabase](https://supabase.com) project → SQL Editor → run [`supabase/schema.sql`](supabase/schema.sql). Under **Auth → Email**, disable *Confirm email*.
2. Copy `.env.example` → `.env` and paste the Supabase **Project URL** + **anon public** key.
3. `npm install && npm run dev` for local dev. Deploy free: push to GitHub → [Vercel](https://vercel.com) → add the two `VITE_…` env vars → done.

> **Forgot PIN?** Supabase Dashboard → Auth → Users → find `p<phone>@tiffin-tracker.app` → Update user → set new 6-digit password.

## Notes

- `npm test` — money-math unit tests; run after any calculation changes.
- Trusted-group model: any member can add/edit entries (like Splitwise), but every action is server-stamped with the doer's name and can't be faked.
