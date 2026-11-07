# Contribuindo com o Nossa Patota

Este guia é para quem vai mexer no código. O que o aplicativo faz para quem
joga está no [README](README.md); os nomes do código que não batem com os da
tela estão no [glossário](docs/glossario.md).

## Rodando localmente

Precisa do Node 22 (a versão do CI) e do npm.

```bash
npm ci
npm run dev
```

O Vite mostra o endereço no terminal (normalmente `http://localhost:5173`).

Sem arquivo `.env`, o aplicativo abre em **modo demonstração**: os dados são
fictícios e ficam só no `localStorage` do navegador. Para mexer em tela, em
regra de negócio ou em quase tudo o mais, isso basta: não é preciso criar
projeto no Supabase. A tela de administração tem um botão para restaurar os
dados fictícios quando eles ficarem bagunçados.

Para usar um Supabase de verdade, rode:

```bash
npm run setup
```

O script (`scripts/setup.mjs`) pede a URL e a chave `anon` do projeto, grava o
`.env` e confere se o schema já foi aplicado. O `.env` vale só para a sua
máquina: ele fica fora do Git e não chega ao site publicado. Para voltar ao
modo demonstração, `npm run setup -- --demo`.

## Antes de abrir o PR

Rode os três comandos que o CI roda (`.github/workflows/ci.yml`):

```bash
npm run lint
npm test
npm run build
```

