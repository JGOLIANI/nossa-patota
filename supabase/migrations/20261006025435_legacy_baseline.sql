-- =============================================================================
-- Nossa Patota — schema completo do Supabase
-- =============================================================================
-- Cole este arquivo inteiro no SQL Editor do seu projeto Supabase e execute.
-- Pode ser executado novamente sem problemas: tudo é idempotente.
--
-- Depois de rodar, faça o primeiro acesso no aplicativo com o usuário "admin"
-- (a linha é criada no final deste arquivo) escolhendo a senha que quiser.
-- =============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------- tabelas --

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  -- Vínculo com a conta de login. Visitantes ficam com NULL.
  user_id uuid unique references auth.users (id) on delete set null,
  username text not null unique,
  full_name text not null,
  photo_url text,
  player_type text not null default 'mensalista'
    check (player_type in ('mensalista', 'visitante')),
  dominant_foot text not null default 'direita'
    check (dominant_foot in ('direita', 'esquerda', 'ambidestro')),
  position text not null default 'linha'
    check (position in ('goleiro', 'linha')),
  status text not null default 'ativo'
    check (status in ('ativo', 'inativo')),
  role text not null default 'jogador'
    check (role in ('admin', 'jogador')),
  level integer not null default 3 check (level between 1 and 5),
  -- Marcada quando um administrador aplica a senha padrão. Enquanto estiver
  -- ligada, o aplicativo não deixa o jogador fazer mais nada antes de trocar.
  must_change_password boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.players
  add column if not exists must_change_password boolean not null default false;

-- A patota tem dia fixo. Guardar isso em um lugar só permite ao sistema criar
-- as próximas rodadas sozinho, em vez de o administrador repetir o cadastro
-- toda semana.
create table if not exists public.patota_settings (
  id text primary key default 'default' check (id = 'default'),
  weekday integer not null default 5 check (weekday between 0 and 6),
  start_time text not null default '20:00',
  location text not null default '',
  -- Endereço do local no Google Maps, do jeito que o administrador colou.
  -- Vazio faz o aplicativo abrir o mapa por uma busca pelo nome acima.
  location_url text not null default '',
  -- 0 significa rodada sem limite de vagas.
  max_players integer not null default 0 check (max_players >= 0),
  weeks_ahead integer not null default 4 check (weeks_ahead between 0 and 12),
  -- Senha de entrada da patota. Vazio deixa o cadastro aberto a quem tiver o
  -- endereço do aplicativo.
  join_code text not null default ''
);

alter table public.patota_settings add column if not exists join_code text not null default '';
alter table public.patota_settings add column if not exists location_url text not null default '';

insert into public.patota_settings (id) values ('default') on conflict (id) do nothing;

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  title text not null default 'Rodada',
  start_time text not null default '20:00',
  location text not null default '',
  location_url text not null default '',
  team_count integer not null default 2 check (team_count between 1 and 8),
  max_players integer not null default 0 check (max_players >= 0),
  status text not null default 'rascunho'
    check (status in ('rascunho', 'em_andamento', 'encerrada')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  -- Uma rodada por data: é o que permite recriar a agenda sem duplicar nada.
  unique (date)
);

-- Colunas acrescentadas depois da primeira versão do schema.
alter table public.rounds add column if not exists start_time text not null default '20:00';
alter table public.rounds add column if not exists location text not null default '';
alter table public.rounds add column if not exists location_url text not null default '';
alter table public.rounds add column if not exists max_players integer not null default 0;
alter table public.rounds add column if not exists awards_settled_at timestamptz;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  position integer not null default 0,
  name text not null,
  color text not null default '#000000',
  unique (round_id, position)
);

