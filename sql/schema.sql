-- Einsatzfahrzeug State Tracker: Datenbankschema für Supabase
-- Einmal im Supabase SQL Editor ausführen (neues, leeres Projekt, Region EU).
-- Voraussetzung im Dashboard: Authentication > Sign In / Providers > "Allow anonymous sign-ins" einschalten.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  org_name text not null default 'Meine Einheit',
  team_code text not null default 'bitte-aendern'
);
insert into public.settings (id) values (1) on conflict do nothing;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  location text,
  notes text,
  next_inspection date,
  photo_path text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- Fach, Staukasten oder Bereich eines Fahrzeugs.
-- x und y: Position auf dem Fahrzeugfoto, Werte von 0 bis 1.
create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  name text not null,
  photo_path text,
  x numeric check (x between 0 and 1),
  y numeric check (y between 0 and 1),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists areas_vehicle_idx on public.areas(vehicle_id);

-- Gegenstand, der geprüft wird. x und y: Position auf dem Foto des Fachs.
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas(id) on delete cascade,
  name text not null,
  qty int not null default 1 check (qty >= 0),
  note text,
  x numeric check (x between 0 and 1),
  y numeric check (y between 0 and 1),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists items_area_idx on public.items(area_id);

create table if not exists public.checks (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  member_name text not null default 'Unbekannt',
  note text,
  created_at timestamptz not null default now()
);
create index if not exists checks_vehicle_idx on public.checks(vehicle_id, created_at desc);

-- status: ok (vorhanden), missing (fehlt), defect (defekt)
create table if not exists public.check_results (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.checks(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  item_name text not null,
  area_name text,
  status text not null check (status in ('ok','missing','defect')),
  note text,
  photo_path text,
  created_at timestamptz not null default now()
);
create index if not exists check_results_check_idx on public.check_results(check_id);

-- Checklisten je Fahrzeug (mit optionalem Intervall in Tagen)
create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  name text not null,
  interval_days int check (interval_days is null or interval_days between 1 and 730),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists checklists_vehicle_idx on public.checklists(vehicle_id);
-- Gegenstände ohne Checkliste gehören zu jedem Check
alter table public.items add column if not exists checklist_id uuid references public.checklists(id) on delete set null;
alter table public.checks add column if not exists checklist_id uuid references public.checklists(id) on delete set null;
alter table public.checks add column if not exists checklist_name text;
alter table public.checklists enable row level security;

-- Mängelverfolgung: Bearbeitungsstand je Ergebnis (nur für fehlt/defekt relevant)
alter table public.check_results add column if not exists resolved_status text not null default 'open';
alter table public.check_results add column if not exists resolved_at timestamptz;
alter table public.check_results add column if not exists resolved_by text;
alter table public.check_results add column if not exists resolve_note text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'check_results_resolved_status_chk') then
    alter table public.check_results add constraint check_results_resolved_status_chk
      check (resolved_status in ('open','progress','fixed'));
  end if;
end $$;
-- Prüfintervall in Monaten (optional)
alter table public.vehicles add column if not exists inspection_months int;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'vehicles_inspection_months_chk') then
    alter table public.vehicles add constraint vehicles_inspection_months_chk
      check (inspection_months is null or inspection_months between 1 and 60);
  end if;
end $$;
create index if not exists check_results_open_idx on public.check_results(resolved_status) where status <> 'ok';

-- ---------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid());
$$;

create or replace function public.can_read() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_member();
$$;

-- Wer bin ich? Gibt Rolle und Namen zurück.
create or replace function public.whoami() returns json
language plpgsql stable security definer set search_path = public as $$
declare
  v_name text;
begin
  if auth.uid() is null then
    return json_build_object('role', null);
  end if;
  if public.is_admin() then
    return json_build_object('role', 'admin', 'org', (select org_name from public.settings where id = 1));
  end if;
  select name into v_name from public.members where user_id = auth.uid();
  if v_name is not null then
    return json_build_object('role', 'member', 'name', v_name,
                             'org', (select org_name from public.settings where id = 1));
  end if;
  return json_build_object('role', null);
end;
$$;

