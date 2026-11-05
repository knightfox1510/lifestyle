-- Private log: owner-only writes, hidden without a share; weekly fitness goals; watchlist details. P = owner, Q = partner.
\set ON_ERROR_STOP 1
\o /dev/null
\set p '''56565656-0000-0000-0000-000000000091'''
\set q '''78787878-0000-0000-0000-000000000092'''
insert into auth.users (id, email) values (:p, 'p91@example.com'), (:q, 'q92@example.com');
set role authenticated;

select set_config('request.jwt.claim.sub', :p, false);
select public.create_household('Private home') as hid \gset
select public.create_invite(:'hid') as code \gset
select set_config('request.jwt.claim.sub', :q, false);
select public.accept_invite(:'code');

-- Private log
select set_config('request.jwt.claim.sub', :p, false);
insert into public.private_logs (household_id, kind, detail, amount, occurred_on) values (:'hid', 'alcohol', 'beer', 3, '2026-11-01');
insert into public.private_logs (household_id, kind, detail, occurred_on) values (:'hid', 'intimacy', 'sex', '2026-11-01');
do $$ begin
  insert into public.private_logs (household_id, kind, occurred_on) values ((select id from public.households where name = 'Private home'), 'gambling', '2026-11-01');
  raise exception 'SHOULD_FAIL: unknown kind';
exception when check_violation then null;
end $$;
update public.profiles set ai_include_alcohol = true where id = auth.uid();

select set_config('request.jwt.claim.sub', :q, false);
do $$ begin
  assert (select count(*) from public.private_logs) = 0, 'partner sees nothing without a share';
end $$;

select set_config('request.jwt.claim.sub', :p, false);
insert into public.module_shares (owner_id, grantee_id, module_key, level) values (:p, :q, 'private_log', 'write');
select set_config('request.jwt.claim.sub', :q, false);
update public.private_logs set amount = 1;
delete from public.private_logs;
do $$ begin
  assert (select count(*) from public.private_logs) = 2, 'a share shows the entries, and the partner cannot delete them';
  assert (select amount from public.private_logs where kind = 'alcohol') = 3, 'even a write share cannot change them';
end $$;
do $$ begin
  insert into public.private_logs (owner_id, household_id, kind, occurred_on)
  values ('56565656-0000-0000-0000-000000000091', (select id from public.households where name = 'Private home'), 'solo', '2026-11-02');
  raise exception 'SHOULD_FAIL: partner logging for the owner';
exception when insufficient_privilege then null;
end $$;

-- Weekly fitness goals: one per type; a write share can set them for the owner.
select set_config('request.jwt.claim.sub', :p, false);
insert into public.fitness_goals (household_id, kind, times_per_week) values (:'hid', 'gym', 4);
do $$ begin
  insert into public.fitness_goals (household_id, kind, times_per_week) values ((select id from public.households where name = 'Private home'), 'gym', 3);
  raise exception 'SHOULD_FAIL: one goal per type';
exception when unique_violation then null;
end $$;
do $$ begin
  insert into public.fitness_goals (household_id, kind, times_per_week) values ((select id from public.households where name = 'Private home'), 'walk', 20);
  raise exception 'SHOULD_FAIL: too many a week';
exception when check_violation then null;
end $$;
select set_config('request.jwt.claim.sub', :q, false);
do $$ begin
  assert (select count(*) from public.fitness_goals) = 0, 'goals are private without a fitness share';
end $$;
select set_config('request.jwt.claim.sub', :p, false);
insert into public.module_shares (owner_id, grantee_id, module_key, level) values (:p, :q, 'fitness', 'write');
select set_config('request.jwt.claim.sub', :q, false);
insert into public.fitness_goals (owner_id, household_id, kind, times_per_week) values (:p, :'hid', 'walk', 3);
do $$ begin
  assert (select count(*) from public.fitness_goals) = 2, 'a write share can add goals for the owner';
end $$;

-- Watchlist details
insert into public.watchlist_items (household_id, title, kind, year, imdb_rating, genres) values (:'hid', 'Panchayat', 'series', 2020, 9.0, array['Comedy', 'Drama']);
do $$ begin
  update public.watchlist_items set imdb_rating = 11;
  raise exception 'SHOULD_FAIL: rating out of range';
exception when check_violation then null;
end $$;

reset role;
\o
\echo 'ALL PRIVATE LOG & GOALS TESTS PASSED'
