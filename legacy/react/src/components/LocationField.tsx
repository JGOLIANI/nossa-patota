import { isMapsUrl, mapsSearchUrl } from '../lib/maps'
import { IconPin } from './icons'
import { Button, Field, Input, Note } from './ui'

/**
 * Onde é o jogo, com o ponto marcado no Google Maps.
 *
 * São dois campos porque são duas coisas diferentes. O nome é o que a patota
 * usa para falar do lugar — "quadra do Zé" — e é o que aparece na tela e na
 * mensagem do grupo. O link é o endereço: é ele que abre a navegação no
 * celular de quem nunca foi.
 *
 * Marcar é ida e volta, e não um mapa dentro do aplicativo: a busca do Google
 * dentro de uma página cobra por consulta e exige uma chave que ficaria à
 * vista de qualquer um que abrisse o aplicativo. O botão abre o Maps já
 * procurando o nome digitado; lá se acha o lugar, toca em compartilhar e cola
 * o link de volta aqui. São dois toques a mais, uma vez na vida da patota.
 *
 * Sem link a partida continua funcionando: o mapa é aberto por uma busca pelo
 * nome, que acerta o lugar conhecido e erra a quadra sem placa.
 */
export function LocationField({
  location,
  locationUrl,
  onLocationChange,
  onLocationUrlChange,
  placeholder,
}: {
  location: string
  locationUrl: string
  onLocationChange: (value: string) => void
  onLocationUrlChange: (value: string) => void
  placeholder: string
}) {
  const name = location.trim()
  const link = locationUrl.trim()
  const marked = isMapsUrl(link)

  return (
    <div className="space-y-3">
      <Field label="Local">
        <Input
          value={location}
          onChange={(event) => onLocationChange(event.target.value)}
          placeholder={placeholder}
        />
      </Field>

      <Field
        label="Local no Google Maps"
        hint="Abra o mapa, ache o lugar, toque em Compartilhar e cole o link aqui."
      >
        <Input
          value={locationUrl}
          onChange={(event) => onLocationUrlChange(event.target.value)}
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="https://maps.app.goo.gl/…"
        />
      </Field>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          block
          disabled={!name && !marked}
          onClick={() =>
            window.open(marked ? link : mapsSearchUrl(name), '_blank', 'noopener,noreferrer')
          }
        >
          <IconPin className="size-5" />
          {marked ? 'Conferir no mapa' : 'Procurar no Google Maps'}
        </Button>
      </div>

      {link && !marked && (
        <Note tone="warn">
          Este link não é do Google Maps, então ele não vai ser usado. O que vale é o endereço que
          começa com <strong>maps.app.goo.gl</strong> ou <strong>google.com/maps</strong>.
        </Note>
      )}
    </div>
  )
}
