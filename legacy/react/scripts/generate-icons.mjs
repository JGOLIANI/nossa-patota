#!/usr/bin/env node
/**
 * Gera os ícones PNG do PWA sem depender de nenhuma biblioteca externa:
 * desenha os pixels na mão e grava o PNG com o `zlib` do próprio Node.
 *
 *   npm run icons
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/icons')

// ---------------------------------------------------------------- PNG ------

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0 // filtro "none"
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ------------------------------------------------------------- desenho -----

const BG_TOP = [16, 185, 129]
const BG_BOTTOM = [4, 120, 87]
const BALL = [255, 255, 255]
const PATTERN = [12, 24, 41]

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

function insideRoundedRect(x, y, size, radius) {
  const min = radius
  const max = size - radius
  const cx = Math.min(Math.max(x, min), max)
  const cy = Math.min(Math.max(y, min), max)
  return Math.hypot(x - cx, y - cy) <= radius
}

function insidePolygon(x, y, points) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSq))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/**
 * Uma bola de futsal: círculo branco, pentágono central escuro e as costuras
 * saindo de cada vértice. Desenhado com supersampling 2x para suavizar.
 */
function renderIcon(size, { maskable = false } = {}) {
  const scale = 2
  const dim = size * scale
  const rgba = Buffer.alloc(size * size * 4)

  const radius = maskable ? 0 : dim * 0.22
  const center = dim / 2
  const ballRadius = maskable ? dim * 0.26 : dim * 0.31
  const pentaRadius = ballRadius * 0.42
  const seam = ballRadius * 0.11

  const pentagon = []
  for (let i = 0; i < 5; i += 1) {
    const angle = (-90 + i * 72) * (Math.PI / 180)
    pentagon.push([center + pentaRadius * Math.cos(angle), center + pentaRadius * Math.sin(angle)])
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0

      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const px = x * scale + sx + 0.5
          const py = y * scale + sy + 0.5

          if (!maskable && !insideRoundedRect(px, py, dim, radius)) continue

          const background = mix(BG_TOP, BG_BOTTOM, (px + py) / (dim * 2))
          let color = background

          const distance = Math.hypot(px - center, py - center)
          if (distance <= ballRadius) {
            color = BALL
            if (insidePolygon(px, py, pentagon)) {
              color = PATTERN
            } else {
              for (const [vx, vy] of pentagon) {
                const angle = Math.atan2(vy - center, vx - center)
                const ex = center + Math.cos(angle) * ballRadius
                const ey = center + Math.sin(angle) * ballRadius
                if (distanceToSegment(px, py, vx, vy, ex, ey) <= seam / 2) {
                  color = PATTERN
                  break
                }
              }
            }
          }

          r += color[0]
          g += color[1]
          b += color[2]
          a += 255
        }
      }

      const samples = scale * scale
      const offset = (y * size + x) * 4
      const coverage = a / samples / 255
      rgba[offset] = coverage > 0 ? Math.round(r / (a / 255)) : 0
      rgba[offset + 1] = coverage > 0 ? Math.round(g / (a / 255)) : 0
      rgba[offset + 2] = coverage > 0 ? Math.round(b / (a / 255)) : 0
      rgba[offset + 3] = Math.round(coverage * 255)
    }
  }

  return encodePng(size, size, rgba)
}

// --------------------------------------------------------------- saída -----

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#10b981"/>
      <stop offset="1" stop-color="#047857"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <circle cx="32" cy="32" r="20" fill="#ffffff"/>
  <path d="M32 24.6 38 29l-2.3 7h-7.4L26 29l6-4.4Z" fill="#0c1829"/>
  <g stroke="#0c1829" stroke-width="2.4" stroke-linecap="round">
    <path d="M32 24.6V16M38 29l7.6-2.6M35.7 36l4.7 6.4M28.3 36l-4.7 6.4M26 29l-7.6-2.6"/>
  </g>
</svg>
`

mkdirSync(outDir, { recursive: true })

const targets = [
  { file: resolve(outDir, 'icon-192.png'), size: 192, options: {} },
  { file: resolve(outDir, 'icon-512.png'), size: 512, options: {} },
  { file: resolve(outDir, 'icon-maskable-512.png'), size: 512, options: { maskable: true } },
  { file: resolve(root, 'public/apple-touch-icon.png'), size: 180, options: { maskable: true } },
]

for (const target of targets) {
  writeFileSync(target.file, renderIcon(target.size, target.options))
  console.log(`gerado ${target.file.replace(`${root}/`, '')}`)
}

writeFileSync(resolve(root, 'public/favicon.svg'), FAVICON_SVG)
console.log('gerado public/favicon.svg')
