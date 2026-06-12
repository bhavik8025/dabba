# Contributing

Dabba is a small, focused app — one job, done well. Contributions that keep it
small are welcome.

## Setup

```bash
git clone <this repo>
cd dabba
npm install
cp .env.example .env   # fill with your own free Supabase project (README)
npm run dev            # http://localhost:5173
```

No Supabase project yet? Run the app anyway and hit **"Try demo mode"** — the
entire UI works on seeded localStorage data, no backend needed.

## Checks before a PR

```bash
npm test       # money-math unit tests (vitest) — must stay green
npm run build  # tsc + vite build — must compile clean
```

## Ground rules

- **Money math changes need tests.** Anything touching `src/lib/balance.ts`,
  `src/lib/types.ts` cost helpers, or split logic must extend
  `src/lib/money.test.ts`.
- **Never weaken the audit trail.** Attribution stamps, tombstones, and the
  no-hard-delete policies are the product. Schema changes go through a new
  `supabase/migration-*.sql` file AND `schema.sql` (kept as the
  fresh-install source of truth).
- **Keep it ₹0.** No paid services, no SMS, no servers. That constraint is a
  feature.
- Match the existing style: plain CSS, no new state libraries, small screens
  over clever abstractions.

## Reporting bugs

Open an issue with: what you did, what you expected, what happened, and a
screenshot if it's visual. If it's about money math, include the exact
entries/prices to reproduce.
