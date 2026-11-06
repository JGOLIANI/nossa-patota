# Nossa Patota

PWA para organizar a pelada semanal de futsal: presença com lista de espera, sorteio de times, placar ao vivo, votação de prêmios e estatísticas. React 19 + Vite + Tailwind v4 + Supabase; publicado no GitHub Pages. Sem as variáveis do Supabase, roda em modo demonstração (`localStorage`).

Se `graphify-out/` existir, consulte o grafo (`graphify query "..."`) antes de sair lendo arquivos. Depois de mudar código, `graphify update .`.

## Camadas

```
pages · components  →  store  →  data  →  domain  →  types.ts
lib/ = utilitários usados por todas as camadas
```

Dependências só apontam para a direita.

- Telas leem estado e chamam ações só por `useApp()` (`src/store/useApp.ts`).
- Telas não importam `data/*`. No máximo `import type` de `data/types` (ex.: `PlayerFormModal.tsx`). O `resetDemoData` em `AdminPage.tsx` é um desvio conhecido; não repita.
- `domain/` é puro: não importa React, `lib/`, `localStorage` nem rede (`rankings.ts` → `lib/format` é desvio conhecido).

## Padrões obrigatórios

- **Persistência passa pela interface `Backend`** (`src/data/types.ts`). Método novo = implementar em `supabaseBackend.ts` **e** em `localBackend.ts`.
- **Ação de negócio nova** entra em `AppActions` (`src/store/context.ts`) e é implementada em `AppProvider.tsx` dentro de `run()`, que liga o carregando e recarrega o acervo. Ex.: `closeVoting`, `generateTeamsForRound`.
- **Regra que precisa ser confiável** (quem pode votar, vagas, permissões) mora numa função SQL `security definer` em `supabase/schema.sql` e é espelhada no `localBackend`. Ex.: `respond_attendance` ↔ `localBackend.respondAttendance`; `cast_vote` ↔ `localBackend.castVote`.
- **Funções de domínio** recebem o `Snapshot` como 1º parâmetro e a data atual como parâmetro, sem chamar `new Date()` por dentro. Ex.: `canVote(snapshot, roundId, playerId)`, `votingState(round, now)`, `missingRoundDates(settings, rounds, todayISO())`.
- **Derivado não se grava**: placar sai dos gols (`scoreFromEvents`), estatísticas e rankings saem do `Snapshot`.
- **Toda tela começa com `<Page>`** (`src/components/Page.tsx`). Ex.: `RoundsPage.tsx`. Exceção: `LoginPage`.

## Escrita

- Só named exports; nada de `export default`.
- Identificadores em inglês; valores de domínio em português, iguais aos `check` do SQL: `RoundStatus = 'rascunho' | 'em_andamento' | 'encerrada'` (`src/types.ts`).
- Unions de string em vez de `enum`.
- Comentários em português explicando o *porquê*, não o quê (ver JSDoc de `Backend` e `AppActions`).
- SQL sempre idempotente: `create table if not exists`, `add column if not exists`, `create or replace function`.

## Testes

- `*.test.ts` ao lado do código: `domain/awards.ts` + `domain/awards.test.ts`.
- `it` é a frase da regra em português: `it('deixa o craque sair do time derrotado')`.
- Cenários com os builders de `src/domain/testing.ts` (`makePlayer`, `makeRound`, `baseScenario()`…).
- Regra nova de domínio vem com teste.
- Antes de commitar: `npm test`, `npm run lint` e `npm run build` precisam passar.

## Commits

- Assunto em português, começando por verbo na 3ª pessoa do presente, descrevendo o efeito para o usuário, até 72 caracteres, sem `feat:`/`fix:`.
  Ex.: `Separa partidas em aberto das realizadas na lista`, `Deixa remarcar a partida enquanto os times não saíram`.
- Corpo em prosa: primeiro o problema, depois a solução e o porquê.

## Glossário (código → tela)

| Código | Na tela |
|---|---|
| `Round` / `rounds` | Partida (o encontro da semana) |
| `Match` / `matches` | Placar daquela partida |
| `RoundPlayer` / `round_players` | Presença / escalação |
| `Attendance 'espera'` | Lista de espera |
| `jogador_rodada` | Craque da Partida |
| `pior_jogador` | Bagre da Rodada |
| `goleiro_menos_vazado` | Paredão |
| `awards_settled_at` | Apuração da votação |

Rótulos oficiais em `AWARD_LABELS` (`src/types.ts`).

Glossário completo (todos os valores de domínio, rotas, ações e as armadilhas de nome, como `/partidas/:id` ser o placar e não a partida) em [`docs/glossario.md`](docs/glossario.md).
