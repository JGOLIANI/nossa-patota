import { describe, expect, it } from 'vitest'
import { isMapsUrl, mapsSearchUrl, mapsUrl } from './maps'

describe('reconhecer um link do Google Maps', () => {
  it('aceita o link do botão de compartilhar', () => {
    expect(isMapsUrl('https://maps.app.goo.gl/aBcD1234')).toBe(true)
    expect(isMapsUrl('https://goo.gl/maps/aBcD1234')).toBe(true)
  })

  it('aceita o endereço do navegador, em qualquer domínio do Google', () => {
    expect(isMapsUrl('https://www.google.com/maps/place/Quadra+do+Ze/@-23.5,-46.6,17z')).toBe(true)
    expect(isMapsUrl('https://www.google.com.br/maps/search/quadra')).toBe(true)
    expect(isMapsUrl('https://maps.google.com/maps?q=quadra')).toBe(true)
  })

  it('não se importa com espaços em volta', () => {
    expect(isMapsUrl('  https://maps.app.goo.gl/aBcD1234  ')).toBe(true)
  })

  it('recusa o que não é mapa', () => {
    expect(isMapsUrl('https://www.google.com/search?q=quadra')).toBe(false)
    expect(isMapsUrl('https://maps.apple.com/?q=quadra')).toBe(false)
    expect(isMapsUrl('https://naogoogle.com/maps/place/x')).toBe(false)
    expect(isMapsUrl('https://maps.app.goo.gl')).toBe(false)
  })

  it('recusa o que nem endereço é', () => {
    expect(isMapsUrl('')).toBe(false)
    expect(isMapsUrl('Quadra do Zé')).toBe(false)
    expect(isMapsUrl('javascript:alert(1)')).toBe(false)
  })
})

describe('endereço do local no mapa', () => {
  it('usa o ponto marcado quando ele existe', () => {
    expect(mapsUrl('Quadra do Zé', 'https://maps.app.goo.gl/aBcD1234')).toBe(
      'https://maps.app.goo.gl/aBcD1234',
    )
  })

  it('cai na busca pelo nome quando não há ponto', () => {
    expect(mapsUrl('Quadra do Zé', '')).toBe(mapsSearchUrl('Quadra do Zé'))
  })

  it('ignora um link colado que não é do mapa', () => {
    expect(mapsUrl('Quadra do Zé', 'https://www.instagram.com/quadradoze')).toBe(
      mapsSearchUrl('Quadra do Zé'),
    )
  })

  it('não inventa link quando não há local nenhum', () => {
    expect(mapsUrl('', '')).toBe('')
    expect(mapsUrl('   ', '')).toBe('')
  })

  it('escapa o nome na busca', () => {
    expect(mapsSearchUrl('Quadra do Zé & cia')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Quadra%20do%20Z%C3%A9%20%26%20cia',
    )
  })
})
