import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const IconHome = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
  </Base>
)

export const IconCalendar = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Base>
)

export const IconTrophy = (props: IconProps) => (
  <Base {...props}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M7 6H4v1a4 4 0 0 0 3 3.9M17 6h3v1a4 4 0 0 1-3 3.9" />
    <path d="M12 14v3M9 21h6M10 17h4l.5 4h-5l.5-4Z" />
  </Base>
)

export const IconUsers = (props: IconProps) => (
  <Base {...props}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.3a3.2 3.2 0 0 1 0 5.4M17.5 14.6A5.5 5.5 0 0 1 20.5 20" />
  </Base>
)

export const IconUser = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Base>
)

export const IconPlus = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 5v14M5 12h14" />
  </Base>
)

export const IconBall = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="m12 7.5 3.6 2.6-1.4 4.2H9.8L8.4 10.1 12 7.5Z" />
    <path d="M12 3v4.5M3.6 9.6l4.8.5M20.4 9.6l-4.8.5M6.5 19.4l3.3-4.9M17.5 19.4l-3.3-4.9" />
  </Base>
)

export const IconChevronLeft = (props: IconProps) => (
  <Base {...props}>
    <path d="m15 5-7 7 7 7" />
  </Base>
)

export const IconChevronRight = (props: IconProps) => (
  <Base {...props}>
    <path d="m9 5 7 7-7 7" />
  </Base>
)

export const IconChevronDown = (props: IconProps) => (
  <Base {...props}>
    <path d="m6 9 6 6 6-6" />
  </Base>
)

export const IconCheck = (props: IconProps) => (
  <Base {...props}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Base>
)

export const IconClose = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 6 18 18M18 6 6 18" />
  </Base>
)

export const IconSettings = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </Base>
)

export const IconLogout = (props: IconProps) => (
  <Base {...props}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 8 6 12l4 4M6 12h9" />
  </Base>
)

export const IconCamera = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </Base>
)

export const IconTrash = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </Base>
)

export const IconEdit = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="M14.5 6.5 17.5 9.5" />
  </Base>
)

export const IconShuffle = (props: IconProps) => (
  <Base {...props}>
    <path d="M17 4h4v4M21 4l-6.5 6.5M3 5h3l3.5 3.5M17 20h4v-4M21 20l-6-6M3 19h3l2.5-2.5" />
  </Base>
)

export const IconWhistle = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 12a6 6 0 0 0 6 6h4l7-4V9l-7-1H9a6 6 0 0 0-6 4Z" />
    <circle cx="9" cy="12" r="2" />
  </Base>
)

/** Bola de ouro: a esfera sobre o pedestal, como o troféu da France Football. */
export const IconGoldenBall = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="8" r="5.4" />
    <path d="m12 4.4 3.2 2.3-1.2 3.8h-4L8.8 6.7 12 4.4Z" />
    <path d="M12 3v1.4M15.2 6.7l2.1-.7M14 10.5l1.3 1.8M10 10.5l-1.3 1.8M8.8 6.7l-2.1-.7" />
    <path d="M12 13.4v3.1" />
    <path d="M8.6 21h6.8l-1-4.5H9.6L8.6 21Z" />
  </Base>
)

/** Bola furada: o rasgo no couro e o ar escapando por ele. */
export const IconPuncturedBall = (props: IconProps) => (
  <Base {...props}>
    <circle cx="11" cy="14" r="7.5" />
    <path d="m11 10.2 3 2.2-1.1 3.5H9.1L8 12.4l3-2.2Z" />
    <path d="M11 6.5v3.7M14 12.4l3.2-1M12.9 15.9l1.9 2.6M9.1 15.9l-1.9 2.6M8 12.4l-3.2-1" />
    <path d="m13.4 8.6 1.9-1.9" />
    <path d="M17.2 6.6c.6-.6 1.6-.6 2.2 0M20.4 4.6c.6-.6.6-1.6 0-2.2" />
  </Base>
)