Se algum falhar aqui, vai falhar no PR também. Mudou o banco? Rode também os
testes do banco (ver [Mudanças no banco](#mudanças-no-banco)).

Regra de negócio nova vem com teste. O teste fica ao lado do código
(`src/domain/awards.ts` → `src/domain/awards.test.ts`), o `it` é a frase da
regra em português (`it('recusa o voto em si mesmo')`) e os cenários saem dos
builders de `src/domain/testing.ts` (`makePlayer`, `makeRound`,
`baseScenario()`).

## Branches e pull requests

```
sua branch  ──PR──▶  dev  ──PR do dono──▶  main  ──▶  GitHub Pages
```

1. Atualize a `dev` e crie sua branch a partir dela: `feature/<tema>` para
   código, `doc/<tema>` para documentação. Ex.: `feature/rtk-ai`,
   `doc/glossario`.
2. Abra o PR para a `dev`, nunca para a `main`. O repositório tem um template
   de descrição; preencha o contexto (o problema antes da solução) e marque os
   três comandos acima.
3. O dono do repositório revisa e mescla na `dev`, e de tempos em tempos
   promove a `dev` para a `main`.

A `main` é produção: todo push nela publica o aplicativo no GitHub Pages
(`.github/workflows/deploy.yml`).

## Commits

O assunto:

- em português, começando por verbo na 3ª pessoa do presente ("Separa…",
  "Corrige…", "Deixa…");
- descreve o efeito para quem usa o aplicativo, não o arquivo alterado;
- tem até 72 caracteres;
- não usa prefixos como `feat:` ou `fix:`.

O corpo é prosa: primeiro o problema, depois a solução e o porquê dela.

Dois exemplos do histórico:

```
Separa partidas em aberto das realizadas na lista

A lista de partidas misturava o rascunho da semana que vem com o jogo de
dois meses atrás. [...]

Agora a tela tem dois grupos, "Em aberto" e "Realizadas" [...]
```

```
Deixa remarcar a partida enquanto os times não saíram
```

`git show 4ef8c4b` e `git show 60b6c4e` mostram os dois por inteiro. O título
do PR segue o mesmo padrão.

## Onde colocar cada coisa

O código em `src/` é organizado por camada, e as dependências só apontam para
baixo nesta lista:

| Pasta | O que vai nela |
|---|---|
| `pages/` | Uma tela por arquivo. Toda tela começa com `<Page>` (exceto `LoginPage`) e lê estado e ações só por `useApp()`. |
| `components/` | Peças de interface reaproveitadas pelas telas. Os componentes básicos (`Button`, `Card`…) estão em `ui.tsx`. |
| `store/` | O `AppProvider`, que guarda o acervo da patota e expõe as ações de negócio (`AppActions`). |
| `data/` | A interface `Backend` e suas duas implementações: `supabaseBackend` (produção) e `localBackend` (modo demonstração). |
| `domain/` | Regras puras: sorteio de times, apuração dos prêmios, estatísticas. Sem React, sem navegador, sem rede. |
| `types.ts` | As entidades (`Player`, `Round`, `Match`…) e o `Snapshot` com o acervo inteiro. |
| `lib/` | Utilitários usados por todas as camadas: formatação, mapas, instalação do PWA, imagens. |

`src/welcome/` (a tela de boas-vindas animada) é a exceção: está organizada por
funcionalidade, com seu próprio `index.ts`.

Na prática:

- **Tela nova:** arquivo em `pages/`, rota em `src/App.tsx`. Tela não importa
  nada de `data/`.
- **Regra de cálculo nova:** função em `domain/`, recebendo o `Snapshot` como
  primeiro parâmetro e a data atual como parâmetro (sem `new Date()` por
  dentro, para o teste controlar o relógio). Com teste.
- **Ação nova** (um botão que grava alguma coisa): entra em `AppActions`
  (`src/store/context.ts`) e é implementada em `AppProvider.tsx` dentro de
  `run()`, que liga o carregando e recarrega o acervo.
- **Dado novo para gravar:** método novo na interface `Backend`
  (`src/data/types.ts`), implementado nos **dois** backends.
- **Número derivado** (placar, estatística, ranking): calcula a partir do
  `Snapshot`, não grava no banco.

Mais convenções (named exports, unions de string em vez de `enum`, comentários
explicando o porquê) estão no [CLAUDE.md](CLAUDE.md), que vale para pessoas
tanto quanto para o Claude Code.

## Mudanças no banco

O banco inteiro está em `supabase/schema.sql`. Ele é aplicado colando o arquivo
no SQL Editor do Supabase, e precisa poder rodar de novo sobre um banco que já
existe. Por isso todo SQL é idempotente: `create table if not exists`,
`add column if not exists`, `create or replace function`.

As regras que precisam ser confiáveis (quem pode votar e em quem, vagas e lista
de espera, permissões) moram em funções SQL `security definer`, porque no
navegador seriam só uma sugestão. O modo demonstração não tem servidor, então
as mesmas regras são reimplementadas em `src/data/localBackend.ts`
(`cast_vote` ↔ `castVote`, `respond_attendance` ↔ `respondAttendance`). Mudou
uma regra no SQL? Mude também no `localBackend` e nos testes dos dois lados
(`src/data/localBackend.test.ts` e `supabase/tests/rls_test.sql`).

### Testes do banco

`supabase/tests/rls_test.sql` confere as regras de segurança num Postgres comum;
`local_prelude.sql` cria antes o mínimo do ambiente Supabase (papéis, schemas
`auth` e `storage`). Eles ainda não rodam no CI, então rode na mão quando mexer
no `schema.sql`. Com Docker, sem precisar instalar o `psql`:

```bash
docker run --rm -d --name patota-db -e POSTGRES_PASSWORD=postgres postgres:16
sleep 5   # espera o Postgres subir

cat supabase/tests/local_prelude.sql supabase/schema.sql supabase/tests/rls_test.sql \
  | docker exec -i patota-db psql -U postgres -q -v ON_ERROR_STOP=1

docker stop patota-db
```

A saída mostra uma linha `OK n — …` por regra conferida. Se uma regra quebrar,
aparece `ERROR: FALHOU: …` e o comando para ali. O prelúdio só roda num banco
vazio, então suba um contêiner novo a cada execução (o `--rm` já apaga o
anterior ao parar). No Windows, rode pelo Git Bash.

## Usando o Claude Code

Todos os contribuidores usam o Claude Code. Ele lê o [CLAUDE.md](CLAUDE.md) no
começo de cada sessão, e o repositório traz hooks opcionais para o rtk e o
graphify, que economizam tokens; a instalação está no README, em
[Contribuindo com o Claude Code](README.md#contribuindo-com-o-claude-code).

## Decisões de arquitetura

Ainda não há um registro formal das decisões de arquitetura. Até lá, o porquê
dos padrões acima está nos comentários do código (o JSDoc de `Backend` e de
`AppActions` é um bom começo) e nas mensagens de commit: `git log` vale a
leitura.
