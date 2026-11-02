-- Cycle tracker: private by default; a read share lets the partner see, not change. L = owner, M = partner.
\set ON_ERROR_STOP 1
\o /dev/null
\set l '''56565656-0000-0000-0000-000000000081'''
\set m '''78787878-0000-0000-0000-000000000082'''
insert into auth.users (id, email) values (:l, 'l81@example.com'), (:m, 'm82@example.com');
set role authenticated;

select set_config('request.jwt.claim.sub', :l, false);
select public.create_household('Cycle home') as hid \gset
select public.create_invite(:'hid') as code \gset
select set_config('request.jwt.claim.sub', :m, false);
select public.accept_invite(:'code');

select set_config('request.jwt.claim.sub', :l, false);
insert into public.household_modules (household_id, module_key, enabled) values (:'hid', 'cycle', true) on conflict do nothing;
insert into public.cycle_days (household_id, day, flow, symptoms) values (:'hid', '2026-10-30', 'heavy', array['cramps']);
do $$ begin
  insert into public.cycle_days (household_id, day, flow) values ((select id from public.households where name = 'Cycle home'), '2026-10-31', 'gushing');
  raise exception 'SHOULD_FAIL: bad flow';
exception when check_violation then null;
end $$;
do $$ begin
  insert into public.cycle_days (household_id, day, flow) values ((select id from public.households where name = 'Cycle home'), '2026-10-30', 'light');
  raise exception 'SHOULD_FAIL: one row per day';
exception when unique_violation then null;
end $$;

select set_config('request.jwt.claim.sub', :m, false);
do $$ begin
  assert (select count(*) from public.cycle_days) = 0, 'partner sees nothing without a share';
end $$;

select set_config('request.jwt.claim.sub', :l, false);
insert into public.module_shares (owner_id, grantee_id, module_key, level) values (:l, :m, 'cycle', 'read');
select set_config('request.jwt.claim.sub', :m, false);
update public.cycle_days set flow = 'light';
do $$ begin
  assert (select count(*) from public.cycle_days) = 1, 'read share shows the days';
  assert (select flow from public.cycle_days) = 'heavy', 'read share cannot change them';
end $$;

reset role;
\o
\echo 'ALL CYCLE TESTS PASSED'
