begin;
-- Nominal votes remain private even for administrators; the snapshot exposes
-- anonymous totals and the requesting player's own selection.
drop policy scoped_read on public.round_votes;
drop policy scoped_admin on public.round_votes;
create policy own_vote_read on public.round_votes for select to authenticated
using(exists(select 1 from public.players p where p.id=voter_id and p.user_id=auth.uid() and patota_private.member(p.patota_id)));
create table patota_private.command_receipts (
  command_id uuid primary key,
  actor_id uuid not null references auth.users(id),
  patota_id uuid not null references public.patotas(id),
  kind text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create table public.team_generations (
  id uuid primary key default gen_random_uuid(),
  patota_id uuid not null references public.patotas(id),
  round_id uuid not null references public.rounds(id),
  algorithm_version text not null,
  seed text not null,
  payload jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.award_result_versions (
  id uuid primary key default gen_random_uuid(),
  patota_id uuid not null references public.patotas(id),
  round_id uuid not null references public.rounds(id),
  formula_version text not null default 'legacy-v1',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  superseded_at timestamptz
);
create table public.generated_share_cards (
  id uuid primary key default gen_random_uuid(),
  patota_id uuid not null references public.patotas(id),
  round_id uuid not null references public.rounds(id),
  player_id uuid not null references public.players(id),
  template_version text not null default 'player-match-v1',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  superseded_at timestamptz
);
-- Historical winners stay frozen; unavailable old components are not invented.
insert into public.award_result_versions(patota_id,round_id,payload)
select r.patota_id,r.id,jsonb_build_object('source','legacy-backfill','results',coalesce((select jsonb_object_agg(a.type,jsonb_build_object('player_id',a.player_id,'components',null)) from public.round_awards a where a.round_id=r.id),'{}'))
from public.rounds r where r.awards_settled_at is not null or exists(select 1 from public.round_awards a where a.round_id=r.id);
do $$ declare t text; begin
 foreach t in array array['team_generations','award_result_versions','generated_share_cards'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy members_read on public.%I for select to authenticated using(patota_private.member(patota_id))',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
drop policy members_read on public.generated_share_cards;
create policy card_owner_read on public.generated_share_cards for select to authenticated
using(patota_private.admin(patota_id) or exists(select 1 from public.players p where p.id=player_id and p.user_id=auth.uid()));

create function patota_private.claim(p_group uuid,p_command uuid,p_kind text,p_payload jsonb) returns boolean language plpgsql set search_path='' as $$
declare v_row patota_private.command_receipts%rowtype;
begin
 if p_command is null then raise exception 'Identificador de comando obrigatório.'; end if;
 insert into patota_private.command_receipts(command_id,actor_id,patota_id,kind,payload)
 values(p_command,auth.uid(),p_group,p_kind,p_payload) on conflict do nothing;
 if found then return true; end if;
 select * into v_row from patota_private.command_receipts where command_id=p_command;
 if v_row.actor_id is distinct from auth.uid() or v_row.patota_id<>p_group or v_row.kind<>p_kind or v_row.payload<>p_payload then raise exception 'Identificador de comando já utilizado.'; end if;
 return false;
end $$;

create function public.respond_to_round(p_round_id uuid,p_wants text,p_command_id uuid,p_player_id uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare r public.rounds%rowtype; me public.players%rowtype; old public.round_players%rowtype; v_state text; n int; w record;
begin
 select * into r from public.rounds where id=p_round_id for update;
 if r.id is null or not patota_private.member(r.patota_id) then raise exception 'Partida indisponível.'; end if;
 if p_player_id is not null then
  perform patota_private.require_admin(r.patota_id);
  select * into me from public.players where id=p_player_id and patota_id=r.patota_id;
 else select * into me from public.players where user_id=auth.uid() and patota_id=r.patota_id; end if;
 if me.id is null or me.status<>'ativo' or r.status in ('encerrada','cancelada') then raise exception 'Não é possível responder a esta partida.'; end if;
 if p_wants not in ('confirmado','fora') then raise exception 'Resposta inválida.'; end if;
 if not patota_private.claim(r.patota_id,p_command_id,'attendance',jsonb_build_object('round',p_round_id,'player',me.id,'wants',p_wants)) then return; end if;
 select * into old from public.round_players where round_id=r.id and player_id=me.id;
 if old.attendance=p_wants or (old.attendance='espera' and p_wants='confirmado') then return; end if;
 select count(*) into n from public.round_players where round_id=r.id and attendance='confirmado' and player_id<>me.id;
 v_state:=case when p_wants='fora' then 'fora' when r.max_players=0 or n<r.max_players then 'confirmado' else 'espera' end;
 insert into public.round_players(patota_id,round_id,player_id,attendance,responded_at,source)
 values(r.patota_id,r.id,me.id,v_state,clock_timestamp(),case when p_player_id is null then 'app' else 'admin' end)
 on conflict(round_id,player_id) do update set attendance=excluded.attendance, responded_at=excluded.responded_at,
 source=excluded.source,version=public.round_players.version+1;
 -- Keep historical team membership even on withdrawal; actual attendance is separate.
 if v_state='fora' and old.attendance='confirmado' then
  for w in select id,player_id from public.round_players where round_id=r.id and attendance='espera' order by responded_at,id for update loop
   if r.max_players>0 and n>=r.max_players then exit; end if;
   update public.round_players set attendance='confirmado',version=version+1 where id=w.id;
   perform patota_private.audit(r.patota_id,'WaitlistPromoted',w.player_id,jsonb_build_object('round_id',r.id)); n:=n+1;
  end loop;
 end if;
 perform patota_private.audit(r.patota_id,'AttendanceChanged',me.id,jsonb_build_object('round_id',r.id,'before',old.attendance,'after',v_state,'source',case when p_player_id is null then 'app' else 'admin' end));
end $$;

create function public.create_round(p_patota_id uuid,p_input jsonb,p_command_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; p public.patotas%rowtype; s public.patota_settings%rowtype;
begin
 perform patota_private.require_admin(p_patota_id);
 select * into p from public.patotas where id=p_patota_id for update;
 if not patota_private.claim(p.id,p_command_id,'round_create',p_input) then
  select resource_id into v_id from public.audit_log where patota_id=p.id and action='MatchScheduled' and payload->>'command_id'=p_command_id::text;
  return v_id;
 end if;
 select * into s from public.patota_settings where patota_id=p.id;
 insert into public.rounds(patota_id,date,title,start_time,location,location_url,max_players,timezone,series_id,rules_snapshot)
 values(p.id,(p_input->>'date')::date,coalesce(p_input->>'title','Partida'),coalesce(p_input->>'start_time',s.start_time),coalesce(p_input->>'location',s.location),coalesce(p_input->>'location_url',s.location_url),coalesce((p_input->>'max_players')::int,s.max_players),p.timezone,(p_input->>'series_id')::uuid,
 jsonb_build_object('version','mobile-v1','modality',p.modality,'team_size',s.team_size,'team_count',2,'timezone',p.timezone)) returning id into v_id;
 perform patota_private.audit(p.id,'MatchScheduled',v_id,jsonb_build_object('command_id',p_command_id));
 return v_id;
end $$;

create function public.update_patota_settings(p_patota_id uuid,p_input jsonb) returns void language plpgsql security definer set search_path='' as $$
declare s public.patota_settings%rowtype; p public.patotas%rowtype; a text; b text; palette text[]:=array['#000000','#ffffff','#007aff','#ff3b30','#34c759','#ffcc00','#af52de','#ff9500'];
begin
 perform patota_private.require_admin(p_patota_id);
 select * into p from public.patotas where id=p_patota_id for update;
 select * into s from public.patota_settings where patota_id=p.id;
 a:=coalesce(p_input->>'team_a_color',s.team_a_color); b:=coalesce(p_input->>'team_b_color',s.team_b_color);
 if not(a=any(palette)) or not(b=any(palette)) or a=b then raise exception 'Selecione duas cores diferentes da paleta.'; end if;
 if coalesce(p_input->>'modality',p.modality) not in ('futsal','society','campo') or not exists(select 1 from pg_timezone_names where name=coalesce(p_input->>'timezone',p.timezone)) then raise exception 'Modalidade ou fuso inválido.'; end if;
 update public.patotas set name=coalesce(p_input->>'name',name),modality=coalesce(p_input->>'modality',modality),timezone=coalesce(p_input->>'timezone',timezone) where id=p.id;
 update public.patota_settings set weekday=coalesce((p_input->>'weekday')::int,weekday),start_time=coalesce(p_input->>'start_time',start_time),location=coalesce(p_input->>'location',location),location_url=coalesce(p_input->>'location_url',location_url),max_players=coalesce((p_input->>'max_players')::int,max_players),weeks_ahead=coalesce((p_input->>'weeks_ahead')::int,weeks_ahead),team_size=coalesce((p_input->>'team_size')::int,team_size),team_a_label=coalesce(nullif(btrim(p_input->>'team_a_label'),''),team_a_label),team_b_label=coalesce(nullif(btrim(p_input->>'team_b_label'),''),team_b_label),team_a_color=a,team_b_color=b where patota_id=p.id;
 update public.match_series set weekday=coalesce((p_input->>'weekday')::int,weekday),start_time=coalesce(p_input->>'start_time',start_time),timezone=coalesce(p_input->>'timezone',timezone),active=coalesce((p_input->>'weeks_ahead')::int,s.weeks_ahead)>0 where patota_id=p.id;
 perform patota_private.audit(p.id,case when p.modality<>coalesce(p_input->>'modality',p.modality) then 'PatotaModalityChanged' else 'PatotaSettingsChanged' end,p.id,p_input-'join_code');
end $$;

create function public.mutate_round(p_round_id uuid,p_action text,p_input jsonb,p_command_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.rounds%rowtype; row public.round_players%rowtype; capacity int; n int; w record;
begin
 select * into r from public.rounds where id=p_round_id for update;
 perform patota_private.require_admin(r.patota_id);
 if not patota_private.claim(r.patota_id,p_command_id,'round_'||p_action,jsonb_build_object('round',r.id,'input',p_input)) then return; end if;
 if p_action='edit' then
  if r.status<>'rascunho' then raise exception 'Só é possível editar uma partida em rascunho.'; end if;
  if (p_input->>'expected_version')::int is distinct from r.version then raise exception 'A partida mudou. Atualize a tela e tente novamente.'; end if;
  capacity:=coalesce((p_input->>'max_players')::int,r.max_players);
  select count(*) into n from public.round_players where round_id=r.id and attendance='confirmado';
  if capacity>0 and capacity<n then raise exception 'A capacidade não pode ser menor que os confirmados.'; end if;
  update public.rounds set date=coalesce((p_input->>'date')::date,date),title=coalesce(p_input->>'title',title),start_time=coalesce(p_input->>'start_time',start_time),location=coalesce(p_input->>'location',location),location_url=coalesce(p_input->>'location_url',location_url),max_players=capacity,version=version+1 where id=r.id;
  for w in select id,player_id from public.round_players where round_id=r.id and attendance='espera' order by responded_at,id for update loop
   if capacity>0 and n>=capacity then exit; end if;
   update public.round_players set attendance='confirmado',version=version+1 where id=w.id; n:=n+1;
   perform patota_private.audit(r.patota_id,'WaitlistPromoted',w.player_id,jsonb_build_object('round_id',r.id));
  end loop;
 elsif p_action='cancel' then
  if r.status not in ('rascunho','cancelada') then raise exception 'Só é possível cancelar antes de iniciar a partida.'; end if;
  if nullif(btrim(p_input->>'reason'),'') is null then raise exception 'Informe o motivo do cancelamento.'; end if;
  update public.rounds set status='cancelada',cancel_reason=p_input->>'reason',version=version+1 where id=r.id;
 elsif p_action='uncancel' then
  if r.status<>'cancelada' then raise exception 'A partida não está cancelada.'; end if;
  update public.rounds set status='rascunho',cancel_reason=null,version=version+1 where id=r.id;
 elsif p_action='check_in' then
  if r.status in ('cancelada','encerrada') then raise exception 'Reabra a partida para corrigir comparecimento.'; end if;
  if p_input->>'actual_attendance' not in ('presente','ausente') then raise exception 'Comparecimento inválido.'; end if;
  update public.round_players set actual_attendance=p_input->>'actual_attendance',version=version+1 where round_id=r.id and player_id=(p_input->>'player_id')::uuid;
  if not found then raise exception 'Jogador não inscrito.'; end if;
 elsif p_action='position' then
  if r.status in ('encerrada','cancelada') or p_input->>'position' not in ('linha','goleiro') then raise exception 'Posição indisponível.'; end if;
  update public.round_players set position=p_input->>'position' where round_id=r.id and player_id=(p_input->>'player_id')::uuid;
  if not found then raise exception 'Jogador não inscrito.'; end if;
 elsif p_action='close' then
  if r.status='encerrada' then return; end if;
  if r.status<>'em_andamento' then raise exception 'Inicie a partida antes de encerrar.'; end if;
  update public.matches set status='encerrada',ended_at=now() where round_id=r.id and status<>'encerrada';
  update public.rounds set status='encerrada',closed_at=now(),awards_settled_at=null,version=version+1 where id=r.id;
 elsif p_action='reopen' then
  if r.status<>'encerrada' then raise exception 'A partida não está encerrada.'; end if;
  if nullif(btrim(p_input->>'reason'),'') is null then raise exception 'Informe o motivo da reabertura.'; end if;
  update public.matches set status='em_andamento',ended_at=null where round_id=r.id;
  update public.rounds set status='em_andamento',closed_at=null,awards_settled_at=null,version=version+1 where id=r.id;
  update public.award_result_versions set superseded_at=now() where round_id=r.id and superseded_at is null;
  update public.generated_share_cards set superseded_at=now() where round_id=r.id and superseded_at is null;
  delete from public.round_awards where round_id=r.id;
 else raise exception 'Comando de partida inválido.'; end if;
 perform patota_private.audit(r.patota_id,'Match:'||p_action,r.id,p_input);
end $$;

create function public.publish_teams(p_round_id uuid,p_input jsonb,p_command_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.rounds%rowtype; item jsonb; p_id uuid; t_id uuid; a uuid; b uuid; i int:=0; n int; existing boolean;
begin
 select * into r from public.rounds where id=p_round_id for update;
 perform patota_private.require_admin(r.patota_id);
 if r.status in ('encerrada','cancelada') then raise exception 'Reabra a partida antes de alterar os times.'; end if;
 if not patota_private.claim(r.patota_id,p_command_id,'teams',jsonb_build_object('round',r.id,'input',p_input)) then return; end if;
 if p_input->>'algorithm_version' not in ('legacy-v1','manual-v1') or jsonb_array_length(p_input->'teams')<>2 then raise exception 'Geração inválida.'; end if;
 if exists(select 1 from jsonb_array_elements(p_input->'teams') t, jsonb_array_elements_text(t->'players') p group by p.value having count(*)>1) then raise exception 'Jogador duplicado nos times.'; end if;
 for item in select value from jsonb_array_elements(p_input->'teams') loop
  if item->>'color' not in ('#000000','#ffffff','#007aff','#ff3b30','#34c759','#ffcc00','#af52de','#ff9500') or nullif(btrim(item->>'name'),'') is null or jsonb_array_length(item->'players')=0 then raise exception 'Nome, cor ou elenco inválido.'; end if;
  for p_id in select value::uuid from jsonb_array_elements_text(item->'players') loop
   if not exists(select 1 from public.round_players rp join public.players p on p.id=rp.player_id where rp.round_id=r.id and rp.player_id=p_id and rp.attendance='confirmado' and p.status='ativo') then raise exception 'Apenas jogadores confirmados podem ser escalados.'; end if;
  end loop;
 end loop;
 if p_input->'teams'->0->>'color'=p_input->'teams'->1->>'color' then raise exception 'Selecione cores diferentes.'; end if;
 existing:=exists(select 1 from public.teams where round_id=r.id);
 if existing and p_input->>'algorithm_version'<>'manual-v1' then raise exception 'Use ajuste manual para preservar os gols.'; end if;
 update public.round_players set team_id=null where round_id=r.id;
 for item in select value from jsonb_array_elements(p_input->'teams') loop
  insert into public.teams(patota_id,round_id,position,name,color) values(r.patota_id,r.id,i,item->>'name',item->>'color')
  on conflict(round_id,position) do update set name=excluded.name,color=excluded.color returning id into t_id;
  for p_id in select value::uuid from jsonb_array_elements_text(item->'players') loop
   update public.round_players set team_id=t_id,position=coalesce(position,(select position from public.players where id=p_id)) where round_id=r.id and player_id=p_id;
  end loop;
  if i=0 then a:=t_id; else b:=t_id; end if; i:=i+1;
 end loop;
 if not existing then
  insert into public.matches(patota_id,round_id,team_a_id,team_b_id) values(r.patota_id,r.id,a,b);
  update public.rounds set status='em_andamento',version=version+1 where id=r.id;
 end if;
 insert into public.team_generations(patota_id,round_id,algorithm_version,seed,payload,created_by) values(r.patota_id,r.id,p_input->>'algorithm_version',p_input->>'seed',p_input,auth.uid());
 perform patota_private.audit(r.patota_id,'TeamsGenerated',r.id,p_input);
end $$;

create function public.mutate_goal(p_match_id uuid,p_action text,p_input jsonb,p_command_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare m public.matches%rowtype; r public.rounds%rowtype; e public.match_events%rowtype; v_team uuid; v_scorer uuid; v_assist uuid; v_own boolean;
begin
 select * into m from public.matches where id=p_match_id;
 select * into r from public.rounds where id=m.round_id for update;
 perform patota_private.require_admin(r.patota_id);
 if r.status<>'em_andamento' or m.status<>'em_andamento' then raise exception 'Reabra a partida antes de alterar o placar.'; end if;
 if not patota_private.claim(r.patota_id,p_command_id,'goal_'||p_action,jsonb_build_object('match',m.id,'input',p_input)) then return; end if;
 if p_action in ('edit','reverse') then
  select * into e from public.match_events where id=(p_input->>'event_id')::uuid and match_id=m.id and voided_at is null for update;
  if e.id is null then raise exception 'Evento indisponível.'; end if;
  if nullif(btrim(p_input->>'reason'),'') is null then raise exception 'Informe o motivo da correção.'; end if;
  update public.match_events set voided_at=now(),correction_reason=p_input->>'reason' where id=e.id;
 end if;
 if p_action in ('add','edit') then
  v_team:=(p_input->>'team_id')::uuid; v_scorer:=(p_input->>'scorer_id')::uuid; v_assist:=(p_input->>'assist_id')::uuid; v_own:=coalesce((p_input->>'own_goal')::boolean,false);
  if v_team not in (m.team_a_id,m.team_b_id) or v_team is null then raise exception 'Time inválido.'; end if;
  if v_scorer is not null and not exists(select 1 from public.round_players where round_id=r.id and player_id=v_scorer and team_id=case when v_own then case when v_team=m.team_a_id then m.team_b_id else m.team_a_id end else v_team end) then raise exception 'Autor do gol não pertence ao time.'; end if;
  if v_assist is not null and (v_own or v_assist=v_scorer or not exists(select 1 from public.round_players where round_id=r.id and player_id=v_assist and team_id=v_team)) then raise exception 'Assistência inválida.'; end if;
  insert into public.match_events(patota_id,match_id,team_id,scorer_id,assist_id,own_goal,actor_id,minute)
  values(r.patota_id,m.id,v_team,v_scorer,v_assist,v_own,auth.uid(),(p_input->>'minute')::int);
 elsif p_action<>'reverse' then raise exception 'Comando de gol inválido.'; end if;
 update public.matches set score_a=(select count(*) from public.match_events where match_id=m.id and team_id=m.team_a_id and voided_at is null),score_b=(select count(*) from public.match_events where match_id=m.id and team_id=m.team_b_id and voided_at is null) where id=m.id;
 update public.rounds set version=version+1 where id=r.id;
 update public.generated_share_cards set superseded_at=now() where round_id=r.id and superseded_at is null;
 perform patota_private.audit(r.patota_id,'MatchAction:'||p_action,m.id,jsonb_build_object('before',case when e.id is null then null else to_jsonb(e) end,'after',p_input));
end $$;

-- Frozen, approved legacy-v1 scoring; no new formula introduced.
create function patota_private.round_stats(p_round uuid) returns table(player_id uuid,team_id uuid,"position" text,played bigint,goals bigint,assists bigint,against bigint,wins bigint)
language sql stable set search_path='' as $$
 select rp.player_id,rp.team_id,coalesce(rp.position,p.position),count(m.id),
 coalesce(sum((select count(*) from public.match_events e where e.match_id=m.id and e.scorer_id=rp.player_id and not e.own_goal and e.voided_at is null)),0)::bigint,
 coalesce(sum((select count(*) from public.match_events e where e.match_id=m.id and e.assist_id=rp.player_id and e.voided_at is null)),0)::bigint,
 coalesce(sum(case when rp.team_id=m.team_a_id then m.score_b else m.score_a end),0)::bigint,
 count(m.id) filter(where case when rp.team_id=m.team_a_id then m.score_a>m.score_b else m.score_b>m.score_a end)
 from public.round_players rp join public.players p on p.id=rp.player_id
 join public.matches m on m.round_id=rp.round_id and m.status='encerrada' and rp.team_id in(m.team_a_id,m.team_b_id)
 where rp.round_id=p_round and rp.actual_attendance is distinct from 'ausente'
 group by rp.player_id,rp.team_id,coalesce(rp.position,p.position);
$$;
create function patota_private.award_pool(p_round uuid,p_type text) returns setof uuid language sql stable set search_path='' as $$
 with points as (
 select t.id,coalesce(sum(case when t.id=m.team_a_id then case when m.score_a>m.score_b then 3 when m.score_a=m.score_b then 1 else 0 end else case when m.score_b>m.score_a then 3 when m.score_a=m.score_b then 1 else 0 end end),0) total
 from public.teams t join public.matches m on m.round_id=t.round_id and t.id in(m.team_a_id,m.team_b_id) and m.status='encerrada' where t.round_id=p_round group by t.id
 ) select s.player_id from patota_private.round_stats(p_round) s join points p on p.id=s.team_id
 where (p_type='goleiro_menos_vazado' and s.position='goleiro') or
 (s.position='linha' and ((p_type='jogador_rodada' and p.total=(select max(total) from points)) or (p_type='pior_jogador' and p.total=(select min(total) from points))));
$$;
create function patota_private.legacy_luck(p_text text) returns double precision language plpgsql immutable set search_path='' as $$
declare h bigint:=2166136261; t bigint; i int;
begin
 for i in 1..length(p_text) loop h:=((h # ascii(substr(p_text,i,1)))*16777619)&4294967295; end loop;
 h:=(h+1831565813)&4294967295;
 t:=mod((h # (h>>15))::numeric*(h|1)::numeric,4294967296)::bigint;
 -- Multiplication can exceed signed bigint; reduce numeric modulo before casting.
 t:=(t # ((t + mod((t # (t>>7))::numeric*(t|61)::numeric,4294967296)::bigint)&4294967295))&4294967295;
 return ((t # (t>>14))&4294967295)::double precision/4294967296.0;
end $$;
create function public.vote_award(p_round_id uuid,p_type text,p_player_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare r public.rounds%rowtype; me uuid;
begin
 select * into r from public.rounds where id=p_round_id for update;
 if not patota_private.member(r.patota_id) or r.status<>'encerrada' or r.closed_at is null or r.awards_settled_at is not null or now()>=r.closed_at+interval '16 hours' then raise exception 'Votação encerrada ou indisponível.'; end if;
 if p_type not in('jogador_rodada','pior_jogador','goleiro_menos_vazado') then raise exception 'Categoria inválida.'; end if;
 select id into me from public.players where patota_id=r.patota_id and user_id=auth.uid();
 if not exists(select 1 from patota_private.round_stats(r.id) where player_id=me) then raise exception 'Somente quem jogou pode votar.'; end if;
 if p_player_id=me then raise exception 'Não é permitido votar em si mesmo.'; end if;
 if p_player_id is null then delete from public.round_votes where round_id=r.id and voter_id=me and type=p_type;
 else
  if not exists(select 1 from patota_private.award_pool(r.id,p_type) id where id=p_player_id) then raise exception 'Candidato não elegível.'; end if;
  insert into public.round_votes(patota_id,round_id,voter_id,type,player_id) values(r.patota_id,r.id,me,p_type,p_player_id) on conflict(round_id,type,voter_id) do update set player_id=excluded.player_id,created_at=now();
 end if;
end $$;
create function public.settle_awards(p_round_id uuid,p_early boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare r public.rounds%rowtype; category text; winner uuid; breakdown jsonb; all_results jsonb:='{}';
begin
 select * into r from public.rounds where id=p_round_id for update;
 perform patota_private.require_admin(r.patota_id);
 if r.status<>'encerrada' then raise exception 'Encerre a partida primeiro.'; end if;
 if r.awards_settled_at is not null then return; end if;
 if not p_early and now()<r.closed_at+interval '16 hours' then return; end if;
 foreach category in array array['jogador_rodada','pior_jogador','goleiro_menos_vazado'] loop
  with pool as (
   select s.*,case when category='goleiro_menos_vazado' then against else goals+assists end metric,
    (select count(*) from public.round_votes v where v.round_id=r.id and v.type=category and v.player_id=s.player_id)::int votes
   from patota_private.round_stats(r.id) s where s.player_id in(select patota_private.award_pool(r.id,category))
  ), scored as (
   select *,case when max(metric) over()=min(metric) over() then 0.5 else (metric-min(metric) over())::double precision/(max(metric) over()-min(metric) over()) end normalized,
    coalesce(votes::double precision/nullif(sum(votes) over(),0),0) vote_share from pool
  ), final as (
   select *,0.7*vote_share+0.3*case when category='jogador_rodada' then normalized else 1-normalized end score
   from scored where category='goleiro_menos_vazado' or (select sum(votes) from pool)>0 or (select max(goals+assists) from pool)>0
  ) select player_id,jsonb_build_object('votes',votes,'vote_share',vote_share,'metric',metric,'normalized',normalized,'score',score,'formula_version','legacy-v1') into winner,breakdown
    from final order by score desc,votes desc,
    case when category='goleiro_menos_vazado' then goals+assists else (goals*100+assists)*case when category='pior_jogador' then -1 else 1 end end desc,
    (select count(*) from public.round_awards a where a.player_id=final.player_id and a.type=category and a.round_id<>r.id),
    patota_private.legacy_luck(r.id::text||':'||category||':'||player_id::text) desc limit 1;
  if winner is not null then insert into public.round_awards(patota_id,round_id,type,player_id) values(r.patota_id,r.id,category,winner); end if;
  all_results:=all_results||jsonb_build_object(category,jsonb_build_object('player_id',winner,'components',breakdown));
 end loop;
 insert into public.award_result_versions(patota_id,round_id,payload) values(r.patota_id,r.id,all_results);
 update public.rounds set awards_settled_at=now() where id=r.id;
 perform patota_private.audit(r.patota_id,'AwardsCalculated',r.id,jsonb_build_object('formula_version','legacy-v1','results',all_results));
end $$;

create function public.player_match_card(p_round_id uuid,p_player_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rounds%rowtype; p public.players%rowtype; stats record; v_payload jsonb; existing public.generated_share_cards%rowtype;
begin
 select * into r from public.rounds where id=p_round_id for share;
 select * into p from public.players where id=p_player_id and patota_id=r.patota_id;
 if not patota_private.member(r.patota_id) or (p.user_id is distinct from auth.uid() and not patota_private.admin(r.patota_id)) then raise exception 'Card indisponível.'; end if;
 if r.status<>'encerrada' then raise exception 'Encerre a partida antes de gerar o card.'; end if;
 select * into stats from patota_private.round_stats(r.id) where player_id=p.id;
 if stats.player_id is null then raise exception 'Sem participação registrada nesta partida.'; end if;
 v_payload:=jsonb_build_object('player_id',p.id,'name',p.full_name,'patota',(select name from public.patotas where id=r.patota_id),'date',r.date,'round_id',r.id,'round_version',r.version,'games',stats.played,'goals',stats.goals,'assists',stats.assists,'wins',stats.wins,'team',(select to_jsonb(t) from public.teams t where t.id=stats.team_id),'scores',coalesce((select jsonb_agg(jsonb_build_object('score_a',m.score_a,'score_b',m.score_b,'team_a',(select name from public.teams where id=m.team_a_id),'team_b',(select name from public.teams where id=m.team_b_id))) from public.matches m where m.round_id=r.id),'[]'),'awards',case when r.awards_settled_at is null then '[]'::jsonb else coalesce((select jsonb_agg(a.type) from public.round_awards a where a.round_id=r.id and a.player_id=p.id),'[]') end,'template_version','player-match-v1');
 select * into existing from public.generated_share_cards where round_id=r.id and player_id=p.id and superseded_at is null and payload=v_payload order by created_at desc limit 1;
 if existing.id is null then
  update public.generated_share_cards set superseded_at=now() where round_id=r.id and player_id=p.id and superseded_at is null;
  insert into public.generated_share_cards(patota_id,round_id,player_id,payload) values(r.patota_id,r.id,p.id,v_payload) returning * into existing;
  perform patota_private.audit(r.patota_id,'PlayerMatchCardGenerated',existing.id);
 end if;
 return to_jsonb(existing);
end $$;

-- Sports mutations go through transactions; UI cannot bypass them via Data API.
revoke insert,update,delete on public.rounds,public.teams,public.round_players,public.matches,public.match_events,public.round_awards,public.round_votes,public.patota_settings from authenticated;
revoke update on public.players from authenticated;
grant update(full_name,photo_url,share_photo,must_change_password,username,player_type,position,dominant_foot,level,status) on public.players to authenticated;
revoke delete on public.players from authenticated;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('respond_to_round','create_round','update_patota_settings','mutate_round','publish_teams','mutate_goal','vote_award','settle_awards','player_match_card') loop
  execute format('revoke all on function %s from public,anon',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
revoke all on all functions in schema patota_private from public,anon,authenticated;
grant execute on function patota_private.member(uuid),patota_private.admin(uuid),patota_private.avatar_read(text),patota_private.avatar_write(text) to authenticated;
create function public.round_history(p_round_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rounds%rowtype;
begin
 select * into r from public.rounds where id=p_round_id;
 perform patota_private.require_admin(r.patota_id);
 return coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.audit_log a where a.patota_id=r.patota_id and (a.resource_id=r.id or a.payload->>'round_id'=r.id::text or a.resource_id in(select id from public.matches where round_id=r.id))),'[]');
end $$;
revoke all on function public.round_history(uuid) from public,anon;
grant execute on function public.round_history(uuid) to authenticated;
revoke all on all tables in schema patota_private from public,anon,authenticated;
grant all on all tables in schema public,patota_private to service_role;
commit;
