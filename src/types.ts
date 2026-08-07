export type Role = 'admin' | 'jogador'
export type PlayerType = 'mensalista' | 'visitante'
export type DominantFoot = 'direita' | 'esquerda' | 'ambidestro'
export type PlayerPosition = 'goleiro' | 'linha'
export type PlayerStatus = 'ativo' | 'inativo'
export type RoundStatus = 'rascunho' | 'em_andamento' | 'encerrada'
export type MatchStatus = 'em_andamento' | 'encerrada'
export type AwardType = 'jogador_rodada' | 'pior_jogador' | 'goleiro_menos_vazado'

export interface Player {
  id: string
  /** Vínculo com a conta de autenticação. Visitantes não possuem login. */
  user_id: string | null
  username: string
  full_name: string
  photo_url: string | null
  player_type: PlayerType
  dominant_foot: DominantFoot
  position: PlayerPosition
  status: PlayerStatus
  role: Role
  /** Nível informado pelo administrador (1 a 5), usado no balanceamento. */
  level: number
  created_at: string
}

export interface Round {
  id: string
  date: string
  title: string
  team_count: number
  status: RoundStatus
  created_at: string
  closed_at: string | null
}

export interface Team {
  id: string
  round_id: string
  /** Ordem do time dentro da rodada (0, 1, 2...). */
  position: number
  name: string
  color: string
}

export interface RoundPlayer {
  id: string
  round_id: string
  player_id: string
  team_id: string | null
}

export interface Match {
  id: string
  round_id: string
  sequence: number
  team_a_id: string
  team_b_id: string
  score_a: number
  score_b: number
  status: MatchStatus
  created_at: string
  ended_at: string | null
}

export interface MatchEvent {
  id: string
  match_id: string
  /** Time que marcou o gol (o beneficiado, inclusive em gol contra). */
  team_id: string
  /** Autor do gol. Em gol contra, é o jogador que marcou contra o próprio time. */
  scorer_id: string | null
  assist_id: string | null
  own_goal: boolean
  created_at: string
}

export interface Award {
  id: string
  round_id: string
  type: AwardType
  player_id: string
}

/** Conjunto completo de dados carregado do backend. */
export interface Snapshot {
  players: Player[]
  rounds: Round[]
  teams: Team[]
  roundPlayers: RoundPlayer[]
  matches: Match[]
  events: MatchEvent[]
  awards: Award[]
}

export const EMPTY_SNAPSHOT: Snapshot = {
  players: [],
  rounds: [],
  teams: [],
  roundPlayers: [],
  matches: [],
  events: [],
  awards: [],
}

export interface SessionUser {
  id: string
  username: string
}

export const AWARD_LABELS: Record<AwardType, string> = {
  jogador_rodada: 'Jogador da Rodada',
  pior_jogador: 'Pior Jogador da Rodada',
  goleiro_menos_vazado: 'Goleiro Menos Vazado',
}

export const TEAM_PRESETS: Array<{ name: string; color: string }> = [
  { name: 'Time Verde', color: '#22c55e' },
  { name: 'Time Azul', color: '#3b82f6' },
  { name: 'Time Vermelho', color: '#ef4444' },
  { name: 'Time Amarelo', color: '#eab308' },
  { name: 'Time Roxo', color: '#a855f7' },
  { name: 'Time Laranja', color: '#f97316' },
]
