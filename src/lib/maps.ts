/**
 * Endereços do Google Maps.
 *
 * O aplicativo não conversa com a API do Google: ela exige uma chave dentro
 * do navegador e cobra por consulta, o que seria uma conta a pagar para uma
 * patota resolver onde é o jogo. O que existe aqui é o endereço público do
 * mapa — o mesmo que qualquer pessoa abre no navegador ou no aplicativo do
 * Google Maps — montado a partir do que já se sabe sobre o local.
 *
 * São duas qualidades de link. O que o administrador marca no mapa e cola no
 * cadastro aponta para o ponto exato, com o nome e as avaliações do lugar. Na
 * falta dele, resta a busca pelo nome digitado: acha a quadra conhecida, erra
 * na quadra sem placa. Por isso o campo do link existe, e por isso ele é
 * opcional.
 */

/** Hosts curtos do Google Maps, os que saem do botão de compartilhar. */
const SHORT_HOSTS = ['maps.app.goo.gl', 'goo.gl']

/** `google.com`, `google.com.br`, `maps.google.de`… */
const GOOGLE_HOST = /^([a-z-]+\.)*google(\.[a-z]{2,})+$/

function parse(value: string): URL | null {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

/**
 * Reconhece um endereço do Google Maps.
 *
 * A conferência é do host e do caminho, e não do formato inteiro: os links do
 * Maps têm meia dúzia de formas — `/maps/place`, `/maps/search`, o `?q=`
 * antigo, o encurtado do botão de compartilhar — e recusar o que não se
 * reconhece rejeitaria links bons.
 */
export function isMapsUrl(value: string): boolean {
  const url = parse(value)
  if (!url) return false

  const host = url.hostname.toLowerCase()
  if (SHORT_HOSTS.includes(host)) return url.pathname.length > 1
  return GOOGLE_HOST.test(host) && url.pathname.startsWith('/maps')
}

/** Busca do lugar pelo nome, para quando não há ponto marcado. */
export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`
}

/**
 * O endereço que abre o local no Google Maps: o ponto marcado, quando existe;
 * a busca pelo nome, quando não. Sem nome nem ponto não há link nenhum, e
 * quem chama decide o que fazer com a ausência.
 */
export function mapsUrl(location: string, locationUrl: string): string {
  if (isMapsUrl(locationUrl)) return locationUrl.trim()
  const name = location.trim()
  return name ? mapsSearchUrl(name) : ''
}
