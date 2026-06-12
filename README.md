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

## One-time setup (~10 minutes)

### 1. Create the Supabase project (free)

1. Go to [supabase.com](https://supabase.com) → sign up → **New project** (free tier).
2. When it's ready, open **SQL Editor** → **New query**, paste the entire contents of
   [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
3. Go to **Authentication → Sign In / Providers → Email** and turn **OFF**
   "Confirm email". (Login uses phone+PIN mapped to a synthetic email under the
   hood — no real emails are ever sent, this just skips the confirmation step.)

### 2. Connect the app

1. In Supabase: **Project Settings → API** — copy the **Project URL** and the
   **anon public** key.
2. Copy `.env.example` to `.env` and paste both values in.

### 3. Run it locally

```
npm install
npm run dev
```

### 4. Deploy free (so everyone's phone can use it)

Easiest: [vercel.com](https://vercel.com) → **New project** → import this folder
(push it to GitHub first, or use `npx vercel`). Add the two `VITE_...` env vars in
the Vercel project settings. You get a URL like `https://tiffin-yourname.vercel.app`.

Everyone opens that URL on their phone → browser menu → **Add to Home Screen** →
it installs like an app.

### 5. First use

1. You: create an account (name, phone, PIN) → **Create a new group** → set tiffin
   and roti prices.
2. Settings tab shows the **invite code** — share it in the group chat.
3. Friends: create an account → **Join with invite code**.
4. Start logging from the Add tab.

## If someone forgets their PIN

There is no SMS or email reset (that's what keeps the app free). As the person
who owns the Supabase project, you reset it in ~1 minute:

1. Supabase Dashboard → **Authentication → Users**.
2. Find the account — the email looks like `p98XXXXXXXX@tiffin-tracker.app`
   (their phone number).
3. Open the **⋯** menu → **Update user** → set a new password = their new
   6-digit PIN. Tell them, done.

## Notes

- PIN is 6 digits because the backend requires a minimum 6-character password.
  Tell friends not to reuse their ATM PIN.
- This is a trusted-group app: every member can add/edit/delete entries and
  record payments for the group (just like Splitwise) — but nothing happens
  silently: adds, edits and deletes always carry the doer's name, enforced
  server-side.
- Known tradeoff: profile names/phones are readable by any signed-in account on
  *your* deployment (needed so removed members' names survive). Fine for a
  private friends deployment.
- Data lives in your Supabase project — the free tier is far beyond what
  4 people logging tiffins will ever use.
- Money-math unit tests: `npm test` — run them after any code edits.
