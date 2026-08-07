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

export const IconMedal = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="15" r="5" />
    <path d="M8 3h8l-2.5 6M8 3l2.5 6" />
    <path d="m12 13 .8 1.6 1.7.2-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.2L12 13Z" />
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
