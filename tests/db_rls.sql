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

-- Mängelverfolgung
select t.run('new results default to open', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ select string_agg(distinct resolved_status, ',') from public.check_results $$, 'open');
select t.run('member cannot update defect state', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ with x as (update public.check_results set resolved_status='fixed' where status<>'ok' returning 1) select count(*)::text from x $$, '0');
select t.run('state still open after member attempt', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ select count(*)::text from public.check_results where status<>'ok' and resolved_status='open' and status<>'ok' $$, (select count(*)::text from public.check_results where status<>'ok'));
select t.run('admin can set progress', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ with x as (update public.check_results set resolved_status='progress', resolved_by='Admin', resolved_at=now() where status<>'ok' returning 1) select (count(*)>0)::text from x $$, 'true');
select t.run('admin invalid state rejected', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ update public.check_results set resolved_status='bogus' where status<>'ok' returning 1 $$, 'fail');
select t.run('stranger cannot update defect state', 'bbbbbbbb-0000-0000-0000-000000000002','authenticated',
 $$ with x as (update public.check_results set resolved_status='fixed' returning 1) select count(*)::text from x $$, '0');

select t.run('admin sets inspection interval', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ with x as (update public.vehicles set inspection_months=12 returning 1) select count(*)::text from x $$, '1');
select t.run('interval 0 rejected', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ update public.vehicles set inspection_months=0 returning 1 $$, 'fail');
select t.run('interval 61 rejected', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ update public.vehicles set inspection_months=61 returning 1 $$, 'fail');
select t.run('member cannot set interval', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ with x as (update public.vehicles set inspection_months=3 returning 1) select count(*)::text from x $$, '0');

-- Checklisten
select t.run('admin creates checklist', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ with x as (insert into public.checklists(vehicle_id,name,interval_days) select id,'Woechentlich',7 from public.vehicles limit 1 returning 1) select count(*)::text from x $$, '1');
select t.run('member can read checklists', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ select count(*)::text from public.checklists $$, '1');
select t.run('stranger cannot read checklists', 'bbbbbbbb-0000-0000-0000-000000000002','authenticated',
 $$ select count(*)::text from public.checklists $$, '0');
select t.run('member cannot create checklist', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ insert into public.checklists(vehicle_id,name,interval_days) select id,'X',7 from public.vehicles limit 1 returning 1 $$, 'fail');
select t.run('member cannot update checklist', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ with x as (update public.checklists set name='Hack' returning 1) select count(*)::text from x $$, '0');
select t.run('member cannot delete checklist', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ with x as (delete from public.checklists returning 1) select count(*)::text from x $$, '0');
select t.run('checklist interval 0 rejected', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ update public.checklists set interval_days=0 returning 1 $$, 'fail');
select t.run('checklist interval 731 rejected', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ update public.checklists set interval_days=731 returning 1 $$, 'fail');
select t.run('checklist without interval allowed', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ with x as (update public.checklists set interval_days=null returning 1) select count(*)::text from x $$, '1');
select t.run('admin assigns item to checklist', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ with x as (update public.items set checklist_id=(select id from public.checklists limit 1) where id=(select id from public.items limit 1) returning 1) select count(*)::text from x $$, '1');
select t.run('admin deletes checklist', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ with d as (delete from public.checklists returning 1) select count(*)::text from d $$, '1');
select t.run('items kept, link cleared after checklist delete', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ select (select count(*) from public.items where checklist_id is not null)::text || '/' || (select count(*) from public.items)::text $$, '0/' || (select count(*) from public.items)::text);

-- Nutzung
select t.run('member checks in', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ with x as (insert into public.usages(vehicle_id,member_name,purpose) values ('11111111-1111-1111-1111-111111111111','Anna','einsatz') returning 1) select count(*)::text from x $$, '1');
select t.run('second open usage same vehicle rejected', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ insert into public.usages(vehicle_id,member_name,purpose) values ('11111111-1111-1111-1111-111111111111','Admin','uebung') returning 1 $$, 'fail');
select t.run('bad purpose rejected', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ insert into public.usages(vehicle_id,member_name,purpose) values ('11111111-1111-1111-1111-111111111111','Anna','urlaub') returning 1 $$, 'fail');
select t.run('stranger cannot read usages', 'bbbbbbbb-0000-0000-0000-000000000002','authenticated',
 $$ select count(*)::text from public.usages $$, '0');
select t.run('stranger cannot check in', 'bbbbbbbb-0000-0000-0000-000000000002','authenticated',
 $$ insert into public.usages(vehicle_id,member_name,purpose) values ('11111111-1111-1111-1111-111111111111','X','fahrt') returning 1 $$, 'fail');
select t.run('member sees usage', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ select count(*)::text from public.usages $$, '1');
select t.run('member cannot fake other user', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ insert into public.usages(vehicle_id,member_name,purpose,user_id) values ('11111111-1111-1111-1111-111111111111','Z','fahrt','cccccccc-0000-0000-0000-000000000003') returning 1 $$, 'fail');
select t.run('other member cannot end foreign usage', 'cccccccc-0000-0000-0000-000000000003','authenticated',
 $$ with x as (update public.usages set ended_at=now() returning 1) select count(*)::text from x $$, '0');
select t.run('member ends own usage', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ with x as (update public.usages set ended_at=now(), ended_by='Anna' returning 1) select count(*)::text from x $$, '1');
select t.run('admin checks in after end', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ with x as (insert into public.usages(vehicle_id,member_name,purpose) values ('11111111-1111-1111-1111-111111111111','Admin','wartung') returning 1) select count(*)::text from x $$, '1');
select t.run('admin ends usage', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ with x as (update public.usages set ended_at=now() where ended_at is null returning 1) select count(*)::text from x $$, '1');
select t.run('member cannot delete usage', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ with x as (delete from public.usages returning 1) select count(*)::text from x $$, '0');

