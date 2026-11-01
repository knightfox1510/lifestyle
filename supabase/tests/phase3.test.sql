-- Phase 3 RLS tests. J = owner, K = partner, L = stranger.
\set ON_ERROR_STOP 1
\o /dev/null
\set j '''66666666-0000-0000-0000-00000000000a'''
\set k '''55555555-0000-0000-0000-00000000000b'''
\set l '''44444444-0000-0000-0000-00000000000c'''

insert into auth.users (id, email) values (:j, 'j@example.com'), (:k, 'k@example.com'), (:l, 'l@example.com');
set role authenticated;

select set_config('request.jwt.claim.sub', :j, false);
select public.create_household('P3 home') as hid \gset
select public.create_invite(:'hid') as code \gset
do $$ begin
  assert (select count(*) from public.household_modules where enabled) >= 16, 'phase 3 modules on, child opt-in';
  assert (select enabled from public.household_modules where module_key = 'child') = false, 'child off by default';
end $$;
select set_config('request.jwt.claim.sub', :k, false);
select public.accept_invite(:'code');
select set_config('request.jwt.claim.sub', :l, false);
select public.create_household('L home') as hid_l \gset
insert into public.dependents (id, household_id, name) values ('cccccccc-3333-0000-0000-000000000001', :'hid_l', 'Other kid');

select set_config('request.jwt.claim.sub', :j, false);
insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://push.example/j', 'p', 'a');
insert into public.notification_prefs (daily_hour) values (8);
insert into public.fitness_classes (household_id, name, days_of_week, start_time) values (:'hid', 'Morning gym', array[1, 3, 5], '07:30');
do $$ begin
  insert into public.fitness_classes (household_id, name, days_of_week, start_time)
  values ((select id from public.households where name = 'P3 home'), 'Bad', array[1], '7:30');
  raise exception 'SHOULD_FAIL: bad time';
exception when check_violation then null;
end $$;
insert into public.workout_logs (household_id, performed_on, title) values (:'hid', current_date, 'Gym');
insert into public.dependents (id, household_id, name, date_of_birth) values ('dddddddd-3333-0000-0000-000000000002', :'hid', 'Aarav', current_date - 200);
insert into public.child_logs (dependent_id, household_id, kind, detail) values ('dddddddd-3333-0000-0000-000000000002', :'hid', 'medicine', 'Paracetamol 2.5 ml');
insert into public.vaccinations (dependent_id, household_id, vaccine, due_on) values ('dddddddd-3333-0000-0000-000000000002', :'hid', 'MMR 1', current_date + 70);
do $$ begin
  insert into public.child_logs (dependent_id, household_id, kind)
  values ('cccccccc-3333-0000-0000-000000000001', (select id from public.households where name = 'P3 home'), 'feed');
  raise exception 'SHOULD_FAIL: other household child';
exception when insufficient_privilege then null;
end $$;
insert into public.maintenance_tasks (household_id, title, interval_days, next_due_on) values (:'hid', 'AC filter', 90, current_date);
insert into public.documents (household_id, title, doc_type, number_last4, expires_on) values (:'hid', 'My passport', 'passport', '1234', current_date + 50);
insert into public.documents (household_id, title, doc_type, scope, expires_on) values (:'hid', 'Home insurance', 'home_insurance', 'household', current_date + 300);
do $$ begin
  insert into public.documents (household_id, title, number_last4)
  values ((select id from public.households where name = 'P3 home'), 'Full number', 'A1234567');
  raise exception 'SHOULD_FAIL: full number stored';
exception when check_violation then null;
end $$;
insert into public.subscriptions (household_id, name, cost, paid_by) values (:'hid', 'Netflix', 649, :j);
do $$ begin
  insert into public.subscriptions (household_id, name, paid_by)
  values ((select id from public.households where name = 'P3 home'), 'X', 'cccccccc-0000-0000-0000-000000000003');
  raise exception 'SHOULD_FAIL: payer outside household';
exception when insufficient_privilege then null;
end $$;

-- K (partner): shared rows yes, personal rows no
select set_config('request.jwt.claim.sub', :k, false);
do $$
declare n int;
begin
  assert (select count(*) from public.push_subscriptions) = 0, 'push subs are private';
  assert (select count(*) from public.notification_prefs) = 0, 'prefs are private';
  assert (select count(*) from public.fitness_classes) = 0, 'fitness private';
  assert (select count(*) from public.dependents) = 1, 'partner sees child';
  assert (select count(*) from public.child_logs) = 1, 'partner sees dose log';
  assert (select count(*) from public.maintenance_tasks) = 1, 'partner sees maintenance';
  assert (select count(*) from public.subscriptions) = 1, 'partner sees subscriptions';
  assert (select count(*) from public.documents) = 1, 'partner sees only household documents';
  update public.documents set notes = 'x';
  get diagnostics n = row_count;
  assert n = 1, 'partner can edit household document only';
end $$;
do $$ begin
  insert into public.notification_log (user_id, kind, ref_key, title) values ('55555555-0000-0000-0000-00000000000b', 'x', 'x', 'x');
  raise exception 'SHOULD_FAIL: users cannot write the log';
exception when insufficient_privilege then null;
end $$;

-- J shares documents with K
select set_config('request.jwt.claim.sub', :j, false);
insert into public.module_shares (owner_id, grantee_id, module_key, level) values (:j, :k, 'documents', 'read');
select set_config('request.jwt.claim.sub', :k, false);
do $$ begin
  assert (select count(*) from public.documents) = 2, 'shared personal documents visible';
end $$;

select set_config('request.jwt.claim.sub', :l, false);
do $$ begin
  assert (select count(*) from public.dependents) = 1, 'stranger sees own child only';
  assert (select count(*) from public.documents) = 0, 'stranger: no documents';
  assert (select count(*) from public.subscriptions) = 0, 'stranger: no subscriptions';
end $$;

reset role;
\o
\echo 'ALL PHASE 3 TESTS PASSED'
