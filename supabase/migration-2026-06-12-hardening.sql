-- Hardening migration — applied to production 2026-06-12.
-- (Fresh installs don't need this: schema.sql already contains the final state.)
--
-- 1) profiles: strangers could read every name + phone. Now visible = yourself,
--    current groupmates, and people referenced in your groups' records (so names
--    on old entries survive after a member is removed).
-- 2) entries/settlements: policies were FOR ALL, so the raw API allowed hard
--    DELETE, silently bypassing the tombstone audit trail. Soft-delete (update)
--    is now the only delete. entry_items keeps DELETE — the app's edit flow
--    replaces items, and the parent entry update stamps edited_by in the same save.

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

drop policy "profiles read" on public.profiles;
create policy "profiles read" on public.profiles
  for select to authenticated using (public.profile_visible(id));

drop policy "entries all" on public.entries;
create policy "entries select" on public.entries
  for select to authenticated using (public.is_group_member(group_id));
create policy "entries insert" on public.entries
  for insert to authenticated with check (public.is_group_member(group_id));
create policy "entries update" on public.entries
  for update to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

drop policy "settlements all" on public.settlements;
create policy "settlements select" on public.settlements
  for select to authenticated using (public.is_group_member(group_id));
create policy "settlements insert" on public.settlements
  for insert to authenticated with check (public.is_group_member(group_id));
create policy "settlements update" on public.settlements
  for update to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));
