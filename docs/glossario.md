# Glossário: nomes do código × nomes da tela

O produto mudou de vocabulário mais rápido que o banco. `pior_jogador` virou
"Bola Murcha" e depois "Bagre da Rodada"; a "rodada" passou a se chamar
"partida" na tela. Renomear tabelas e valores gravados exigiria migrar o
histórico de todas as patotas para ganhar só legibilidade — então os nomes do
banco ficam, e este arquivo faz a ponte.

Regras que valem para tudo abaixo:

- **O banco manda nos valores.** Os valores de domínio (`'rascunho'`,
  `'espera'`…) são os mesmos dos `check` em `supabase/schema.sql` e das unions
  em `src/types.ts`. Não traduza nem renomeie.
- **O rótulo da tela mora num lugar só sempre que possível.** Os prêmios saem de
  `AWARD_LABELS` / `AWARD_SHORT_LABELS` (`src/types.ts`): trocar o apelido ali
  renomeia o prêmio em todas as telas, imagens e mensagens sem tocar no
  histórico. Os demais rótulos ainda estão escritos direto nas telas — as
  colunas "Onde aparece" dizem onde.

## As armadilhas

Se for ler só uma seção, leia esta.

1. **"Partida" na tela quase sempre é `Round`, não `Match`.** O encontro da
   semana é o `Round` (tabela `rounds`); o `Match` é o placar dele. Como hoje
   cada rodada tem uma única partida, a tela trata os dois como uma coisa só:
   o botão "Encerrar partida" do placar ao vivo chama `closeRound`, e a tela do
   placar se chama "Partida 1" (`match.sequence`). As rotas seguem o código,
   não a tela: a aba **Partidas** abre `/rodadas`, e `/partidas/:matchId` é o
   placar ao vivo.
2. **`goleiro_menos_vazado` são duas coisas.** Como `AwardType`, é o prêmio
   votado **Paredão**. Como chave de ranking (`domain/rankings.ts`), é a lista
   estatística **Goleiro menos vazado**, ordenada pela média de gols sofridos.
   Um pode ganhar o Paredão sem liderar o ranking, e vice-versa.
3. **`melhor_jogador` não é o Craque.** É o ranking "Melhor jogador", uma nota
   geral calculada pelo desempenho. O Craque da Partida é o prêmio
   `jogador_rodada`, decidido por voto (70%) e estatística (30%).
4. **`position` existe em dois lugares.** `Player.position` é a posição do
   cadastro; `RoundPlayer.position` é onde ele realmente jogou naquela rodada
   (`null` = a do cadastro). Gols sofridos vão para quem estava no gol na
   rodada, não para quem é goleiro no cadastro.
5. **O mesmo status tem rótulos diferentes conforme a tela.** `'rascunho'`
   aparece como "Rascunho" na lista e no Início, mas como "Aberta" no detalhe;
   `'em_andamento'` aparece como "Em andamento" no Início e "Ao vivo" no resto.
   Está registrado aqui; unificar é outra tarefa.
6. **Prêmio gravado se chama `round_awards` no banco**, mas `awards` no
   `Snapshot` e `Award` no tipo.

## Entidades

| Código (tipo · tabela) | Na tela | O que é, para quem joga |
|---|---|---|
| `Player` · `players` | Jogador; a lista é o **Elenco** | Cada pessoa da patota, com ou sem login. |
| `Round` · `rounds` | **Partida** | O encontro da semana: dia, hora, quadra, vagas e quem vai. |
| `Match` · `matches` | **Placar**; a tela se chama "Partida N" | O jogo disputado naquele encontro, com o placar ao vivo. Hoje, um por rodada. |
| `Team` · `teams` | Time (Time Preto, Time Branco…) | O colete de cada lado. Preto e branco primeiro (`TEAM_PRESETS`). |
| `RoundPlayer` · `round_players` | **Presença** / escalação | A resposta de um jogador ao convite e, depois do sorteio, em que time ele caiu. |
| `MatchEvent` · `match_events` | Gol | Um gol no placar ao vivo, com autor e assistência. |
| `Award` · `round_awards` | Prêmio / **Premiações** | O resultado oficial da votação, depois da apuração. |
| `RoundVote` · `round_votes` | Voto | O voto de um jogador num prêmio. Votar de novo troca o voto. |
| `PatotaSettings` · `patota_settings` | **Agenda da patota** | Dia fixo, horário, local e vagas de onde as próximas partidas nascem sozinhas. |
| `Snapshot` | — (no código: "acervo") | Tudo o que o app carregou do backend de uma vez. Não aparece na tela. |

## Valores de domínio

Todas as unions de `src/types.ts` (e as de domínio que aparecem na tela).

### `Role` — permissão

