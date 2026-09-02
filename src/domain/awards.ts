import type { AwardType, PlayerPosition, Round, Snapshot } from '../types'
import { STAT_WEIGHT, VOTE_WEIGHT, VOTING_WINDOW_HOURS } from '../types'
import { roundEntries } from './selectors'
import { computeStats, type PlayerStats } from './stats'

export interface RoundAwards {
  /** Craque da Partida. */
  jogador_rodada: string[]
  /** Bagre da Rodada. */
  pior_jogador: string[]
  /** Paredão: o goleiro menos vazado. */
  goleiro_menos_vazado: string[]
}

export const AWARD_TYPES: AwardType[] = [
  'jogador_rodada',
  'goleiro_menos_vazado',
  'pior_jogador',
]

/* ------------------------------------------------------------- a urna ----- */

export type VotingState = 'nao-comecou' | 'aberta' | 'encerrada'

/**
 * Quando a urna fecha: dezesseis horas depois de a partida ser encerrada.
 *
 * O relógio começa a correr no encerramento, e não no horário marcado da
 * rodada, porque é o encerramento que diz que o jogo de fato aconteceu — uma
 * rodada que ninguém abriu não tem o que apurar.
 */
export function votingDeadline(round: Round): Date | null {
  if (!round.closed_at) return null
  const closed = new Date(round.closed_at)
  if (Number.isNaN(closed.getTime())) return null
  return new Date(closed.getTime() + VOTING_WINDOW_HOURS * 3600_000)
}

/**
 * Em que pé está a urna.
 *
 * Fecham a votação duas coisas, e a apuração é quem une as duas: o prazo, que
 * corre sozinho, e o administrador, que pode apurar antes quando todo mundo
 * já votou e o resultado está preso só pelo relógio. Apurar é encerrar — por
 * isso a marca da apuração basta aqui, venha ela de onde vier.
 */
export function votingState(round: Round, now: Date = new Date()): VotingState {
  const deadline = votingDeadline(round)
  if (round.status !== 'encerrada' || !deadline) return 'nao-comecou'
  if (round.awards_settled_at) return 'encerrada'
  return now < deadline ? 'aberta' : 'encerrada'
}

/**
 * Quem tem direito a voto: quem foi escalado em um dos times.
 *
 * Quem estava em quadra é quem viu o jogo. Quem ficou na espera, avisou que
 * não vinha ou nem respondeu não tem como julgar quem jogou bem, e um voto
 * desses só faria peso.
 */
export function canVote(snapshot: Snapshot, roundId: string, playerId: string): boolean {
  return roundEntries(snapshot, roundId).some(
    (entry) => entry.player_id === playerId && Boolean(entry.team_id),
  )
}

/* -------------------------------------------------------- o resultado ----- */

export interface RoundOutcome {
  winner: string | null
  loser: string | null
  /** Verdadeiro quando não houve vencedor nem perdedor. */
  draw: boolean
}

/**
 * Como a rodada terminou.
 *
 * Com uma partida por rodada isso é apenas quem ganhou e quem perdeu. A
 * função também aguenta rodadas antigas com várias partidas, somando pontos
 * no critério 3-1-0; empate na ponta ou na lanterna equivale a empate.
 */
export function roundOutcome(snapshot: Snapshot, roundId: string): RoundOutcome {
  const matches = snapshot.matches.filter(
    (match) => match.round_id === roundId && match.status === 'encerrada',
  )
  if (matches.length === 0) return { winner: null, loser: null, draw: false }

  const points = new Map<string, number>()
  const add = (teamId: string, value: number) =>
    points.set(teamId, (points.get(teamId) ?? 0) + value)

  for (const match of matches) {
    add(match.team_a_id, 0)
    add(match.team_b_id, 0)
    if (match.score_a > match.score_b) add(match.team_a_id, 3)
    else if (match.score_b > match.score_a) add(match.team_b_id, 3)
    else {
      add(match.team_a_id, 1)
      add(match.team_b_id, 1)
    }
  }

  const ranked = [...points.entries()].sort((a, b) => b[1] - a[1])
  if (ranked.length < 2) return { winner: null, loser: null, draw: false }

  const first = ranked[0]
  const last = ranked[ranked.length - 1]
  if (first[1] === last[1]) return { winner: null, loser: null, draw: true }

  const tiedOnTop = ranked[1][1] === first[1]
  const tiedOnBottom = ranked[ranked.length - 2][1] === last[1]

  return {
    winner: tiedOnTop ? null : first[0],
    loser: tiedOnBottom ? null : last[0],
    draw: false,
  }
}

/* ---------------------------------------------------------- candidatos ---- */

