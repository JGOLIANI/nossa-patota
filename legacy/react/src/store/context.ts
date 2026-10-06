import { createContext } from 'react'
import type { PlayerStats } from '../domain/stats'
import type {
  EventInput,
  JoinCodeCheck,
  PlayerInput,
  RoundInput,
  SignUpInput,
} from '../data/types'
import type {
  Attendance,
  AwardType,
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
  /** Senha provisória para quem esqueceu a sua. Só administradores. */
  setPlayerPassword(playerId: string, password: string): Promise<void>

  /**
   * Salva a agenda da patota, materializa as próximas rodadas e recolhe as do
   * dia antigo que ninguém tocou. Devolve quantas foram criadas e removidas.
   */
  updateSettings(patch: Partial<PatotaSettings>): Promise<{ created: number; removed: number }>

  createRound(input: RoundInput): Promise<Round>
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
  /**
   * Monta os times na mão. `assignments` diz em que time (0 ou 1) cada
   * jogador entra; quem não aparece, ou aparece com `null`, fica de fora.
   *
   * Sem times ainda, cria os dois e abre o placar, como o sorteio faz. Com os
   * times já montados, move só quem mudou de lado — refazê-los apagaria a
   * partida e os gols já registrados.
   */
  setManualTeams(roundId: string, assignments: Record<string, number | null>): Promise<void>
  closeRound(roundId: string): Promise<void>

  reopenMatch(matchId: string): Promise<void>

  addGoal(match: Match, input: Omit<EventInput, 'match_id'>): Promise<void>
  /**
   * Corrige um gol já registrado e recalcula o placar a partir dos eventos.
   * Vale com a partida encerrada: é assim que a rodada é revisada depois,
   * quando alguém lembra que o gol foi do outro.
   */
  editGoal(match: Match, eventId: string, input: Omit<EventInput, 'match_id'>): Promise<void>
  removeEvent(match: Match, eventId: string): Promise<void>

  /**
   * Apura os prêmios antes do prazo de 16 horas e, com isso, fecha a urna.
   * Só administradores conseguem gravar.
   */
  closeVoting(roundId: string): Promise<void>

  /** Voto do próprio jogador. Votar de novo troca o voto anterior. */
  castVote(roundId: string, type: AwardType, playerId: string): Promise<void>
  clearVote(roundId: string, type: AwardType): Promise<void>
}

export interface AppValue {
  ready: boolean
  loading: boolean
  /** A primeira leitura do acervo desta sessão já terminou. */
  hydrated: boolean
  demoMode: boolean
  session: SessionUser | null
  snapshot: Snapshot
  currentPlayer: Player | null
  isAdmin: boolean
  stats: Map<string, PlayerStats>
  refresh(): Promise<void>
  signIn(username: string, password: string): Promise<void>
  signUp(input: SignUpInput): Promise<void>
  signOut(): Promise<void>
  changePassword(password: string): Promise<void>
  /** Se a patota exige código de entrada no cadastro. */
  joinCodeRequired(): Promise<JoinCodeCheck>
  actions: AppActions
}

export const AppContext = createContext<AppValue | null>(null)
