-- Engagement tests. E = owner, F = partner, G = stranger.
\set ON_ERROR_STOP 1
\o /dev/null
\set e '''e1e1e1e1-0000-0000-0000-000000000021'''
\set f '''f2f2f2f2-0000-0000-0000-000000000022'''
\set g '''a3a3a3a3-0000-0000-0000-000000000023'''

insert into auth.users (id, email) values (:e, 'e@example.com'), (:f, 'f@example.com'), (:g, 'g@example.com');
set role authenticated;

select set_config('request.jwt.claim.sub', :e, false);
select public.create_household('Engage home') as hid \gset
select public.create_invite(:'hid') as code \gset
select set_config('request.jwt.claim.sub', :f, false);
select public.accept_invite(:'code');
select set_config('request.jwt.claim.sub', :g, false);
select public.create_household('G home') as hid_g \gset

-- E logs water today and yesterday; a check-in two days ago.
select set_config('request.jwt.claim.sub', :e, false);
update public.profiles set home_view = 'bars' where id = auth.uid();
do $$ begin
  update public.profiles set home_view = 'carousel' where id = auth.uid();
  raise exception 'SHOULD_FAIL: bad home view';
exception when check_violation then null;
end $$;
insert into public.fluid_intake (household_id, drink, volume_ml) values (:'hid', 'water', 250);
insert into public.fluid_intake (household_id, drink, volume_ml, occurred_at) values (:'hid', 'water', 250, now() - interval '1 day');
insert into public.daily_checkins (household_id, checkin_date, mood) values (:'hid', current_date - 2, 4);
do $$ begin
  assert (select count(*) from public.activity_days(auth.uid(), current_date - 7)) >= 2, 'own activity days';
end $$;

-- Milestones: own rows only.
insert into public.milestones (key) values ('streak_7');
select set_config('request.jwt.claim.sub', :f, false);
do $$ begin
  assert (select count(*) from public.milestones) = 0, 'partner cannot see milestones';
  -- Partner sees only the dates, not the rows.
  assert (select count(*) from public.activity_days('e1e1e1e1-0000-0000-0000-000000000021', current_date - 7)) >= 2, 'partner sees activity days';
  assert (select count(*) from public.fluid_intake) = 0, 'partner still cannot read fluids';
end $$;

-- Cheers: partner to E works; as someone else or to a stranger fails.
insert into public.cheers (household_id, to_user, emoji) values (:'hid', :e, '👏');
do $$ begin
  insert into public.cheers (household_id, from_user, to_user, emoji)
  values ((select id from public.households where name = 'Engage home'), 'e1e1e1e1-0000-0000-0000-000000000021', 'f2f2f2f2-0000-0000-0000-000000000022', '👏');
  raise exception 'SHOULD_FAIL: cheer as someone else';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.cheers (household_id, to_user, emoji)
  values ((select id from public.households where name = 'Engage home'), 'a3a3a3a3-0000-0000-0000-000000000023', '❤️');
  raise exception 'SHOULD_FAIL: cheer to stranger';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.cheers (household_id, to_user, emoji)
  values ((select id from public.households where name = 'Engage home'), 'e1e1e1e1-0000-0000-0000-000000000021', '💩');
  raise exception 'SHOULD_FAIL: bad emoji';
exception when check_violation then null;
end $$;

select set_config('request.jwt.claim.sub', :e, false);
do $$ begin
  assert (select count(*) from public.cheers) = 1, 'recipient sees cheer';
end $$;

-- Stranger: nothing.
select set_config('request.jwt.claim.sub', :g, false);
do $$ begin
  assert (select count(*) from public.cheers) = 0, 'stranger sees no cheers';
  assert (select count(*) from public.activity_days('e1e1e1e1-0000-0000-0000-000000000021', current_date - 7)) = 0, 'stranger sees no activity';
end $$;

reset role;
\o
\echo 'ALL ENGAGEMENT TESTS PASSED'
