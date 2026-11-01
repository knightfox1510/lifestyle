-- Phase 2 RLS tests. G = owner, H = partner, I = stranger.
\set ON_ERROR_STOP 1
\o /dev/null
\set g '''99999999-0000-0000-0000-000000000007'''
\set h '''88888888-0000-0000-0000-000000000008'''
\set i '''77777777-0000-0000-0000-000000000009'''

insert into auth.users (id, email) values (:g, 'g@example.com'), (:h, 'h@example.com'), (:i, 'i@example.com');
set role authenticated;

select set_config('request.jwt.claim.sub', :g, false);
select public.create_household('P2 home') as hid \gset
select public.create_invite(:'hid') as code \gset
do $$ begin
  assert (select count(*) from public.household_modules where enabled) >= 12, 'phase 2 modules on by default';
end $$;
select set_config('request.jwt.claim.sub', :h, false);
select public.accept_invite(:'code');
select set_config('request.jwt.claim.sub', :i, false);
select public.create_household('I home') as hid_i \gset
insert into public.recipes (id, household_id, title) values ('aaaaaaaa-1111-0000-0000-000000000001', :'hid_i', 'Stranger recipe');

-- G: personal + shared data
select set_config('request.jwt.claim.sub', :g, false);
insert into public.nutrition_goals (household_id, calories) values (:'hid', 1800);
insert into public.food_entries (household_id, meal, description, calories) values (:'hid', 'lunch', 'Dal rice', 550);
insert into public.body_metrics (household_id, weight_kg) values (:'hid', 64.2);
do $$ begin
  insert into public.body_metrics (household_id) values ((select id from public.households where name = 'P2 home'));
  raise exception 'SHOULD_FAIL: empty metric';
exception when check_violation then null;
end $$;
insert into public.body_goals (household_id, target_weight_kg, milestones) values (:'hid', 60, array[63, 62, 61]);
insert into public.lab_results (household_id, test_date, marker, value, unit, flag) values (:'hid', current_date, 'Vitamin D', 18, 'ng/mL', 'low');
insert into public.pantry_items (household_id, name, expires_on) values (:'hid', 'Milk', current_date + 2);
insert into public.recipes (id, household_id, title) values ('bbbbbbbb-1111-0000-0000-000000000002', :'hid', 'Palak paneer');
insert into public.meal_plan (household_id, plan_date, meal, recipe_id) values (:'hid', current_date, 'dinner', 'bbbbbbbb-1111-0000-0000-000000000002');
-- cannot log food against another household's recipe
do $$ begin
  insert into public.food_entries (household_id, meal, description, recipe_id)
  values ((select id from public.households where name = 'P2 home'), 'dinner', 'x', 'aaaaaaaa-1111-0000-0000-000000000001');
  raise exception 'SHOULD_FAIL: foreign recipe';
exception when insufficient_privilege then null;
end $$;

-- H: shared household rows visible, personal rows private
select set_config('request.jwt.claim.sub', :h, false);
do $$ begin
  assert (select count(*) from public.pantry_items) = 1, 'partner sees pantry';
  assert (select count(*) from public.recipes) = 1, 'partner sees household recipes only';
  assert (select count(*) from public.meal_plan) = 1, 'partner sees meal plan';
  assert (select count(*) from public.food_entries) = 0, 'food diary private';
  assert (select count(*) from public.nutrition_goals) = 0, 'goals private';
  assert (select count(*) from public.body_metrics) = 0, 'body metrics private';
  assert (select count(*) from public.lab_results) = 0, 'lab results private';
end $$;

select set_config('request.jwt.claim.sub', :g, false);
insert into public.module_shares (owner_id, grantee_id, module_key, level) values (:g, :h, 'medical_records', 'read'), (:g, :h, 'body_recomp', 'write');

select set_config('request.jwt.claim.sub', :h, false);
insert into public.body_metrics (owner_id, household_id, weight_kg) values (:g, :'hid', 64.0);
do $$
declare n int;
begin
  assert (select count(*) from public.lab_results) = 1, 'labs visible via medical share';
  assert (select count(*) from public.body_metrics) = 2, 'body metrics visible with write share';
  update public.lab_results set value = 99;
  get diagnostics n = row_count;
  assert n = 0, 'read share cannot edit labs';
  assert (select count(*) from public.food_entries) = 0, 'food still private';
end $$;

select set_config('request.jwt.claim.sub', :i, false);
do $$ begin
  assert (select count(*) from public.pantry_items) = 0, 'stranger: no pantry';
  assert (select count(*) from public.recipes) = 1, 'stranger: own recipe only';
  assert (select count(*) from public.lab_results) = 0, 'stranger: no labs';
end $$;

reset role;
\o
\echo 'ALL PHASE 2 TESTS PASSED'
