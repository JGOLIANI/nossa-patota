import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { REFERENCE_HEIGHT, REFERENCE_WIDTH } from './geometry'

type ReferenceCanvasProps = {
  backgroundColor?: string
  children: ReactNode
  'data-testid'?: string
}

function readViewport() {
  if (typeof window === 'undefined') return { width: REFERENCE_WIDTH, height: REFERENCE_HEIGHT }
  return { width: window.innerWidth, height: window.innerHeight }
}

/**
 * O plano calibrado de 640 × 1385 encaixado no aparelho de verdade.
 *
 * Quando a proporção da tela é quase a mesma do plano, a escala usada é a
 * maior das duas e o pouco que sobra sai pelas bordas — é o que evita a
 * tarja de fundo em volta de um desenho que deveria sangrar. Quando a tela é
 * bem diferente (um monitor largo, um tablet), vale a menor: melhor deixar
 * margem do que cortar o botão.
 */
export function ReferenceCanvas({
  backgroundColor = '#FFFFFF',
  children,
  'data-testid': testId,
}: ReferenceCanvasProps) {
  const [viewport, setViewport] = useState(readViewport)

  useEffect(() => {
    const onResize = () => setViewport(readViewport())
    onResize()
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
  }, [])

  const widthScale = viewport.width / REFERENCE_WIDTH
  const heightScale = viewport.height / REFERENCE_HEIGHT
  const scaleDelta = Math.abs(widthScale - heightScale) / Math.min(widthScale, heightScale)
  const scale = scaleDelta <= 0.02 ? Math.max(widthScale, heightScale) : Math.min(widthScale, heightScale)
  const width = REFERENCE_WIDTH * scale
  const height = REFERENCE_HEIGHT * scale

  const canvas: CSSProperties = {
    position: 'absolute',
    width: REFERENCE_WIDTH,
    height: REFERENCE_HEIGHT,
    left: (viewport.width - width) / 2,
    top: (viewport.height - height) / 2,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  }

  return (
    <div
      data-testid={testId}
      style={{ position: 'fixed', inset: 0, overflow: 'hidden', backgroundColor }}
    >
      <div style={canvas}>{children}</div>
    </div>
  )
}
