-- Pantry/supplement additions. P = owner, Q = partner, R = stranger.
\set ON_ERROR_STOP 1
\o /dev/null
\set p '''4d4d4d4d-0000-0000-0000-000000000041'''
\set q '''5e5e5e5e-0000-0000-0000-000000000042'''
\set r '''6f6f6f6f-0000-0000-0000-000000000043'''
insert into auth.users (id, email) values (:p, 'p@example.com'), (:q, 'q@example.com'), (:r, 'r@example.com');
set role authenticated;

select set_config('request.jwt.claim.sub', :p, false);
select public.create_household('Pantry home') as hid \gset
select public.create_invite(:'hid') as code \gset
select set_config('request.jwt.claim.sub', :q, false);
select public.accept_invite(:'code');
select set_config('request.jwt.claim.sub', :r, false);
select public.create_household('R home') as hid_r \gset
insert into public.pantry_items (id, household_id, name) values ('7a7a7a7a-0000-0000-0000-000000000044', :'hid_r', 'R milk');

-- Supplement nutrients must be an object.
select set_config('request.jwt.claim.sub', :p, false);
insert into public.supplements (household_id, name, nutrients, serving_label, nutrients_source)
values (:'hid', 'Uprise D3 60K', '{"vit_d_mcg": 1500}', '1 sachet', 'catalog');
do $$ begin
  insert into public.supplements (household_id, name, nutrients) values ((select id from public.households where name = 'Pantry home'), 'bad', '[1]');
  raise exception 'SHOULD_FAIL: nutrients array';
exception when check_violation then null;
end $$;

-- Staple + running low, linked grocery item; partner can update flags.
insert into public.pantry_items (id, household_id, name, staple) values ('8b8b8b8b-0000-0000-0000-000000000045', :'hid', 'Atta', true);
insert into public.grocery_items (id, household_id, name, reason, pantry_item_id)
values ('9c9c9c9c-0000-0000-0000-000000000046', :'hid', 'Atta', 'staple', '8b8b8b8b-0000-0000-0000-000000000045');
do $$ begin
  insert into public.grocery_items (id, household_id, name, pantry_item_id)
  values ('9c9c9c9c-0000-0000-0000-000000000047', (select id from public.households where name = 'Pantry home'), 'x', '7a7a7a7a-0000-0000-0000-000000000044');
  raise exception 'SHOULD_FAIL: foreign pantry link';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.grocery_items (id, household_id, name, reason) values ('9c9c9c9c-0000-0000-0000-000000000048', (select id from public.households where name = 'Pantry home'), 'x', 'whim');
  raise exception 'SHOULD_FAIL: bad reason';
exception when check_violation then null;
end $$;

select set_config('request.jwt.claim.sub', :q, false);
update public.pantry_items set running_low = true where id = '8b8b8b8b-0000-0000-0000-000000000045';
do $$ begin
  assert (select running_low from public.pantry_items where id = '8b8b8b8b-0000-0000-0000-000000000045'), 'partner sets running low';
end $$;

select set_config('request.jwt.claim.sub', :r, false);
do $$ begin
  assert (select count(*) from public.grocery_items where name = 'Atta') = 0, 'stranger sees nothing';
end $$;

reset role;
\o
\echo 'ALL PANTRY TESTS PASSED'
