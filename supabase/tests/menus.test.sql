-- Restaurant menu tests. P = owner, Q = partner, R = stranger.
\set ON_ERROR_STOP 1
\o /dev/null
\set p '''12121212-0000-0000-0000-000000000010'''
\set q '''34343434-0000-0000-0000-000000000011'''
\set r '''56565656-0000-0000-0000-000000000012'''

insert into auth.users (id, email) values (:p, 'p@example.com'), (:q, 'q@example.com'), (:r, 'r@example.com');
set role authenticated;

select set_config('request.jwt.claim.sub', :p, false);
select public.create_household('Menu home') as hid \gset
select public.create_invite(:'hid') as code \gset
select set_config('request.jwt.claim.sub', :q, false);
select public.accept_invite(:'code');
select set_config('request.jwt.claim.sub', :r, false);
select public.create_household('R home') as hid_r \gset
insert into public.dining_places (id, household_id, name) values ('aaaaaaaa-5555-0000-0000-000000000001', :'hid_r', 'Other place');
insert into public.dining_dishes (id, place_id, household_id, name) values ('aaaaaaaa-5555-0000-0000-000000000002', 'aaaaaaaa-5555-0000-0000-000000000001', :'hid_r', 'Secret dish');

select set_config('request.jwt.claim.sub', :p, false);
insert into public.dining_places (id, household_id, name) values ('bbbbbbbb-5555-0000-0000-000000000003', :'hid', 'Good Flippin');
insert into public.dining_dishes (id, place_id, household_id, name, section, calories, carbs_g, fat_g, source)
values ('bbbbbbbb-5555-0000-0000-000000000004', 'bbbbbbbb-5555-0000-0000-000000000003', :'hid', 'Smash Burger', 'Burgers', 780, 45, 42, 'menu_import');

-- Same name (any case) at the same place is rejected → imports must upsert.
do $$ begin
  insert into public.dining_dishes (place_id, household_id, name)
  values ('bbbbbbbb-5555-0000-0000-000000000003', (select id from public.households where name = 'Menu home'), 'smash burger');
  raise exception 'SHOULD_FAIL: duplicate dish name';
exception when unique_violation then null;
end $$;

-- Log the dish to the food diary.
insert into public.food_entries (household_id, meal, description, calories, source, dish_id)
values (:'hid', 'dinner', 'Smash Burger', 780, 'restaurant', 'bbbbbbbb-5555-0000-0000-000000000004');

-- Can't log another household's dish.
do $$ begin
  insert into public.food_entries (household_id, meal, description, source, dish_id)
  values ((select id from public.households where name = 'Menu home'), 'dinner', 'x', 'restaurant', 'aaaaaaaa-5555-0000-0000-000000000002');
  raise exception 'SHOULD_FAIL: foreign dish';
exception when insufficient_privilege then null;
end $$;

select set_config('request.jwt.claim.sub', :q, false);
do $$ begin
  assert (select count(*) from public.dining_dishes) = 1, 'partner sees household menu';
  assert (select section from public.dining_dishes) = 'Burgers', 'menu fields readable';
  assert (select count(*) from public.food_entries) = 0, 'food diary still private';
end $$;

select set_config('request.jwt.claim.sub', :r, false);
do $$ begin
  assert (select count(*) from public.dining_dishes) = 1, 'stranger sees only own dishes';
end $$;

-- Deleting a dish keeps the diary entry (dish_id is cleared).
select set_config('request.jwt.claim.sub', :p, false);
delete from public.dining_dishes where id = 'bbbbbbbb-5555-0000-0000-000000000004';
do $$ begin
  assert (select count(*) from public.food_entries where dish_id is null and source = 'restaurant') = 1, 'entry kept after dish deleted';
end $$;

reset role;
\o
\echo 'ALL MENU TESTS PASSED'
