import type {
  Attendance,
  Award,
  AwardType,
  Match,
  MatchEvent,
  PatotaSettings,
  Player,
  PlayerPosition,
  Round,
  SessionUser,
  Snapshot,
} from '../types'

export type PlayerInput = Omit<Player, 'id' | 'created_at' | 'user_id'> &
  Partial<Pick<Player, 'user_id'>>

/**
 * O que o jogador preenche ao criar a própria conta. O nível não está aqui de
 * propósito: quem se cadastra não se autoavalia — todo mundo começa no meio da
 * escala e o administrador ajusta depois, se quiser.
 */
export interface SignUpInput {
  username: string
  password: string
  full_name: string
  player_type: Player['player_type']
  position: Player['position']
  dominant_foot: Player['dominant_foot']
  /** Só é exigido quando a patota já definiu um código de entrada. */
  join_code?: string
}

export interface RoundInput {
  date: string
  title: string
  start_time: string
  location: string
  team_count: number
  max_players: number
}

/** Uma alteração de presença a ser gravada. */
export interface AttendanceInput {
  player_id: string
  attendance: Attendance
  responded_at?: string
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
 * O que a tela de cadastro sabe sobre o código de entrada.
 *
 * Os dois últimos estados existem porque a pergunta vai ao servidor e a
 * resposta pode não vir. Sem eles, uma consulta que falha viraria "exige
 * código" — e trancaria o primeiro acesso da patota, quando ainda não há
 * código nem administrador a quem pedir.
 *
 *  · `exigido`     — a patota definiu um código;
 *  · `dispensado`  — não há código; o cadastro está aberto;
 *  · `sem-schema`  — o banco respondeu que a função não existe, ou seja, o
 *                    `supabase/schema.sql` ainda não foi aplicado;
 *  · `desconhecido`— não houve resposta (rede, URL errada, projeto pausado).
 */
export type JoinCodePolicy = 'exigido' | 'dispensado' | 'sem-schema' | 'desconhecido'

export interface JoinCodeCheck {
  policy: JoinCodePolicy
  /**
   * O que o servidor respondeu, quando a pergunta falhou.
   *
   * Vai cru para a tela de propósito: quem está configurando a patota precisa
   * distinguir "chave inválida" de "projeto pausado" de "sem internet", e
   * nenhuma frase amável nossa diria isso por ele.
   */
  detail?: string
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
  signUp(input: SignUpInput): Promise<void>
  signOut(): Promise<void>
  changePassword(password: string): Promise<void>
  /** Consultado na tela de cadastro, antes de existir sessão. */
  joinCodeRequired(): Promise<JoinCodeCheck>
  /**
   * Senha provisória gerada por um administrador para quem esqueceu a sua.
   * Roda no servidor: trocar a senha alheia é privilégio que não cabe no
   * navegador.
   */
  setPlayerPassword(playerId: string, password: string): Promise<void>

  fetchAll(): Promise<Snapshot>

  createPlayer(input: PlayerInput): Promise<Player>
  updatePlayer(id: string, patch: Partial<Player>): Promise<void>
  deletePlayer(id: string): Promise<void>
  uploadAvatar(playerId: string, file: File): Promise<string>

  updateSettings(patch: Partial<PatotaSettings>): Promise<void>

  createRound(input: RoundInput): Promise<Round>
  updateRound(id: string, patch: Partial<Round>): Promise<void>
  deleteRound(id: string): Promise<void>
  setRoundTeams(roundId: string, teams: TeamInput[]): Promise<void>
  /**
   * Move um jogador entre os times já montados da rodada.
   *
   * Existe separado de `setRoundTeams` porque aquele refaz os times do zero,
   * e refazer apaga a partida e os gols junto. Para trocar alguém de lado no
   * meio da pelada é esta a operação: mexe numa linha só.
   */
  setPlayerTeam(roundId: string, playerId: string, teamId: string | null): Promise<void>

  /**
   * Resposta do próprio jogador. No Supabase é uma função no servidor, porque
   * promover alguém da lista de espera mexe na linha de outro jogador e
   * precisa ser atômico entre confirmações simultâneas.
   */
  respondAttendance(roundId: string, wants: 'confirmado' | 'fora'): Promise<void>
  /** Ajuste manual do administrador. */
  setAttendance(roundId: string, changes: AttendanceInput[]): Promise<void>
  removeFromRound(roundId: string, playerId: string): Promise<void>
  /** Troca a posição que o jogador ocupa nesta rodada. */
  setRoundPosition(
    roundId: string,
    playerId: string,
    position: PlayerPosition,
  ): Promise<void>

  createMatch(roundId: string, teamAId: string, teamBId: string): Promise<Match>
  updateMatch(id: string, patch: Partial<Match>): Promise<void>
  deleteMatch(id: string): Promise<void>

  addEvent(input: EventInput): Promise<MatchEvent>
  /**
   * Corrige um gol já registrado — autor, assistência, gol contra ou o time
   * que pontuou. Existe porque no calor da pelada o gol entra no nome errado,
   * e apagar e lançar de novo perde a ordem em que as coisas aconteceram.
   */
  updateEvent(id: string, patch: Partial<Omit<EventInput, 'match_id'>>): Promise<void>
  deleteEvent(id: string): Promise<void>

  setAwards(roundId: string, awards: AwardInput[]): Promise<Award[]>

  /**
   * Voto do próprio jogador num prêmio da rodada. Votar de novo troca o voto
   * anterior. No Supabase é uma função no servidor: quem pode votar, em quem,
   * e até quando são regras que não cabem no navegador.
   */
  castVote(roundId: string, type: AwardType, playerId: string): Promise<void>
  /** Desfaz o próprio voto naquele prêmio. */
  clearVote(roundId: string, type: AwardType): Promise<void>
}
