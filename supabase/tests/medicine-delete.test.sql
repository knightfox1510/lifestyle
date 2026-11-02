-- Deleting medicines: owner always; a partner with write access only ones they added. G = owner, H = partner.
\set ON_ERROR_STOP 1
\o /dev/null
\set g '''abababab-0000-0000-0000-000000000061'''
\set h '''cdcdcdcd-0000-0000-0000-000000000062'''
insert into auth.users (id, email) values (:g, 'g61@example.com'), (:h, 'h62@example.com');
set role authenticated;

select set_config('request.jwt.claim.sub', :g, false);
select public.create_household('Med delete home') as hid \gset
select public.create_invite(:'hid') as code \gset
select set_config('request.jwt.claim.sub', :h, false);
select public.accept_invite(:'code');

select set_config('request.jwt.claim.sub', :g, false);
insert into public.module_shares (owner_id, grantee_id, module_key, level) values (:g, :h, 'medicines', 'write');
insert into public.medicines (id, household_id, name, times, dose_amount)
values ('a1a1a1a1-0000-0000-0000-000000000063', :'hid', 'Owner added', array['08:00'], 1);

-- The partner adds one for G by mistake, then deletes it.
select set_config('request.jwt.claim.sub', :h, false);
insert into public.medicines (id, owner_id, household_id, name, times, dose_amount)
values ('a1a1a1a1-0000-0000-0000-000000000064', :g, :'hid', 'Partner added', array['09:00'], 1);
delete from public.medicines where id = 'a1a1a1a1-0000-0000-0000-000000000064';
-- …but can't delete one G added.
delete from public.medicines where id = 'a1a1a1a1-0000-0000-0000-000000000063';
do $$ begin
  assert not exists (select 1 from public.medicines where id = 'a1a1a1a1-0000-0000-0000-000000000064'), 'creator can delete';
  assert exists (select 1 from public.medicines where id = 'a1a1a1a1-0000-0000-0000-000000000063'), 'partner cannot delete owner''s medicine';
end $$;

-- Without write access the creator can't delete any more.
select set_config('request.jwt.claim.sub', :h, false);
insert into public.medicines (id, owner_id, household_id, name, times, dose_amount)
values ('a1a1a1a1-0000-0000-0000-000000000065', :g, :'hid', 'Partner added 2', array['10:00'], 1);
select set_config('request.jwt.claim.sub', :g, false);
update public.module_shares set level = 'read' where owner_id = :g and grantee_id = :h;
select set_config('request.jwt.claim.sub', :h, false);
delete from public.medicines where id = 'a1a1a1a1-0000-0000-0000-000000000065';
select set_config('request.jwt.claim.sub', :g, false);
do $$ begin
  assert exists (select 1 from public.medicines where id = 'a1a1a1a1-0000-0000-0000-000000000065'), 'read-only creator cannot delete';
end $$;
-- The owner can delete anything of theirs.
delete from public.medicines where id = 'a1a1a1a1-0000-0000-0000-000000000065';
do $$ begin
  assert not exists (select 1 from public.medicines where id = 'a1a1a1a1-0000-0000-0000-000000000065'), 'owner can delete';
end $$;

reset role;
\o
\echo 'ALL MEDICINE DELETE TESTS PASSED'
