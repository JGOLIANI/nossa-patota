import { useEffect, useState } from 'react'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-900.css'

/**
 * A abertura só pode começar depois que as duas variações da Nunito estão
 * decodificadas. Sem essa espera o primeiro quadro sai com a fonte do
 * sistema e a marca "pula" de largura no meio do movimento — justo no
 * momento em que a atenção está toda nela.
 *
 * Nada além das fontes precisa ser pré-carregado: a mascote e a marca são
 * desenhadas em SVG, então já chegam junto com o pacote da aplicação.
 */
const FACES = ['400 64px Nunito', '900 64px Nunito'] as const

export function useNunitoReady() {
  const [ready, setReady] = useState(() => typeof document === 'undefined' || !document.fonts)

  useEffect(() => {
    if (ready) return
    let active = true
    // Um tempo máximo de espera: numa rede ruim é melhor abrir com a fonte do
    // sistema do que segurar a tela de entrada indefinidamente.
    const timeout = setTimeout(() => active && setReady(true), 1500)
    Promise.all(FACES.map((face) => document.fonts.load(face)))
      .catch(() => undefined)
      .then(() => {
        if (!active) return
        clearTimeout(timeout)
        setReady(true)
      })
    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [ready])

  return ready
}
