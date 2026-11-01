-- Phase 1 RLS + trigger tests. D = owner, E = partner, F = stranger.
\set ON_ERROR_STOP 1
\o /dev/null
\set d '''dddddddd-0000-0000-0000-000000000004'''
\set e '''eeeeeeee-0000-0000-0000-000000000005'''
\set f '''ffffffff-0000-0000-0000-000000000006'''

insert into auth.users (id, email) values (:d, 'd@example.com'), (:e, 'e@example.com'), (:f, 'f@example.com');

set role authenticated;

select set_config('request.jwt.claim.sub', :d, false);
select public.create_household('Phase1 home') as hid \gset
select public.create_invite(:'hid') as code \gset
do $$ begin
  assert (select count(*) from public.household_modules where enabled) = 8, 'all phase 1 modules on by default';
end $$;

select set_config('request.jwt.claim.sub', :e, false);
select public.accept_invite(:'code');
select set_config('request.jwt.claim.sub', :f, false);
select public.create_household('F home') as hid_f \gset

-- D creates personal data ----------------------------------------------------
select set_config('request.jwt.claim.sub', :d, false);
insert into public.medicines (id, household_id, name, times, stock_count, dose_amount)
values ('11111111-0000-0000-0000-000000000001', :'hid', 'Metformin', array['08:00', '20:00'], 10, 1);
do $$ begin
  insert into public.medicines (household_id, name, times)
  values ((select id from public.households where name = 'Phase1 home'), 'Bad', array['25:00']);
  raise exception 'SHOULD_FAIL: invalid time';
exception when check_violation then null;
end $$;
insert into public.medicine_doses (medicine_id, owner_id, scheduled_date, scheduled_time, status)
values ('11111111-0000-0000-0000-000000000001', :d, current_date, '08:00', 'taken');
do $$ begin
  assert (select stock_count from public.medicines) = 9, 'taking a dose decrements stock';
end $$;
update public.medicine_doses set status = 'skipped';
do $$ begin
  assert (select stock_count from public.medicines) = 10, 'un-taking restores stock';
end $$;
delete from public.medicine_doses;

insert into public.supplements (id, household_id, name) values ('22222222-0000-0000-0000-000000000002', :'hid', 'Magnesium');
insert into public.supplement_logs (supplement_id, owner_id, log_date) values ('22222222-0000-0000-0000-000000000002', :d, current_date);
insert into public.bladder_events (household_id, kind, amount, triggers) values (:'hid', 'leak', 'small', array['cough', 'lifting']);
do $$ begin
  insert into public.bladder_events (household_id, kind, triggers)
  values ((select id from public.households where name = 'Phase1 home'), 'leak', array['nonsense']);
  raise exception 'SHOULD_FAIL: unknown trigger';
exception when check_violation then null;
end $$;
insert into public.fluid_intake (household_id, drink, volume_ml, caffeinated) values (:'hid', 'coffee', 200, true);
insert into public.daily_checkins (household_id, checkin_date, mood) values (:'hid', current_date, 4);
insert into public.habits (id, household_id, name) values ('33333333-0000-0000-0000-000000000003', :'hid', 'Walk');
insert into public.habit_logs (habit_id, owner_id, log_date) values ('33333333-0000-0000-0000-000000000003', :d, current_date);
insert into public.pelvic_floor_sessions (household_id, sets, reps, hold_seconds, relax_seconds, duration_seconds)
values (:'hid', 3, 10, 5, 5, 300);
insert into public.grocery_items (id, household_id, name) values (gen_random_uuid(), :'hid', 'Milk');

-- E: household groceries yes, personal data no ---------------------------------
select set_config('request.jwt.claim.sub', :e, false);
do $$ begin
  assert (select count(*) from public.grocery_items) = 1, 'partner sees shared groceries';
  assert (select count(*) from public.medicines) = 0, 'no medicines without share';
  assert (select count(*) from public.bladder_events) = 0, 'no bladder diary without share';
  assert (select count(*) from public.fluid_intake) = 0, 'no fluids without share';
  assert (select count(*) from public.supplement_logs) = 0, 'no supplement logs without share';
  assert (select count(*) from public.habit_logs) = 0, 'no habit logs without share';
  assert (select count(*) from public.daily_checkins) = 0, 'no check-ins without share';
  assert (select count(*) from public.pelvic_floor_sessions) = 0, 'no sessions without share';
end $$;
update public.grocery_items set checked = true;
insert into public.grocery_items (id, household_id, name) values (gen_random_uuid(), :'hid', 'Eggs');
do $$ begin
  insert into public.medicine_doses (medicine_id, owner_id, scheduled_date, scheduled_time, status)
  values ('11111111-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000004', current_date, '20:00', 'taken');
  raise exception 'SHOULD_FAIL: dose without share';
exception when insufficient_privilege then null;
end $$;

-- D shares medicines (write) and bladder diary (read) with E
select set_config('request.jwt.claim.sub', :d, false);
insert into public.module_shares (owner_id, grantee_id, module_key, level) values
  (:d, :e, 'medicines', 'write'),
  (:d, :e, 'bladder_diary', 'read');

select set_config('request.jwt.claim.sub', :e, false);
insert into public.medicine_doses (medicine_id, owner_id, scheduled_date, scheduled_time, status)
values ('11111111-0000-0000-0000-000000000001', :d, current_date, '20:00', 'taken');
do $$
declare n int;
begin
  assert (select count(*) from public.medicines) = 1, 'partner sees shared medicines';
  assert (select count(*) from public.bladder_events) = 1, 'partner reads bladder diary';
  assert (select count(*) from public.fluid_intake) = 1, 'partner reads fluids';
  assert (select count(*) from public.supplements) = 0, 'supplements still private';
  update public.bladder_events set notes = 'x';
  get diagnostics n = row_count;
  assert n = 0, 'read-only share cannot edit diary';
end $$;
do $$ begin
  insert into public.bladder_events (owner_id, household_id, kind)
  values ('dddddddd-0000-0000-0000-000000000004', (select id from public.households limit 1), 'urge');
  raise exception 'SHOULD_FAIL: read share inserted';
exception when insufficient_privilege then null;
end $$;

-- Dose on someone else's medicine id with mismatched owner is rejected
do $$ begin
  insert into public.medicine_doses (medicine_id, owner_id, scheduled_date, scheduled_time, status)
  values ('11111111-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000005', current_date, '08:00', 'taken');
  raise exception 'SHOULD_FAIL: owner mismatch';
exception when insufficient_privilege then null;
end $$;

-- F sees nothing
select set_config('request.jwt.claim.sub', :f, false);
do $$ begin
  assert (select count(*) from public.grocery_items) = 0, 'stranger: no groceries';
  assert (select count(*) from public.medicines) = 0, 'stranger: no medicines';
  assert (select count(*) from public.medicine_doses) = 0, 'stranger: no doses';
end $$;
do $$ begin
  insert into public.grocery_items (id, household_id, name)
  values (gen_random_uuid(), (select id from public.households where name = 'F home'), 'ok');
end $$;
do $$ begin
  assert (select count(*) from public.grocery_items) = 1, 'stranger sees only own list';
end $$;

select set_config('request.jwt.claim.sub', :d, false);
do $$ begin
  assert (select stock_count from public.medicines) = 9, 'partner-logged dose decremented stock';
  assert (select count(*) from public.grocery_items) = 2, 'owner sees partner grocery item';
end $$;

reset role;
\o
\echo 'ALL PHASE 1 TESTS PASSED'
