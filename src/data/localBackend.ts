import { planResponse } from '../domain/attendance'
import { blobToDataUrl, resizeImage } from '../lib/image'
import { normalizeUsername } from '../lib/supabase'
import type {
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
  Team,
} from '../types'
import { VOTING_WINDOW_HOURS } from '../types'
import { createDemoSnapshot } from './demoSeed'
import type {
  AttendanceInput,
  AwardInput,
  Backend,
  EventInput,
  JoinCodeCheck,
  PlayerInput,
  RoundInput,
  SignUpInput,
  TeamInput,
} from './types'

// A versão faz parte da chave: quando o formato do snapshot muda, os dados
// antigos são descartados em vez de carregarem sem os campos novos.
const STORAGE_KEY = 'nossa-patota:demo:v6'
const LEGACY_KEYS = [
  'nossa-patota:demo:v1',
  'nossa-patota:demo:v2',
  'nossa-patota:demo:v3',
  'nossa-patota:demo:v4',
  'nossa-patota:demo:v5',
]
const SESSION_KEY = 'nossa-patota:demo:session'

const listeners = new Set<(user: SessionUser | null) => void>()

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

/**
 * Cópia já desserializada do histórico.
 *
 * Sem ela, cada leitura refazia o `JSON.parse` do acervo inteiro — que passa
 * de um megabyte numa patota de anos — e toda gravação repetia o
 * `JSON.stringify`. O cache é invalidado por toda escrita, então nunca
 * devolve dado velho.
 */
let cached: Snapshot | null = null

function seed(): Snapshot {
  const seeded = createDemoSnapshot()
  cached = seeded
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
  return seeded
}

/** Só aceita um snapshot que tenha tudo que as telas atuais esperam. */
function isUsable(value: unknown): value is Snapshot {
  const candidate = value as Partial<Snapshot> | null
  return Boolean(
    candidate &&
      Array.isArray(candidate.players) &&
      Array.isArray(candidate.rounds) &&
      Array.isArray(candidate.roundPlayers) &&
      candidate.settings &&
      typeof candidate.settings.weekday === 'number',
  )
}

function load(): Snapshot {
  if (cached) return cached

  for (const key of LEGACY_KEYS) localStorage.removeItem(key)

  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return seed()

  try {
    const parsed = JSON.parse(raw)
    cached = isUsable(parsed) ? parsed : null
    return cached ?? seed()
  } catch {
    return seed()
  }
}

