import { planResponse } from '../domain/attendance'
import { blobToDataUrl, resizeImage } from '../lib/image'
import { normalizeUsername } from '../lib/supabase'
import type {
  Award,
  Match,
  MatchEvent,
  PatotaSettings,
  Player,
  Round,
  SessionUser,
  Snapshot,
  Team,
} from '../types'
import { createDemoSnapshot } from './demoSeed'
import type {
  AttendanceInput,
  AwardInput,
  Backend,
  EventInput,
  PlayerInput,
  RoundInput,
  TeamInput,
} from './types'

const STORAGE_KEY = 'nossa-patota:demo:v1'
const SESSION_KEY = 'nossa-patota:demo:session'

const listeners = new Set<(user: SessionUser | null) => void>()

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

function load(): Snapshot {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const seeded = createDemoSnapshot()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
    return seeded
  }
  try {
    return JSON.parse(raw) as Snapshot
  } catch {
    const seeded = createDemoSnapshot()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
    return seeded
  }
}

function save(snapshot: Snapshot): void {
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
  localStorage.removeItem(STORAGE_KEY)
  load()
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
   * Mesma regra do Supabase: a primeira conta do sistema vira administradora;
   * as seguintes precisam ter sido cadastradas por um admin e entram sempre
   * como jogador comum.
   */
  async signUp(username: string) {
    const snapshot = load()
    const wanted = normalizeUsername(username)
    const isFirst = !snapshot.players.some((player) => player.user_id)
    const existing = snapshot.players.find((player) => player.username === wanted)

    if (isFirst) {
      if (existing) {
        existing.user_id = existing.id
        existing.role = 'admin'
      } else {
        const player: Player = {
          id: uid(),
          user_id: null,
          username: wanted,
          full_name: username,
          photo_url: null,
          player_type: 'mensalista',
          dominant_foot: 'direita',
          position: 'linha',
          status: 'ativo',
          role: 'admin',
          level: 3,
          created_at: new Date().toISOString(),
        }
        player.user_id = player.id
        snapshot.players.push(player)
      }
      save(snapshot)
      await localBackend.signIn(wanted, '')
      return
    }

    if (!existing) {
      throw new Error(
        `O usuário "${wanted}" não está cadastrado na patota. Peça ao administrador para cadastrá-lo.`,
      )
    }
    if (existing.user_id) {
      throw new Error(`O usuário "${wanted}" já possui acesso criado.`)
    }

    existing.user_id = existing.id
    existing.role = 'jogador'
    save(snapshot)
    await localBackend.signIn(wanted, '')
  },

  async signOut() {
    localStorage.removeItem(SESSION_KEY)
    notify(null)
  },

  async changePassword() {
    throw new Error('A troca de senha não está disponível no modo demonstração.')
  },

  async fetchAll() {
    return load()
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
      const round: Round = {
        id: uid(),
        date: input.date,
        title: input.title,
        start_time: input.start_time,
        location: input.location,
        team_count: input.team_count,
        max_players: input.max_players,
        status: 'rascunho',
        created_at: new Date().toISOString(),
        closed_at: null,
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
          if (change.responded_at) existing.responded_at = change.responded_at
        } else {
          snapshot.roundPlayers.push({
            id: uid(),
            round_id: roundId,
            player_id: change.player_id,
            team_id: null,
            attendance: change.attendance,
            responded_at: change.responded_at ?? new Date().toISOString(),
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
          if (change.responded_at) existing.responded_at = change.responded_at
        } else {
          snapshot.roundPlayers.push({
            id: uid(),
            round_id: roundId,
            player_id: change.player_id,
            team_id: null,
            attendance: change.attendance,
            responded_at: change.responded_at ?? new Date().toISOString(),
          })
        }
      }
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

  async deleteMatch(id: string) {
    mutate((snapshot) => {
      snapshot.matches = snapshot.matches.filter((m) => m.id !== id)
      snapshot.events = snapshot.events.filter((e) => e.match_id !== id)
    })
  },

  async addEvent(input: EventInput) {
    return mutate((snapshot) => {
      const event: MatchEvent = { ...input, id: uid(), created_at: new Date().toISOString() }
      snapshot.events.push(event)
      return event
    })
  },

  async deleteEvent(id: string) {
    mutate((snapshot) => {
      snapshot.events = snapshot.events.filter((e) => e.id !== id)
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
