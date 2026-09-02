import type { ImgHTMLAttributes } from 'react'
import bagre from '../assets/awards/bagre.png'
import craque from '../assets/awards/craque.png'
import paredao from '../assets/awards/paredao.png'
import { cn } from '../lib/cn'

/**
 * Os troféus dos três prêmios.
 *
 * São imagens, e não desenho em SVG como os ícones de comando. Os ícones são
 * traço único que herda a cor de onde estiver — é assim que o ícone da aba
 * fica verde no destino ativo. Estes são as ilustrações da patota, com ouro,
 * sombra e reflexo, e redesenhá-las em vetor seria refazê-las por aproximação.
 * Aqui elas entram como são.
 *
 * Os arquivos saem das ilustrações originais sem retoque nenhum: o que se fez
 * foi recortar o fundo branco — sem isso o quadrado apareceria por trás do
 * troféu no tema escuro —, aparar a margem vazia e reduzir para 160 pixels de
 * altura, que é o dobro do maior tamanho em que aparecem numa tela de alta
 * densidade. Guardá-las nos 2000 pixels do original seria meio megabyte para
 * desenhar 36.
 */
type TrophyProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>

/**
 * A caixa é quadrada e a imagem cabe dentro dela pelo lado maior.
 *
 * Os três troféus são mais altos do que largos, e em proporções que não batem
 * entre si. Encaixados por dentro de um quadrado, todos ficam com a mesma
 * altura e o mesmo eixo — que é o que faz uma lista de prêmios parecer
 * alinhada, em vez de três figuras avulsas.
 */
function Trophy({ src, className, ...props }: TrophyProps & { src: string }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn('object-contain', className)}
      {...props}
    />
  )
}

/** Craque da Partida: a bola de ouro coroada. */
export const AwardGoldenBall = (props: TrophyProps) => <Trophy src={craque} {...props} />

/** Paredão: a luva de ouro. */
export const AwardGlove = (props: TrophyProps) => <Trophy src={paredao} {...props} />

/** Bagre da Rodada: o bagre de ouro. */
export const AwardCatfish = (props: TrophyProps) => <Trophy src={bagre} {...props} />