function save(snapshot: Snapshot): void {
  cached = snapshot
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

function mutate<T>(fn: (snapshot: Snapshot) => T): T {
  const snapshot = load()
  const result = fn(snapshot)
  save(snapshot)
  return result
}

function notify(user: SessionUser | null): void {
  for (const listener of listeners) listener(user)
}

/** Recusa o voto depois de a urna fechar, pelo prazo ou pela apuração. */
function ensureBallotOpen(roundId: string): void {
  const round = load().rounds.find((item) => item.id === roundId)
  if (!round || round.status !== 'encerrada' || !round.closed_at) {
    throw new Error('A votação abre quando a partida é encerrada.')
  }
  const deadline = new Date(round.closed_at).getTime() + VOTING_WINDOW_HOURS * 3600_000
  if (round.awards_settled_at || Date.now() > deadline) {
    throw new Error('A votação desta partida já foi encerrada.')
  }
}

function readSession(): SessionUser | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

/** Restaura a patota fictícia original. Só existe no modo demonstração. */
export function resetDemoData(): void {
  cached = null
  localStorage.removeItem(STORAGE_KEY)
  seed()
}

export const localBackend: Backend = {
  mode: 'demo',

  async getSession() {
    return readSession()
  },

  onAuthChange(callback: (user: SessionUser | null) => void) {
    listeners.add(callback)
    return () => listeners.delete(callback)
  },

  async signIn(username: string) {
    const snapshot = load()
    const wanted = normalizeUsername(username)
    const player = snapshot.players.find((p) => p.username === wanted)
    if (!player) {
      throw new Error('Usuário não encontrado. No modo demonstração use, por exemplo, "admin".')
    }
    const session: SessionUser = { id: player.user_id ?? player.id, username: player.username }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    notify(session)
  },

  /**
   * Mesmas regras do Supabase: o jogador se cadastra sozinho, a primeira conta
   * do sistema vira administradora e as seguintes entram como jogador comum,
   * conferindo o código da patota quando houver um.
   */
  async signUp(input: SignUpInput) {
    const snapshot = load()
    const wanted = normalizeUsername(input.username)
    const isFirst = !snapshot.players.some((player) => player.user_id)
    const existing = snapshot.players.find((player) => player.username === wanted)
    const code = snapshot.settings.join_code.trim()

    if (!isFirst && code && code !== (input.join_code ?? '').trim()) {
      throw new Error('Código da patota inválido. Peça o código a um administrador.')
    }
    if (existing?.user_id) {
      throw new Error(`O usuário "${wanted}" já possui acesso criado.`)
    }

    const role = isFirst ? 'admin' : 'jogador'
    const profile = {
      full_name: input.full_name.trim() || input.username,
      player_type: input.player_type,
      position: input.position,
      dominant_foot: input.dominant_foot,
    }

    if (existing) {
      // Ficha aberta pelo administrador: o tipo e o nível continuam dele.
      existing.user_id = existing.id
      existing.role = role
      existing.full_name = profile.full_name
      existing.position = profile.position
      existing.dominant_foot = profile.dominant_foot
    } else {
      const player: Player = {
        id: uid(),
        user_id: null,
        username: wanted,
        photo_url: null,
        status: 'ativo',
        must_change_password: false,
        role,
        level: 3,
        created_at: new Date().toISOString(),
        ...profile,
      }
      player.user_id = player.id
      snapshot.players.push(player)
    }

    save(snapshot)
    await localBackend.signIn(wanted, '')
  },

  async joinCodeRequired(): Promise<JoinCodeCheck> {
    return { policy: load().settings.join_code.trim() ? 'exigido' : 'dispensado' }
  },

  async setPlayerPassword() {
    throw new Error('O modo demonstração não usa senha: qualquer uma entra.')
  },

  async signOut() {
    localStorage.removeItem(SESSION_KEY)
    notify(null)
  },

  async changePassword() {
    throw new Error('A troca de senha não está disponível no modo demonstração.')
  },

  async fetchAll() {
    // Objeto novo a cada leitura: é a identidade dele que invalida os
    // índices memorizados e os `useMemo` das telas.
    //
    // As listas também são copiadas, e não é detalhe: o acervo guardado é
    // mutado no lugar por toda escrita. Entregar a lista viva fazia o
    // snapshot de quem estava lendo enxergar sozinho a linha recém-gravada —
    // e quem somava a novidade à lista que já tinha (é o caso do gol, que
    // recalcula o placar) contava a mesma linha duas vezes.
    const snapshot = load()
    return {
      players: [...snapshot.players],
      rounds: [...snapshot.rounds],
      teams: [...snapshot.teams],
      roundPlayers: [...snapshot.roundPlayers],
      matches: [...snapshot.matches],
      events: [...snapshot.events],
      awards: [...snapshot.awards],
      votes: [...snapshot.votes],
      settings: { ...snapshot.settings },
    }
  },

  async createPlayer(input: PlayerInput) {
    return mutate((snapshot) => {
      const username = normalizeUsername(input.username)
      if (snapshot.players.some((p) => p.username === username)) {
        throw new Error('Já existe um jogador com esse nome de usuário.')
      }
      const player: Player = {
        ...input,
        username,
        user_id: input.user_id ?? null,
        id: uid(),
        created_at: new Date().toISOString(),
      }
      snapshot.players.push(player)
      return player
    })
  },

  async updatePlayer(id: string, patch: Partial<Player>) {
    mutate((snapshot) => {
      const player = snapshot.players.find((p) => p.id === id)
      if (!player) throw new Error('Jogador não encontrado.')
      if (patch.username) {
        const username = normalizeUsername(patch.username)
        if (snapshot.players.some((p) => p.id !== id && p.username === username)) {
          throw new Error('Já existe um jogador com esse nome de usuário.')
        }
        patch = { ...patch, username }
      }
      Object.assign(player, patch)
    })
  },

  async deletePlayer(id: string) {
    mutate((snapshot) => {
      snapshot.players = snapshot.players.filter((p) => p.id !== id)
      snapshot.roundPlayers = snapshot.roundPlayers.filter((rp) => rp.player_id !== id)
      snapshot.awards = snapshot.awards.filter((award) => award.player_id !== id)
      // Os gols continuam valendo para o placar, apenas perdem o autor.
      for (const event of snapshot.events) {
        if (event.scorer_id === id) event.scorer_id = null
        if (event.assist_id === id) event.assist_id = null
      }
    })
  },

  async uploadAvatar(_playerId: string, file: File) {
    const blob = await resizeImage(file, 320, 0.75)
    return blobToDataUrl(blob)
  },

  async createRound(input: RoundInput) {
    return mutate((snapshot) => {
      // Mesma regra do banco (`rounds` é única por data): é ela que permite
      // materializar a agenda quantas vezes for preciso sem duplicar nada.
      if (snapshot.rounds.some((r) => r.date.slice(0, 10) === input.date.slice(0, 10))) {
        throw new Error('Já existe uma partida marcada para esta data.')
      }
      const round: Round = {
        id: uid(),
        date: input.date,
        title: input.title,
        start_time: input.start_time,
        location: input.location,
        location_url: input.location_url,
        team_count: input.team_count,
        max_players: input.max_players,
        status: 'rascunho',
        created_at: new Date().toISOString(),
        closed_at: null,
        awards_settled_at: null,
      }
      snapshot.rounds.push(round)
      return round
    })
  },

  async updateSettings(patch: Partial<PatotaSettings>) {
    mutate((snapshot) => {
      snapshot.settings = { ...snapshot.settings, ...patch, id: 'default' }
    })
  },

  async updateRound(id: string, patch: Partial<Round>) {
    mutate((snapshot) => {
      const round = snapshot.rounds.find((r) => r.id === id)
      if (!round) throw new Error('Rodada não encontrada.')
      // Mesma regra do banco, e ela também vale para remarcar: sem a
      // conferência aqui, o modo demonstração deixaria passar duas partidas
      // no mesmo dia e o Supabase recusaria a mesma ação.
      if (
        patch.date &&
        snapshot.rounds.some(
          (r) => r.id !== id && r.date.slice(0, 10) === patch.date!.slice(0, 10),
        )
      ) {
        throw new Error('Já existe uma partida marcada para esta data.')
      }
      Object.assign(round, patch)
    })
  },

  async deleteRound(id: string) {
    mutate((snapshot) => {
      const matchIds = new Set(
        snapshot.matches.filter((m) => m.round_id === id).map((m) => m.id),
      )
      snapshot.rounds = snapshot.rounds.filter((r) => r.id !== id)
      snapshot.teams = snapshot.teams.filter((t) => t.round_id !== id)
      snapshot.roundPlayers = snapshot.roundPlayers.filter((rp) => rp.round_id !== id)
      snapshot.matches = snapshot.matches.filter((m) => m.round_id !== id)
      snapshot.events = snapshot.events.filter((e) => !matchIds.has(e.match_id))
      snapshot.awards = snapshot.awards.filter((a) => a.round_id !== id)
    })
  },

  async respondAttendance(roundId: string, wants: 'confirmado' | 'fora') {
    const session = readSession()
    if (!session) throw new Error('Você precisa estar logado.')

    mutate((snapshot) => {
      const player = snapshot.players.find(
        (item) => item.user_id === session.id || item.username === session.username,
      )
      if (!player) throw new Error('Sua conta não está vinculada a um jogador da patota.')

      const round = snapshot.rounds.find((item) => item.id === roundId)
      if (!round) throw new Error('Rodada não encontrada.')
      if (round.status === 'encerrada') throw new Error('Esta rodada já foi encerrada.')

      const rows = snapshot.roundPlayers.filter((rp) => rp.round_id === roundId)
      const changes = planResponse(rows, player.id, wants, round.max_players, new Date().toISOString())

      for (const change of changes) {
        const existing = snapshot.roundPlayers.find(
          (rp) => rp.round_id === roundId && rp.player_id === change.player_id,
        )
        if (existing) {
          existing.attendance = change.attendance
          // Quem deixa de estar confirmado sai do time: o sorteio já podia ter
          // acontecido, e um desistente com time continuaria na escalação e nas
          // estatísticas da partida que ele não jogou.
          if (change.attendance !== 'confirmado') existing.team_id = null
          if (change.responded_at) existing.responded_at = change.responded_at
        } else {
          snapshot.roundPlayers.push({
            id: uid(),
            round_id: roundId,
            player_id: change.player_id,
            team_id: null,
            attendance: change.attendance,
            responded_at: change.responded_at ?? new Date().toISOString(),
            position: null,
          })
        }
      }
    })
  },

  async setAttendance(roundId: string, changes: AttendanceInput[]) {
    mutate((snapshot) => {
      for (const change of changes) {
        const existing = snapshot.roundPlayers.find(
          (rp) => rp.round_id === roundId && rp.player_id === change.player_id,
        )
        if (existing) {
          existing.attendance = change.attendance
          if (change.attendance !== 'confirmado') existing.team_id = null
          if (change.responded_at) existing.responded_at = change.responded_at
        } else {
          snapshot.roundPlayers.push({
            id: uid(),
            round_id: roundId,
            player_id: change.player_id,
            team_id: null,
            attendance: change.attendance,
            responded_at: change.responded_at ?? new Date().toISOString(),
            position: null,
          })
        }
      }
    })
  },

  async setRoundPosition(roundId: string, playerId: string, position: PlayerPosition) {
    mutate((snapshot) => {
      const row = snapshot.roundPlayers.find(
        (rp) => rp.round_id === roundId && rp.player_id === playerId,
      )
      if (!row) throw new Error('Jogador não está nesta rodada.')
      row.position = position
    })
  },

  async removeFromRound(roundId: string, playerId: string) {
    mutate((snapshot) => {
      snapshot.roundPlayers = snapshot.roundPlayers.filter(
        (rp) => !(rp.round_id === roundId && rp.player_id === playerId),
      )
    })
  },

  async setRoundTeams(roundId: string, teams: TeamInput[]) {
    mutate((snapshot) => {
      const matchIds = new Set(
        snapshot.matches.filter((m) => m.round_id === roundId).map((m) => m.id),
      )
      snapshot.matches = snapshot.matches.filter((m) => m.round_id !== roundId)
      snapshot.events = snapshot.events.filter((e) => !matchIds.has(e.match_id))
      snapshot.teams = snapshot.teams.filter((t) => t.round_id !== roundId)

      const created: Team[] = teams.map((team, index) => ({
        id: uid(),
        round_id: roundId,
        position: index,
        name: team.name,
        color: team.color,
      }))
      snapshot.teams.push(...created)

      for (const rp of snapshot.roundPlayers) {
        if (rp.round_id !== roundId) continue
        const index = teams.findIndex((team) => team.playerIds.includes(rp.player_id))
        rp.team_id = index >= 0 ? created[index].id : null
      }
    })
  },

  async setPlayerTeam(roundId: string, playerId: string, teamId: string | null) {
    mutate((snapshot) => {
      const row = snapshot.roundPlayers.find(
        (rp) => rp.round_id === roundId && rp.player_id === playerId,
      )
      if (row) row.team_id = teamId
    })
  },

  async createMatch(roundId: string, teamAId: string, teamBId: string) {
    return mutate((snapshot) => {
      const sequence =
        snapshot.matches
          .filter((m) => m.round_id === roundId)
          .reduce((max, m) => Math.max(max, m.sequence), 0) + 1
      const match: Match = {
        id: uid(),
        round_id: roundId,
        sequence,
        team_a_id: teamAId,
        team_b_id: teamBId,
        score_a: 0,
        score_b: 0,
        status: 'em_andamento',
        created_at: new Date().toISOString(),
        ended_at: null,
      }
      snapshot.matches.push(match)
      return match
    })
  },

  async updateMatch(id: string, patch: Partial<Match>) {
    mutate((snapshot) => {
      const match = snapshot.matches.find((m) => m.id === id)
      if (!match) throw new Error('Partida não encontrada.')
      Object.assign(match, patch)
    })
  },


  async addEvent(input: EventInput) {
    return mutate((snapshot) => {
      const event: MatchEvent = { ...input, id: uid(), created_at: new Date().toISOString() }
      snapshot.events.push(event)
      return event
    })
  },

  async updateEvent(id: string, patch: Partial<Omit<EventInput, 'match_id'>>) {
    mutate((snapshot) => {
      const event = snapshot.events.find((row) => row.id === id)
      if (event) Object.assign(event, patch)
    })
  },

  async deleteEvent(id: string) {
    mutate((snapshot) => {
      snapshot.events = snapshot.events.filter((e) => e.id !== id)
    })
  },

  /**
   * A urna do modo demonstração segue a mesma regra do servidor: fecham a
   * votação o prazo e a apuração, e depois de qualquer um dos dois o voto é
   * recusado. Sem isto o modo demonstração aceitaria voto em rodada apurada
   * e daria a impressão errada de como o aplicativo funciona.
   */
  async castVote(roundId: string, type: AwardType, playerId: string) {
    const session = readSession()
    if (!session) throw new Error('Entre na sua conta para votar.')
    const voter = load().players.find(
      (player) => player.user_id === session.id || player.username === session.username,
    )
    if (!voter) throw new Error('Sua ficha de jogador não foi encontrada.')
    if (voter.id === playerId) throw new Error('Não dá para votar em você mesmo.')
    ensureBallotOpen(roundId)

    mutate((snapshot) => {
      const existing = snapshot.votes.find(
        (vote) => vote.round_id === roundId && vote.type === type && vote.voter_id === voter.id,
      )
      if (existing) {
        existing.player_id = playerId
        existing.created_at = new Date().toISOString()
        return
      }
      snapshot.votes.push({
        id: uid(),
        round_id: roundId,
        type,
        voter_id: voter.id,
        player_id: playerId,
        created_at: new Date().toISOString(),
      })
    })
  },

  async clearVote(roundId: string, type: AwardType) {
    const session = readSession()
    if (!session) throw new Error('Entre na sua conta para votar.')
    const voter = load().players.find(
      (player) => player.user_id === session.id || player.username === session.username,
    )
    if (!voter) return
    ensureBallotOpen(roundId)
    mutate((snapshot) => {
      snapshot.votes = snapshot.votes.filter(
        (vote) =>
          !(vote.round_id === roundId && vote.type === type && vote.voter_id === voter.id),
      )
    })
  },

  async setAwards(roundId: string, awards: AwardInput[]) {
    return mutate((snapshot) => {
      snapshot.awards = snapshot.awards.filter((award) => award.round_id !== roundId)
      const created: Award[] = awards.map((award) => ({
        ...award,
        id: uid(),
        round_id: roundId,
      }))
      snapshot.awards.push(...created)
      return created
    })
  },
}