create table if not exists public.round_players (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  -- Resposta do jogador ao convite. A ordem de `responded_at` é o que define
  -- quem sobe primeiro da lista de espera.
  attendance text not null default 'confirmado'
    check (attendance in ('confirmado', 'espera', 'fora')),
  responded_at timestamptz not null default now(),
  -- Posição realmente ocupada nesta rodada. Nulo mantém a do cadastro; é o
  -- que permite ao goleiro jogar na linha sem levar os gols sofridos junto.
  position text check (position in ('goleiro', 'linha')),
  unique (round_id, player_id)
);

alter table public.round_players
  add column if not exists attendance text not null default 'confirmado';
alter table public.round_players
  add column if not exists responded_at timestamptz not null default now();
alter table public.round_players add column if not exists position text;

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  sequence integer not null default 1,
  team_a_id uuid not null references public.teams (id) on delete cascade,
  team_b_id uuid not null references public.teams (id) on delete cascade,
  score_a integer not null default 0 check (score_a >= 0),
  score_b integer not null default 0 check (score_b >= 0),
  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'encerrada')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  check (team_a_id <> team_b_id)
);

create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  -- Time que pontuou (em gol contra, o time beneficiado).
  team_id uuid not null references public.teams (id) on delete cascade,
  -- Gols de jogadores removidos continuam valendo para o placar.
  scorer_id uuid references public.players (id) on delete set null,
  assist_id uuid references public.players (id) on delete set null,
  own_goal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.round_awards (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  type text not null
    check (type in ('jogador_rodada', 'pior_jogador', 'goleiro_menos_vazado')),
  player_id uuid not null references public.players (id) on delete cascade,
  unique (round_id, type, player_id)
);

/*
 * Votos dos prêmios.
 *
 * Cada jogador escalado tem um voto por prêmio, e votar de novo troca o
 * anterior — é o que a chave única garante. A urna fica aberta por 16 horas
 * depois de a partida ser encerrada; quem decide isso é a função `cast_vote`,
 * não o cliente.
 */
create table if not exists public.round_votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  type text not null
    check (type in ('jogador_rodada', 'pior_jogador', 'goleiro_menos_vazado')),
  voter_id uuid not null references public.players (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (round_id, type, voter_id)
);

create index if not exists round_votes_round_idx on public.round_votes (round_id);

create index if not exists round_players_round_idx on public.round_players (round_id);
create index if not exists round_players_team_idx on public.round_players (team_id);
create index if not exists matches_round_idx on public.matches (round_id);
create index if not exists match_events_match_idx on public.match_events (match_id);
create index if not exists round_awards_round_idx on public.round_awards (round_id);
create index if not exists teams_round_idx on public.teams (round_id);

-- ---------------------------------------------------------------- funções --

-- SECURITY DEFINER para que a consulta a `players` dentro das políticas de
-- `players` não caia em recursão infinita de RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.players
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- O código de entrada da patota, consultado antes do login — por isso as duas
-- funções são SECURITY DEFINER e abertas ao papel anônimo: quem está na tela
-- de cadastro ainda não tem sessão para ler `patota_settings`.
--
-- `join_code_matches` confere o código sem nunca devolvê-lo, e existe só para
-- a mensagem de erro sair certa na tela. A validação que vale é a do gatilho
-- de cadastro, que roda dentro da transação que cria a conta.
create or replace function public.join_code_required()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select join_code from public.patota_settings where id = 'default'), '') <> '';
$$;

create or replace function public.join_code_matches(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select join_code from public.patota_settings where id = 'default'), '')
         in ('', btrim(coalesce(p_code, '')));
$$;

revoke all on function public.join_code_required() from public;
revoke all on function public.join_code_matches(text) from public;
grant execute on function public.join_code_required() to anon, authenticated;
grant execute on function public.join_code_matches(text) to anon, authenticated;

