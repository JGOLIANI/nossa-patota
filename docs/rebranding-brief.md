# Brief de rebranding — Nossa Patota

Status: escopo preparado em 06/10/2026; integração Appllama desinstalada a
pedido do usuário. Este documento é uma proposta de trabalho, não uma identidade
visual aprovada ou uma pesquisa já executada.

## Objetivo

Evoluir a identidade visual do aplicativo Flutter com referências pesquisadas
no MCP Appllama, traduzindo os padrões observados para o contexto de futebol
amador, organização de partidas e convivência da patota.

Premissa inicial: manter o nome Nossa Patota e concentrar a mudança na marca
visual e na apresentação das telas.

## Base atual

- Inter, verde `#18794E`, amarelo `#FFC857` e temas claro/escuro.
- Tokens e componentes em `lib/ui/design_system.dart`; tema em
  `lib/ui/common.dart`.
- Entrada apresenta a marca com um ícone genérico de bola.
- Home organiza próxima partida, presença, vagas/fila e números do jogador.
- Navegação: Início, Partidas, Rankings, Elenco e Perfil.
- Ícones de instalação para Android, iOS e web; cards PNG compartilháveis.

## Pesquisa no Appllama

Buscar aplicativos de esporte, comunidade e organização de atividades.
Examinar entrada, Home, detalhes de atividade, rankings e perfil. Para cada
referência, registrar o aplicativo, a tela consultada, a observação visual e
a aplicação proposta no Nossa Patota.

Decisões a derivar dessa pesquisa:

1. Assinatura visual da marca e ícone de aplicativo.
2. Paleta, contraste e hierarquia tipográfica nos dois temas.
3. Destaque da próxima partida e da ação de confirmar presença.
4. Apresentação de resultados, rankings e estatísticas pessoais.
5. Consistência de navegação, cards, botões e estados vazios.

## Aplicação

Atualizar primeiro os componentes compartilhados e depois entrada, Home,
partidas, rankings, elenco, perfil, configurações e compartilhamento.
Propagar a identidade aos ícones nativos e web e à documentação de design.

As regras esportivas, permissões, histórico, fórmulas `legacy-v1`, fila FIFO
e cores configuradas dos times permanecem como dados do produto. Novas
funcionalidades e mudança de nome não fazem parte desta premissa visual.

## Verificação

- Executar análise e a suíte Flutter existente.
- Revisar visualmente entrada, Home, partida, ranking, perfil e card exportado.
- Conferir temas claro/escuro, tela estreita, desktop e texto ampliado.
- Conferir legibilidade dos ícones de instalação e do PNG compartilhado.
- Registrar quais referências foram efetivamente consultadas no Appllama.

## Dependência atual

O MCP `appllama` e as skills `appllama-usage` e
`appllama-app-design-skill` foram desinstalados a pedido do usuário.
A autorização OAuth não foi concluída, e nenhuma referência do serviço foi
consultada. Este brief permanece como registro do escopo proposto.

Fonte do endpoint: https://appllama.io/mcp
