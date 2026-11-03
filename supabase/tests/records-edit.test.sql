-- Imported records: a partner with write access can edit them and delete the
-- ones they added; medicine nutrients must be an object. J = owner, K = partner.
\set ON_ERROR_STOP 1
\o /dev/null
\set j '''12121212-0000-0000-0000-000000000071'''
\set k '''34343434-0000-0000-0000-000000000072'''
insert into auth.users (id, email) values (:j, 'j71@example.com'), (:k, 'k72@example.com');
set role authenticated;

select set_config('request.jwt.claim.sub', :j, false);
select public.create_household('Records home') as hid \gset
select public.create_invite(:'hid') as code \gset
select set_config('request.jwt.claim.sub', :k, false);
select public.accept_invite(:'code');
select set_config('request.jwt.claim.sub', :j, false);
insert into public.module_shares (owner_id, grantee_id, module_key, level) values (:j, :k, 'medical_records', 'write');
insert into public.medical_events (id, owner_id, created_by, household_id, category, title, start_date)
values ('e7e7e7e7-0000-0000-0000-000000000073', :j, :j, :'hid', 'condition', 'Owner entry', '2026-10-01');

-- K imports papers for J: edits and deletes them.
select set_config('request.jwt.claim.sub', :k, false);
insert into public.medical_events (id, owner_id, created_by, household_id, category, title, start_date, source)
values ('e7e7e7e7-0000-0000-0000-000000000074', :j, :k, :'hid', 'medication', 'Tab Mirago 25', '2026-08-27', 'ai_extracted');
insert into public.lab_results (id, owner_id, created_by, household_id, test_date, marker, value)
values ('e7e7e7e7-0000-0000-0000-000000000075', :j, :k, :'hid', '2026-10-14', 'Hb', 12.1);
update public.medical_events set title = 'Tab Mirago 25 mg' where id = 'e7e7e7e7-0000-0000-0000-000000000074';
update public.lab_results set value = 12.4 where id = 'e7e7e7e7-0000-0000-0000-000000000075';
delete from public.lab_results where id = 'e7e7e7e7-0000-0000-0000-000000000075';
delete from public.medical_events where id = 'e7e7e7e7-0000-0000-0000-000000000074';
delete from public.medical_events where id = 'e7e7e7e7-0000-0000-0000-000000000073';
select set_config('request.jwt.claim.sub', :j, false);
do $$ begin
  assert not exists (select 1 from public.medical_events where id = 'e7e7e7e7-0000-0000-0000-000000000074'), 'creator can delete an imported entry';
  assert not exists (select 1 from public.lab_results where id = 'e7e7e7e7-0000-0000-0000-000000000075'), 'creator can delete an imported lab';
  assert exists (select 1 from public.medical_events where id = 'e7e7e7e7-0000-0000-0000-000000000073'), 'partner cannot delete the owner''s entry';
end $$;

-- Food: K logs a shared meal for J, then edits (moves) and deletes it; can't delete J's own.
select set_config('request.jwt.claim.sub', :j, false);
insert into public.module_shares (owner_id, grantee_id, module_key, level) values (:j, :k, 'food_diary', 'write');
insert into public.food_entries (id, owner_id, household_id, meal, description) values ('e7e7e7e7-0000-0000-0000-000000000076', :j, :'hid', 'lunch', 'Dal');
select set_config('request.jwt.claim.sub', :k, false);
insert into public.food_entries (id, owner_id, created_by, household_id, meal, description) values ('e7e7e7e7-0000-0000-0000-000000000077', :j, :k, :'hid', 'lunch', 'Roti');
update public.food_entries set meal = 'dinner', description = 'Phulka' where id = 'e7e7e7e7-0000-0000-0000-000000000077';
delete from public.food_entries where id in ('e7e7e7e7-0000-0000-0000-000000000076', 'e7e7e7e7-0000-0000-0000-000000000077');
select set_config('request.jwt.claim.sub', :j, false);
do $$ begin
  assert not exists (select 1 from public.food_entries where id = 'e7e7e7e7-0000-0000-0000-000000000077'), 'whoever logged it can delete';
  assert exists (select 1 from public.food_entries where id = 'e7e7e7e7-0000-0000-0000-000000000076'), 'partner cannot delete the owner''s own log';
end $$;

-- Bladder diary: K logs a leak for J, moves its time, deletes it; can't delete J's own.
select set_config('request.jwt.claim.sub', :j, false);
insert into public.module_shares (owner_id, grantee_id, module_key, level) values (:j, :k, 'bladder_diary', 'write');
insert into public.bladder_events (id, household_id, kind) values ('e7e7e7e7-0000-0000-0000-000000000078', :'hid', 'leak');
select set_config('request.jwt.claim.sub', :k, false);
insert into public.bladder_events (id, owner_id, created_by, household_id, kind, amount) values ('e7e7e7e7-0000-0000-0000-000000000079', :j, :k, :'hid', 'leak', 'small');
update public.bladder_events set occurred_at = now() - interval '45 minutes' where id = 'e7e7e7e7-0000-0000-0000-000000000079';
update public.bladder_events set occurred_at = now() - interval '2 hours' where id = 'e7e7e7e7-0000-0000-0000-000000000078';
delete from public.bladder_events where id in ('e7e7e7e7-0000-0000-0000-000000000078', 'e7e7e7e7-0000-0000-0000-000000000079');
select set_config('request.jwt.claim.sub', :j, false);
do $$ begin
  assert not exists (select 1 from public.bladder_events where id = 'e7e7e7e7-0000-0000-0000-000000000079'), 'whoever logged it can delete';
  assert (select occurred_at < now() - interval '1 hour' from public.bladder_events where id = 'e7e7e7e7-0000-0000-0000-000000000078'), 'write share can change the time';