-- Cria (ou vincula) o jogador da conta recém-nascida.
--
-- O jogador se cadastra sozinho: os dados do formulário chegam aqui em
-- `raw_user_meta_data`, e é este gatilho — não o navegador — que grava a linha
-- em `players`, porque o RLS reserva a escrita da tabela aos administradores.
--
-- Três garantias que não dependem do cliente se comportar bem:
--   · o código da patota, quando definido, é conferido no servidor;
--   · ninguém nasce administrador, exceto a primeira conta do sistema — que é
--     livre porque ainda não existe alguém para autorizá-la;
--   · uma ficha que já tem dono não é tomada por outra conta.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  wanted text := lower(split_part(new.email, '@', 1));
  target public.players%rowtype;
  is_first boolean;
  -- O formulário é a fonte destes campos. Ficam nulos quando não vieram ou
  -- vieram fora da lista — assim um cliente adulterado não derruba o cadastro
  -- no CHECK, e um cadastro sem formulário não apaga o que já estava na ficha.
  v_name text := nullif(btrim(coalesce(meta ->> 'full_name', '')), '');
  v_type text := case when meta ->> 'player_type' in ('mensalista', 'visitante')
                      then meta ->> 'player_type' end;
  v_position text := case when meta ->> 'position' in ('goleiro', 'linha')
                          then meta ->> 'position' end;
  v_foot text := case when meta ->> 'dominant_foot' in ('direita', 'esquerda', 'ambidestro')
                      then meta ->> 'dominant_foot' end;
begin
  select not exists (select 1 from public.players where user_id is not null)
    into is_first;

  select * into target from public.players where username = wanted;

  if is_first then
    if target.id is null then
      insert into public.players (user_id, username, full_name, player_type, position,
                                  dominant_foot, role)
      values (new.id, wanted, coalesce(v_name, initcap(replace(wanted, '.', ' '))),
              coalesce(v_type, 'mensalista'), coalesce(v_position, 'linha'),
              coalesce(v_foot, 'direita'), 'admin');
    else
      update public.players set user_id = new.id, role = 'admin' where id = target.id;
    end if;
    return new;
  end if;

  if not public.join_code_matches(meta ->> 'join_code') then
    raise exception 'Código da patota inválido. Peça o código a um administrador.';
  end if;

  if target.user_id is not null and target.user_id <> new.id then
    raise exception 'O usuário "%" já possui acesso criado.', wanted;
  end if;

  -- Nunca administrador no cadastro: a promoção é sempre um ato de um admin.
  if target.id is null then
    insert into public.players (user_id, username, full_name, player_type, position,
                                dominant_foot, role)
    values (new.id, wanted, coalesce(v_name, initcap(replace(wanted, '.', ' '))),
            coalesce(v_type, 'mensalista'), coalesce(v_position, 'linha'),
            coalesce(v_foot, 'direita'), 'jogador');
  else
    -- Ficha aberta pelo administrador antes do primeiro acesso. O que só a
    -- pessoa sabe — nome, posição, perna — vem do formulário; o que é decisão
    -- da patota — mensalista ou visitante, nível, situação — fica como está.
    update public.players
       set user_id = new.id,
           role = 'jogador',
           full_name = coalesce(v_name, target.full_name),
           position = coalesce(v_position, target.position),
           dominant_foot = coalesce(v_foot, target.dominant_foot)
     where id = target.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

/*
 * Confirmação de presença.
 *
 * Precisa rodar no servidor por dois motivos: quando alguém desiste, a
 * promoção mexe na linha de OUTRO jogador, o que o RLS impediria; e a trava
 * por rodada evita que duas pessoas confirmando ao mesmo tempo ocupem a
 * mesma última vaga.
 */
