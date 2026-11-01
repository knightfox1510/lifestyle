-- Invite tests. I = owner, J = partner, K = someone else.
\set ON_ERROR_STOP 1
\o /dev/null
\set i '''1a1a1a1a-0000-0000-0000-000000000031'''
\set j '''2b2b2b2b-0000-0000-0000-000000000032'''
\set k '''3c3c3c3c-0000-0000-0000-000000000033'''

insert into auth.users (id, email) values (:i, 'i@example.com'), (:j, 'j@example.com'), (:k, 'k@example.com');
set role authenticated;

select set_config('request.jwt.claim.sub', :i, false);
select public.create_household('Invite home') as hid \gset
select public.create_invite(:'hid') as code \gset

-- J joins, then uses the same invite again (e.g. after a failed page load): fine.
select set_config('request.jwt.claim.sub', :j, false);
select public.accept_invite(:'code');
update public.profiles set active_household_id = null where id = auth.uid();
select public.accept_invite(lower(:'code'));
do $$ begin
  assert (select count(*) from public.household_members where user_id = auth.uid()) = 1, 'one membership only';
  assert (select active_household_id from public.profiles where id = auth.uid()) = (select id from public.households where name = 'Invite home'), 'household active again';
end $$;

-- K can't reuse J's invite.
select set_config('request.jwt.claim.sub', :k, false);
do $$ begin
  perform public.accept_invite((select code from public.invites limit 1));
  raise exception 'SHOULD_FAIL: reused by someone else';
exception when others then
  if sqlerrm not like '%already used%' and sqlerrm not like '%not found%' then raise; end if;
end $$;

reset role;
\o
\echo 'ALL INVITE TESTS PASSED'
