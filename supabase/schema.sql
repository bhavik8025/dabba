-- Dabba: The Tiffin Tracker — schema
-- Run this whole file once in: Supabase Dashboard -> SQL Editor -> New query -> Run

create extension if not exists pgcrypto;

-- ---------- tables ----------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  tiffin_price numeric not null default 0,
  roti_price numeric not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  entry_date date not null,
  payer_id uuid not null references public.profiles(id),
  -- prices are snapshotted here so later rate edits never change old records
  tiffin_price numeric not null,
  roti_price numeric not null,
  -- the shared pool: cost split equally among entry_items rows with in_shared = true
  shared_tiffin numeric not null default 0 check (shared_tiffin >= 0),
  shared_roti numeric not null default 0 check (shared_roti >= 0),
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  -- audit trail: set on every edit, shown as "edited by" in the app
  edited_by uuid references public.profiles(id),
  edited_at timestamptz,
  -- soft delete: rows are never erased, they become visible tombstones
  deleted_by uuid references public.profiles(id),
  deleted_at timestamptz
);

create table public.entry_items (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  -- this person's own (individual) items only; their slice of the entry's
  -- shared pool is derived from in_shared at read time
  tiffin_count numeric not null default 1 check (tiffin_count >= 0),
  roti_count numeric not null default 0 check (roti_count >= 0),
  in_shared boolean not null default false,
  -- one-off extras in rupees (sweet, papad, cold drink…) on top of tiffin/roti
  extra_amount numeric not null default 0 check (extra_amount >= 0),
  unique (entry_id, user_id)
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_user uuid not null references public.profiles(id),
  to_user uuid not null references public.profiles(id),
  amount numeric not null check (amount > 0),
  settle_date date not null default current_date,
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  -- soft delete (payments cannot be edited, only deleted with a trace)
  deleted_by uuid references public.profiles(id),
  deleted_at timestamptz
);

-- ---------- helpers ----------

