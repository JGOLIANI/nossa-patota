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
 * A defesa: a mão fechando na bola.
 *
 * A luva sozinha era só um objeto; com a bola dentro dela vira o lance que dá
 * nome ao prêmio. A mão vem inclinada, como quem sobe para pegar, e a bola
 * fica atrás, aparecendo por cima dos dedos.
 *
 * A palma é quadrada de propósito: 16 de largura por 16 de altura visível
 * (os outros 4 do retângulo ficam sob o punho verde). Deitada, como era
 * antes, a mão lia como uma pá — e é a palma que manda na largura dos dedos,
 * porque quatro dedos e três folgas têm de caber dentro dela. Em 16, isso dá
 * dedos de 2,8 com folga de 1,2: fino o bastante para se contar os quatro,
 * largo o bastante para nenhum deles sumir no tamanho da cédula de votação.
 *
 * O grupo é girado em torno de (24, 24) e depois arrastado: a rotação sozinha
 * jogava a mão para a direita, por cima da bola, em vez de por baixo dela.
 */
export const AwardGlove = (props: ArtProps) => (
  <Art {...props}>
    <circle cx="31" cy="15" r="12.4" fill="#E3EBF6" />
    <path d="M31 7.2 37.5 11.9 35 19.6H27L24.5 11.9 31 7.2Z" fill="#A9BACF" />
    <g stroke="#A9BACF" strokeWidth="1.8" strokeLinecap="round">
      <path d="M31 2.6v4.6M37.5 11.9l4.4-1.4M35 19.6l2.7 3.7M27 19.6l-2.7 3.7M24.5 11.9l-4.4-1.4" />
    </g>

    <g transform="translate(-4 -1.5) rotate(-34 24 24)">
      <path d="M15.8 31.4 8.8 25" stroke="#5566C4" strokeWidth="4" strokeLinecap="round" />
      <g fill="#6C7FE0">
        <rect x="15.4" y="14" width="2.8" height="18" rx="1.4" />
        <rect x="19.4" y="8.8" width="2.8" height="23.2" rx="1.4" />
        <rect x="23.4" y="7.6" width="2.8" height="24.4" rx="1.4" />
        <rect x="27.4" y="11.8" width="2.8" height="20.2" rx="1.4" />
      </g>
      <rect x="14.8" y="23" width="16" height="20" rx="4.6" fill="#8093E8" />
      <rect x="17.6" y="28.4" width="10.4" height="3" rx="1.5" fill="#FBB040" />
      <path d="M14.8 36.6h16v1.8c0 2.54-2.06 4.6-4.6 4.6H19.4c-2.54 0-4.6-2.06-4.6-4.6Z" fill="#2FB552" />
    </g>
  </Art>
)

/* ------------------------------------------------- Bagre da Rodada ------- */

/**
 * O bagre de frente, com os barbilhões subindo.
 *
 * Eles são desenhados antes da cabeça: assim nascem por trás dela e saem
 * pelos lados, sem precisar de folga entre o traço e o contorno — folga que,
 * num quadro deste tamanho, não existiria. E terminam em cima, nos cantos que
 * a cabeça triangular deixa livres, que é para onde eles apontam no peixe.
 */
export const AwardCatfish = (props: ArtProps) => (
  <Art {...props}>
    <g stroke="#93B1DE" strokeWidth="2.4" strokeLinecap="round">
      <path d="M17 33C9 31 3.6 24 4.6 15.5 5.2 11 7 8 9.6 6" />
      <path d="M31 33c8-2 13.4-9 12.4-17.5C42.8 11 41 8 38.4 6" />
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
