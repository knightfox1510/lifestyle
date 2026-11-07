-- AI cost logging and the answer cache: household members only. A = member, B = outsider.
\set ON_ERROR_STOP 1
\o /dev/null
\set a '''56565656-0000-0000-0000-0000000000a1'''
\set b '''78787878-0000-0000-0000-0000000000b2'''
insert into auth.users (id, email) values (:a, 'a1@example.com'), (:b, 'b2@example.com');
set role authenticated;

select set_config('request.jwt.claim.sub', :a, false);
select public.create_household('AI home') as hid \gset
insert into public.ai_usage (household_id, user_id, feature, input_tokens, output_tokens, thinking_tokens, cached_tokens, search_queries, model, attempts)
values (:'hid', :a, 'food_estimate', 6000, 400, 800, 5000, null, 'gemini-flash-latest', 1);
insert into public.ai_usage (household_id, user_id, feature, from_cache) values (:'hid', :a, 'food_estimate', true);
insert into public.ai_cache (household_id, key, feature, result) values (:'hid', repeat('a', 64), 'food_estimate', '{"items": []}');
insert into public.ai_cache (household_id, key, feature, result) values (:'hid', repeat('a', 64), 'food_estimate', '{"items": [1]}')
on conflict (household_id, key) do update set result = excluded.result;
do $$ begin
  insert into public.ai_cache (household_id, key, feature, result) values ((select id from public.households where name = 'AI home'), 'short', 'x', '{}');
  raise exception 'SHOULD_FAIL: key must be a hash';
exception when check_violation then null;
end $$;
do $$ begin
  assert (select count(*) from public.ai_usage where not from_cache) = 1, 'cache hits are told apart';
  assert (select result from public.ai_cache) = '{"items": [1]}'::jsonb, 'upsert replaces the answer';
end $$;

-- Budget and search limit (owner), batch flag, AI weekly summary choice.
update public.households set ai_monthly_budget_inr = 500, ai_search_daily_limit = 20 where id = :'hid';
do $$ begin
  update public.households set ai_monthly_budget_inr = 5 where name = 'AI home';
  raise exception 'SHOULD_FAIL: budget too small';
exception when check_violation then null;
end $$;
insert into public.ai_usage (household_id, user_id, feature, batch) values (:'hid', :a, 'weekly_digest', true);
insert into public.notification_prefs (user_id, digest_ai) values (:a, true) on conflict (user_id) do update set digest_ai = true;
-- Batch jobs are written by the server only.
do $$ begin
  insert into public.ai_batches (household_id, user_id, feature, job_name) values ((select id from public.households where name = 'AI home'), '56565656-0000-0000-0000-0000000000a1', 'weekly_digest', 'batches/x');
  raise exception 'SHOULD_FAIL: users cannot queue batch jobs';
exception when insufficient_privilege then null;
end $$;
-- Deleted imported workouts: your own list only.
insert into public.workout_dismissed (external_id) values ('hc:1793000000000');
do $$ begin
  assert (select ai_monthly_budget_inr from public.households where name = 'AI home') = 500, 'owner sets the budget';
  assert (select count(*) from public.ai_usage where batch) = 1, 'batch requests are flagged';
  assert (select count(*) from public.workout_dismissed) = 1, 'dismissed workout remembered';
end $$;

select set_config('request.jwt.claim.sub', :b, false);
do $$ begin
  assert (select count(*) from public.ai_cache) = 0, 'outsiders see no cached answers';
  assert (select count(*) from public.workout_dismissed) = 0, 'others cannot see your dismissed workouts';
end $$;

reset role;
\o
\echo 'ALL AI COST TESTS PASSED'
