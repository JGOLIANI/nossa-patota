import { useEffect, useState } from 'react'

/**
 * A abertura só pode começar depois que a Nunito está decodificada. Sem essa
 * espera o primeiro quadro sai com a fonte de reserva e a marca "pula" de
 * largura no meio do movimento — justo no momento em que a atenção está toda
 * nela.
 *
 * A família é carregada em `main.tsx`, porque hoje é a fonte do aplicativo
 * inteiro; aqui só se espera por ela. Nada além disso precisa ser
 * pré-carregado: o ícone é desenhado em SVG e a marca é texto, então os dois
 * já chegam junto com o pacote da aplicação.
 */
const FACES = ['400 64px "Nunito Variable"', '900 64px "Nunito Variable"'] as const

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
