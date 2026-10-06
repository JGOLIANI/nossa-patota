# Revisão da especificação Nossa Patota v1.5

Atualização de 06/10/2026: o usuário confirmou fases 0–2, preservação dos dados,
e-mail/senha, FIFO com promoção automática, fórmulas legadas versionadas e
perfis/fotos restritos aos membros com compartilhamento manual. A comparação
abaixo registra o diagnóstico anterior à implementação. O estado entregue e os
gates operacionais pendentes estão em [fases-0-2.md](fases-0-2.md).

Data: 05/10/2026. Branch examinada: `app-dev`.

Fonte: `nossa-patota-especificacao-flutter-supabase-superwall-v1.5.md`,
versão 1.5 de 01/10/2026, fornecida pelo usuário.

Esta revisão compara requisitos com o código local. Não comprova o estado de
um Supabase remoto, a configuração das lojas ou builds nativos. Nenhuma feature,
migração de banco ou integração externa foi alterada nesta revisão.

## Decisões solicitadas ao usuário

1. Escopo: fases 0–2 primeiro, todas as fases em entregas sequenciais ou features
   escolhidas pelo usuário.
2. Base: evolução com preservação dos dados atuais ou uma base nova com banco de
   desenvolvimento separado. A frase “começa do zero” do documento conflita com
   o contexto de migração da aplicação existente; não implica autorização para
   apagar ou substituir os dados.
3. Auth: e-mail/senha com recuperação, usuário/senha atual ou Google/Apple.

As respostas são necessárias antes de implementar a nova estrutura de contas,
patotas e isolamento de dados. As demais decisões serão perguntadas antes da
feature correspondente; exemplos/propostas do documento não serão tratados
como escolhas comerciais ou regras aprovadas.

## Comparação por feature

“Parcial” significa que há uma implementação relacionada, mas os critérios de
aceite da v1.5 não estão todos atendidos.

| Seção | Feature | Estado local | Trabalho necessário |
|---|---|---|---|
| 6.1 | Agenda e presença | Parcial | Agenda recorrente e respostas existem; faltam patota/membership, fuso IANA, séries com exceções, cancelamento com motivo e comparecimento/no-show separado da inscrição. |
| 6.2 | Capacidade e fila | Parcial | Há RPC de resposta e fila; faltam posição explícita na UI, oferta de vaga com prazo, expiração, políticas configuráveis e auditoria. Revisar também as alterações administrativas que hoje usam comandos separados. |
| 6.3 | Balanceamento | Parcial | Algoritmo Dart com PRNG determinístico, estatísticas e distribuição de goleiros; faltam versões persistidas da geração, seed/parâmetros, publicação auditável, travas e explicações. |
| 6.4 | Carreira/overall | Parcial | Perfil, estatísticas e rating usado no balanceamento existem; faltam overall público 0–100 aprovado, snapshots versionados, confiança, evolução, contestação e privacidade. |
| 6.5 | Jogo ao vivo | Parcial | Gols, assistências, gol contra, correção, placar e fechamento existem; faltam RPCs atômicos para ações/fechamento, idempotência, autoria/minuto/motivo e reversões preservadas. Outras métricas dependem da taxonomia aprovada. |
| 6.6 | Prêmios híbridos | Parcial | Há cálculo 70% votos/30% desempenho em Dart, elegibilidade e janela de votação via RPC; faltam apuração atômica no servidor, regras versionadas, componentes persistidos, explicação e correção auditável. Os pesos existentes não equivalem à aprovação da proposta da v1.5. |
| 6.7 | Temporadas | Ausente | Gestão de ciclos, associação de partidas, regras, totais reconstruíveis, fechamento e versões. |
| 6.8 | Recordes/rivalidades | Parcial | Rankings agregados existem; faltam recordes/sequências definidos, comparação consentida e controles de exposição. |
| 6.9 | Milestones | Ausente | Catálogo versionado, progresso derivado, concessões/revogações idempotentes, streaks e cards. |
| 6.10 | Retrospectivas | Parcial | Há resumo compartilhável de rodada; faltam snapshots versionados, temporada, Meu Ano, Ano da Patota e revisão coletiva. |
| 6.11 | Compartilhamento/links | Parcial | Share sheet, texto e PNG existem; faltam links com token/hash, escopo, validade, revogação e autorização pública. |
| 6.12 | Push/WhatsApp | Ausente | Preferências/consentimento, dispositivos, envio servidor, jobs/deduplicação e adaptador oficial; WhatsApp é fase posterior e depende do provedor escolhido. |
| 6.13 | Financeiro | Ausente | Obrigações, pagamentos informados/confirmados, ledger/reversões, despesas e exportação; Pix depende de escopo e provedor. |
| 6.14 | Free/Pro | Ausente | Entitlements por patota no servidor, assinatura, ciclo de billing, uso/limites e SDK Superwall. Preço e SKUs não estão decididos. |
| 6.15 | Onboarding | Ausente | Promessa/demonstração, respostas retomáveis, criação/entrada em patota e ativação; analytics/paywall dependem de decisões próprias. |
| 6.16 | Central do organizador | Parcial | Home mostra partida e presença; falta projeção operacional com fila, alertas/atalhos e, posteriormente, financeiro. |
| 6.17 | Marketplace | Ausente | Quadro de pedidos/ofertas e reserva; explicitamente posterior ao MVP e condicionado a políticas de operação. |
| 6.18 | Modalidade | Ausente | Catálogo Futsal/Society/Campo, presets versionados e snapshot de regras históricas. |
| 6.19 | Código randomizado | Parcial | Existe um código global editável/verificado no cadastro; faltam código por patota, geração/rotação segura, rate limiting e membership idempotente/aprovação. |
| 6.20 | Identidade dos times | Parcial | Times possuem nome/cor; faltam defaults por patota, paleta validada, override publicado e auditoria/versionamento. |
| 6.21 | Card individual | Ausente | Card vertical por jogador/partida finalizada, preview, autorização, privacidade e versões após correções. O PNG atual é coletivo. |