| Valor | Na tela | O que é |
|---|---|---|
| `'admin'` | Admin / administrador | Cria e edita partidas, sorteia times, encerra votação, gerencia o elenco. |
| `'jogador'` | Jogador | Confirma presença, vota e vê tudo. |

Onde aparece: seletor em `AdminPage` (Administração → Contas ativas).

### `PlayerType` — tipo de jogador

| Valor | Na tela | O que é |
|---|---|---|
| `'mensalista'` | Mensalista | Paga o mês e joga toda semana. |
| `'visitante'` | Visitante | Aparece de vez em quando, a convite. |

Onde aparece: cadastro (`LoginPage`), `PlayerFormModal`, filtros do Elenco, perfil.

### `PlayerPosition` — posição

| Valor | Na tela | O que é |
|---|---|---|
| `'goleiro'` | Goleiro | Joga no gol. |
| `'linha'` | Linha / Jogador de linha | Joga na linha. |

Vale para `Player.position` (cadastro) e `RoundPlayer.position` (naquela rodada) — ver armadilha 4.

### `DominantFoot` — perna dominante

| Valor | No formulário | No perfil |
|---|---|---|
| `'direita'` | Direita | Destro |
| `'esquerda'` | Esquerda | Canhoto |
| `'ambidestro'` | Ambidestro | Ambidestro |

O perfil (`PlayerDetailPage`, constante `FOOT`) usa adjetivo; os formulários usam o lado.

### `PlayerStatus` — situação

| Valor | Na tela | O que é |
|---|---|---|
| `'ativo'` | Ativo | Aparece no Elenco e é convidado para as partidas. |
| `'inativo'` | Inativo | Afastado. Some das listas, mas o histórico fica. Preferível a remover. |

### `RoundStatus` — situação da partida (`Round`)

| Valor | Na tela | O que é |
|---|---|---|
| `'rascunho'` | Rascunho (lista, Início) · Aberta (detalhe) | Marcada, recebendo presenças; times ainda não saíram. Só aqui dá para remarcar. |
| `'em_andamento'` | Ao vivo · Em andamento (Início) | Times sorteados, bola rolando. |
| `'encerrada'` | Encerrada | Jogo acabou; abre a votação dos prêmios por 16 h. |

### `MatchStatus` — situação do placar (`Match`)

| Valor | Na tela | O que é |
|---|---|---|
| `'em_andamento'` | Ao vivo · "Registrar gols" na lista | Placar aberto para lançar gols. |
| `'encerrada'` | Encerrada · "Encerrado" na lista | Placar fechado. Ainda dá para corrigir um gol ou reabrir. |

### `Attendance` — presença

| Valor | Na tela | O que é |
|---|---|---|
| `'confirmado'` | Confirmados · "Sua presença está confirmada" | Vai jogar e tem vaga. |
| `'espera'` | **Lista de espera** · "Você é o Nº da lista de espera" | Quer jogar, mas as vagas acabaram. Sobe sozinho quando alguém sai, pela ordem de `responded_at`. |
| `'fora'` | Não vão · "Não vou poder ir" | Avisou que não vai. |

### `AwardType` — prêmios votados

| Valor | `AWARD_LABELS` | `AWARD_SHORT_LABELS` | O que é |
|---|---|---|---|
| `'jogador_rodada'` | **Craque da Partida** | Craque | Quem jogou mais naquele dia. |
| `'pior_jogador'` | **Bagre da Rodada** (antes "Bola Murcha") | Bagre | O prêmio da zoeira: quem passou o jogo pedindo para sair. |
| `'goleiro_menos_vazado'` | **Paredão** | Paredão | Quem fechou o gol. Ver armadilha 2. |

### `VotingState` — situação da votação (`domain/awards.ts`)

| Valor | Na tela | O que é |
|---|---|---|
| `'nao-comecou'` | "A votação ainda não abriu" | A partida não foi encerrada. |
| `'aberta'` | Votação aberta · encerra em X | Até 16 h depois do encerramento (`VOTING_WINDOW_HOURS`). |
| `'encerrada'` | Votação encerrada | Prazo vencido ou apurada antes por um admin. |

### `MatchResult` — resultado no histórico (`domain/stats.ts`)

| Valor | Na tela |
|---|---|
| `'V'` | Vitória |
| `'E'` | Empate |
| `'D'` | Derrota |

## Campos e constantes com nome que não entrega o sentido

