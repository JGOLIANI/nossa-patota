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

-- 2. Sem código definido, qualquer um se cadastra sozinho — e o jogador nasce
--    da ficha que ele mesmo preencheu, como jogador comum.
insert into auth.users (id, email, raw_user_meta_data)
values (
  '44444444-4444-4444-4444-444444444444',
  'ana.paula@patota.local',
  '{"full_name":"Ana Paula","player_type":"visitante","position":"goleiro","dominant_foot":"esquerda"}'::jsonb
);

do $$
declare target public.players%rowtype;
begin
  select * into target from public.players where username = 'ana.paula';
  if target.id is null then
    raise exception 'FALHOU: o cadastro próprio não criou o jogador';
  end if;
  if target.role <> 'jogador' then
    raise exception 'FALHOU: quem se cadastra sozinho não deveria ser admin (role=%)', target.role;
  end if;
  if target.full_name <> 'Ana Paula' or target.position <> 'goleiro'
     or target.dominant_foot <> 'esquerda' or target.player_type <> 'visitante' then
    raise exception 'FALHOU: o formulário de cadastro não chegou à ficha';
  end if;
  if target.level <> 3 then
    raise exception 'FALHOU: quem se cadastra não define o próprio nível (level=%)', target.level;
  end if;
  raise notice 'OK 2 — o jogador se cadastra sozinho, como jogador comum';
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
  -- A conta veio sem formulário: a ficha que o administrador preencheu fica
  -- como estava, em vez de ser sobrescrita por padrões.
  if (select full_name from public.players where username = 'zeca') <> 'Zeca da Bola' then
    raise exception 'FALHOU: o vínculo da conta apagou o cadastro feito pelo administrador';
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

-- 15. Com código definido, o cadastro sem o código é recusado.
update public.patota_settings set join_code = 'PATOTA24' where id = 'default';

do $$
declare blocked boolean := false;
begin
  begin
    insert into auth.users (id, email, raw_user_meta_data)
    values (gen_random_uuid(), 'penetra@patota.local', '{"full_name":"Penetra"}'::jsonb);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FALHOU: cadastro passou sem o código da patota'; end if;
  if exists (select 1 from public.players where username = 'penetra') then
    raise exception 'FALHOU: a ficha do cadastro recusado sobrou no banco';
  end if;
  raise notice 'OK 15 — sem o código da patota o cadastro é recusado';
end $$;

-- 16. Com o código certo, entra.
insert into auth.users (id, email, raw_user_meta_data)
values (
  '55555555-5555-5555-5555-555555555555',
  'bia@patota.local',
  '{"full_name":"Bia Nunes","join_code":"PATOTA24"}'::jsonb
);

do $$
begin
  if not exists (select 1 from public.players where username = 'bia' and role = 'jogador') then
    raise exception 'FALHOU: o código certo não deixou o jogador entrar';
  end if;
  raise notice 'OK 16 — com o código certo o cadastro é aceito';
end $$;

-- 17. Senha provisória: o administrador redefine a de outro jogador, o
--     jogador comum não redefine a de ninguém.
do $$
declare
  v_player uuid;
  v_user uuid;
  blocked boolean := false;
begin
  select id, user_id into v_player, v_user from public.players where username = 'bia';

  -- O chico é o jogador comum que sobrou: o zeca foi promovido no teste 9.
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
  begin
    perform public.admin_set_password(v_player, 'senhanova');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FALHOU: jogador comum redefiniu a senha de outro'; end if;

  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  perform public.admin_set_password(v_player, 'senhanova');

  if (select encrypted_password from auth.users where id = v_user) is null then
    raise exception 'FALHOU: o administrador não gravou a senha provisória';
  end if;
  if (select encrypted_password from auth.users where id = v_user)
     <> crypt('senhanova', (select encrypted_password from auth.users where id = v_user)) then
    raise exception 'FALHOU: a senha gravada não confere';
  end if;
  if not (select must_change_password from public.players where id = v_player) then
    raise exception 'FALHOU: a senha redefinida não exigiu troca na próxima entrada';
  end if;

  blocked := false;
  begin
    perform public.admin_set_password(v_player, 'curta');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FALHOU: aceitou senha com menos de 6 caracteres'; end if;

  raise notice 'OK 17 — só o administrador redefine a senha, e com no mínimo 6 caracteres';
end $$;

-- 18. A marca de troca obrigatória é do próprio jogador desligar, ao escolher
--     uma senha nova. O resto da ficha continua fechado para ele.
do $$
declare
  v_player uuid;
  blocked boolean := false;
begin
  select id into v_player from public.players where username = 'bia';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub',
                     (select user_id::text from public.players where id = v_player), true);

  update public.players set must_change_password = false where id = v_player;
  if (select must_change_password from public.players where id = v_player) then
    raise exception 'FALHOU: o jogador não conseguiu desligar a marca ao trocar a senha';
  end if;

  begin
    update public.players set level = 5 where id = v_player;
  exception when others then blocked := true;
  end;
  reset role;
  if not blocked then raise exception 'FALHOU: o jogador alterou o próprio nível'; end if;

  raise notice 'OK 18 — o jogador desliga a marca de troca, mas nada além dela';
end $$;
