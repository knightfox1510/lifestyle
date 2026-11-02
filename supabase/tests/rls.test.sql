-- RLS behaviour tests. Run with scripts/test-db.sh.
-- A = account owner, B = partner, C = stranger in another household.
\set ON_ERROR_STOP 1
\o /dev/null
\set a '''aaaaaaaa-0000-0000-0000-000000000001'''
\set b '''bbbbbbbb-0000-0000-0000-000000000002'''
\set c '''cccccccc-0000-0000-0000-000000000003'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:a, 'a@example.com', '{"full_name":"Asha"}'),
  (:b, 'b@example.com', '{}'),
  (:c, 'c@example.com', '{}');

do $$ begin
  assert (select display_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Asha',
    'profile created from metadata';
  assert (select display_name from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002') = 'b',
    'profile falls back to email prefix';
end $$;

set role authenticated;

-- A creates a household and an invite ----------------------------------------
select set_config('request.jwt.claim.sub', :a, false);
select public.create_household('Home') as hid \gset
select public.create_invite(:'hid') as code \gset
do $$ begin
  assert (select count(*) from public.household_modules where module_key = 'medical_records' and enabled) = 1,
    'default module enabled';
  assert (select active_household_id is not null from public.profiles where id = auth.uid()),
    'active household set';
end $$;

-- B joins with the code; C creates their own household -------------------------
select set_config('request.jwt.claim.sub', :b, false);
select public.accept_invite(:'code');
do $$ begin
  assert (select count(*) from public.household_members) = 2, 'B sees both members';
  assert (select count(*) from public.profiles) = 2, 'B sees A profile';
end $$;
-- Using the same invite again as B is harmless (no duplicate membership);
-- reuse by someone else is covered in invites.test.sql.
select public.accept_invite((select code from public.invites limit 1));
do $$ begin
  assert (select count(*) from public.household_members) = 2, 'still two members after re-join';
end $$;

select set_config('request.jwt.claim.sub', :c, false);
select public.create_household('Elsewhere') as hid_c \gset
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'C sees only self';
  assert (select count(*) from public.households) = 1, 'C sees only own household';
  assert (select count(*) from public.invites) = 0, 'C cannot see A invites';
end $$;

-- A writes medical data ---------------------------------------------------------
select set_config('request.jwt.claim.sub', :a, false);
insert into public.medical_events (household_id, category, title, start_date)
values (:'hid', 'surgery', 'Appendectomy', '2019-03-02');
insert into public.medical_documents (household_id, title, storage_path, mime_type, size_bytes)
values (:'hid', 'Discharge summary', 'aaaaaaaa-0000-0000-0000-000000000001/x.pdf', 'application/pdf', 1000);
insert into storage.objects (bucket_id, name) values ('medical-documents', 'aaaaaaaa-0000-0000-0000-000000000001/x.pdf');
insert into public.medical_profiles (blood_group) values ('O+');

-- A cannot write into the household of C
do $$ begin
  insert into public.medical_events (household_id, category, title, start_date)
  values ((select id from public.households where name = 'Elsewhere'), 'other', 'x', current_date);
  raise exception 'SHOULD_FAIL: foreign household';
exception when insufficient_privilege or not_null_violation then null;
end $$;

-- B: no share yet → nothing visible ---------------------------------------------
select set_config('request.jwt.claim.sub', :b, false);
do $$ begin
  assert (select count(*) from public.medical_events) = 0, 'B: no events without share';
  assert (select count(*) from public.medical_documents) = 0, 'B: no docs without share';
  assert (select count(*) from public.medical_profiles) = 0, 'B: no profile without share';
  assert (select count(*) from storage.objects) = 0, 'B: no files without share';
  assert (select count(*) from public.household_secrets) = 0, 'secrets never visible';
end $$;
do $$ begin
  insert into public.medical_events (owner_id, household_id, category, title, start_date)
  values ('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.households limit 1), 'illness', 'Cold', current_date);
  raise exception 'SHOULD_FAIL: B wrote A event';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.module_shares (owner_id, grantee_id, module_key, level)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'medical_records', 'write');
  raise exception 'SHOULD_FAIL: B granted itself access';
exception when insufficient_privilege then null;
end $$;

-- A grants read to B; A cannot grant to stranger C ------------------------------
select set_config('request.jwt.claim.sub', :a, false);
insert into public.module_shares (owner_id, grantee_id, module_key, level)
values (:a, :b, 'medical_records', 'read');
do $$ begin
  insert into public.module_shares (owner_id, grantee_id, module_key, level)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003', 'medical_records', 'read');
  raise exception 'SHOULD_FAIL: share with non-member';
exception when insufficient_privilege then null;
end $$;

select set_config('request.jwt.claim.sub', :b, false);
do $$
declare n int;
begin
  assert (select count(*) from public.medical_events) = 1, 'B reads events with read share';
  assert (select count(*) from public.medical_documents) = 1, 'B reads docs with read share';
  assert (select count(*) from storage.objects) = 1, 'B reads files with read share';
  update public.medical_events set title = 'hacked';
  get diagnostics n = row_count;
  assert n = 0, 'read share cannot update';
  delete from public.medical_events;
  get diagnostics n = row_count;
  assert n = 0, 'read share cannot delete';
end $$;
insert into public.share_access_log (owner_id, viewer_id, module_key) values (:a, :b, 'medical_records');

-- C still sees nothing
select set_config('request.jwt.claim.sub', :c, false);
do $$ begin
  assert (select count(*) from public.medical_events) = 0, 'C: no events';
  assert (select count(*) from storage.objects) = 0, 'C: no files';
  assert (select count(*) from public.share_access_log) = 0, 'C: no access log';
end $$;

-- Upgrade to write: B can log a cold for A, but not delete A's entries -----------
select set_config('request.jwt.claim.sub', :a, false);
update public.module_shares set level = 'write' where grantee_id = :b;
do $$ begin
  assert (select count(*) from public.share_access_log) = 1, 'A sees who viewed';
end $$;

select set_config('request.jwt.claim.sub', :b, false);
insert into public.medical_events (owner_id, household_id, category, title, start_date)
values (:a, :'hid', 'illness', 'Cold', current_date);
do $$
declare n int;
begin
  assert (select count(*) from public.medical_events) = 2, 'B sees both A events';
  update public.medical_events set severity = 'mild' where title = 'Cold';
  get diagnostics n = row_count;
  assert n = 1, 'write share can update';
  -- B may delete entries B added (e.g. imported papers), never ones A added.
  delete from public.medical_events where created_by <> auth.uid();
  get diagnostics n = row_count;
  assert n = 0, 'partner cannot delete the owner''s entries';
end $$;

-- B leaves → shares revoked, nothing visible --------------------------------------
select public.leave_household(:'hid');
do $$ begin
  assert (select count(*) from public.medical_events) = 0, 'B: access ends after leaving';
  assert (select count(*) from public.module_shares) = 0, 'B: shares revoked';
end $$;

select set_config('request.jwt.claim.sub', :a, false);
do $$ begin
  assert (select count(*) from public.household_members) = 1, 'A alone again';
  assert (select count(*) from public.medical_events) = 2, 'A keeps all events';
end $$;

reset role;
\o
\echo 'ALL RLS TESTS PASSED'