| Código | Na tela | O que é |
|---|---|---|
| `Round.awards_settled_at` | **Apuração da votação** | Quando os prêmios foram gravados de vez. Distingue "não apurei" de "apurei e ninguém se destacou". |
| `Round.closed_at` | — | Quando a partida foi encerrada. É daqui que correm as 16 h de votação. |
| `Round.max_players` / `PatotaSettings.max_players` | Vagas | Quantos confirmados cabem. `0` = sem limite. |
| `Round.title` (`roundTitle`) | Título da partida ("Partida de 04/09") | Derivado da data; muda ao remarcar. |
| `RoundPlayer.responded_at` | Ordem na lista de espera | Quem respondeu primeiro sobe primeiro. |
| `RoundPlayer.team_id` | Time em que caiu | `null` até o sorteio. |
| `Match.sequence` | "Partida 1" | Número do jogo dentro da rodada. |
| `Match.score_a` / `score_b` | Placar | Gols do time A e do B, recalculados a partir dos gols lançados. |
| `MatchEvent.scorer_id` | Autor do gol | No gol contra, quem marcou contra o próprio time. |
| `MatchEvent.assist_id` | "Assistência de …" | Quem deu o passe. |
| `MatchEvent.own_goal` | "(contra)" | Gol contra. `team_id` é o time **beneficiado**. |
| `Player.level` | Nível (1 a 5) | Nota dada pelo admin, usada no sorteio equilibrado. |
| `Player.must_change_password` | Troca de senha obrigatória | Entrou com a senha padrão e precisa trocar antes de usar. |
| `DEFAULT_PASSWORD` | Senha provisória (`patota123`) | A que o admin dita quando alguém esquece a sua. |
| `PatotaSettings.join_code` | **Código da patota** | O que o jogador digita para se cadastrar. Vazio = cadastro aberto. |
| `PatotaSettings.weeks_ahead` | Semanas à frente | Quantas partidas futuras a agenda mantém criadas. |
| `PatotaSettings.weekday` | Dia da semana | `0` = domingo … `6` = sábado (`WEEKDAYS`). |
| `VOTE_WEIGHT` / `STAT_WEIGHT` | — | Peso do voto (0,7) e da estatística (0,3) na apuração. |

## Ações (`AppActions`) → botão na tela

| Ação | Botão / tela |
|---|---|
| `respond(…, 'confirmado')` | Confirmar presença · Entrar na lista de espera |
| `respond(…, 'fora')` | Não vou poder ir · Sair da lista |
| `setAttendance` | Ajuste manual do admin na aba Presença |
| `generateTeamsForRound` | **Sortear times** |
| `setManualTeams` | Prefiro montar na mão |
| `setRoundPosition` | Trocar goleiro/linha na aba Times |
| `closeRound` | **Encerrar partida** (no detalhe e no placar ao vivo) |
| `reopenMatch` | Reabrir partida |
| `addGoal` / `editGoal` / `removeEvent` | Gol do … · Corrigir gol · Remover gol |
| `castVote` / `clearVote` | Votar / desfazer voto na aba Prêmios |
| `closeVoting` | **Encerrar votação agora** (apura antes do prazo) |
| `createRound` | Partida avulsa (fora do dia fixo) |
| `updateRound` | Editar partida (lápis, só em rascunho) |
| `deleteRound` | Excluir partida |
| `updateSettings` | Agenda da patota |

## Rotas → tela

| Rota | Tela | Componente |
|---|---|---|
| `/` | Início | `HomePage` |
| `/rodadas` | **Partidas** | `RoundsPage` |
| `/rodadas/nova` | Partida avulsa | `RoundNewPage` |
| `/rodadas/:roundId` | Detalhe da partida (Presença · Times · Prêmios) | `RoundDetailPage` |
| `/partidas/:matchId` | **Placar ao vivo** ("Partida N") | `LiveMatchPage` |
| `/jogadores` | **Elenco** | `PlayersPage` |
| `/jogadores/:playerId` | Perfil do jogador | `PlayerDetailPage` |
| `/rankings` | Rankings | `RankingsPage` |
| `/perfil` | Meu perfil | `ProfilePage` |
| `/admin` | Administração | `AdminPage` |
| `/admin/agenda` | Agenda da patota | `SettingsPage` |
| `/entrar` | Entrar / criar acesso | `LoginPage` |

## Rankings (`domain/rankings.ts`)

| Chave | Na tela | O que mede |
|---|---|---|
| `artilheiro` | Artilharia | Gols marcados |
| `assistencias` | Assistências | Passes para gol |
| `participacoes` | Participações em gols | Gols + assistências |
| `melhor_jogador` | Melhor jogador | Nota geral pelo desempenho (não é o Craque — armadilha 3) |
| `vitorias` | Vitórias | Partidas vencidas |
| `aproveitamento` | Aproveitamento | % dos pontos possíveis, com mínimo de partidas |
| `goleiro_menos_vazado` | Goleiro menos vazado | Média de gols sofridos no gol (não é o Paredão — armadilha 2) |
