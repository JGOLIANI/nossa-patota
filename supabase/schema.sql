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
  created_at timestamptz not null default now()
);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  title text not null default 'Rodada',
  team_count integer not null default 2 check (team_count between 1 and 8),
  status text not null default 'rascunho'
    check (status in ('rascunho', 'em_andamento', 'encerrada')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  position integer not null default 0,
  name text not null,
  color text not null default '#22c55e',
  unique (round_id, position)
);

create table if not exists public.round_players (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  unique (round_id, player_id)
);

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

-- Vincula a conta recém-criada ao jogador de mesmo nome de usuário.
--
-- A primeira conta do sistema é a única que nasce administradora — e ela pode
-- se cadastrar livremente, já que ainda não existe ninguém para autorizá-la.
-- Da segunda em diante, só quem foi cadastrado por um administrador consegue
-- criar acesso, e sempre como jogador comum: virar administrador depende de
-- uma promoção explícita feita por outro administrador.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted text := lower(split_part(new.email, '@', 1));
  target public.players%rowtype;
  is_first boolean;
begin
  select not exists (select 1 from public.players where user_id is not null)
    into is_first;

  select * into target from public.players where username = wanted;

  if is_first then
    if target.id is null then
      insert into public.players (user_id, username, full_name, role)
      values (new.id, wanted, initcap(replace(wanted, '.', ' ')), 'admin');
    else
      update public.players set user_id = new.id, role = 'admin' where id = target.id;
    end if;
    return new;
  end if;

  if target.id is null then
    raise exception
      'O usuário "%" não está cadastrado na patota. Peça ao administrador para cadastrá-lo.',
      wanted;
  end if;

  if target.user_id is not null and target.user_id <> new.id then
    raise exception 'O usuário "%" já possui acesso criado.', wanted;
  end if;

  -- Nunca administrador no cadastro: a promoção é sempre um ato de um admin.
  update public.players set user_id = new.id, role = 'jogador' where id = target.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

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

-- Leitura liberada para qualquer jogador autenticado; escrita só para admins.
do $$
declare
  target text;
begin
  foreach target in array array[
    'players', 'rounds', 'teams', 'round_players', 'matches', 'match_events', 'round_awards'
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

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
for select using (bucket_id = 'avatars');

drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects
for insert to authenticated with check (bucket_id = 'avatars');

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects
for update to authenticated using (bucket_id = 'avatars');

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects
for delete to authenticated using (bucket_id = 'avatars');

-- ------------------------------------------------------- primeiro usuário --

-- Não há nada a semear: a primeira pessoa que criar acesso no aplicativo vira
-- a administradora da patota, com o nome de usuário que ela escolher. Todas as
-- contas seguintes precisam ter sido cadastradas por ela e entram como
-- jogador comum.