/**
 * Memória dos candidatos, por snapshot e por rodada.
 *
 * Montar a lista custa uma passada de `computeStats` sobre o histórico, e a
 * tela dos prêmios pede a mesma lista quatro vezes: uma por prêmio, mais uma
 * para saber quem concorre. Sem esta memória eram quatro passadas por
 * renderização — na patota com anos de acervo, milissegundos de sobra a cada
 * toque. Como a chave é o próprio snapshot, e cada recarga produz um objeto
 * novo, o cache se invalida sozinho e nunca serve dado velho.
 */
const candidateCache = new WeakMap<Snapshot, Map<string, Record<AwardType, PlayerStats[]>>>()

/**
 * Quem disputa cada prêmio.
 *
 * Os dois prêmios de linha são simétricos: o Craque sai de quem venceu e a
 * Bagre da Rodada de quem perdeu. No empate não há de onde separar, então os dois
 * olham a rodada inteira.
 *
 * A posição considerada é a da rodada, não a do cadastro: o goleiro que foi
 * para a linha disputa os prêmios de linha, e quem assumiu o gol disputa o de
 * goleiro menos vazado.
 */
export function awardCandidates(
  snapshot: Snapshot,
  roundId: string,
): Record<AwardType, PlayerStats[]> {
  let byRound = candidateCache.get(snapshot)
  if (!byRound) {
    byRound = new Map()
    candidateCache.set(snapshot, byRound)
  }
  const cached = byRound.get(roundId)
  if (cached) return cached

  const computed = buildCandidates(snapshot, roundId)
  byRound.set(roundId, computed)
  return computed
}

function buildCandidates(
  snapshot: Snapshot,
  roundId: string,
): Record<AwardType, PlayerStats[]> {
  const stats = computeStats(snapshot, { roundId })
  const registered = new Map(snapshot.players.map((player) => [player.id, player.position]))
  const rows = roundEntries(snapshot, roundId).filter((entry) => entry.team_id)

  const teamOf = new Map(rows.map((entry) => [entry.player_id, entry.team_id]))
  const positionOf = new Map<string, PlayerPosition>(
    rows.map((entry) => [
      entry.player_id,
      entry.position ?? registered.get(entry.player_id) ?? 'linha',
    ]),
  )

  const participants = rows
    .map((entry) => stats.get(entry.player_id))
    .filter((entry): entry is PlayerStats => entry !== undefined && entry.played > 0)

  const line = participants.filter((entry) => positionOf.get(entry.playerId) === 'linha')
  const keepers = participants.filter((entry) => positionOf.get(entry.playerId) === 'goleiro')

  const outcome = roundOutcome(snapshot, roundId)
  const fromTeam = (teamId: string | null) =>
    teamId ? line.filter((entry) => teamOf.get(entry.playerId) === teamId) : []

  return {
    jogador_rodada: outcome.draw ? line : fromTeam(outcome.winner),
    pior_jogador: outcome.draw ? line : fromTeam(outcome.loser),
    goleiro_menos_vazado: keepers,
  }
}

/* ------------------------------------------------------------ apuração ---- */

/** A estatística que cada prêmio olha, e se ali maior é melhor. */
const METRIC: Record<AwardType, { value: (stats: PlayerStats) => number; higherIsBetter: boolean }> =
  {
    jogador_rodada: { value: (stats) => stats.participations, higherIsBetter: true },
    pior_jogador: { value: (stats) => stats.participations, higherIsBetter: false },
    goleiro_menos_vazado: { value: (stats) => stats.goalsAgainst, higherIsBetter: false },
  }

export interface AwardTallyEntry {
  playerId: string
  votes: number
  /** Fatia dos votos válidos daquele prêmio, de 0 a 1. */
  voteShare: number
  /** A estatística do prêmio, normalizada de 0 a 1 dentro dos candidatos. */
  statScore: number
  /** `VOTE_WEIGHT × voteShare + STAT_WEIGHT × statScore`. */
  score: number
}

export interface AwardTally {
  entries: AwardTallyEntry[]
  /** Quantos votos válidos foram computados neste prêmio. */
  totalVotes: number
  /** Vencedores: todos os que empataram na maior nota. */
  winners: string[]
}

/**
 * Normalizador de 0 a 1 dentro do grupo. Sem variação, devolve 0,5 para
 * todos — nenhum candidato leva vantagem por estatística, e o voto decide
 * sozinho.
 */
function normalizer(values: number[]): (value: number) => number {
  if (values.length === 0) return () => 0.5
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return () => 0.5
  return (value) => (value - min) / (max - min)
}

