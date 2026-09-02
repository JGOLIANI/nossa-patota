import { LocationField } from './LocationField'
import { Field, Input, Select } from './ui'

/**
 * O que se preenche sobre uma partida: quando, onde e para quantos.
 *
 * Marcar e remarcar pedem exatamente os mesmos campos, e é por isso que eles
 * vivem aqui e não dentro da tela de criar. Duas cópias do formulário viravam
 * duas listas de vagas que divergem no primeiro dia em que alguém acrescenta
 * uma opção só de um lado.
 */
export interface RoundDraft {
  date: string
  startTime: string
  location: string
  locationUrl: string
  /** Texto porque vem de um `<select>`; `'0'` é rodada sem limite. */
  maxPlayers: string
}

const VAGAS = [8, 10, 12, 14, 16, 18, 20, 24]

export function RoundFields({
  value,
  onChange,
}: {
  value: RoundDraft
  onChange: (next: RoundDraft) => void
}) {
  const set = <K extends keyof RoundDraft>(key: K, next: RoundDraft[K]) =>
    onChange({ ...value, [key]: next })

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data">
          <Input
            type="date"
            value={value.date}
            onChange={(event) => set('date', event.target.value)}
          />
        </Field>
        <Field label="Horário">
          <Input
            type="time"
            value={value.startTime}
            onChange={(event) => set('startTime', event.target.value)}
          />
        </Field>
      </div>

      <LocationField
        location={value.location}
        locationUrl={value.locationUrl}
        onLocationChange={(next) => set('location', next)}
        onLocationUrlChange={(next) => set('locationUrl', next)}
        placeholder="Quadra do Zé"
      />

      <Field label="Vagas" hint="Quem confirmar depois disso entra na lista de espera.">
        <Select value={value.maxPlayers} onChange={(event) => set('maxPlayers', event.target.value)}>
          <option value="0">Sem limite</option>
          {VAGAS.map((count) => (
            <option key={count} value={count}>
              {count} jogadores
            </option>
          ))}
        </Select>
      </Field>
    </>
  )
}
