\set ON_ERROR_STOP on
\set QUIET on

-- 1. Primeiro acesso do admin vincula a conta ao jogador "admin".
insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'admin@patota.local');

do $$
begin
  if (select user_id from public.players where username = 'admin')
     <> '11111111-1111-1111-1111-111111111111' then
    raise exception 'FALHOU: signup do admin não vinculou o jogador';
  end if;
  raise notice 'OK 1 — signup vincula a conta ao jogador cadastrado';
end $$;

-- 2. Quem não foi cadastrado pelo administrador não consegue criar acesso.
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

-- 3. Admin autenticado consegue cadastrar jogador e criar rodada.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.players (username, full_name, position)
values ('zeca', 'Zeca da Bola', 'linha');

insert into public.rounds (title, date) values ('Rodada teste', current_date);
commit;

do $$
begin
  if (select count(*) from public.rounds) <> 1 then
    raise exception 'FALHOU: admin não criou a rodada';
  end if;
  raise notice 'OK 3 — admin cadastra jogador e cria rodada';
end $$;

-- 4. Jogador comum cria o próprio acesso.
insert into auth.users (id, email)
values ('22222222-2222-2222-2222-222222222222', 'zeca@patota.local');

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
update public.players set full_name = 'Invadido' where username = 'admin';
commit;

do $$
begin
  if (select full_name from public.players where username = 'admin') = 'Invadido' then
    raise exception 'FALHOU: jogador alterou o cadastro de outro';
  end if;
  raise notice 'OK 8 — jogador não altera cadastro alheio';
end $$;

-- 9. Todo mundo autenticado enxerga a lista de jogadores e as rodadas.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
begin
  if (select count(*) from public.players) < 2 then
    raise exception 'FALHOU: jogador não enxerga a lista de jogadores';
  end if;
  if (select count(*) from public.rounds) < 1 then
    raise exception 'FALHOU: jogador não enxerga as rodadas';
  end if;
  raise notice 'OK 9 — leitura liberada para jogadores autenticados';
end $$;
commit;

-- 10. Usuário anônimo (sem login) não lê nada.
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
  raise notice 'OK 10 — anônimo não lê dados da patota';
end $$;
commit;
