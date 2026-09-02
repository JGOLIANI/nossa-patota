import type { SVGProps } from 'react'

/**
 * As ilustrações dos três prêmios.
 *
 * Vivem à parte do conjunto de ícones porque são outra espécie. Os ícones são
 * comandos — voltar, fechar, buscar — desenhados em traço único que herda a
 * cor de onde estiverem, e é assim que o ícone da aba fica verde no destino
 * ativo. Estes são figuras: aparecem grandes, num cartão, e trazem cor
 * própria. Herdar cor aqui seria abrir mão do que os torna reconhecíveis.
 *
 * A paleta é fixa nos dois temas, e escolhida para isso: nada de preto puro
 * nem de branco chapado em área grande, que sumiriam num dos dois. Os tons
 * claros aparecem só por dentro de uma forma escura o bastante para contê-los.
 */
type ArtProps = SVGProps<SVGSVGElement>

/**
 * O quadro é de 48 unidades, e não de 24 como o dos ícones: figura colorida
 * pede coordenada com casa decimal a menos para as formas encaixarem.
 */
function Art({ children, ...props }: ArtProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      {children}
    </svg>
  )
}

/* ------------------------------------------------- Craque da Partida ------ */

/** Bola de ouro sobre o pedestal, como o troféu da France Football. */
export const AwardGoldenBall = (props: ArtProps) => (
  <Art {...props}>
    <path d="M13.4 44.5 16.4 33h15.2l3 11.5Z" fill="#43536A" />
    <rect x="20.6" y="27" width="6.8" height="7.4" rx="1.6" fill="#57697F" />
    <circle cx="24" cy="17" r="12.2" fill="#F5B921" />
    <path d="M24 8.6 30.9 13.6 28.3 21.7H19.7L17.1 13.6 24 8.6Z" fill="#D2930A" />
    <circle cx="18.4" cy="11.4" r="2.7" fill="#FFDE8A" />
  </Art>
)

/* -------------------------------------------------------- Paredão -------- */

/**
 * Luva de goleiro: dedos e polegar em azul, palma clara, punho no verde da
 * patota.
 *
 * A ordem das formas é o desenho: os dedos vão inteiros até o meio da luva e
 * a palma passa por cima, cobrindo as pontas de baixo. É o que faz quatro
 * dedos separados virarem uma mão só, em vez dos quatro retângulos soltos que
 * a primeira tentativa deixou.
 */
export const AwardGlove = (props: ArtProps) => (
  <Art {...props}>
    <path d="M13.6 25.4c-2.8-1.7-6.1-.8-7.2 2.1-1.1 2.9.5 6.1 3.4 7.3l5 2V25.8Z" fill="#C7D9F1" />
    <g fill="#C7D9F1">
      <rect x="13.2" y="16.4" width="6" height="20" rx="3" />
      <rect x="20" y="10.2" width="6" height="26.2" rx="3" />
      <rect x="26.8" y="8.8" width="6" height="27.6" rx="3" />
      <rect x="33.6" y="13.6" width="6" height="22.8" rx="3" />
    </g>
    <rect x="12.4" y="24.6" width="28" height="13.4" rx="5" fill="#F2F8FE" />
    <path d="M12.4 33.2h28v3.6c0 3.2-2.6 5.8-5.8 5.8H18.2c-3.2 0-5.8-2.6-5.8-5.8Z" fill="#2FB552" />
    <path d="M12.4 33.2h28v2.2h-28Z" fill="#269744" />
  </Art>
)

/* ------------------------------------------------- Bagre da Rodada ------- */

/**
 * O bagre de frente. Os barbilhões são desenhados antes da cabeça: assim eles
 * nascem por trás dela e saem pelos lados, sem precisar de folga entre o
 * traço e o contorno — folga que, num quadro deste tamanho, não existiria.
 */
export const AwardCatfish = (props: ArtProps) => (
  <Art {...props}>
    <g stroke="#93B1DE" strokeWidth="2.4" strokeLinecap="round">
      <path d="M19 15C11 19 5.2 27 6.2 34c.6 4.6 4 7 8.5 7.6" />
      <path d="M29 15c8 4 13.8 12 12.8 19-.6 4.6-4 7-8.5 7.6" />
    </g>
    <rect x="22.4" y="2.6" width="3.2" height="11" rx="1.6" fill="#C4D6EF" />
    <path d="M24 7.5C30.4 7.5 41 22.4 41 30.4 41 36.2 33.4 39.8 24 39.8 14.6 39.8 7 36.2 7 30.4 7 22.4 17.6 7.5 24 7.5Z" fill="#AFC5E8" />
    <path d="M24 7.5C17.6 7.5 7 22.4 7 30.4c0 3.6 3 6.4 7.6 8.1-2.6-2.1-4-4.9-4-8.1 0-6.8 7-18 13.4-22.9Z" fill="#8FAEDC" />
    <path d="M8.6 31.4c5-3.2 25.8-3.2 30.8 0 0 5-6.8 8.4-15.4 8.4S8.6 36.4 8.6 31.4Z" fill="#F1F8FE" />
    <path d="M8.6 31.4c5-4.4 25.8-4.4 30.8 0-5 1.6-9.4 1-15.4 1s-10.4.6-15.4-1Z" fill="#8FAEDC" />
    <path d="M15 34c3.6-2.2 14.4-2.2 18 0-3.6 2.8-14.4 2.8-18 0Z" fill="#6B4A4A" />
    <rect x="15.4" y="24.6" width="2.4" height="4.6" rx="1.2" fill="#6B6B72" />
    <rect x="30.2" y="24.6" width="2.4" height="4.6" rx="1.2" fill="#6B6B72" />
  </Art>
)
