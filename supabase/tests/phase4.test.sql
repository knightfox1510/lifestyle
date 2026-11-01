-- Phase 4 RLS tests. M = owner, N = partner, O = stranger.
\set ON_ERROR_STOP 1
\o /dev/null
\set m '''33333333-0000-0000-0000-00000000000d'''
\set n '''22222222-0000-0000-0000-00000000000e'''
\set o '''11111111-0000-0000-0000-00000000000f'''

insert into auth.users (id, email) values (:m, 'm@example.com'), (:n, 'n@example.com'), (:o, 'o@example.com');
set role authenticated;

select set_config('request.jwt.claim.sub', :m, false);
select public.create_household('P4 home') as hid \gset
select public.create_invite(:'hid') as code \gset
do $$ begin
  assert (select count(*) from public.household_modules where enabled) = 21, 'phase 4 modules on';
end $$;
select set_config('request.jwt.claim.sub', :n, false);
select public.accept_invite(:'code');
select set_config('request.jwt.claim.sub', :o, false);
select public.create_household('O home') as hid_o \gset
insert into public.trips (id, household_id, title) values ('eeeeeeee-4444-0000-0000-000000000001', :'hid_o', 'Other trip');

select set_config('request.jwt.claim.sub', :m, false);
insert into public.watchlist_items (id, household_id, title) values ('aaaaaaaa-4444-0000-0000-000000000002', :'hid', 'House of the Dragon');
insert into public.watch_progress (item_id, household_id, season, episode) values ('aaaaaaaa-4444-0000-0000-000000000002', :'hid', 2, 3);
insert into public.trips (id, household_id, title, destination) values ('bbbbbbbb-4444-0000-0000-000000000003', :'hid', 'Japan', 'Tokyo');
insert into public.trip_packing (trip_id, household_id, name) values ('bbbbbbbb-4444-0000-0000-000000000003', :'hid', 'Passport');
do $$ begin
  insert into public.trip_items (trip_id, household_id, title)
  values ('eeeeeeee-4444-0000-0000-000000000001', (select id from public.households where name = 'P4 home'), 'x');
  raise exception 'SHOULD_FAIL: foreign trip';
exception when insufficient_privilege then null;
end $$;
insert into public.occasions (household_id, title, month, day) values (:'hid', 'Karishma birthday', 3, 14);
insert into public.gift_ideas (household_id, for_person, idea) values (:'hid', 'Karishma', 'Kindle');
insert into public.wearable_daily (household_id, day, steps) values (:'hid', current_date, 8000);
insert into public.ingest_tokens (token_hash) values (repeat('a', 64));

select set_config('request.jwt.claim.sub', :n, false);
do $$
declare n int;
begin
  assert (select count(*) from public.watchlist_items) = 1, 'partner sees watchlist';
  assert (select count(*) from public.watch_progress) = 1, 'partner sees progress';
  assert (select count(*) from public.trips) = 1, 'partner sees own household trips only';
  assert (select count(*) from public.trip_packing) = 1, 'partner sees packing';
  assert (select count(*) from public.occasions) = 1, 'partner sees occasions';
  assert (select count(*) from public.gift_ideas) = 0, 'gift ideas stay secret';
  assert (select count(*) from public.wearable_daily) = 0, 'wearables private';
  assert (select count(*) from public.ingest_tokens) = 0, 'tokens private';
  update public.watch_progress set episode = 9;
  get diagnostics n = row_count;
  assert n = 0, 'cannot move partner progress';
end $$;
insert into public.watch_progress (item_id, household_id, season, episode) values ('aaaaaaaa-4444-0000-0000-000000000002', :'hid', 2, 5);

-- Even with a module share, gift ideas stay private.
select set_config('request.jwt.claim.sub', :m, false);
insert into public.module_shares (owner_id, grantee_id, module_key, level) values (:m, :n, 'occasions', 'write'), (:m, :n, 'wearables', 'read');
select set_config('request.jwt.claim.sub', :n, false);
do $$ begin
  assert (select count(*) from public.gift_ideas) = 0, 'gift ideas private even when shared';
  assert (select count(*) from public.wearable_daily) = 1, 'wearables shared';
end $$;

-- Household switching
select set_config('request.jwt.claim.sub', :n, false);
do $$ begin
  perform public.switch_household((select id from public.households where name = 'O home'));
  raise exception 'SHOULD_FAIL: switch to foreign household';
exception when raise_exception then
  if sqlerrm like 'SHOULD_FAIL%' then raise; end if;
end $$;

select set_config('request.jwt.claim.sub', :o, false);
do $$ begin
  assert (select count(*) from public.watchlist_items) = 0, 'stranger: no watchlist';
  assert (select count(*) from public.trips) = 1, 'stranger: own trip only';
end $$;

-- Account deletion hands ownership to the partner.
select set_config('request.jwt.claim.sub', :m, false);
select public.prepare_account_deletion();
reset role;
delete from auth.users where id = :m;
do $$ begin
  assert (select role from public.household_members where user_id = '22222222-0000-0000-0000-00000000000e') = 'owner', 'partner became owner';
  assert (select count(*) from public.gift_ideas) = 0, 'deleted user data removed';
  assert (select count(*) from public.watchlist_items) = 1, 'shared household data kept';
end $$;
-- Sole member deleting removes the household.
set role authenticated;
select set_config('request.jwt.claim.sub', :o, false);
select public.prepare_account_deletion();
reset role;
do $$ begin
  assert (select count(*) from public.households where name = 'O home') = 0, 'empty household removed';
end $$;

\o
\echo 'ALL PHASE 4 TESTS PASSED'
