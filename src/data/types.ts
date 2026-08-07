import type {
  Award,
  AwardType,
  Match,
  MatchEvent,
  Player,
  Round,
  SessionUser,
  Snapshot,
} from '../types'

export type PlayerInput = Omit<Player, 'id' | 'created_at' | 'user_id'> &
  Partial<Pick<Player, 'user_id'>>

export interface RoundInput {
  date: string
  title: string
  team_count: number
  playerIds: string[]
}

export interface TeamInput {
  name: string
  color: string
  playerIds: string[]
}

export interface EventInput {
  match_id: string
  team_id: string
  scorer_id: string | null
  assist_id: string | null
  own_goal: boolean
}

export interface AwardInput {
  type: AwardType
  player_id: string
}

/**
 * Contrato único de persistência. Há duas implementações: Supabase (produção)
 * e um backend local em `localStorage` usado no modo demonstração, quando as
 * variáveis de ambiente do Supabase não estão configuradas.
 */
export interface Backend {
  mode: 'supabase' | 'demo'

  getSession(): Promise<SessionUser | null>
  onAuthChange(callback: (user: SessionUser | null) => void): () => void
  signIn(username: string, password: string): Promise<void>
  signUp(username: string, password: string): Promise<void>
  signOut(): Promise<void>
  changePassword(password: string): Promise<void>

  fetchAll(): Promise<Snapshot>

  createPlayer(input: PlayerInput): Promise<Player>
  updatePlayer(id: string, patch: Partial<Player>): Promise<void>
  deletePlayer(id: string): Promise<void>
  uploadAvatar(playerId: string, file: File): Promise<string>

  createRound(input: RoundInput): Promise<Round>
  updateRound(id: string, patch: Partial<Round>): Promise<void>
  deleteRound(id: string): Promise<void>
  setRoundRoster(roundId: string, playerIds: string[]): Promise<void>
  setRoundTeams(roundId: string, teams: TeamInput[]): Promise<void>

  createMatch(roundId: string, teamAId: string, teamBId: string): Promise<Match>
  updateMatch(id: string, patch: Partial<Match>): Promise<void>
  deleteMatch(id: string): Promise<void>

  addEvent(input: EventInput): Promise<MatchEvent>
  deleteEvent(id: string): Promise<void>

  setAwards(roundId: string, awards: AwardInput[]): Promise<Award[]>
}
