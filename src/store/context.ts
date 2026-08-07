import { createContext } from 'react'
import type { PlayerStats } from '../domain/stats'
import type { AwardInput, EventInput, PlayerInput, RoundInput } from '../data/types'
import type { Match, Player, Round, SessionUser, Snapshot } from '../types'

export interface AppActions {
  createPlayer(input: PlayerInput): Promise<Player>
  updatePlayer(id: string, patch: Partial<Player>): Promise<void>
  deletePlayer(id: string): Promise<void>
  uploadAvatar(playerId: string, file: File): Promise<void>

  createRound(input: RoundInput): Promise<Round>
  updateRound(id: string, patch: Partial<Round>): Promise<void>
  deleteRound(id: string): Promise<void>
  setRoundRoster(roundId: string, playerIds: string[]): Promise<void>
  /** Gera os times equilibrados e os grava na rodada. */
  generateTeamsForRound(roundId: string, teamCount: number): Promise<void>
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