-- security definer avoids RLS recursion when policies need membership checks
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- who is allowed to see a profile row: yourself, current groupmates, and anyone
-- referenced in your groups' records (keeps names on old entries after a member
-- is removed). Strangers see nothing.
create or replace function public.profile_visible(target uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select target = auth.uid()
     or exists (
       select 1 from group_members a
       join group_members b on a.group_id = b.group_id
       where a.user_id = auth.uid() and b.user_id = target
     )
     or exists (
       select 1 from entries e
       where public.is_group_member(e.group_id)
         and target in (e.payer_id, e.created_by, e.edited_by, e.deleted_by)
     )
     or exists (
       select 1 from entry_items it
       join entries e on e.id = it.entry_id
       where public.is_group_member(e.group_id) and it.user_id = target
     )
     or exists (
       select 1 from settlements s
       where public.is_group_member(s.group_id)
         and target in (s.from_user, s.to_user, s.created_by, s.deleted_by)
     );
$$;

create or replace function public.create_group(p_name text, p_tiffin numeric, p_roti numeric)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  gid uuid;
  code text;
begin
  code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into groups (name, invite_code, tiffin_price, roti_price, created_by)
  values (p_name, code, p_tiffin, p_roti, auth.uid())
  returning id into gid;
  insert into group_members (group_id, user_id) values (gid, auth.uid());
  return gid;
end;
$$;

create or replace function public.join_group(p_code text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  gid uuid;
begin
  select id into gid from groups where invite_code = upper(trim(p_code));
  if gid is null then
    raise exception 'Invalid invite code';
  end if;
  insert into group_members (group_id, user_id)
  values (gid, auth.uid())
  on conflict do nothing;
  return gid;
end;
$$;

-- new invite code if the old one leaked; old code stops working immediately
create or replace function public.regenerate_invite(p_group uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  code text;
begin
  if not public.is_group_member(p_group) then
    raise exception 'Not a member of this group';
  end if;
  code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  update groups set invite_code = code where id = p_group;
  return code;
end;
$$;

-- ---------- attribution triggers ----------
-- The server stamps who created/edited/deleted, ignoring whatever the client
-- sends — so "added by / edited by / deleted by" can never be faked via the API.

create or replace function public.stamp_entry_attribution()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
    new.edited_by := null;
    new.edited_at := null;
    new.deleted_by := null;
    new.deleted_at := null;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if new.deleted_at is not null and old.deleted_at is null then
      -- soft delete
      new.deleted_by := auth.uid();
      new.deleted_at := now();
    else
      -- normal edit, or a restore (deleted_at cleared)
      new.edited_by := auth.uid();
      new.edited_at := now();
      if new.deleted_at is null then
        new.deleted_by := null;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger entries_attribution
  before insert or update on public.entries
  for each row execute function public.stamp_entry_attribution();

create or replace function public.stamp_settlement_attribution()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
    new.deleted_by := null;
    new.deleted_at := null;
  else
    if new.deleted_at is not null and old.deleted_at is null then
      new := old;
      new.deleted_by := auth.uid();
      new.deleted_at := now();
    else
      -- payments are immutable: no edits, no un-delete
      raise exception 'Payments cannot be edited — delete it and record a new one';
    end if;
  end if;
  return new;
end;
$$;

create trigger settlements_attribution
  before insert or update on public.settlements
  for each row execute function public.stamp_settlement_attribution();

-- ---------- row level security ----------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.entries enable row level security;
alter table public.entry_items enable row level security;
alter table public.settlements enable row level security;

-- profiles: visible only to groupmates & people who share records with you
-- (profile_visible); you can only write your own
create policy "profiles read" on public.profiles
  for select to authenticated using (public.profile_visible(id));
create policy "profiles insert own" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles update own" on public.profiles
  for update to authenticated using (id = auth.uid());

-- groups: visible/editable only to members (creation goes through create_group)
create policy "groups read" on public.groups
  for select to authenticated using (public.is_group_member(id));
create policy "groups update" on public.groups
  for update to authenticated using (public.is_group_member(id));

-- group_members: members can see who else is in their groups (joins go through RPCs)
create policy "members read" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));
-- trusted-group model: any member can leave, or remove someone who left the mess
create policy "members delete" on public.group_members
  for delete to authenticated using (public.is_group_member(group_id));

-- entries: members can read/add/update — but NOT hard-delete. Soft-delete
-- (update with deleted_by/deleted_at) is the only delete, so the tombstone
-- audit trail can't be bypassed even via the raw API.
create policy "entries select" on public.entries
  for select to authenticated using (public.is_group_member(group_id));
create policy "entries insert" on public.entries
  for insert to authenticated with check (public.is_group_member(group_id));
create policy "entries update" on public.entries
  for update to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

-- entry_items: access follows the parent entry. DELETE stays allowed here —
-- the app's edit flow replaces an entry's items, and the parent entry update
-- stamps edited_by in the same save.
create policy "entry items all" on public.entry_items
  for all to authenticated
  using (public.is_group_member((select group_id from public.entries where id = entry_id)))
  with check (public.is_group_member((select group_id from public.entries where id = entry_id)));

-- settlements: same as entries — no hard delete, tombstones only
create policy "settlements select" on public.settlements
  for select to authenticated using (public.is_group_member(group_id));
create policy "settlements insert" on public.settlements
  for insert to authenticated with check (public.is_group_member(group_id));
create policy "settlements update" on public.settlements
  for update to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

-- ---------- realtime ----------
-- lets phones with the app open see each other's changes instantly

alter publication supabase_realtime add table public.entries;
alter publication supabase_realtime add table public.settlements;
alter publication supabase_realtime add table public.groups;
alter publication supabase_realtime add table public.group_members;

-- ---------- website & analytics (write-only via API) ----------
-- Lead capture, feedback, and event counters for the marketing site + app.
-- Anyone can INSERT; nothing is readable through the API - read these in the
-- dashboard Table Editor.

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