## Diferenças estruturais

- `lib/models.dart` e `supabase/schema.sql` não têm entidades `patotas`,
  `profiles` ou `patota_members`. Papéis estão no jogador e as configurações
  ficam na linha global `patota_settings/default`.
- No esquema atual, `rounds` representa a rodada e `matches` os confrontos
  entre times dentro dela. A v1.5 usa `matches` para a ocorrência agendada.
  Uma migração precisa resolver essa diferença sem perder confrontos,
  eventos, votos e estatísticas existentes.
- `lib/data/backend.dart` usa usuário convertido em endereço
  `usuario@patota.local`. Recuperação por e-mail/OAuth exige outro contrato
  de identidade e configuração de redirects/deep links.
- As leituras das tabelas esportivas usam políticas `authenticated using
  (true)`. Esse modelo não isola múltiplas patotas. Membership e escopo devem
  entrar no banco, consultas, Realtime, RPCs e Storage antes de habilitar
  criação/entrada em grupos distintos.
- Avatares estão em bucket público e o cliente usa `getPublicUrl`. A v1.5
  especifica bucket privado por padrão, URLs assinadas e política de
  retenção/exclusão. O tratamento de fotos existentes precisa ser definido.
- `lib/store.dart` registra/edita eventos, atualiza placares e encerra/apura
  partidas em várias operações do cliente. A v1.5 requer atomicidade e
  idempotência servidor para essas mutações.
- CI valida Dart/Flutter e web. Não há pipeline validado de release Android/iOS,
  configurações de push, Superwall ou três ambientes isolados.
- A v1.5 coloca Flutter Web fora do primeiro escopo. O suporte web existente
  não deve ser removido automaticamente sem uma decisão do usuário.

## Ordem proposta, sujeita às respostas

1. Fundação: contrato de identidade e patota, estratégia de migração, schema
   versionado, RLS por membership, ambientes e navegação/onboarding básico.
2. Rodada confiável: modalidade/código, agenda/fuso, resposta idempotente,
   capacidade/fila, cancelamento/comparecimento e compartilhamento manual.
3. Dados esportivos: comandos atômicos, geração e identidade versionadas,
   premiações auditáveis e card individual.
4. Carreira: fórmula aprovada, temporadas, recordes, milestones e retrospectiva.
5. Monetização: matriz Free/Pro aprovada, entitlements, Superwall/produtos e
   testes de compra/restore/webhook. Nunca simular uma assinatura ativa real.
6. Integrações posteriores: push conforme configuração, WhatsApp, Pix e
   marketplace nos gates definidos pelo documento e pelo usuário.

## Decisões por etapa e verificação

- Rodada: capacidade/defaults, visitantes, FIFO/prioridade, prazo de promoção,
  estados de comparecimento e timezone.
- Esporte: estatísticas registradas, elegibilidade, categorias (inclusive
  manter/remover “Bagre”), fórmula/pesos e desempates; defaults de modalidade,
  paleta/tamanho dos times e privacidade.
- Social: escopo/expiração de links, métricas e templates dos cards,
  elegibilidade anual, consentimento de fotos e comparações.
- Financeiro/Pro: caixa manual/processamento, limites, preço/trial/SKUs,
  associação comprador–patota, cancelamento/grace/refund e mecanismo de
  verificação de billing escolhido.
- Integrações: projeto Supabase de desenvolvimento, credenciais públicas por
  ambiente, package/bundle IDs, domínio de links, push/analytics/WhatsApp/Pix.
  Segredos pertencem ao servidor; não pedir que sejam colados em conversa.

Validar com testes de domínio, autorização entre duas patotas, RPCs concorrentes
para vagas/fila, repetição idempotente, reconciliação após correções e testes
Flutter dos fluxos. Builds nativos e integrações reais precisam de seus
ambientes; mocks não comprovam compra, push ou webhooks de produção.
