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
 * Os três são troféus, e é isso que os faz um conjunto: mesma base escura,
 * mesma placa dourada, mesmo ouro por cima. O que muda é a figura no alto —
 * a bola coroada, o bagre, a luva —, e é só ela que o olho precisa ler,
 * porque o resto já disse "prêmio".
 *
 * A paleta é fixa nos dois temas, e escolhida para isso: nada de preto puro
 * nem de branco chapado em área grande, que sumiriam num dos dois. O ouro é
 * contornado por um âmbar escuro, e é esse contorno que separa a figura do
 * fundo claro — sem ele, o dourado encosta no bege do cartão e some.
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

/**
 * A base do troféu, igual nos três.
 *
 * Ela ocupa o quarto de baixo do quadro e não mais do que isso: a esta altura
 * o prêmio aparece com 28 pixels na tela, e cada unidade que a base toma é
 * uma unidade a menos para a figura que de fato distingue um prêmio do outro.
 */
function Pedestal() {
  return (
    <g>
      {/* Degrau de baixo, o que apoia tudo. */}
      <rect x="8.4" y="40.4" width="31.2" height="5.8" rx="2.2" fill="#3B404D" />
      <rect x="8.4" y="40.4" width="31.2" height="2" rx="1" fill="#565C6C" />
      {/* Bloco de cima, mais estreito, com a placa. */}
      <path d="M14 34h20l1.6 6.4H12.4Z" fill="#2B303B" />
      <rect x="17.4" y="35.4" width="13.2" height="3.8" rx="1.4" fill="#F5B81F" />
      <rect x="17.4" y="35.4" width="13.2" height="1.4" rx="0.7" fill="#FFD75E" />
    </g>
  )
}

/**
 * Uma pepita: polígono irregular, contornado como o resto do ouro.
 *
 * São desenhadas uma a uma, e não como um monte liso, porque é a quina entre
 * elas que faz o ouro parecer bruto — e é a diferença entre um monte de
 * pepitas e um pedestal cônico qualquer.
 */
function Nugget({ x, y, r = 3.2 }: { x: number; y: number; r?: number }) {
  return (
    <path
      d={`M${x - r} ${y + r * 0.34}L${x - r * 0.72} ${y - r * 0.82}L${x + r * 0.26} ${y - r}L${x + r} ${y - r * 0.12}L${x + r * 0.62} ${y + r}L${x - r * 0.48} ${y + r}Z`}
      fill="#F5B81F"
      stroke="#A35D06"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  )
}

/* ------------------------------------------------- Craque da Partida ------ */

/**
 * A bola de ouro coroada, sobre o monte de pepitas.
 *
 * A coroa entra tombada para a direita, encavalada na bola, e não centrada em
 * cima dela: de lado ela é silhueta que se lê de longe, e o alto da bola fica
 * livre para o brilho — que é o que faz a esfera parecer esfera.
 */
export const AwardGoldenBall = (props: ArtProps) => (
  <Art {...props}>
    <Pedestal />

    {/* O monte de pepitas em que a bola se apoia. Duas fileiras, a de cima
        encavalada na bola: assim a esfera se aninha no monte em vez de
        pousar em cima dele. */}
    <Nugget x={14.4} y={32.4} />
    <Nugget x={20} y={32.6} r={3.4} />
    <Nugget x={26.2} y={32.6} r={3.4} />
    <Nugget x={31.8} y={32.4} />
    <Nugget x={17.2} y={29} r={2.9} />
    <Nugget x={23} y={29.4} r={2.9} />
    <Nugget x={29} y={29} r={2.9} />

    {/* A bola. */}
    <circle cx="23" cy="18.2" r="11.4" fill="#F9C33B" stroke="#A35D06" strokeWidth="1.4" />
    <path
      d="M23 11.4 29.6 16.2 27.1 24H18.9L16.4 16.2Z"
      fill="#EFA31A"
      stroke="#A35D06"
      strokeWidth="1.1"
      strokeLinejoin="round"
    />
    <g stroke="#A35D06" strokeWidth="1.1" strokeLinecap="round">
      <path d="M23 11.4V7M29.6 16.2l4.2-1.4M27.1 24l2.6 3.6M18.9 24l-2.6 3.6M16.4 16.2l-4.2-1.4" />
    </g>
    <path d="M15.8 12.6a8.6 8.6 0 0 1 4-3.4" stroke="#FFE9A8" strokeWidth="2.6" strokeLinecap="round" />

    {/* A coroa, tombada sobre o ombro direito da bola. */}
    <g transform="rotate(24 32.4 6.6)">
      <path
        d="M26.6 9.6 27.8 3.4l2.6 2.6 2-3.6 2 3.6 2.6-2.6 1.2 6.2Z"
        fill="#FFCE43"
        stroke="#A35D06"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <rect
        x="26.2"
        y="9"
        width="12.4"
        height="3.4"
        rx="1.5"
        fill="#EFA31A"
        stroke="#A35D06"
        strokeWidth="1.3"
      />
      <g fill="#FFCE43" stroke="#A35D06" strokeWidth="1.2">
        <circle cx="27.8" cy="3" r="1.7" />
        <circle cx="32.4" cy="1.8" r="1.7" />
        <circle cx="37" cy="3" r="1.7" />
      </g>
    </g>
  </Art>
)

