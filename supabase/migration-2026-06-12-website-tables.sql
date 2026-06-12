-- Website + analytics support — applied to production 2026-06-12 (rebrand day).
-- (Fresh installs don't need this: schema.sql already contains the final state.)
--
-- Three write-only tables. Anyone (even logged out) can INSERT via the API;
-- NOBODY can read them through the API — you read them in the dashboard's
-- Table Editor. This powers the marketing site's lead + feedback forms and
-- the app's PWA install counter at ₹0.

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  contact text not null,           -- email or phone, free-form
  message text,
  source text not null default 'website',
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  rating int check (rating between 1 and 5),
  message text not null,
  contact text,                    -- optional
  page text,                       -- where it was submitted from
  source text not null default 'website',
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,              -- e.g. 'pwa_installed'
  meta jsonb,
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;
alter table public.feedback enable row level security;
alter table public.events enable row level security;

create policy "leads insert" on public.leads
  for insert to anon, authenticated with check (true);
create policy "feedback insert" on public.feedback
  for insert to anon, authenticated with check (true);
create policy "events insert" on public.events
  for insert to anon, authenticated with check (true);
