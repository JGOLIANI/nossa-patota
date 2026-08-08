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
  /** Entrou com a senha padrão e precisa trocá-la antes de usar o aplicativo. */
  must_change_password: boolean
  created_at: string
}

export interface Round {
  id: string
  date: string
  title: string
  /** Horário de início, `HH:MM`. Herdado da configuração da patota. */
  start_time: string
  location: string
  team_count: number
  /** Vagas da rodada. 0 significa sem limite. */
  max_players: number
  status: RoundStatus
  created_at: string
  closed_at: string | null
}

/**
 * Configuração fixa da patota: o dia em que ela acontece, o horário, o local
 * e quantas vagas existem. É a partir daqui que as próximas rodadas nascem
 * sozinhas, sem o administrador precisar criar uma por uma toda semana.
 */
export interface PatotaSettings {
  id: string
  /** 0 = domingo … 6 = sábado. */
  weekday: number
  start_time: string
  location: string
  max_players: number
  /** Quantas rodadas futuras manter sempre criadas. */
  weeks_ahead: number
  /**
   * Código que o jogador digita para se cadastrar. Vazio deixa o cadastro
   * aberto a quem tiver o endereço do aplicativo.
   */
  join_code: string
}

export const DEFAULT_SETTINGS: PatotaSettings = {
  id: 'default',
  weekday: 5,
  start_time: '20:00',
  location: '',
  max_players: 0,
  weeks_ahead: 4,
  join_code: '',
}

export const WEEKDAYS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

export interface Team {
  id: string
  round_id: string
  /** Ordem do time dentro da rodada (0, 1, 2...). */
  position: number
  name: string
  color: string
}

/** Resposta do jogador ao convite da rodada. */
export type Attendance = 'confirmado' | 'espera' | 'fora'

export interface RoundPlayer {
  id: string
  round_id: string
  player_id: string
  team_id: string | null
  attendance: Attendance
  /** Momento da confirmação — define a ordem da lista de espera. */
  responded_at: string
  /**
   * Posição realmente ocupada nesta rodada.
   *
   * Na pelada o goleiro cansa e vai para a linha, e um jogador de linha
   * assume o gol. Sem isso, os gols sofridos seriam atribuídos a quem nem
   * estava debaixo das traves. `null` mantém a posição do cadastro.
   */
  position: PlayerPosition | null
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
  settings: PatotaSettings
}

export const EMPTY_SNAPSHOT: Snapshot = {
  players: [],
  rounds: [],
  teams: [],
  roundPlayers: [],
  matches: [],
  events: [],
  awards: [],
  settings: DEFAULT_SETTINGS,
}

export interface SessionUser {
  id: string
  username: string
}

export const AWARD_LABELS: Record<AwardType, string> = {
  jogador_rodada: 'Craque da Partida',
  pior_jogador: 'Bola Murcha',
  goleiro_menos_vazado: 'Paredão',
}

/** Versão curta, para caber embaixo de um número na ficha do jogador. */
export const AWARD_SHORT_LABELS: Record<AwardType, string> = {
  jogador_rodada: 'Craque',
  pior_jogador: 'Bola Murcha',
  goleiro_menos_vazado: 'Paredão',
}

/**
 * Senha aplicada pelo administrador quando alguém perde a sua.
 *
 * É fixa e conhecida de propósito: o administrador precisa conseguir ditá-la
 * no grupo sem copiar e colar. O que a torna segura o bastante é durar uma
 * entrada só — quem entra com ela cai direto na troca obrigatória.
 */
export const DEFAULT_PASSWORD = 'patota123'

/**
 * Os coletes da patota, na ordem em que são distribuídos.
 *
 * Preto e branco vêm primeiro porque são os dois times de toda partida — é o
 * par que a quadra reconhece de longe, e o único que continua legível na foto
 * do grupo, no print e em quem enxerga cor de um jeito diferente. Os demais
 * ficam de reserva, para o caso de a patota passar a dividir mais times.
 *
 * Nenhuma das duas primeiras cores se sustenta sozinha: sobre o cartão branco
 * o time branco some, sobre o fundo preto do tema escuro some o preto. Onde a
 * cor aparece como bolinha ou faixa, ela vem sempre com um contorno.
 */
export const TEAM_PRESETS: Array<{ name: string; color: string }> = [
  { name: 'Time Preto', color: '#000000' },
  { name: 'Time Branco', color: '#ffffff' },
  { name: 'Time Vermelho', color: '#ef4444' },
  { name: 'Time Amarelo', color: '#eab308' },
  { name: 'Time Azul', color: '#3b82f6' },
  { name: 'Time Verde', color: '#22c55e' },
]