create or replace function public.respond_attendance(p_round_id uuid, p_wants text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid;
  round_row public.rounds%rowtype;
  current_row public.round_players%rowtype;
  confirmed_count integer;
  promoted uuid;
  next_state text;
begin
  if p_wants not in ('confirmado', 'fora') then
    raise exception 'Resposta inválida: %', p_wants;
  end if;

  select id into me from public.players where user_id = auth.uid();
  if me is null then
    raise exception 'Sua conta ainda não está vinculada a um jogador da patota.';
  end if;

  select * into round_row from public.rounds where id = p_round_id;
  if round_row.id is null then
    raise exception 'Rodada não encontrada.';
  end if;
  if round_row.status = 'encerrada' then
    raise exception 'Esta rodada já foi encerrada.';
  end if;

  -- Serializa as respostas desta rodada até o fim da transação.
  perform pg_advisory_xact_lock(hashtext(p_round_id::text));

  select * into current_row
    from public.round_players
   where round_id = p_round_id and player_id = me;

  if p_wants = 'fora' then
    if current_row.id is not null and current_row.attendance = 'fora' then
      return;
    end if;

    if current_row.id is null then
      insert into public.round_players (round_id, player_id, attendance, responded_at)
      values (p_round_id, me, 'fora', now());
      return;
    end if;

    -- Sai do time junto: o sorteio já podia ter acontecido, e um desistente
    -- com time continuaria na escalação e nas estatísticas da partida que ele
    -- não jogou.
    update public.round_players
       set attendance = 'fora', responded_at = now(), team_id = null
     where id = current_row.id;

    -- A vaga só abre se quem saiu realmente ocupava uma.
    if current_row.attendance = 'confirmado' then
      select player_id into promoted
        from public.round_players
       where round_id = p_round_id and attendance = 'espera'
       order by responded_at
       limit 1;

      if promoted is not null then
        update public.round_players
           set attendance = 'confirmado'
         where round_id = p_round_id and player_id = promoted;
      end if;
    end if;
    return;
  end if;

  -- Já confirmado ou já na espera: nada muda.
  if current_row.id is not null and current_row.attendance in ('confirmado', 'espera') then
    return;
  end if;

  select count(*) into confirmed_count
    from public.round_players
   where round_id = p_round_id and attendance = 'confirmado';

  next_state := case
    when round_row.max_players <= 0 or confirmed_count < round_row.max_players then 'confirmado'
    else 'espera'
  end;

  if current_row.id is null then
    insert into public.round_players (round_id, player_id, attendance, responded_at)
    values (p_round_id, me, next_state, now());
  else
    -- Quem desistiu e voltou entra no fim da fila, não no lugar antigo — e sem
    -- time, porque o sorteio que o colocou em um já ficou para trás.
    update public.round_players
       set attendance = next_state, responded_at = now(),
           team_id = case when next_state = 'confirmado' then team_id else null end
     where id = current_row.id;
  end if;
end;
$$;

revoke all on function public.respond_attendance(uuid, text) from public;
grant execute on function public.respond_attendance(uuid, text) to authenticated;

/*
 * Redefinição de senha feita por um administrador.
 *
 * O login da patota é por nome de usuário em domínio reservado, que não recebe
 * mensagem nenhuma — então o "esqueci minha senha" por e-mail não tem para
 * onde ir. Quem destrava é o administrador: gera uma senha provisória e passa
 * para a pessoa, que troca depois no próprio perfil.
 *
 * Trocar a senha de outra conta é privilégio de `service_role`, que não pode
 * viver no navegador. Daí a função rodar aqui dentro, com SECURITY DEFINER e
 * `is_admin()` na porta.
 *
 * `search_path` inclui `extensions` porque é lá que o Supabase instala o
 * pgcrypto; em um Postgres comum ele fica em `public` e o schema inexistente é
 * simplesmente ignorado.
 */
/*
 * Registra o voto de um jogador em um prêmio da rodada.
 *
 * Roda no servidor porque as três regras que valem aqui não podem depender do
 * cliente: só vota quem foi escalado, ninguém vota em si mesmo, e a urna
 * fecha 16 horas depois do encerramento da partida. Uma política de RLS
 * sozinha não conseguiria expressar a janela de tempo nem a escalação.
 */
create or replace function public.cast_vote(
  p_round_id uuid,
  p_type text,
  p_player_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid;
  round_row public.rounds%rowtype;
begin
  if p_type not in ('jogador_rodada', 'pior_jogador', 'goleiro_menos_vazado') then
    raise exception 'Prêmio inválido: %', p_type;
  end if;

  select id into me from public.players where user_id = auth.uid();
  if me is null then
    raise exception 'Sua conta ainda não está vinculada a um jogador da patota.';
  end if;
  if me = p_player_id then
    raise exception 'Não dá para votar em você mesmo.';
  end if;

  select * into round_row from public.rounds where id = p_round_id;
  if round_row.id is null then
    raise exception 'Partida não encontrada.';
  end if;
  if round_row.status <> 'encerrada' or round_row.closed_at is null then
    raise exception 'A votação abre quando a partida é encerrada.';
  end if;
  -- Fecham a urna duas coisas: o prazo, que corre sozinho, e a apuração, que
  -- o administrador pode antecipar quando todo mundo já votou.
  if round_row.awards_settled_at is not null
     or now() > round_row.closed_at + interval '16 hours' then
    raise exception 'A votação desta partida já foi encerrada.';
  end if;

  if not exists (
    select 1 from public.round_players
    where round_id = p_round_id and player_id = me and team_id is not null
  ) then
    raise exception 'Só quem jogou a partida pode votar.';
  end if;

  if not exists (
    select 1 from public.round_players
    where round_id = p_round_id and player_id = p_player_id and team_id is not null
  ) then
    raise exception 'Esse jogador não estava escalado nesta partida.';
  end if;

  insert into public.round_votes (round_id, type, voter_id, player_id)
  values (p_round_id, p_type, me, p_player_id)
  on conflict (round_id, type, voter_id)
  do update set player_id = excluded.player_id, created_at = now();
end;
$$;

/* Desfaz o próprio voto, enquanto a urna estiver aberta. */
create or replace function public.clear_vote(p_round_id uuid, p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid;
  round_row public.rounds%rowtype;
begin
  select id into me from public.players where user_id = auth.uid();
  if me is null then
    return;
  end if;

  select * into round_row from public.rounds where id = p_round_id;
  if round_row.awards_settled_at is not null
     or (round_row.closed_at is not null
         and now() > round_row.closed_at + interval '16 hours') then
    raise exception 'A votação desta partida já foi encerrada.';
  end if;

  delete from public.round_votes
  where round_id = p_round_id and type = p_type and voter_id = me;
end;
$$;

create or replace function public.admin_set_password(p_player_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_user uuid;
begin
  if not public.is_admin() then
    raise exception 'Somente administradores podem redefinir a senha de outro jogador.';
  end if;

  if length(coalesce(p_password, '')) < 6 then
    raise exception 'A senha precisa ter pelo menos 6 caracteres.';
  end if;

  select user_id into target_user from public.players where id = p_player_id;

  if target_user is null then
    raise exception 'Este jogador ainda não criou acesso, então não há senha a redefinir.';
  end if;

  update auth.users
     set encrypted_password = crypt(p_password, gen_salt('bf'))
   where id = target_user;

  -- A senha padrão é conhecida de quem a entregou, então ela serve para entrar
  -- uma vez e nada mais: na próxima entrada o aplicativo exige a troca.
  update public.players set must_change_password = true where id = p_player_id;
end;
$$;

revoke all on function public.admin_set_password(uuid, text) from public;
grant execute on function public.admin_set_password(uuid, text) to authenticated;

-- O jogador comum pode ajustar apenas a própria foto e o próprio nome.
create or replace function public.players_guard_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `auth.uid()` nulo significa que a alteração veio de um contexto confiável
  -- (trigger de cadastro, service_role, SQL Editor) e não de um jogador logado.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.username is distinct from old.username
     or new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.player_type is distinct from old.player_type
     or new.position is distinct from old.position
     or new.dominant_foot is distinct from old.dominant_foot
     or new.level is distinct from old.level
     or new.user_id is distinct from old.user_id then
    raise exception 'Somente administradores podem alterar estes dados do jogador.';
  end if;

  -- `must_change_password` fica de fora de propósito: é o próprio jogador que
  -- desliga a marca ao trocar a senha. Desligá-la sem trocar não dá privilégio
  -- nenhum — só deixa a pessoa com a senha padrão que ela já conhecia.

  return new;
end;
$$;

drop trigger if exists players_guard_self_update on public.players;
create trigger players_guard_self_update
before update on public.players
for each row execute function public.players_guard_self_update();

-- -------------------------------------------------------------------- RLS --

alter table public.players enable row level security;
alter table public.rounds enable row level security;
alter table public.teams enable row level security;
alter table public.round_players enable row level security;
alter table public.matches enable row level security;
alter table public.match_events enable row level security;
alter table public.round_awards enable row level security;
alter table public.round_votes enable row level security;
alter table public.patota_settings enable row level security;

-- Leitura liberada para qualquer jogador autenticado; escrita só para admins.
do $$
declare
  target text;
begin
  foreach target in array array[
    'players', 'rounds', 'teams', 'round_players', 'matches', 'match_events',
    'round_awards', 'round_votes', 'patota_settings'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', target || '_read', target);
    execute format('drop policy if exists %I on public.%I', target || '_write', target);

    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      target || '_read', target
    );
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.is_admin()) with check (public.is_admin())',
      target || '_write', target
    );
  end loop;
end;
$$;

-- O Supabase já concede estes privilégios por padrão; repetimos para que o
-- schema funcione mesmo em um banco Postgres criado do zero.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;

-- Exceção: cada jogador pode atualizar a própria linha (foto e nome).
drop policy if exists players_update_self on public.players;
create policy players_update_self on public.players
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ---------------------------------------------------------------- storage --

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- A foto é enviada em `<id do jogador>/<momento>.jpg`, e é a primeira pasta do
-- caminho que diz de quem ela é. Escrever fora da própria pasta é o que esta
-- função recusa: sem ela, qualquer pessoa da patota podia trocar ou apagar a
-- foto de qualquer outra. O administrador continua podendo tudo, para limpar
-- o que precisar.
create or replace function public.owns_avatar(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.players
     where user_id = auth.uid()
       and id::text = split_part(coalesce(p_path, ''), '/', 1)
  );
$$;

revoke all on function public.owns_avatar(text) from public;
grant execute on function public.owns_avatar(text) to authenticated;

-- A leitura é aberta de propósito: o bucket é público e as fotos aparecem em
-- listas, cartões e nas imagens geradas para o WhatsApp.
drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
for select using (bucket_id = 'avatars');

drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'avatars' and public.owns_avatar(name));

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects
for update to authenticated
using (bucket_id = 'avatars' and public.owns_avatar(name))
with check (bucket_id = 'avatars' and public.owns_avatar(name));

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects
for delete to authenticated
using (bucket_id = 'avatars' and public.owns_avatar(name));

-- ------------------------------------------------------- primeiro usuário --

-- Não há nada a semear: a primeira pessoa que criar acesso no aplicativo vira
-- a administradora da patota, com o nome de usuário que ela escolher. Todas as
-- contas seguintes se cadastram sozinhas e entram como jogador comum.
--
-- Enquanto ninguém tiver criado a primeira conta, a porta fica aberta — quem
-- chegar primeiro vira dono da patota. Crie a sua logo depois de rodar este
-- arquivo e, em Administração, defina o código da patota.

-- --------------------------------------------------- renomeação de rodadas --

-- A patota passou a chamar cada encontro de "partida", e os títulos criados
-- automaticamente antes disso diziam "Rodada de 10/07". Alinhamos o acervo com
-- o vocabulário novo; títulos escritos à mão pelo administrador não são
-- tocados. Reaplicar não faz nada, porque a condição deixa de casar.
update public.rounds
   set title = 'Partida de ' || substring(title from 12)
 where title like 'Rodada de %';
