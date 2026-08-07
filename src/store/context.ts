import { createContext } from 'react'
import type { PlayerStats } from '../domain/stats'
import type { AwardInput, EventInput, PlayerInput, RoundInput } from '../data/types'
import type {
  Attendance,
  Match,
  PatotaSettings,
  Player,
  PlayerPosition,
  Round,
  SessionUser,
  Snapshot,
} from '../types'

export interface AppActions {
  createPlayer(input: PlayerInput): Promise<Player>
  updatePlayer(id: string, patch: Partial<Player>): Promise<void>
  deletePlayer(id: string): Promise<void>
  uploadAvatar(playerId: string, file: File): Promise<void>

  /** Salva a agenda da patota e materializa as próximas rodadas. */
  updateSettings(patch: Partial<PatotaSettings>): Promise<void>
  ensureUpcomingRounds(): Promise<void>

  createRound(input: RoundInput): Promise<Round>
  updateRound(id: string, patch: Partial<Round>): Promise<void>
  deleteRound(id: string): Promise<void>

  /** Resposta do próprio jogador ao convite, com lista de espera. */
  respond(roundId: string, playerId: string, wants: 'confirmado' | 'fora'): Promise<void>
  /** Ajuste manual feito pelo administrador. */
  setAttendance(roundId: string, playerId: string, attendance: Attendance): Promise<void>
  removeFromRound(roundId: string, playerId: string): Promise<void>
  /** Marca em que posição o jogador atuou nesta rodada. */
  setRoundPosition(roundId: string, playerId: string, position: PlayerPosition): Promise<void>

  /** Sorteia os dois times com quem confirmou e já cria a partida da rodada. */
  generateTeamsForRound(roundId: string): Promise<void>
  startRound(roundId: string): Promise<void>
  closeRound(roundId: string): Promise<void>

  createMatch(roundId: string, teamAId: string, teamBId: string): Promise<Match>
  finishMatch(matchId: string): Promise<void>
  reopenMatch(matchId: string): Promise<void>
  deleteMatch(matchId: string): Promise<void>

  addGoal(match: Match, input: Omit<EventInput, 'match_id'>): Promise<void>
  removeEvent(match: Match, eventId: string): Promise<void>

  setAwards(roundId: string, awards: AwardInput[]): Promise<void>
}

export interface AppValue {
  ready: boolean
  loading: boolean
  demoMode: boolean
  session: SessionUser | null
  snapshot: Snapshot
  currentPlayer: Player | null
  isAdmin: boolean
  stats: Map<string, PlayerStats>
  refresh(): Promise<void>
  signIn(username: string, password: string): Promise<void>
  signUp(username: string, password: string): Promise<void>
  signOut(): Promise<void>
  changePassword(password: string): Promise<void>
  actions: AppActions
}

export const AppContext = createContext<AppValue | null>(null)
