# Onboarding e plano da patota

Implementação baseada no PDF fornecido pelo usuário, *The Ultimate Paywall &
Onboarding Playbook*, de Jake Castillo. O artigo foi lido como referência de
produto; suas sugestões não substituem as decisões do usuário.

## Decisões confirmadas

- Manter todos os recursos atuais gratuitos.
- Preparar uma oferta configurável, sem iniciar compras ou testes.
- O futuro plano Pro vale para a patota inteira.
- Preços, duração de teste e divisão comercial definitiva ainda não definidos.

## Aplicação do artigo

As páginas 4–5 orientam a duração do onboarding pelo problema resolvido e
apresentam a sequência promessa, demonstração, perguntas, progresso,
resultado personalizado e oferta. A adaptação ao Nossa Patota usa duas
perguntas: o papel na turma e a primeira necessidade a resolver.

| Etapa | Experiência no app |
| --- | --- |
| Promessa | Menos correria para organizar e mais tempo para jogar |
| Demonstração | Confirmação interativa em uma partida explicitamente fictícia |
| Papel | Organizar a patota ou participar como jogador |
| Objetivo | Presenças, equilíbrio dos times ou histórico |
| Caminho personalizado | Três ações concretas conforme as respostas |
| Oferta | Apresentação do plano da patota com continuação gratuita |

O organizador vê seis etapas de introdução. O jogador vê cinco, sem oferta
antes do cadastro. O convite não depende de assinatura do jogador.
Anual e mensal são as duas opções previstas do Pro, com anual selecionado
inicialmente. Totais e economia só aparecem quando configurados.

O fluxo usa resultados operacionais que o produto já oferece. Não apresenta
projeções inventadas, depoimentos, contadores de urgência ou números de adoção.
Não pede avaliações nem permissões durante a introdução. Os benchmarks do
artigo não são tratados como metas comprovadas para o Nossa Patota.

## Navegação e persistência

- O link `/#/onboarding` abre uma prévia desde a primeira etapa, mesmo após
  concluir a introdução ou entrar no app. A prévia não altera o rascunho,
  as escolhas nem a sessão salvos. Ao terminar, retorna à entrada normal.
- Sessões autenticadas abrem diretamente o app.
- `Já tenho conta` leva ao login existente.
- A recuperação de senha conserva seu caminho de acesso.
- Etapa, papel e objetivo ficam na chave local `patota.intro.v1` do
  SharedPreferences. O rascunho é por instalação, não um perfil comercial
  compartilhado entre dispositivos.
- Depois da oferta ou do caminho do jogador, o formulário abre em cadastro.
  Há um atalho para entrar com uma conta existente.
- Depois de autenticar, uma conta sem patotas segue para criação ou convite
  conforme o papel escolhido. Uma conta com patotas mantém o acesso normal.
- A escolha de papel na introdução não concede permissões. As permissões
  continuam vindo da criação ou associação à patota.
- O botão voltar conserva as respostas. Um rascunho inválido recomeça em uma
  etapa válida.
- O Perfil contém `Plano da patota`, disponível aos membros para conhecer a
  oferta e retornar ao app gratuitamente.

## Lance de futebol no botão de continuar

O botão de continuar avança um lance de futebol junto com as etapas: saída de bola, passe,
drible, preparação do chute e gol. O gol fica na última tela tanto do
organizador quanto do jogador. Ao voltar, o lance recua; ao retomar um
rascunho, toca apenas o trecho correspondente à etapa salva.

A ilustração é desenhada no Flutter, com interpolação contínua acompanhando
a taxa de atualização da tela e aceleração suave. Cada trecho termina e fica
parado, sem loop. Bola, chute e braços da comemoração têm transições suaves.
O lance ocupa o fundo do botão com 40% de opacidade e recorte nos cantos
arredondados. O texto da ação fica fixo e centralizado sobre a animação,
inclusive durante o gol.

