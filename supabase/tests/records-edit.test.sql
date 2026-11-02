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

-- Medicine composition and nutrients.
insert into public.medicines (household_id, name, times, dose_amount, ingredients, nutrients)
values (:'hid', 'Shelcal 500', array['09:00'], 1, 'Calcium carbonate 1250 mg + Vitamin D3 250 IU', '{"calcium_mg": 500, "vit_d_mcg": 6.25}');
do $$ begin
  insert into public.medicines (household_id, name, times, dose_amount, nutrients)
  values ((select id from public.households where name = 'Records home'), 'bad', array['09:00'], 1, '[1]');
  raise exception 'SHOULD_FAIL: nutrients array';
exception when check_violation then null;
end $$;

reset role;
\o
\echo 'ALL RECORDS EDIT TESTS PASSED'
