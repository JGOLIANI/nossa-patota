# Design do Nossa Patota

Aplicação das regras de `nossa-patota-regras-de-design.md` na branch `app-dev`.
O visual usa uma identidade esportiva própria, com Inter, verde de campo e
amarelo de medalha, botões com profundidade e cards arredondados.

## Sistema compartilhado

Os tokens e componentes estão em `lib/ui/design_system.dart`; o tema Flutter
está em `lib/ui/common.dart`.

| Elemento | Regra aplicada |
| --- | --- |
| Cores | Verde `#18794E`, amarelo `#FFC857`, cores semânticas e paleta específica para tema escuro |
| Espaçamento | Escala de 4, 8, 12, 16, 24, 32, 40 e 48 px |
| Tipografia | Inter; corpo de 16 px; títulos de 20–32 px |
| Cards | Raio de 20 px, borda e conteúdo com respiro |
| Ação principal | Botão de 52 px com base de 4 px, pressão, carregamento e feedback |
| Movimento | Microinterações próprias de 120–240 ms; respeitam a redução de movimento do sistema |
| Navegação | Início, Partidas, Rankings, Elenco e Perfil; conteúdo centralizado em telas grandes |
| Status | Texto e ícone junto à cor para presença, fila, erros e resultados |

## Telas

- Entrada com e-mail/senha, recuperação e criação de conta com validação clara.
- Criação de patota em quatro etapas: nome, modalidade, regras e revisão.
- Home com próxima partida, presença, vagas/fila e estatísticas do jogador.
- Rankings com destaque dos três primeiros e posição do próprio jogador.
- Perfil, elenco, histórico e partidas com os componentes compartilhados.
- Placar e times com nomes e cores existentes; compartilhamento manual de cards.
- Configurações com opções avançadas agrupadas e feedback ao copiar convites.

O progresso exibido usa estatísticas reais já disponíveis, como aproveitamento
e preenchimento de vagas. O nível informado do jogador continua sendo o dado
existente de 1 a 5, sem ser apresentado como uma progressão de XP.

## Escopo confirmado

O usuário autorizou aplicar o design com os dados atuais. Não foram criadas
novas fórmulas de XP, níveis, conquistas, metas, sequências ou retrospectiva
anual. Premiações e fórmulas `legacy-v1`, fila FIFO, permissões e histórico
continuam usando as regras existentes.

## Validação

Os testes de widgets verificam contraste dos tokens nos dois temas, bloqueio
durante carregamento, feedback do botão, onboarding com retorno e preservação
dos dados, telas estreitas com texto ampliado e posição própria no ranking.
Também permanecem os testes de fluxo e de domínio da aplicação.

A suíte completa passou com 21 testes e `flutter analyze` não reportou problemas.
O teste de compartilhamento verifica nomes longos, múltiplos confrontos e a
geração real de um PNG de 1080 × 1920 px para o card individual. O gráfico
exportado tem tipografia própria; os mesmos dados ficam disponíveis em texto
ampliável na tela. A navegação mantém os rótulos semânticos de todas as áreas e
dá mais espaço ao nome da área selecionada quando a fonte está ampliada.

```sh
flutter analyze
flutter test
flutter build web --release --no-web-resources-cdn
flutter build apk --debug
```

A revisão visual local inclui tela de entrada, Home, tema escuro, desktop e
texto a 160%. Build e execução nativos em iOS dependem de macOS/Xcode.
