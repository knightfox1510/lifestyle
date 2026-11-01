-- Nutrition tests. S = owner, T = partner, U = stranger.
\set ON_ERROR_STOP 1
\o /dev/null
\set s '''78787878-0000-0000-0000-000000000013'''
\set t '''90909090-0000-0000-0000-000000000014'''
\set u '''13131313-0000-0000-0000-000000000015'''

insert into auth.users (id, email) values (:s, 's@example.com'), (:t, 't@example.com'), (:u, 'u@example.com');
set role authenticated;

select set_config('request.jwt.claim.sub', :s, false);
select public.create_household('Nutri home') as hid \gset
select public.create_invite(:'hid') as code \gset
select set_config('request.jwt.claim.sub', :t, false);
select public.accept_invite(:'code');
select set_config('request.jwt.claim.sub', :u, false);
select public.create_household('U home') as hid_u \gset
insert into public.recipes (id, household_id, title) values ('cccccccc-6666-0000-0000-000000000001', :'hid_u', 'Other dal');

select set_config('request.jwt.claim.sub', :s, false);
insert into public.custom_foods (household_id, name, barcode, source, nutrients)
values (:'hid', 'Aashirvaad atta', '8901725181222', 'label', '{"calories": 360, "protein_g": 12, "iron_mg": 3.9}');
do $$ begin
  insert into public.custom_foods (household_id, name, barcode)
  values ((select id from public.households where name = 'Nutri home'), 'dup', '8901725181222');
  raise exception 'SHOULD_FAIL: duplicate barcode';
exception when unique_violation then null;
end $$;
do $$ begin
  insert into public.custom_foods (household_id, name, barcode)
  values ((select id from public.households where name = 'Nutri home'), 'bad', 'abc');
  raise exception 'SHOULD_FAIL: bad barcode';
exception when check_violation then null;
end $$;

insert into public.recipes (id, household_id, title, servings, nutrition, total_weight_g, irritants)
values ('dddddddd-6666-0000-0000-000000000002', :'hid', 'Toor dal', 4, '{"calories": 210, "protein_g": 11, "iron_mg": 2.1}', 1200, '{tomato}');
insert into public.food_entries (household_id, meal, description, calories, micros, grams, accuracy, irritants, group_id, recipe_id)
values (:'hid', 'dinner', 'Toor dal', 210, '{"iron_mg": 2.1}', 300, 'calculated', '{tomato}', 'eeeeeeee-6666-0000-0000-000000000003', 'dddddddd-6666-0000-0000-000000000002');
insert into public.pantry_items (household_id, name, location, recipe_id, portions)
values (:'hid', 'Leftover: Toor dal', 'fridge', 'dddddddd-6666-0000-0000-000000000002', 2);
do $$ begin
  insert into public.pantry_items (household_id, name, recipe_id)
  values ((select id from public.households where name = 'Nutri home'), 'x', 'cccccccc-6666-0000-0000-000000000001');
  raise exception 'SHOULD_FAIL: foreign recipe leftover';
exception when insufficient_privilege then null;
end $$;

-- Partner can log for S only with a write share on food_diary.
select set_config('request.jwt.claim.sub', :t, false);
do $$ begin
  assert (select count(*) from public.custom_foods) = 1, 'partner sees household foods';
  insert into public.food_entries (owner_id, household_id, meal, description)
  values ('78787878-0000-0000-0000-000000000013', (select id from public.households where name = 'Nutri home'), 'dinner', 'x');
  raise exception 'SHOULD_FAIL: no write share';
exception when insufficient_privilege then null;
end $$;

select set_config('request.jwt.claim.sub', :s, false);
insert into public.module_shares (owner_id, grantee_id, module_key, level) values (:s, :t, 'food_diary', 'write');
select set_config('request.jwt.claim.sub', :t, false);
insert into public.food_entries (owner_id, household_id, meal, description, calories, group_id)
values (:s, :'hid', 'dinner', 'Toor dal (partner logged)', 160, 'eeeeeeee-6666-0000-0000-000000000003');
do $$ begin
  assert (select count(*) from public.food_entries where group_id = 'eeeeeeee-6666-0000-0000-000000000003') = 2, 'shared meal grouped';
  assert (select micros->>'iron_mg' from public.food_entries where accuracy = 'calculated') = '2.1', 'micros stored';
end $$;

select set_config('request.jwt.claim.sub', :u, false);
do $$ begin
  assert (select count(*) from public.custom_foods) = 0, 'stranger: no foods';
end $$;

-- Water reminder settings: own row only, sane ranges.
select set_config('request.jwt.claim.sub', :s, false);
insert into public.notification_prefs (user_id, water, water_target_ml, water_interval_min, water_start, water_end)
values (:s, true, 2500, 90, '07:30', '19:00');
do $$ begin
  update public.notification_prefs set water_interval_min = 5 where user_id = auth.uid();
  raise exception 'SHOULD_FAIL: interval too short';
exception when check_violation then null;
end $$;
select set_config('request.jwt.claim.sub', :t, false);
do $$ begin
  assert (select count(*) from public.notification_prefs where water) = 0, 'partner cannot see my water prefs';
end $$;

reset role;
\o
\echo 'ALL NUTRITION TESTS PASSED'