/**
 * Apura um prêmio da rodada.
 *
 * A nota de cada candidato mistura as duas coisas que a patota tem: o que o
 * pessoal viu (a fatia de votos que recebeu) e o que ficou registrado (a
 * estatística do prêmio, normalizada entre os candidatos). Quem some da
 * cédula — porque os times mudaram depois da votação, por exemplo — tem o
 * voto descartado, e a fatia dos demais é calculada só sobre o que sobrou.
 *
 * Sem nenhum voto a nota vira só a estatística, que é exatamente o critério
 * antigo. É o que mantém a rodada que ninguém votou com um resultado justo em
 * vez de nenhum.
 */
export function tallyAward(snapshot: Snapshot, roundId: string, type: AwardType): AwardTally {
  const pool = awardCandidates(snapshot, roundId)[type]
  if (pool.length === 0) return { entries: [], totalVotes: 0, winners: [] }

  const eligible = new Set(pool.map((entry) => entry.playerId))
  const counted = snapshot.votes.filter(
    (vote) =>
      vote.round_id === roundId && vote.type === type && eligible.has(vote.player_id),
  )

  const votesFor = new Map<string, number>()
  for (const vote of counted) {
    votesFor.set(vote.player_id, (votesFor.get(vote.player_id) ?? 0) + 1)
  }

  const metric = METRIC[type]
  const scale = normalizer(pool.map(metric.value))

  const entries: AwardTallyEntry[] = pool.map((stats) => {
    const votes = votesFor.get(stats.playerId) ?? 0
    const voteShare = counted.length > 0 ? votes / counted.length : 0
    const normalized = scale(metric.value(stats))
    const statScore = metric.higherIsBetter ? normalized : 1 - normalized
    return {
      playerId: stats.playerId,
      votes,
      voteShare,
      statScore,
      score: VOTE_WEIGHT * voteShare + STAT_WEIGHT * statScore,
    }
  })

  entries.sort((a, b) => b.score - a.score || b.votes - a.votes)

  /*
   * Sem voto nenhum, e com todo mundo zerado na estatística, ninguém se
   * destacou — nem para bem nem para mal. Sem esta guarda a Bagre da Rodada ia
   * para o time perdedor inteiro numa derrota sem gols, e um prêmio que cabe
   * em sete dos dez jogadores não diz nada sobre nenhum deles. Havendo voto,
   * a patota decidiu, e o prêmio sai.
   */
  const decidedByStatsAlone = counted.length === 0
  const noneStood =
    type !== 'goleiro_menos_vazado' && Math.max(...pool.map((stats) => stats.participations)) === 0
  if (decidedByStatsAlone && noneStood) {
    return { entries, totalVotes: 0, winners: [] }
  }

  const best = Math.max(...entries.map((entry) => entry.score))
  return {
    entries,
    totalVotes: counted.length,
    winners: entries
      .filter((entry) => Math.abs(entry.score - best) < 1e-9)
      .map((entry) => entry.playerId),
  }
}

/** Apura os três prêmios de uma vez. */
export function computeRoundAwards(snapshot: Snapshot, roundId: string): RoundAwards {
  return {
    jogador_rodada: tallyAward(snapshot, roundId, 'jogador_rodada').winners,
    pior_jogador: tallyAward(snapshot, roundId, 'pior_jogador').winners,
    goleiro_menos_vazado: tallyAward(snapshot, roundId, 'goleiro_menos_vazado').winners,
  }
}

/** Em quem este jogador votou, por prêmio. */
export function votesByVoter(
  snapshot: Snapshot,
  roundId: string,
  voterId: string,
): Partial<Record<AwardType, string>> {
  const chosen: Partial<Record<AwardType, string>> = {}
  for (const vote of snapshot.votes) {
    if (vote.round_id === roundId && vote.voter_id === voterId) chosen[vote.type] = vote.player_id
  }
  return chosen
}

/** Quantos dos eleitores da rodada já votaram em cada prêmio. */
export function voterTurnout(snapshot: Snapshot, roundId: string): { voted: number; total: number } {
  const total = roundEntries(snapshot, roundId).filter((entry) => entry.team_id).length
  const voters = new Set(
    snapshot.votes.filter((vote) => vote.round_id === roundId).map((vote) => vote.voter_id),
  )
  return { voted: voters.size, total }
}

/** Conta quantas vezes cada jogador recebeu cada prêmio ao longo da história. */
export function awardCounts(snapshot: Snapshot, playerId: string): Record<AwardType, number> {
  const counts: Record<AwardType, number> = {
    jogador_rodada: 0,
    pior_jogador: 0,
    goleiro_menos_vazado: 0,
  }
  for (const award of snapshot.awards) {
    if (award.player_id === playerId) counts[award.type] += 1
  }
  return counts
}