-- Kilometer, Tankstand, Barcode
select t.run('member checks in with km and fuel', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ with x as (insert into public.usages(vehicle_id,member_name,purpose,km_start,fuel_start) values ('11111111-1111-1111-1111-111111111111','Anna','fahrt',1000,'3/4') returning 1) select count(*)::text from x $$, '1');
select t.run('km end below km start rejected', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ update public.usages set ended_at=now(), km_end=900 where ended_at is null returning 1 $$, 'fail');
select t.run('bad fuel value rejected', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ update public.usages set fuel_end='halb' where ended_at is null returning 1 $$, 'fail');
select t.run('negative km rejected', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ update public.usages set km_end=-5 where ended_at is null returning 1 $$, 'fail');
select t.run('member ends with km and fuel', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ with x as (update public.usages set ended_at=now(), km_end=1042, fuel_end='1/2' where ended_at is null returning 1) select count(*)::text from x $$, '1');
select t.run('km saved', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ select km_start::text||'-'||km_end::text||' '||fuel_start||' '||fuel_end from public.usages where km_end is not null $$, '1000-1042 3/4 1/2');
select t.run('admin sets item barcode', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ with x as (update public.items set barcode='4006381333931' returning 1) select count(*)::text from x $$, '1');
select t.run('empty barcode rejected', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ update public.items set barcode='' returning 1 $$, 'fail');
select t.run('member reads barcode', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ select barcode from public.items limit 1 $$, '4006381333931');
select t.run('member cannot set barcode', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ with x as (update public.items set barcode='x' returning 1) select count(*)::text from x $$, '0');

-- Buchungen
select t.run('member requests booking', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ with x as (insert into public.bookings(vehicle_id,member_name,purpose,starts_at,ends_at) values ('11111111-1111-1111-1111-111111111111','Anna','uebung','2030-01-10 10:00+00','2030-01-10 12:00+00') returning 1) select count(*)::text from x $$, '1');
select t.run('member cannot self confirm on insert', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ insert into public.bookings(vehicle_id,member_name,purpose,starts_at,ends_at,status) values ('11111111-1111-1111-1111-111111111111','Anna','uebung','2030-02-10 10:00+00','2030-02-10 12:00+00','confirmed') returning 1 $$, 'fail');
select t.run('end before start rejected', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ insert into public.bookings(vehicle_id,member_name,purpose,starts_at,ends_at) values ('11111111-1111-1111-1111-111111111111','Anna','uebung','2030-03-10 12:00+00','2030-03-10 10:00+00') returning 1 $$, 'fail');
select t.run('member cannot confirm', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ with x as (update public.bookings set status='confirmed' returning 1) select count(*)::text from x $$, 'fail');
select t.run('admin confirms', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ with x as (update public.bookings set status='confirmed', decided_by='Admin' returning 1) select count(*)::text from x $$, '1');
select t.run('request in confirmed time rejected', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ insert into public.bookings(vehicle_id,member_name,purpose,starts_at,ends_at) values ('11111111-1111-1111-1111-111111111111','Anna','fahrt','2030-01-10 11:00+00','2030-01-10 13:00+00') returning 1 $$, 'fail');
select t.run('request right after confirmed ok', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ with x as (insert into public.bookings(vehicle_id,member_name,purpose,starts_at,ends_at) values ('11111111-1111-1111-1111-111111111111','Anna','fahrt','2030-01-10 12:00+00','2030-01-10 14:00+00') returning 1) select count(*)::text from x $$, '1');
select t.run('admin books directly confirmed', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ with x as (insert into public.bookings(vehicle_id,member_name,purpose,starts_at,ends_at,status) values ('11111111-1111-1111-1111-111111111111','Admin','wartung','2030-01-10 13:00+00','2030-01-10 15:00+00','confirmed') returning 1) select count(*)::text from x $$, '1');
select t.run('confirming overlapping request rejected', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated',
 $$ update public.bookings set status='confirmed' where purpose='fahrt' returning 1 $$, 'fail');
select t.run('stranger cannot read bookings', 'bbbbbbbb-0000-0000-0000-000000000002','authenticated',
 $$ select count(*)::text from public.bookings $$, '0');
select t.run('member cancels own', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ with x as (update public.bookings set status='cancelled' where purpose='fahrt' returning 1) select count(*)::text from x $$, '1');
select t.run('member cannot delete booking', 'dddddddd-0000-0000-0000-000000000004','authenticated',
 $$ with x as (delete from public.bookings returning 1) select count(*)::text from x $$, '0');

-- Admin Verwaltung
select t.run('admin sees members', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated', $$ select count(*)::text from public.members $$, '2');
select t.run('admin remove member', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated', $$ select public.remove_member('dddddddd-0000-0000-0000-000000000004')::text $$, '');
select t.run('admin delete check cascades results', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated', $$ with x as (delete from public.checks returning 1) select count(*)::text from x $$, '1');
select t.run('results gone after check delete', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated', $$ select count(*)::text from public.check_results $$, '0');
select t.run('admin delete vehicle cascades', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated', $$ with x as (delete from public.vehicles returning 1) select count(*)::text from x $$, '1');
select t.run('areas+items gone', 'aaaaaaaa-0000-0000-0000-000000000001','authenticated', $$ select (select count(*) from public.areas)::text || '/' || (select count(*) from public.items)::text $$, '0/0');

select case when pass then 'PASS' else 'FAIL' end as result, label, got, expect from t.log order by 1 desc, 2;
