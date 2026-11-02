-- Weekly meal planning: the household's grocery-shopping day (0 = Sunday …
-- 6 = Saturday). The plan week starts on it. Any member may change it.

alter table public.households
  add column if not exists shopping_day smallint not null default 0;
do $$ begin
  alter table public.households add constraint households_shopping_day_check check (shopping_day between 0 and 6);
exception when duplicate_object then null;
end $$;

create or replace function public.set_shopping_day(p_household uuid, p_day smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_household_member(p_household) then
    raise exception 'not a member of this household' using errcode = '42501';
  end if;
  if p_day is null or p_day < 0 or p_day > 6 then
    raise exception 'shopping day must be 0-6' using errcode = '22023';
  end if;
  update public.households set shopping_day = p_day where id = p_household;
end;
$$;
revoke all on function public.set_shopping_day(uuid, smallint) from public;
grant execute on function public.set_shopping_day(uuid, smallint) to authenticated;
