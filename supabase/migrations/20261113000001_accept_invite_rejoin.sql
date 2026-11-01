-- Joining with an invite you already used (e.g. the page failed after the join
-- went through) now just takes you to that household instead of failing with
-- "invite already used". Someone else using the same invite still fails.
create or replace function public.accept_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into inv from public.invites
  where code = upper(trim(invite_code))
  for update;

  if not found then
    raise exception 'invite not found';
  end if;

  -- Already accepted by this person, or already a member: just make it active.
  if inv.accepted_by = auth.uid()
     or exists (select 1 from public.household_members m where m.household_id = inv.household_id and m.user_id = auth.uid()) then
    insert into public.household_members (household_id, user_id, role)
    values (inv.household_id, auth.uid(), 'member')
    on conflict do nothing;
    update public.profiles set active_household_id = inv.household_id where id = auth.uid();
    return inv.household_id;
  end if;

  if inv.accepted_at is not null then
    raise exception 'invite already used';
  end if;
  if inv.expires_at < now() then
    raise exception 'invite expired';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (inv.household_id, auth.uid(), 'member')
  on conflict do nothing;

  update public.invites
  set accepted_by = auth.uid(), accepted_at = now()
  where id = inv.id;

  update public.profiles set active_household_id = inv.household_id where id = auth.uid();
  return inv.household_id;
end;
$$;
revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;
