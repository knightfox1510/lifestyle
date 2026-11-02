-- Shopping day: any member can set it, strangers can't, and it stays 0-6.
\set ON_ERROR_STOP 1
\o /dev/null
\set p '''4d4d4d4d-0000-0000-0000-000000000051'''
\set q '''5e5e5e5e-0000-0000-0000-000000000052'''
\set r '''6f6f6f6f-0000-0000-0000-000000000053'''
insert into auth.users (id, email) values (:p, 'p51@example.com'), (:q, 'q52@example.com'), (:r, 'r53@example.com');
set role authenticated;

select set_config('request.jwt.claim.sub', :p, false);
select public.create_household('Plan home') as hid \gset
select public.create_invite(:'hid') as code \gset
select set_config('request.jwt.claim.sub', :q, false);
select public.accept_invite(:'code');
select set_config('test.hid', :'hid', false);

-- The partner (not an owner) can set it.
select public.set_shopping_day(:'hid', 6::smallint);
do $$ begin
  if (select shopping_day from public.households where name = 'Plan home') <> 6 then raise exception 'shopping day not saved'; end if;
end $$;
do $$ begin
  perform public.set_shopping_day(current_setting('test.hid')::uuid, 9::smallint);
  raise exception 'SHOULD_FAIL: day 9';
exception when invalid_parameter_value then null;
end $$;

-- A stranger can't.
select set_config('request.jwt.claim.sub', :r, false);
do $$ begin
  perform public.set_shopping_day(current_setting('test.hid')::uuid, 1::smallint);
  raise exception 'SHOULD_FAIL: stranger';
exception when insufficient_privilege then null;
end $$;

-- Per-person dishes: only for members of the same household.
select set_config('request.jwt.claim.sub', :p, false);
insert into public.meal_plan (household_id, plan_date, meal, title, for_user, portions, kcal_per_serving, ingredients)
values (:'hid', '2026-11-07', 'lunch', 'Paneer bhurji', :q, '{"x": 1.5}', 420, '[{"name": "paneer", "quantity": "200 g", "category": "dairy"}]');
do $$ begin
  insert into public.meal_plan (household_id, plan_date, meal, title, for_user)
  values (current_setting('test.hid')::uuid, '2026-11-07', 'dinner', 'Not ours', '6f6f6f6f-0000-0000-0000-000000000053');
  raise exception 'SHOULD_FAIL: stranger as for_user';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.meal_plan (household_id, plan_date, meal, title, portions) values (current_setting('test.hid')::uuid, '2026-11-07', 'dinner', 'Bad', '[1]');
  raise exception 'SHOULD_FAIL: portions array';
exception when check_violation then null;
end $$;

reset role;
do $$ begin
  if (select shopping_day from public.households where name = 'Plan home') <> 6 then raise exception 'stranger changed the shopping day'; end if;
end $$;
\o
\echo 'ALL WEEK PLAN TESTS PASSED'
