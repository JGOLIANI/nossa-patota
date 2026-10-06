-- Additive upgrade. Apply AFTER the legacy baseline; keep every sports UUID.
begin;
create schema if not exists patota_private;
revoke all on schema patota_private from public, anon, authenticated;
grant usage on schema patota_private to authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 120),
  created_at timestamptz not null default now()
);
create table public.patotas (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 80),
  modality text not null check (modality in ('futsal','society','campo')),
  timezone text not null default 'America/Sao_Paulo',
  created_by uuid references auth.users(id) on delete set null,
  legacy_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index patotas_legacy_one on public.patotas(legacy_default) where legacy_default;
create table public.patota_members (
  patota_id uuid not null references public.patotas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','jogador')),
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  joined_at timestamptz not null default now(),
  primary key(patota_id,user_id)
);
create index patota_members_user_idx on public.patota_members(user_id, status);
create table patota_private.join_codes (
  patota_id uuid primary key references public.patotas(id) on delete cascade,
  code text not null unique,
  rotated_at timestamptz not null default now()
);
create table patota_private.join_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  minute timestamptz not null,
  attempts int not null default 1,
  primary key(user_id,minute)
);
create table public.audit_log (
  id bigint generated always as identity primary key,
  patota_id uuid not null references public.patotas(id),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_id uuid,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_patota_idx on public.audit_log(patota_id,created_at desc);

alter table public.players add column patota_id uuid references public.patotas(id);
alter table public.players add column share_photo boolean not null default false;
alter table public.patota_settings add column patota_id uuid references public.patotas(id);
alter table public.patota_settings add column team_a_color text not null default '#000000';
alter table public.patota_settings add column team_b_color text not null default '#ffffff';
alter table public.patota_settings add column team_a_label text not null default 'Time Preto';
alter table public.patota_settings add column team_b_label text not null default 'Time Branco';
alter table public.patota_settings add column team_size integer not null default 5 check(team_size between 1 and 30);
alter table public.rounds add column patota_id uuid references public.patotas(id);
alter table public.rounds add column timezone text not null default 'America/Sao_Paulo';
alter table public.rounds add column starts_at timestamptz;
alter table public.rounds add column rules_snapshot jsonb not null default '{}';
alter table public.rounds add column cancel_reason text;
alter table public.rounds add column version integer not null default 1;
alter table public.rounds add column series_id uuid;
alter table public.rounds drop constraint rounds_status_check;
alter table public.rounds add constraint rounds_status_check check(status in ('rascunho','em_andamento','encerrada','cancelada'));

do $$ declare t text; begin
  foreach t in array array['teams','round_players','matches','match_events','round_awards','round_votes'] loop
    execute format('alter table public.%I add column patota_id uuid references public.patotas(id)', t);
  end loop;
end $$;
alter table public.round_players add column actual_attendance text check(actual_attendance in ('presente','ausente'));
alter table public.round_players add column source text not null default 'legacy';
alter table public.round_players add column version integer not null default 1;
alter table public.match_events add column actor_id uuid references auth.users(id) on delete set null;
alter table public.match_events add column minute integer check(minute between 0 and 300);
alter table public.match_events add column voided_at timestamptz;
alter table public.match_events add column correction_reason text;

-- Never derive privileges from signup metadata. Backfill existing trusted roles.
insert into public.profiles(user_id,display_name)
select u.id, coalesce(nullif(btrim(p.full_name),''), 'Jogador')
from auth.users u left join public.players p on p.user_id=u.id
on conflict(user_id) do nothing;
do $$ declare v_id uuid; v_owner uuid; t text; begin
  if exists(select 1 from public.players) or exists(select 1 from public.rounds) then
    select user_id into v_owner from public.players where role='admin' and user_id is not null order by created_at limit 1;
    insert into public.patotas(name,modality,created_by,legacy_default)
      values('Nossa Patota','futsal',v_owner,true) returning id into v_id;
    update public.players set patota_id=v_id;
    update public.rounds set patota_id=v_id;
    update public.patota_settings set patota_id=v_id;
    foreach t in array array['teams','round_players','matches','match_events','round_awards','round_votes'] loop
      execute format('update public.%I set patota_id=$1',t) using v_id;
    end loop;
    insert into public.patota_members(patota_id,user_id,role,status)
      select v_id,user_id,role,status from public.players where user_id is not null;
  else
    -- Empty singleton is configuration, not sports history; create settings per new patota.
    delete from public.patota_settings where id='default';
  end if;
end $$;
alter table public.players drop constraint players_user_id_key;
alter table public.players drop constraint players_username_key;
alter table public.players add unique(patota_id,user_id);
alter table public.players add unique(patota_id,username);
alter table public.rounds drop constraint rounds_date_key;
alter table public.rounds add unique(patota_id,date);
alter table public.patota_settings drop constraint patota_settings_id_check;
alter table public.patota_settings add unique(patota_id);
do $$ declare t text; begin
  foreach t in array array['players','patota_settings','rounds','teams','round_players','matches','match_events','round_awards','round_votes'] loop
    execute format('alter table public.%I alter column patota_id set not null',t);
    execute format('create index %I on public.%I(patota_id)',t||'_patota_idx',t);
  end loop;
end $$;

create table public.match_series (
  id uuid primary key default gen_random_uuid(),
  patota_id uuid not null unique references public.patotas(id),
  weekday integer not null check(weekday between 0 and 6),
  start_time text not null,
  timezone text not null,
  active boolean not null default true
);
insert into public.match_series(patota_id,weekday,start_time,timezone,active)
select s.patota_id,s.weekday,s.start_time,p.timezone,s.weeks_ahead>0
from public.patota_settings s join public.patotas p on p.id=s.patota_id;
alter table public.rounds add foreign key(series_id) references public.match_series(id);
update public.rounds r set starts_at=(r.date+r.start_time::time) at time zone r.timezone,
 rules_snapshot=jsonb_build_object('version','legacy-v1','modality','futsal','team_size',5,'team_count',r.team_count,'capacity',r.max_players);

create function patota_private.member(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.patota_members where patota_id=p_id and user_id=(select auth.uid()) and status='ativo');
$$;
create function patota_private.admin(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.patota_members where patota_id=p_id and user_id=(select auth.uid()) and status='ativo' and role='admin');
$$;
revoke all on function patota_private.member(uuid),patota_private.admin(uuid) from public;
grant execute on function patota_private.member(uuid),patota_private.admin(uuid) to authenticated;
create function patota_private.require_admin(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null or not patota_private.admin(p_id) then raise exception 'Ação reservada ao administrador da patota.'; end if; end $$;
create function patota_private.audit(p_id uuid,p_action text,p_resource uuid,p_payload jsonb default '{}') returns void language sql security definer set search_path='' as $$
 insert into public.audit_log(patota_id,actor_id,action,resource_id,payload) values(p_id,auth.uid(),p_action,p_resource,p_payload);
$$;

-- RLS replaces all global legacy policies, including the old self-update policy.
do $$ declare t text; pol record; begin
  foreach t in array array['players','patota_settings','rounds','teams','round_players','matches','match_events','round_awards','round_votes'] loop
    for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I',pol.policyname,t);
    end loop;
    execute format('create policy scoped_read on public.%I for select to authenticated using(patota_private.member(patota_id))',t);
    execute format('create policy scoped_admin on public.%I for all to authenticated using(patota_private.admin(patota_id)) with check(patota_private.admin(patota_id))',t);
  end loop;
  foreach t in array array['profiles','patotas','patota_members','audit_log','match_series'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;
create policy own_profile on public.profiles for select to authenticated using(user_id=(select auth.uid()));
create policy own_profile_update on public.profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy members_read on public.patota_members for select to authenticated using(patota_private.member(patota_id));
create policy patotas_read on public.patotas for select to authenticated using(patota_private.member(id));
create policy audit_admin_read on public.audit_log for select to authenticated using(patota_private.admin(patota_id));
create policy series_read on public.match_series for select to authenticated using(patota_private.member(patota_id));
create policy own_player_update on public.players for update to authenticated using(user_id=(select auth.uid()) and patota_private.member(patota_id)) with check(user_id=(select auth.uid()) and patota_private.member(patota_id));

-- Only profile fields may be changed by a non-admin. Role remains membership-owned.
create or replace function public.players_guard_self_update() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and not patota_private.admin(old.patota_id) and
    (to_jsonb(new)-array['full_name','photo_url','share_photo','must_change_password']) is distinct from
    (to_jsonb(old)-array['full_name','photo_url','share_photo','must_change_password']) then
   raise exception 'Você só pode alterar os campos do próprio perfil.';
 end if;
 return new;
end $$;

-- Scope checks also protect privileged RPCs against forged foreign IDs.
create function patota_private.validate_scope() returns trigger language plpgsql set search_path='' as $$
declare v_group uuid; v_round uuid; v_team_round uuid; v_id uuid;
begin
 if tg_table_name in ('teams','round_players','matches','round_awards','round_votes') then
   select patota_id into v_group from public.rounds where id=new.round_id;
   if v_group is distinct from new.patota_id then raise exception 'Referência de outra patota.'; end if;
 end if;
 if tg_table_name in ('round_players','round_awards','round_votes') then
   if not exists(select 1 from public.players where id=new.player_id and patota_id=new.patota_id) then raise exception 'Jogador de outra patota.'; end if;
 end if;
 if tg_table_name='round_players' then
   if new.team_id is not null then
     if not exists(select 1 from public.teams where id=new.team_id and round_id=new.round_id) then raise exception 'Time de outra rodada.'; end if;
   end if;
 end if;
 if tg_table_name='matches' then
   if not exists(select 1 from public.teams where id=new.team_a_id and round_id=new.round_id) or
      not exists(select 1 from public.teams where id=new.team_b_id and round_id=new.round_id) then raise exception 'Time de outra rodada.'; end if;
 end if;
 if tg_table_name='round_votes' then
   if not exists(select 1 from public.players where id=new.voter_id and patota_id=new.patota_id) then raise exception 'Eleitor de outra patota.'; end if;
 end if;
 if tg_table_name='match_events' then
   select patota_id,round_id into v_group,v_round from public.matches where id=new.match_id;
   if v_group is distinct from new.patota_id or not exists(select 1 from public.teams where id=new.team_id and round_id=v_round) then raise exception 'Evento de outra partida.'; end if;
   foreach v_id in array array[new.scorer_id,new.assist_id] loop
     if v_id is not null and not exists(select 1 from public.players where id=v_id and patota_id=new.patota_id) then raise exception 'Jogador de outra patota.'; end if;
   end loop;
 end if;
 if tg_table_name='rounds' then
   if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Fuso horário inválido.'; end if;
   new.starts_at := (new.date+new.start_time::time) at time zone new.timezone;
   if new.series_id is not null and not exists(select 1 from public.match_series where id=new.series_id and patota_id=new.patota_id) then raise exception 'Série de outra patota.'; end if;
 end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['rounds','teams','round_players','matches','match_events','round_awards','round_votes'] loop
   execute format('create trigger mobile_scope before insert or update on public.%I for each row execute function patota_private.validate_scope()',t);
 end loop;
end $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(user_id,display_name) values(new.id,coalesce(nullif(left(btrim(new.raw_user_meta_data->>'full_name'),120),''),'Jogador'));
 return new;
end $$;

create function patota_private.new_code() returns text language plpgsql set search_path='' as $$
declare alphabet text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; bytes bytea; v_code text; i int;
begin
 loop
  bytes:=decode(replace(gen_random_uuid()::text,'-',''),'hex'); v_code:='';
  for i in 0..7 loop v_code:=v_code||substr(alphabet,1+(get_byte(bytes,i)%length(alphabet)),1); end loop;
  if not exists(select 1 from patota_private.join_codes c where c.code=v_code) then return v_code; end if;
 end loop;
end $$;
insert into patota_private.join_codes(patota_id,code)
select id,patota_private.new_code() from public.patotas;

create function public.create_patota(p_name text,p_modality text,p_timezone text default 'America/Sao_Paulo') returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_name text; v_size int;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 if p_modality not in ('futsal','society','campo') or not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Modalidade ou fuso inválido.'; end if;
 select display_name into v_name from public.profiles where user_id=auth.uid();
 v_size:=case p_modality when 'futsal' then 5 when 'society' then 7 else 11 end;
 insert into public.patotas(name,modality,timezone,created_by) values(btrim(p_name),p_modality,p_timezone,auth.uid()) returning id into v_id;
 insert into public.patota_members(patota_id,user_id,role) values(v_id,auth.uid(),'admin');
 insert into public.players(patota_id,user_id,username,full_name,role) values(v_id,auth.uid(),'jogador.'||replace(auth.uid()::text,'-',''),v_name,'admin');
 insert into public.patota_settings(id,patota_id,team_size,weeks_ahead) values(v_id::text,v_id,v_size,0);
 insert into public.match_series(patota_id,weekday,start_time,timezone,active) values(v_id,5,'20:00',p_timezone,false);
 insert into patota_private.join_codes(patota_id,code) values(v_id,patota_private.new_code());
 perform patota_private.audit(v_id,'PatotaCreated',v_id,jsonb_build_object('modality',p_modality));
 return v_id;
end $$;

create function public.join_patota(p_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_name text; v_attempts int;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 -- The counter must survive invalid requests: return null instead of raising/rolling back.
 insert into patota_private.join_attempts(user_id,minute) values(auth.uid(),date_trunc('minute',clock_timestamp()))
 on conflict(user_id,minute) do update set attempts=patota_private.join_attempts.attempts+1 returning attempts into v_attempts;
 if v_attempts>5 then return null; end if;
 select patota_id into v_id from patota_private.join_codes where code=upper(btrim(p_code));
 if v_id is null then return null; end if;
 if exists(select 1 from public.patota_members where patota_id=v_id and user_id=auth.uid() and status='inativo') then return null; end if;
 select display_name into v_name from public.profiles where user_id=auth.uid();
 insert into public.patota_members(patota_id,user_id,role) values(v_id,auth.uid(),'jogador') on conflict do nothing;
 insert into public.players(patota_id,user_id,username,full_name,role)
 values(v_id,auth.uid(),'jogador.'||replace(auth.uid()::text,'-',''),v_name,'jogador') on conflict(patota_id,user_id) do nothing;
 perform patota_private.audit(v_id,'PlayerJoined',auth.uid());
 return v_id;
end $$;
create function public.patota_join_code(p_patota_id uuid,p_rotate boolean default false) returns text language plpgsql security definer set search_path='' as $$
declare v_code text;
begin
 perform patota_private.require_admin(p_patota_id);
 perform 1 from public.patotas where id=p_patota_id for update;
 if p_rotate then
  update patota_private.join_codes set code=patota_private.new_code(),rotated_at=now() where patota_id=p_patota_id;
  perform patota_private.audit(p_patota_id,'PatotaJoinCodeRegenerated',p_patota_id);
 end if;
 select code into v_code from patota_private.join_codes where patota_id=p_patota_id;
 return v_code;
end $$;
create function public.set_member_role(p_patota_id uuid,p_user_id uuid,p_role text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform patota_private.require_admin(p_patota_id);
 perform 1 from public.patotas where id=p_patota_id for update;
 if p_role not in ('admin','jogador') then raise exception 'Permissão inválida.'; end if;
 if p_role='jogador' and not exists(select 1 from public.patota_members where patota_id=p_patota_id and user_id<>p_user_id and role='admin' and status='ativo') then raise exception 'A patota precisa manter um administrador.'; end if;
 update public.patota_members set role=p_role where patota_id=p_patota_id and user_id=p_user_id;
 update public.players set role=p_role where patota_id=p_patota_id and user_id=p_user_id;
 perform patota_private.audit(p_patota_id,'MemberRoleChanged',p_user_id,jsonb_build_object('role',p_role));
end $$;

create function public.mobile_snapshot(p_patota_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; result jsonb;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 if p_patota_id is not null and not patota_private.member(p_patota_id) then raise exception 'Você não pertence a esta patota.'; end if;
 select p.id into v_id from public.patotas p join public.patota_members m on m.patota_id=p.id
 where m.user_id=auth.uid() and m.status='ativo' and (p_patota_id is null or p.id=p_patota_id) order by p.created_at limit 1;
 result:=jsonb_build_object(
  'activePatotaId',v_id,
  'patotas',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from public.patotas p where patota_private.member(p.id)),'[]'),
  'members',coalesce((select jsonb_agg(to_jsonb(m)) from public.patota_members m where m.patota_id=v_id),'[]'),
  'settings',coalesce((select (to_jsonb(s)-'join_code')||jsonb_build_object('series_id',(select id from public.match_series where patota_id=v_id)) from public.patota_settings s where s.patota_id=v_id),'{}'),
  'players',coalesce((select jsonb_agg(to_jsonb(p)) from public.players p where p.patota_id=v_id),'[]'),
  'rounds',coalesce((select jsonb_agg(to_jsonb(r)) from public.rounds r where r.patota_id=v_id),'[]'),
  'teams',coalesce((select jsonb_agg(to_jsonb(t)) from public.teams t where t.patota_id=v_id),'[]'),
  'roundPlayers',coalesce((select jsonb_agg(to_jsonb(rp)) from public.round_players rp where rp.patota_id=v_id),'[]'),
  'matches',coalesce((select jsonb_agg(to_jsonb(m)) from public.matches m where m.patota_id=v_id),'[]'),
  'events',coalesce((select jsonb_agg(to_jsonb(e)) from public.match_events e where e.patota_id=v_id and e.voided_at is null),'[]'),
  'awards',coalesce((select jsonb_agg(to_jsonb(a)) from public.round_awards a where a.patota_id=v_id),'[]'),
  'votes',coalesce((with identities as materialized (
    select voter_id,gen_random_uuid()::text as token from public.round_votes where patota_id=v_id group by voter_id
   ) select jsonb_agg((to_jsonb(v)-'voter_id')||jsonb_build_object('voter_id',case when p.user_id=auth.uid() then v.voter_id::text else i.token end))
     from public.round_votes v join public.players p on p.id=v.voter_id join identities i on i.voter_id=v.voter_id where v.patota_id=v_id),'[]'));
 return result;
end $$;

-- Remove all old callable definer RPCs until replaced with scope-aware commands.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('is_admin','join_code_required','join_code_matches','respond_attendance','cast_vote','clear_vote','admin_set_password','owns_avatar') loop
   execute format('revoke execute on function %s from public, anon, authenticated',f.signature);
 end loop;
end $$;
revoke all on all functions in schema patota_private from public,anon,authenticated;
grant execute on function patota_private.member(uuid),patota_private.admin(uuid) to authenticated;
revoke all on public.profiles,public.patotas,public.patota_members,public.audit_log,public.match_series from anon,authenticated;
grant select on public.profiles,public.patotas,public.patota_members,public.audit_log,public.match_series to authenticated;
grant update(display_name) on public.profiles to authenticated;
revoke all on function public.create_patota(text,text,text),public.join_patota(text),public.patota_join_code(uuid,boolean),public.set_member_role(uuid,uuid,text),public.mobile_snapshot(uuid) from public,anon;
grant execute on function public.create_patota(text,text,text),public.join_patota(text),public.patota_join_code(uuid,boolean),public.set_member_role(uuid,uuid,text),public.mobile_snapshot(uuid) to authenticated;
-- Existing photos keep their object paths. Make the bucket private; replace URL at read time.
update storage.buckets set public=false where id='avatars';
drop policy avatars_read on storage.objects;
drop policy avatars_insert on storage.objects;
drop policy avatars_update on storage.objects;
drop policy avatars_delete on storage.objects;
create function patota_private.avatar_read(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.players p where p.id::text=split_part(p_path,'/',1) and patota_private.member(p.patota_id)
   and (p.photo_url='storage:avatars/'||p_path or right(split_part(p.photo_url,'?',1),length('/avatars/'||p_path))='/avatars/'||p_path));
$$;
create function patota_private.avatar_write(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.players p where p.id::text=split_part(p_path,'/',1) and patota_private.member(p.patota_id) and (p.user_id=auth.uid() or patota_private.admin(p.patota_id)));
$$;
revoke all on function patota_private.avatar_read(text),patota_private.avatar_write(text) from public,anon;
grant execute on function patota_private.avatar_read(text),patota_private.avatar_write(text) to authenticated;
create policy avatars_member_read on storage.objects for select to authenticated using(bucket_id='avatars' and patota_private.avatar_read(name));
create policy avatars_owner_insert on storage.objects for insert to authenticated with check(bucket_id='avatars' and patota_private.avatar_write(name));
create policy avatars_owner_update on storage.objects for update to authenticated using(bucket_id='avatars' and patota_private.avatar_write(name)) with check(bucket_id='avatars' and patota_private.avatar_write(name));
create policy avatars_owner_delete on storage.objects for delete to authenticated using(bucket_id='avatars' and patota_private.avatar_write(name));
commit;