-- Prüfcode vor der Anmeldung prüfen (ohne Konto). Bremst Raten leicht aus.
create or replace function public.check_code(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform pg_sleep(0.4);
  return exists (select 1 from public.settings where id = 1 and team_code = trim(p_code));
end;
$$;

-- Als Prüfer beitreten: Code und Name. Braucht eine (anonyme) Anmeldung.
create or replace function public.join_team(p_code text, p_name text) returns json
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  perform pg_sleep(0.4);
  if not exists (select 1 from public.settings where id = 1 and team_code = trim(p_code)) then
    raise exception 'Code falsch';
  end if;
  insert into public.members (user_id, name) values (auth.uid(), left(trim(p_name), 60))
  on conflict (user_id) do update set name = excluded.name;
  return public.whoami();
end;
$$;

-- Nur Admin: Einheitscode und Name der Einheit ändern.
create or replace function public.update_settings(p_org text, p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Nur Admin'; end if;
  if p_code is not null and char_length(trim(p_code)) < 6 then
    raise exception 'Code muss mindestens 6 Zeichen haben';
  end if;
  update public.settings
     set org_name = coalesce(nullif(trim(p_org), ''), org_name),
         team_code = coalesce(nullif(trim(p_code), ''), team_code)
   where id = 1;
end;
$$;

-- Nur Admin: Einheitscode lesen.
create or replace function public.get_settings() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Nur Admin'; end if;
  return (select json_build_object('org_name', org_name, 'team_code', team_code)
            from public.settings where id = 1);
end;
$$;

-- Nur Admin: Prüfer entfernen.
create or replace function public.remove_member(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Nur Admin'; end if;
  delete from public.members where user_id = p_user;
end;
$$;

-- Name des Prüfers beim Speichern eines Checks fest eintragen.
create or replace function public.checks_set_name() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  new.user_id := auth.uid();
  select name into v_name from public.members where user_id = auth.uid();
  if v_name is not null then
    new.member_name := v_name;
  elsif public.is_admin() then
    new.member_name := coalesce(nullif(trim(new.member_name), ''), 'Admin');
  end if;
  return new;
end;
$$;
drop trigger if exists checks_set_name_trg on public.checks;
create trigger checks_set_name_trg before insert on public.checks
for each row execute function public.checks_set_name();

-- ---------------------------------------------------------------
-- Rechte (Row Level Security)
-- ---------------------------------------------------------------
alter table public.settings      enable row level security;
alter table public.admins        enable row level security;
alter table public.members       enable row level security;
alter table public.vehicles      enable row level security;
alter table public.areas         enable row level security;
alter table public.items         enable row level security;
alter table public.checks        enable row level security;
alter table public.check_results enable row level security;

-- settings, admins: nur über Funktionen zugänglich (keine Policies = kein direkter Zugriff)

drop policy if exists members_select on public.members;
create policy members_select on public.members for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists vehicles_select on public.vehicles;
create policy vehicles_select on public.vehicles for select using (public.can_read());
drop policy if exists vehicles_admin on public.vehicles;
create policy vehicles_admin on public.vehicles for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists areas_select on public.areas;
create policy areas_select on public.areas for select using (public.can_read());
drop policy if exists areas_admin on public.areas;
create policy areas_admin on public.areas for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists checklists_select on public.checklists;
create policy checklists_select on public.checklists for select using (public.can_read());
drop policy if exists checklists_admin on public.checklists;
create policy checklists_admin on public.checklists for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists items_select on public.items;
create policy items_select on public.items for select using (public.can_read());
drop policy if exists items_admin on public.items;
create policy items_admin on public.items for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists checks_select on public.checks;
create policy checks_select on public.checks for select using (public.can_read());
drop policy if exists checks_insert on public.checks;
create policy checks_insert on public.checks for insert
  with check (public.can_read());
drop policy if exists checks_delete on public.checks;
create policy checks_delete on public.checks for delete using (public.is_admin());

drop policy if exists results_select on public.check_results;
create policy results_select on public.check_results for select using (public.can_read());
drop policy if exists results_insert on public.check_results;
create policy results_insert on public.check_results for insert
  with check (
    public.can_read()
    and exists (select 1 from public.checks c where c.id = check_id and c.user_id = auth.uid())
  );
drop policy if exists results_update on public.check_results;
create policy results_update on public.check_results for update
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists results_delete on public.check_results;
create policy results_delete on public.check_results for delete using (public.is_admin());

-- Funktionen nur für angemeldete Nutzer, außer check_code
revoke all on function public.whoami()          from public;
revoke all on function public.join_team(text, text) from public;
revoke all on function public.update_settings(text, text) from public;
revoke all on function public.get_settings()    from public;
revoke all on function public.remove_member(uuid) from public;
grant execute on function public.whoami()          to anon, authenticated;
grant execute on function public.check_code(text)  to anon, authenticated;
grant execute on function public.join_team(text, text) to authenticated;
grant execute on function public.update_settings(text, text) to authenticated;
grant execute on function public.get_settings()    to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;

-- ---------------------------------------------------------------
-- Foto Speicher (privat)
-- Pfade: vehicles/..., areas/..., checks/<user_id>/...
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists photos_select on storage.objects;
create policy photos_select on storage.objects for select
  using (bucket_id = 'photos' and public.can_read());

drop policy if exists photos_admin_all on storage.objects;
create policy photos_admin_all on storage.objects for all
  using (bucket_id = 'photos' and public.is_admin())
  with check (bucket_id = 'photos' and public.is_admin());

drop policy if exists photos_member_insert on storage.objects;
create policy photos_member_insert on storage.objects for insert
  with check (
    bucket_id = 'photos'
    and public.is_member()
    and name like ('checks/' || auth.uid()::text || '/%')
  );

-- ---------------------------------------------------------------
-- Nach dem ersten Admin Login (Benutzer im Dashboard anlegen) ausführen:
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'DEINE@EMAIL.DE';
-- Einheitscode setzen:
--   update public.settings set team_code = 'MINDESTENS-6-ZEICHEN' where id = 1;
-- ---------------------------------------------------------------

-- ======================================================================
-- Fahrzeugnutzung (Ein und Auschecken) und Buchungen
-- ======================================================================
create table if not exists public.usages (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid default auth.uid(),
  member_name text not null,
  purpose text not null check (purpose in ('einsatz','uebung','wartung','reinigung','fahrt','sonstiges')),
  note text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by text,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create index if not exists usages_vehicle_idx on public.usages(vehicle_id, started_at desc);
-- pro Fahrzeug nur eine offene Nutzung
create unique index if not exists usages_one_open on public.usages(vehicle_id) where ended_at is null;
alter table public.usages enable row level security;
drop policy if exists usages_select on public.usages;
create policy usages_select on public.usages for select using (public.can_read());
drop policy if exists usages_insert on public.usages;
create policy usages_insert on public.usages for insert with check (public.can_read() and (user_id = auth.uid() or public.is_admin()));
drop policy if exists usages_update on public.usages;
create policy usages_update on public.usages for update
  using (public.is_admin() or (public.can_read() and user_id = auth.uid()))
  with check (public.is_admin() or (public.can_read() and user_id = auth.uid()));
drop policy if exists usages_delete on public.usages;
create policy usages_delete on public.usages for delete using (public.is_admin());

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid default auth.uid(),
  member_name text not null,
  purpose text not null check (purpose in ('einsatz','uebung','wartung','reinigung','fahrt','sonstiges')),
  note text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'requested' check (status in ('requested','confirmed','rejected','cancelled')),
  decided_by text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists bookings_vehicle_idx on public.bookings(vehicle_id, starts_at);

-- Eine bestätigte Buchung darf sich nicht mit einer anderen bestätigten überschneiden.
-- Eine neue Anfrage auf eine schon bestätigte Zeit wird abgelehnt.
create or replace function public.bookings_no_overlap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('requested','confirmed') and exists (
    select 1 from public.bookings b
    where b.vehicle_id = new.vehicle_id and b.id <> new.id and b.status = 'confirmed'
      and b.starts_at < new.ends_at and b.ends_at > new.starts_at
  ) then
    raise exception 'Das Fahrzeug ist in dieser Zeit schon gebucht' using errcode = '23P01';
  end if;
  return new;
end $$;
drop trigger if exists bookings_no_overlap_trg on public.bookings;
create trigger bookings_no_overlap_trg before insert or update on public.bookings
  for each row execute function public.bookings_no_overlap();

alter table public.bookings enable row level security;
drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings for select using (public.can_read());
drop policy if exists bookings_insert on public.bookings;
create policy bookings_insert on public.bookings for insert
  with check (public.can_read() and ((user_id = auth.uid() and status = 'requested') or public.is_admin()));
drop policy if exists bookings_update on public.bookings;
create policy bookings_update on public.bookings for update
  using (public.is_admin() or (public.can_read() and user_id = auth.uid()))
  with check (public.is_admin() or (public.can_read() and user_id = auth.uid() and status = 'cancelled'));
drop policy if exists bookings_delete on public.bookings;
create policy bookings_delete on public.bookings for delete using (public.is_admin());
