# 0001 — Pastas organizadas por camada

- **Status:** proposta
- **Data:** 14/11/2026

## Contexto

Quase todo o código em `src/` está organizado por camada técnica: telas em
`pages/`, peças de interface em `components/`, ações em `store/`, persistência
em `data/`, regras em `domain/`. Uma funcionalidade nova fica espalhada por
várias dessas pastas.

A exceção é `src/welcome/`, a abertura animada da tela de entrar. Ela tem seu
próprio `index.ts`, um `types.ts` e hooks que só ela usa (`useReducedMotion`,
`useWelcomeTimeline`…).

As duas formas são válidas, mas conviver com as duas sem regra deixa quem chega
sem saber onde criar o próximo arquivo. E há refatorações na fila (dividir o
`RoundDetailPage`, o `ui.tsx` e o `AppProvider`; extrair um hook para o estado
de "salvando") que vão criar arquivos novos: a regra precisa vir antes delas.

Dois fatos pesaram na escolha:

1. **A arquitetura gira em torno de três peças únicas.** Todo o acervo vive num
   `Snapshot` só; toda gravação passa pela interface `Backend`; toda ação de
   negócio está em `AppActions`. Presença, times, placar e votação leem o mesmo
   `Snapshot` e gravam pela mesma interface. Uma funcionalidade não tem dados
   nem ações próprios, então uma pasta por funcionalidade só conseguiria
   repartir telas e componentes: `store/`, `data/` e `domain/` continuariam
   centrais.
2. **`welcome/` não é uma funcionalidade nesse sentido.** Ela só importa React;
   não usa `store/`, `data/`, `domain/`, `lib/` nem `components/`. De fora, só o
   `LoginPage` a usa, e pelo `index.ts`. É um componente grande que se fecha em
   si mesmo, não uma fatia vertical do app.

## Decisão

**Camada por padrão.** Nenhum arquivo muda de lugar por causa desta decisão; ela
vale para o que for criado ou dividido daqui em diante.

1. **Arquivo novo vai para a pasta da camada que corresponde ao seu papel.**
   Tela em `pages/`, peça de interface em `components/`, ação em `store/`,
   persistência em `data/`, regra em `domain/`, utilitário em `lib/`.
2. **Hook de React usado por telas e componentes fica em `components/`.**
   `lib/` continua sem React, porque é usado também por `data/`.
3. **Subpasta dentro da camada, por assunto,** quando um arquivo grande é
   dividido ou quando surgem três ou mais arquivos do mesmo assunto. A subpasta
   tem um `index.ts` que reexporta o que é usado de fora, para que os imports
   existentes não mudem. Ela continua sendo da camada e obedece às mesmas regras
   de import. Exemplos previstos: `components/ui/` (os componentes básicos hoje
   em `ui.tsx`), `components/round/` (as seções do `RoundDetailPage`),
   `store/actions/` (as ações hoje no `AppProvider`).
4. **Exceção: módulo de interface autocontido**, em `src/<nome>/`, como
   `welcome/`. Só vale se as três condições forem verdadeiras:
   - não importa `store/`, `data/`, `domain/`, `pages/` nem `components/`;
   - quem está fora importa só pelo `index.ts`;
   - as peças só fazem sentido juntas.

   Se o módulo passar a precisar de `useApp()` ou de uma regra de domínio, ele
   deixou de ser autocontido: suas peças vão para as camadas.

## Alternativa considerada

**Funcionalidade daqui para frente:** cada funcionalidade nova em
`src/features/<nome>/` com um `index.ts` público, e o código atual migrando aos
poucos, quando fosse tocado.

Foi rejeitada porque:

- pelo fato 1, a pasta da funcionalidade guardaria só telas e componentes, e o
  resto continuaria por camada: seria uma terceira forma, não uma substituição;
- a migração "aos poucos" deixaria as duas formas convivendo por tempo
  indeterminado, que é justamente o problema que este ADR resolve;
- mudaria os caminhos que o `CLAUDE.md`, o `CONTRIBUTING.md` e o
  [glossário](../glossario.md) citam.

Vale reabrir a decisão se o app ganhar uma área com dados e ações próprios, fora
do `Snapshot` e do `Backend` (por exemplo, um módulo de pagamentos com serviço
separado).

## Consequências

- Uma funcionalidade continua espalhada. A votação, por exemplo, está em
  `domain/awards.ts`, `components/AwardsCard.tsx`, `pages/RoundDetailPage.tsx`,
  `castVote` no `Backend` e `cast_vote` no `supabase/schema.sql`. O glossário e
  o grafo do graphify (`graphify query "..."`) ajudam a achar as partes.
- As regras de import podem ser conferidas por pasta (`no-restricted-imports` no
  ESLint) e alcançam as subpastas sem configuração extra. A exceção de
  `welcome/` pode ganhar uma regra própria: de fora, só pelo `index.ts`.
- As refatorações em fila já têm endereço: seções do `RoundDetailPage` em
  `components/round/`, componentes básicos em `components/ui/`, ações em
  `store/actions/`, hook de "salvando" em `components/useAsyncAction.ts`.
