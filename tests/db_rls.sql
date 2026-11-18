drop schema if exists t cascade; create schema t;
create table t.log (label text, got text, expect text, pass boolean);
create function t.run(label text, uid uuid, rolename text, stmt text, expect text) returns void language plpgsql as $$
declare n text; got text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text,''), true);
  execute format('set local role %I', rolename);
  begin
    execute stmt into n;
    got := n;
  exception when others then
    got := 'fail:' || left(sqlerrm, 60);
  end;
  reset role;
  insert into t.log values (label, got, expect, case when expect = 'fail' then got like 'fail%' else got = expect end);
end $$;
grant usage on schema t to public;

insert into auth.users (id, email, is_anonymous) values
 ('aaaaaaaa-0000-0000-0000-000000000001','admin@x.de',false),
 ('bbbbbbbb-0000-0000-0000-000000000002',null,true),
 ('cccccccc-0000-0000-0000-000000000003',null,true),
 ('dddddddd-0000-0000-0000-000000000004',null,true);
insert into public.admins values ('aaaaaaaa-0000-0000-0000-000000000001');
update public.settings set team_code='Geheim-123' where id=1;

-- Admin legt Daten an
select t.run('admin insert vehicle', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ with x as (insert into public.vehicles(id,name) values ('11111111-1111-1111-1111-111111111111','MTW 1') returning 1) select count(*)::text from x $$, '1');
select t.run('admin insert area', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ with x as (insert into public.areas(id,vehicle_id,name,x,y) values ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','Heck',0.5,0.5) returning 1) select count(*)::text from x $$, '1');
select t.run('admin insert item', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ with x as (insert into public.items(id,area_id,name,x,y) values ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','Verbandkasten',0.2,0.3) returning 1) select count(*)::text from x $$, '1');
select t.run('admin pin out of range rejected', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ insert into public.items(area_id,name,x,y) values ('22222222-2222-2222-2222-222222222222','Bad',1.5,0.3) returning 1 $$, 'fail');
select t.run('admin get_settings', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated', $$ select (public.get_settings()->>'team_code') $$, 'Geheim-123');
select t.run('admin short code rejected', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated', $$ select public.update_settings(null,'abc')::text $$, 'fail');
select t.run('admin whoami', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated', $$ select public.whoami()->>'role' $$, 'admin');

-- Fremder (anonymes Konto ohne Beitritt)
select t.run('stranger whoami null', 'bbbbbbbb-0000-0000-0000-000000000002','authenticated', $$ select coalesce(public.whoami()->>'role','null') $$, 'null');
select t.run('stranger sees no vehicles', 'bbbbbbbb-0000-0000-0000-000000000002','authenticated', $$ select count(*)::text from public.vehicles $$, '0');
select t.run('stranger sees no items', 'bbbbbbbb-0000-0000-0000-000000000002','authenticated', $$ select count(*)::text from public.items $$, '0');
select t.run('stranger insert vehicle denied', 'bbbbbbbb-0000-0000-0000-000000000002','authenticated', $$ insert into public.vehicles(name) values ('X') returning 1 $$, 'fail');
select t.run('stranger settings table hidden', 'bbbbbbbb-0000-0000-0000-000000000002','authenticated', $$ select count(*)::text from public.settings $$, '0');
select t.run('stranger join wrong code', 'bbbbbbbb-0000-0000-0000-000000000002','authenticated', $$ select public.join_team('falsch','Max')::text $$, 'fail');
select t.run('stranger get_settings denied', 'bbbbbbbb-0000-0000-0000-000000000002','authenticated', $$ select public.get_settings()::text $$, 'fail');
select t.run('stranger cannot make himself admin', 'bbbbbbbb-0000-0000-0000-000000000002','authenticated', $$ insert into public.admins values ('bbbbbbbb-0000-0000-0000-000000000002') returning 1 $$, 'fail');
select t.run('stranger cannot make himself member', 'bbbbbbbb-0000-0000-0000-000000000002','authenticated', $$ insert into public.members(user_id,name) values ('bbbbbbbb-0000-0000-0000-000000000002','Hack') returning 1 $$, 'fail');
select t.run('anon check_code right', null,'anon', $$ select public.check_code('Geheim-123')::text $$, 'true');
select t.run('anon check_code wrong', null,'anon', $$ select public.check_code('nope')::text $$, 'false');
select t.run('anon cannot join', null,'anon', $$ select public.join_team('Geheim-123','Max')::text $$, 'fail');
select t.run('anon sees no vehicles', null,'anon', $$ select count(*)::text from public.vehicles $$, '0');

-- Prüfer tritt bei
select t.run('member join ok', 'cccccccc-0000-0000-0000-000000000003','authenticated', $$ select public.join_team('Geheim-123','Anna')->>'role' $$, 'member');
select t.run('member sees vehicles', 'cccccccc-0000-0000-0000-000000000003','authenticated', $$ select count(*)::text from public.vehicles $$, '1');
select t.run('member sees items', 'cccccccc-0000-0000-0000-000000000003','authenticated', $$ select count(*)::text from public.items $$, '1');
select t.run('member update vehicle denied (0 rows)', 'cccccccc-0000-0000-0000-000000000003','authenticated', $$ with x as (update public.vehicles set name='Hack' returning 1) select count(*)::text from x $$, '0');
select t.run('member delete item denied (0 rows)', 'cccccccc-0000-0000-0000-000000000003','authenticated', $$ with x as (delete from public.items returning 1) select count(*)::text from x $$, '0');
select t.run('member insert item denied', 'cccccccc-0000-0000-0000-000000000003','authenticated', $$ insert into public.items(area_id,name) values ('22222222-2222-2222-2222-222222222222','Hack') returning 1 $$, 'fail');
select t.run('member get_settings denied', 'cccccccc-0000-0000-0000-000000000003','authenticated', $$ select public.get_settings()::text $$, 'fail');
select t.run('member update_settings denied', 'cccccccc-0000-0000-0000-000000000003','authenticated', $$ select public.update_settings('x','abcdefgh')::text $$, 'fail');
select t.run('member remove_member denied', 'cccccccc-0000-0000-0000-000000000003','authenticated', $$ select public.remove_member('cccccccc-0000-0000-0000-000000000003')::text $$, 'fail');
select t.run('member insert check (name spoof overridden)', 'cccccccc-0000-0000-0000-000000000003','authenticated',
 $$ with x as (insert into public.checks(id,vehicle_id,member_name,user_id) values ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111','Spoof','aaaaaaaa-0000-0000-0000-000000000001') returning member_name) select member_name from x $$, 'Anna');
select t.run('member check user_id forced to self', 'cccccccc-0000-0000-0000-000000000003','authenticated', $$ select user_id::text from public.checks where id='44444444-4444-4444-4444-444444444444' $$, 'cccccccc-0000-0000-0000-000000000003');
select t.run('member insert result on own check', 'cccccccc-0000-0000-0000-000000000003','authenticated',
 $$ with x as (insert into public.check_results(check_id,item_id,item_name,status) values ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333','Verbandkasten','missing') returning 1) select count(*)::text from x $$, '1');
select t.run('member invalid status rejected', 'cccccccc-0000-0000-0000-000000000003','authenticated',
 $$ insert into public.check_results(check_id,item_name,status) values ('44444444-4444-4444-4444-444444444444','x','kaputt') returning 1 $$, 'fail');
select t.run('member delete check denied (0 rows)', 'cccccccc-0000-0000-0000-000000000003','authenticated', $$ with x as (delete from public.checks returning 1) select count(*)::text from x $$, '0');
select t.run('member sees own member row', 'cccccccc-0000-0000-0000-000000000003','authenticated', $$ select count(*)::text from public.members $$, '1');

-- zweiter Prüfer darf nicht in fremde Checks schreiben
select t.run('member2 join', 'dddddddd-0000-0000-0000-000000000004','authenticated', $$ select public.join_team('Geheim-123','Ben')->>'role' $$, 'member');
select t.run('member2 result into foreign check denied', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ insert into public.check_results(check_id,item_name,status) values ('44444444-4444-4444-4444-444444444444','x','ok') returning 1 $$, 'fail');
select t.run('member2 sees shared history', 'dddddddd-0000-0000-0000-000000000004','authenticated', $$ select count(*)::text from public.checks $$, '1');

-- Storage
select t.run('storage member own checks path ok', 'cccccccc-0000-0000-0000-000000000003','authenticated',
 $$ with x as (insert into storage.objects(bucket_id,name) values ('photos','checks/cccccccc-0000-0000-0000-000000000003/a.jpg') returning 1) select count(*)::text from x $$, '1');
select t.run('storage member foreign checks path denied', 'cccccccc-0000-0000-0000-000000000003','authenticated',
 $$ insert into storage.objects(bucket_id,name) values ('photos','checks/dddddddd-0000-0000-0000-000000000004/a.jpg') returning 1 $$, 'fail');
select t.run('storage member vehicles path denied', 'cccccccc-0000-0000-0000-000000000003','authenticated',
 $$ insert into storage.objects(bucket_id,name) values ('photos','vehicles/x/a.jpg') returning 1 $$, 'fail');
select t.run('storage admin vehicles path ok', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ with x as (insert into storage.objects(bucket_id,name) values ('photos','vehicles/11111111/a.jpg') returning 1) select count(*)::text from x $$, '1');
select t.run('storage member can read', 'dddddddd-0000-0000-0000-000000000004','authenticated', $$ select count(*)::text from storage.objects $$, '2');
select t.run('storage stranger cannot read', 'bbbbbbbb-0000-0000-0000-000000000002','authenticated', $$ select count(*)::text from storage.objects $$, '0');
select t.run('storage anon cannot read', null,'anon', $$ select count(*)::text from storage.objects $$, '0');

-- Admin Verwaltung
select t.run('admin sees members', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated', $$ select count(*)::text from public.members $$, '2');
select t.run('admin remove member', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated', $$ select public.remove_member('dddddddd-0000-0000-0000-000000000004')::text $$, '');
select t.run('admin delete check cascades results', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated', $$ with x as (delete from public.checks returning 1) select count(*)::text from x $$, '1');
select t.run('results gone after check delete', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated', $$ select count(*)::text from public.check_results $$, '0');
select t.run('admin delete vehicle cascades', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated', $$ with x as (delete from public.vehicles returning 1) select count(*)::text from x $$, '1');
select t.run('areas+items gone', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated', $$ select (select count(*) from public.areas)::text || '/' || (select count(*) from public.items)::text $$, '0/0');

select case when pass then 'PASS' else 'FAIL' end as result, label, got, expect from t.log order by 1 desc, 2;
