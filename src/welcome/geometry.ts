/*
 * A tela de boas-vindas é desenhada num plano fixo de 640 × 1385 e depois
 * escalada para o aparelho, exatamente como a referência de movimento foi
 * calibrada. Todas as posições deste módulo estão nessa unidade, não em
 * pixels da tela: assim o mesmo desenho cai igual no iPhone estreito e no
 * Android largo, e as marcações de tempo continuam batendo com o clipe
 * medido a 30 quadros por segundo.
 */
import type { CSSProperties } from 'react'

export const REFERENCE_WIDTH = 640
export const REFERENCE_HEIGHT = 1385

export type Box = readonly [x: number, y: number, width: number, height: number]

/** Posiciona um elemento no plano de referência. */
export function box([left, top, width, height]: Box): CSSProperties {
  return { position: 'absolute', left, top, width, height }
}

/** O mesmo, para o que precisa ficar centralizado na largura do plano. */
export function center(width: number, top: number, height: number): CSSProperties {
  return box([(REFERENCE_WIDTH - width) / 2, top, width, height])
}

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

/**
 * Progresso de 0 a 1 de um trecho da linha do tempo, em milissegundos.
 * É a peça que traduz "0.400–0.567: primeira piscada" em número.
 */
export function segment(timeMs: number, startMs: number, endMs: number) {
  if (endMs <= startMs) return timeMs >= endMs ? 1 : 0
  return clamp01((timeMs - startMs) / (endMs - startMs))
}

/**
 * Interpolação por trechos: `mix(p, [0, 0.5, 1], [0, 8, 10])` acelera no
 * começo e desacelera no fim sem precisar de uma curva fechada.
 */
export function mix(progress: number, inputs: readonly number[], outputs: readonly number[]) {
  const p = clamp01(progress)
  for (let i = 1; i < inputs.length; i += 1) {
    const start = inputs[i - 1]
    const end = inputs[i]
    if (p > end && i < inputs.length - 1) continue
    const span = end - start
    const local = span === 0 ? 1 : clamp01((p - start) / span)
    return outputs[i - 1] + (outputs[i] - outputs[i - 1]) * local
  }
  return outputs[outputs.length - 1]
}

/** A curva de entrada cúbica: começa parado e ganha velocidade. */
export function easeInCubic(progress: number) {
  const p = clamp01(progress)
  return p * p * p
}