export const IconSearch = (props: IconProps) => (
  <Base {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Base>
)

export const IconThumbDown = (props: IconProps) => (
  <Base {...props}>
    <path d="M7 4h9.4a2 2 0 0 1 2 1.7l.9 6A2 2 0 0 1 17.3 14H14l.8 3.6a2.2 2.2 0 0 1-3.9 1.8L7 13.5V4Z" />
    <path d="M4 4h3v9.5H4z" />
  </Base>
)

export const IconShare = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3v13" />
    <path d="m8 7 4-4 4 4" />
    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </Base>
)

export const IconGlove = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 21V9.5a1.8 1.8 0 0 1 3.6 0V11V5.2a1.8 1.8 0 0 1 3.6 0V11V6.6a1.8 1.8 0 0 1 3.6 0V13c0 4-1.6 8-4.4 8H6Z" />
  </Base>
)

/* ------------------------------------------------------- Ícones sólidos ---- */

/**
 * A barra de abas do iOS troca o ícone vazado pelo preenchido no destino
 * ativo — é assim que ela mostra onde você está sem depender só da cor.
 */
function Solid({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      {children}
    </svg>
  )
}

export const IconHomeSolid = (props: IconProps) => (
  <Solid {...props}>
    <path d="M11.35 2.83a1 1 0 0 1 1.3 0l9 7.85c.33.29.37.79.08 1.12a.8.8 0 0 1-.6.27H20V19a2.5 2.5 0 0 1-2.5 2.5H14.5V16a2.5 2.5 0 0 0-5 0v5.5H6.5A2.5 2.5 0 0 1 4 19v-6.93h-1.13a.8.8 0 0 1-.6-.27.79.79 0 0 1 .08-1.12l9-7.85Z" />
  </Solid>
)

export const IconCalendarSolid = (props: IconProps) => (
  <Solid {...props}>
    <path d="M7.5 2.4a1 1 0 0 1 1 1V5h7V3.4a1 1 0 1 1 2 0v1.72A4 4 0 0 1 21 9v.5H3V9a4 4 0 0 1 3.5-3.88V3.4a1 1 0 0 1 1-1Z" />
    <path d="M3 11.5h18V18a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 18v-6.5Z" />
  </Solid>
)

export const IconTrophySolid = (props: IconProps) => (
  <Solid {...props}>
    <path d="M6.8 3h10.4a1 1 0 0 1 1 1v4.5a6.2 6.2 0 0 1-5.2 6.12V17h2.13a1 1 0 0 1 .98.8l.62 3.1a1 1 0 0 1-.98 1.2H9.23a1 1 0 0 1-.98-1.2l.62-3.1a1 1 0 0 1 .98-.8H12v-2.38A6.2 6.2 0 0 1 5.8 8.5V4a1 1 0 0 1 1-1Z" />
    <path d="M4.6 5.6v5.34A4.3 4.3 0 0 1 2 7V6.6a1 1 0 0 1 1-1h1.6ZM19.4 5.6H21a1 1 0 0 1 1 1V7a4.3 4.3 0 0 1-2.6 3.94V5.6Z" />
  </Solid>
)

export const IconUsersSolid = (props: IconProps) => (
  <Solid {...props}>
    <circle cx="9.2" cy="8" r="3.7" />
    <path d="M9.2 13.2a6.7 6.7 0 0 1 6.7 6.5c0 .9-.75 1.6-1.65 1.6H4.15c-.9 0-1.65-.7-1.65-1.6a6.7 6.7 0 0 1 6.7-6.5Z" />
    <circle cx="17.6" cy="7.4" r="2.9" />
    <path d="M17.6 12.2c-.85 0-1.66.16-2.4.45a8.6 8.6 0 0 1 2.5 5.75c0 .38-.06.75-.17 1.1h2.99c.87 0 1.58-.7 1.58-1.57a5.7 5.7 0 0 0-4.5-5.73Z" />
  </Solid>
)