Na escolha de Anual ou Mensal, o texto visual do botão vira um letreiro
`GOOOOOLLL!` que atravessa da direita para a esquerda por 2,2 segundos e então
volta à ação `Continuar gratuitamente`. Cada toque em uma opção reproduz a
comemoração. O nome acessível, tamanho e ação do botão continuam iguais;
ele permite continuar durante o letreiro. A preferência de reduzir movimento
suprime o letreiro. Selecionar planos permanece sem assinatura ou cobrança.
Toda a área do botão responde ao toque, mantendo os estados desabilitado e
carregando. Com a preferência de reduzir animações, a pose da etapa
aparece imediatamente. A oferta aberta pelo Perfil não reproduz o lance.

## Configurar a oferta

Editar `assets/patota_offer.json` e recompilar o aplicativo. O arquivo é
incluído como asset Flutter e não contém segredos.

| Campo | Uso |
| --- | --- |
| `version` | Contrato do catálogo; atualmente `1` |
| `title` | Título principal da oferta |
| `monthlyPriceCents` | Total mensal em centavos de real, ou `null` |
| `annualPriceCents` | Total anual em centavos de real, ou `null` |
| `trialDays` | Duração de teste prevista; `0` não anuncia teste |
| `futureBenefits` | Lista de recursos explicitamente apresentados como em planejamento |

Exemplo de configuração para revisão, sem ativar cobrança:

```json
{
  "version": 1,
  "title": "Mais jogo. Menos trabalho.",
  "monthlyPriceCents": 2000,
  "annualPriceCents": 18000,
  "trialDays": 0,
  "futureBenefits": ["Temporadas e recordes da turma"]
}
```

Esses valores são apenas um exemplo, não preços aprovados. O catálogo entregue
usa preços `null`, mostra `Preço a definir` e mantém `trialDays: 0`.
Valores configurados aparecem com o total e a periodicidade. A economia anual
é calculada em relação a 12 mensalidades, arredondada para baixo e omitida
quando não existe desconto.

Alterar esse arquivo nunca ativa uma assinatura. O botão continua sendo
`Continuar gratuitamente`. Nenhum entitlement é concedido, nenhuma compra é
simulada e nenhum recurso existente é bloqueado. Se o catálogo falhar ao
carregar ou for inválido, a tela usa a oferta padrão gratuita.

Os benefícios futuros são uma proposta de apresentação, rotulada como em
planejamento; o catálogo não implementa essas funcionalidades nem define
uma separação definitiva entre Free e Pro.

## Cobrança e mensuração futuras

O lançamento pago depende de catálogo comercial aprovado, integração real de
compra/restauração, validação da assinatura no servidor e políticas por patota.
O arquivo de oferta é uma configuração de apresentação, não uma fonte de
autorização de acesso.

Não há envio de analytics nesta entrega. Para uma avaliação futura do funil,
medir início, etapa alcançada, conclusão, visualização da oferta e ativação
da patota; a definição de provedor e consentimento permanece separada.

## Verificação

Os testes cobrem organizador até a criação gratuita da patota, jogador até
o convite, retomada, retorno com escolhas preservadas, rascunho inválido,
preços/total anual, continuidade gratuita, sessão existente e telas de 320 px
com texto a 160% nos dois temas. A animação tem cobertura de movimento contínuo,
progressão, gol final nos dois percursos, retorno, redução de movimento e
contenção dentro do botão, toques na ilustração e bloqueio de ações durante
carregamento ou desabilitação.
Os testes do letreiro verificam seleção dos dois planos, repetição, retorno
ao texto da ação, acessibilidade, continuidade durante a comemoração e
redução de movimento, incluindo telas estreitas com texto ampliado.

A revisão visual usa renderizações Flutter com a fonte Inter e os ícones
reais. Isso verifica layout, não desempenho de animação em aparelhos.

Validação local em 06/10/2026: 37 testes aprovados, análise sem issues,
build web release concluído e arquivos da PWA preparados. O catálogo de oferta
foi conferido no build. A integração de pagamentos permanece desativada.

```sh
flutter analyze
flutter test
flutter build web --release --no-web-resources-cdn
dart run tool/prepare_web.dart
```