end $$;

-- Medicine composition and nutrients.
insert into public.medicines (household_id, name, times, dose_amount, ingredients, nutrients)
values (:'hid', 'Shelcal 500', array['09:00'], 1, 'Calcium carbonate 1250 mg + Vitamin D3 250 IU', '{"calcium_mg": 500, "vit_d_mcg": 6.25}');
do $$ begin
  insert into public.medicines (household_id, name, times, dose_amount, nutrients)
  values ((select id from public.households where name = 'Records home'), 'bad', array['09:00'], 1, '[1]');
  raise exception 'SHOULD_FAIL: nutrients array';
exception when check_violation then null;
end $$;

-- How often: every N days and weekdays are checked.
insert into public.supplements (household_id, name, repeat_every_days, schedule_start) values (:'hid', 'D3 60K', 7, '2026-11-02');
insert into public.supplements (household_id, name, days_of_week) values (:'hid', 'Iron', array[1, 3, 5]::smallint[]);
do $$ begin
  insert into public.supplements (household_id, name, days_of_week) values ((select id from public.households where name = 'Records home'), 'Bad', array[9]::smallint[]);
  raise exception 'SHOULD_FAIL: weekday 9';
exception when check_violation then null;
end $$;
do $$ begin
  insert into public.medicines (household_id, name, times, dose_amount, repeat_every_days) values ((select id from public.households where name = 'Records home'), 'Bad', array['09:00'], 1, 1);
  raise exception 'SHOULD_FAIL: every 1 day';
exception when check_violation then null;
end $$;
update public.profiles set supplement_times = '{"morning": "07:15"}' where id = :j;

reset role;
-- Water intake has its own share: K sees and logs J's water (not alcohol, not the bladder diary) with a "water" share.
reset role;
delete from public.module_shares where owner_id = '12121212-0000-0000-0000-000000000071' and module_key = 'bladder_diary';
insert into public.fluid_intake (owner_id, created_by, household_id, drink, volume_ml, caffeinated) values
  ('12121212-0000-0000-0000-000000000071', '12121212-0000-0000-0000-000000000071', :'hid', 'water', 500, false),
  ('12121212-0000-0000-0000-000000000071', '12121212-0000-0000-0000-000000000071', :'hid', 'alcohol', 330, false);
insert into public.bladder_events (owner_id, created_by, household_id, kind) values ('12121212-0000-0000-0000-000000000071', '12121212-0000-0000-0000-000000000071', :'hid', 'leak');
set role authenticated;
select set_config('test.hid', :'hid', false);
select set_config('request.jwt.claim.sub', :k, false);
do $$ begin
  assert (select count(*) from public.fluid_intake where owner_id = '12121212-0000-0000-0000-000000000071') = 0, 'no water share: no water';
  insert into public.fluid_intake (owner_id, created_by, household_id, drink, volume_ml, caffeinated) values ('12121212-0000-0000-0000-000000000071', '34343434-0000-0000-0000-000000000072', current_setting('test.hid')::uuid, 'water', 250, false);
  raise exception 'SHOULD_FAIL: logging water without a share';
exception when insufficient_privilege then null;
end $$;
select set_config('request.jwt.claim.sub', :j, false);
insert into public.module_shares (owner_id, grantee_id, module_key, level) values (:j, :k, 'water', 'write');
select set_config('request.jwt.claim.sub', :k, false);
insert into public.fluid_intake (id, owner_id, created_by, household_id, drink, volume_ml, caffeinated) values ('e7e7e7e7-0000-0000-0000-000000000079', :j, :k, :'hid', 'water', 250, false);
do $$ begin
  assert (select coalesce(sum(volume_ml), 0) from public.fluid_intake where owner_id = '12121212-0000-0000-0000-000000000071') = 750, 'water share: sees water (500 + 250), not alcohol';
  assert (select count(*) from public.bladder_events) = 0, 'water share does not open the bladder diary';
  insert into public.fluid_intake (owner_id, created_by, household_id, drink, volume_ml, caffeinated) values ('12121212-0000-0000-0000-000000000071', '34343434-0000-0000-0000-000000000072', current_setting('test.hid')::uuid, 'alcohol', 330, false);
  raise exception 'SHOULD_FAIL: logging alcohol with only a water share';
exception when insufficient_privilege then null;
end $$;
delete from public.fluid_intake where id = 'e7e7e7e7-0000-0000-0000-000000000079';
do $$ begin
  assert (select coalesce(sum(volume_ml), 0) from public.fluid_intake where owner_id = '12121212-0000-0000-0000-000000000071') = 500, 'whoever logged water can delete it';
end $$;
reset role;
\o
\echo 'ALL RECORDS EDIT TESTS PASSED'
