\set ON_ERROR_STOP on
\set QUIET on

-- 1. A primeira conta do sistema vira administradora, mesmo sem cadastro
--    prévio: é a única forma de a patota começar a existir.
insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'joao@patota.local');

do $$
declare target public.players%rowtype;
begin
  select * into target from public.players where username = 'joao';
  if target.id is null then
    raise exception 'FALHOU: a primeira conta não criou o jogador';
  end if;
  if target.role <> 'admin' then
    raise exception 'FALHOU: a primeira conta não virou administradora (role=%)', target.role;
  end if;
  raise notice 'OK 1 — a primeira conta do sistema vira administradora';
end $$;

-- 2. A partir da segunda, quem não foi cadastrado não consegue criar acesso.
do $$
declare blocked boolean := false;
begin
  begin
    insert into auth.users (id, email) values (gen_random_uuid(), 'estranho@patota.local');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FALHOU: desconhecido conseguiu se cadastrar'; end if;
  raise notice 'OK 2 — cadastro de usuário desconhecido bloqueado';
end $$;

-- 3. Admin autenticado cadastra jogadores e cria rodada.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.players (username, full_name, position) values ('zeca', 'Zeca da Bola', 'linha');
-- Cadastrado deliberadamente como admin, para provar que o cadastro não
-- basta: o vínculo da conta rebaixa para jogador.
insert into public.players (username, full_name, role) values ('chico', 'Chico Esperto', 'admin');
insert into public.rounds (title, date) values ('Rodada teste', current_date);
commit;

do $$
begin
  if (select count(*) from public.rounds) <> 1 then
    raise exception 'FALHOU: admin não criou a rodada';
  end if;
  raise notice 'OK 3 — admin cadastra jogadores e cria rodada';
end $$;

-- 4. Conta seguinte é sempre vinculada como jogador comum.
insert into auth.users (id, email)
values ('22222222-2222-2222-2222-222222222222', 'zeca@patota.local');
insert into auth.users (id, email)
values ('33333333-3333-3333-3333-333333333333', 'chico@patota.local');

do $$
begin
  if (select role from public.players where username = 'zeca') <> 'jogador' then
    raise exception 'FALHOU: conta comum não entrou como jogador';
  end if;
  if (select role from public.players where username = 'chico') <> 'jogador' then
    raise exception 'FALHOU: cadastro marcado como admin virou admin ao criar a conta';
  end if;
  raise notice 'OK 4 — contas seguintes entram sempre como jogador comum';
end $$;

-- 5. Jogador comum NÃO pode criar rodada.
do $$
declare blocked boolean := false;
begin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
    insert into public.rounds (title) values ('Rodada proibida');
  exception when others then blocked := true;
  end;
  reset role;
  if not blocked then raise exception 'FALHOU: jogador comum criou rodada'; end if;
  raise notice 'OK 5 — jogador comum não cria rodada';
end $$;

-- 6. Jogador comum pode trocar a própria foto.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
update public.players set photo_url = 'https://exemplo/zeca.jpg' where username = 'zeca';
commit;

do $$
begin
  if (select photo_url from public.players where username = 'zeca') is null then
    raise exception 'FALHOU: jogador não conseguiu trocar a própria foto';
  end if;
  raise notice 'OK 6 — jogador troca a própria foto';
end $$;

-- 7. Jogador comum NÃO pode se promover a administrador.
do $$
declare blocked boolean := false;
begin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
    update public.players set role = 'admin' where username = 'zeca';
  exception when others then blocked := true;
  end;
  reset role;
  if not blocked then raise exception 'FALHOU: jogador se promoveu a admin'; end if;
  raise notice 'OK 7 — jogador não altera a própria permissão';
end $$;

-- 8. Jogador comum não altera o cadastro de outro jogador.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
update public.players set full_name = 'Invadido' where username = 'joao';
commit;

do $$
begin
  if (select full_name from public.players where username = 'joao') = 'Invadido' then
    raise exception 'FALHOU: jogador alterou o cadastro de outro';
  end if;
  raise notice 'OK 8 — jogador não altera cadastro alheio';
end $$;

-- 9. O administrador consegue promover outra conta.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update public.players set role = 'admin' where username = 'zeca';
commit;

do $$
begin
  if (select role from public.players where username = 'zeca') <> 'admin' then
    raise exception 'FALHOU: administrador não conseguiu promover outra conta';
  end if;
  raise notice 'OK 9 — administrador promove outra conta';
end $$;

-- 10. Todo mundo autenticado enxerga a lista de jogadores e as rodadas.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
begin
  if (select count(*) from public.players) < 3 then
    raise exception 'FALHOU: jogador não enxerga a lista de jogadores';
  end if;
  if (select count(*) from public.rounds) < 1 then
    raise exception 'FALHOU: jogador não enxerga as rodadas';
  end if;
  raise notice 'OK 10 — leitura liberada para jogadores autenticados';
end $$;
commit;

-- 11. Usuário anônimo (sem login) não lê nada.
begin;
set local role anon;
do $$
declare visible integer;
begin
  begin
    select count(*) into visible from public.players;
  exception when insufficient_privilege then
    visible := 0;
  end;
  if visible <> 0 then
    raise exception 'FALHOU: anônimo enxergou jogadores';
  end if;
  raise notice 'OK 11 — anônimo não lê dados da patota';
end $$;
commit;

-- 12. Confirmação de presença: a função do servidor respeita as vagas.
update public.rounds set max_players = 2, status = 'rascunho'
 where title = 'Rodada teste';

do $$
declare v_round uuid;
begin
  select id into v_round from public.rounds where title = 'Rodada teste';

  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  perform public.respond_attendance(v_round, 'confirmado');
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  perform public.respond_attendance(v_round, 'confirmado');
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
  perform public.respond_attendance(v_round, 'confirmado');

  if (select count(*) from public.round_players
       where round_id = v_round and attendance = 'confirmado') <> 2 then
    raise exception 'FALHOU: mais gente confirmada do que vagas';
  end if;
  if (select attendance from public.round_players rp
       join public.players p on p.id = rp.player_id
      where rp.round_id = v_round and p.username = 'chico') <> 'espera' then
    raise exception 'FALHOU: o terceiro não foi para a lista de espera';
  end if;
  raise notice 'OK 12 — ao lotar, a confirmação vai para a lista de espera';
end $$;

-- 13. Quem desiste libera a vaga para o primeiro da espera.
do $$
declare v_round uuid;
begin
  select id into v_round from public.rounds where title = 'Rodada teste';

  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  perform public.respond_attendance(v_round, 'fora');

  if (select attendance from public.round_players rp
       join public.players p on p.id = rp.player_id
      where rp.round_id = v_round and p.username = 'chico') <> 'confirmado' then
    raise exception 'FALHOU: a espera não foi promovida quando abriu vaga';
  end if;
  if (select count(*) from public.round_players
       where round_id = v_round and attendance = 'confirmado') <> 2 then
    raise exception 'FALHOU: a rodada não voltou a ter 2 confirmados';
  end if;
  raise notice 'OK 13 — desistência promove o primeiro da lista de espera';
end $$;

-- 14. Jogador comum não altera a presença de outro jogador na marra.
do $$
declare blocked boolean := false;
begin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
    update public.round_players set attendance = 'fora'
     where player_id = (select id from public.players where username = 'zeca');
    if not found then blocked := true; end if;
  exception when others then blocked := true;
  end;
  reset role;
  if not blocked then raise exception 'FALHOU: jogador alterou a presença de outro'; end if;
  raise notice 'OK 14 — jogador não mexe na presença alheia';
end $$;