/* -------------------------------------------------------- Paredão -------- */

/**
 * A luva de ouro, de palma aberta para quem olha.
 *
 * De frente ela é a mão que fecha o gol, e não um objeto largado de lado. A
 * palma é quadrada porque é ela que manda na largura dos dedos: quatro dedos
 * e três folgas têm de caber dentro dela e ainda serem contáveis com 28
 * pixels de tela. O polegar sai pela direita, apontando para cima — abaixo da
 * horizontal ele lia como um quinto dedo caído.
 */
export const AwardGlove = (props: ArtProps) => (
  <Art {...props}>
    <Pedestal />

    <g stroke="#A35D06" strokeWidth="1.4" strokeLinejoin="round">
      {/* Dedos, atrás da palma para nascerem de dentro dela. */}
      <g fill="#FFCE43">
        <rect x="14.6" y="10.6" width="4.2" height="14" rx="2.1" />
        <rect x="19.4" y="7.6" width="4.2" height="17" rx="2.1" />
        <rect x="24.2" y="8.4" width="4.2" height="16.2" rx="2.1" />
        <rect x="29" y="11.4" width="4.2" height="13.2" rx="2.1" />
      </g>

      {/* Polegar: começa dentro da palma, senão fica um apêndice colado. */}
      <rect
        x="28.6"
        y="19.4"
        width="13.4"
        height="5.8"
        rx="2.9"
        fill="#FFCE43"
        transform="rotate(-18 28.6 19.4)"
      />

      {/* Palma e punho. */}
      <rect x="14.2" y="17" width="19.4" height="13.6" rx="4.6" fill="#F9C33B" />
      <rect x="16.4" y="28.4" width="15" height="6" rx="2" fill="#EFA31A" />
    </g>

    {/* Fecho do punho e o brilho da palma. */}
    <rect x="19.4" y="29.8" width="9" height="3.2" rx="1.2" fill="#FFCE43" stroke="#A35D06" strokeWidth="1.2" />
    <path d="M18 21.4a3.4 3.4 0 0 1 3-2.2" stroke="#FFE9A8" strokeWidth="2.4" strokeLinecap="round" />
  </Art>
)

/* ------------------------------------------------- Bagre da Rodada ------- */

/**
 * O bagre de ouro, de perfil, com o rabo apoiado na base.
 *
 * De frente ele virava uma bolha: sem rabo e sem barbilhão à mostra, um peixe
 * pequeno na tela é indistinguível de qualquer outra mancha arredondada. De
 * lado, a silhueta já entrega o bicho — corpo comprido inclinado, rabo
 * bifurcado atrás, focinho na frente.
 *
 * Os barbilhões saem da boca e sobem, e é só por eles que este peixe é um
 * bagre e não uma sardinha. Por isso são traço grosso, longo e por fora da
 * silhueta: são a única parte que não pode encolher junto com o resto.
 */
export const AwardCatfish = (props: ArtProps) => (
  <Art {...props}>
    <Pedestal />

    {/* Barbilhões, antes do corpo para saírem por trás da cabeça. */}
    <g stroke="#EFA31A" strokeWidth="2.4" strokeLinecap="round" fill="none">
      <path d="M35.4 13.8c1.2-3 .8-5.8-1.2-8.4" />
      <path d="M37.4 15.6c3-.8 5-2.8 6-6" />
    </g>

    {/* Rabo bifurcado, encostando no bloco da base. */}
    <path
      d="M16.4 23.6 6.6 19.8l4.6 6.6-4.2 6.8 9.8-4Z"
      fill="#EFA31A"
      stroke="#A35D06"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />

    {/* Nadadeira de cima e nadadeira de baixo. */}
    <path
      d="M19.2 17.2 22.4 9.6l6.2 3.4Z"
      fill="#EFA31A"
      stroke="#A35D06"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path
      d="M23.4 28 26 34.4 30.6 29.6Z"
      fill="#EFA31A"
      stroke="#A35D06"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />

    {/* O corpo: elipse deitada e inclinada, focinho para cima à direita. */}
    <ellipse
      cx="25"
      cy="21.6"
      rx="12.6"
      ry="7.6"
      transform="rotate(-20 25 21.6)"
      fill="#F9C33B"
      stroke="#A35D06"
      strokeWidth="1.4"
    />
    {/* A barriga, mais clara, acompanhando a curva de baixo. */}
    <path
      d="M17.6 26.4c3.6 3 9.6 3.2 14.6-.6"
      stroke="#FFE9A8"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    {/* Guelra, boca e olho. */}
    <path d="M28.2 14.6c-2 2.6-2.2 6.2-.6 9" stroke="#A35D06" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M34 19.8c1.6.4 2.8 0 3.4-1.2" stroke="#A35D06" strokeWidth="1.4" strokeLinecap="round" />
    <circle cx="32.6" cy="16.4" r="2" fill="#3B404D" />
    <circle cx="33.2" cy="15.8" r="0.7" fill="#FFE9A8" />
  </Art>
)
