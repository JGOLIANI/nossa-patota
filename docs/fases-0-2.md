# Fases 0–2 — implementação e implantação

Escopo autorizado: Flutter; dados existentes preservados; autenticação por
e-mail/senha; fila FIFO com promoção automática; fórmulas existentes versionadas;
perfis/fotos somente para membros; compartilhamento manual. Preços, novos overall,
Superwall, pagamentos, WhatsApp e provedores de push aguardam decisões posteriores.

## Implementação

- Auth por e-mail/senha, confirmação e recuperação pelo SDK; navegação de retorno
  para recuperação; login legado por usuário e mudança de e-mail mantendo o UUID.
- Perfil separado de associação: criar patota concede admin somente nela;
  código associa como jogador. Cadastro não aceita privilégios de metadados.
- Seletor de patota e rascunho de onboarding; modalidade futsal/society/campo,
  tamanho sugerido 5/7/11, timezone IANA, cores de paleta e nomes dos times.
- Migração incremental dos dados antigos para uma patota legada, conservando
  jogadores, UUIDs, partidas, gols, votos, prêmios e vínculos Auth.
- Convite por código privado de 8 caracteres, rotação pelo admin, limite de
  5 tentativas/minuto por conta autenticada; copiar/share sheet manual.
- Agenda recorrente criada ao abrir o app como admin; horário local convertido
  para UTC no servidor; edição com versão, cancelamento motivado e restauração.
- Presença com trava por partida, limite de vagas e FIFO estável; desistência
  promove a fila; comparecimento real separado da resposta. Ausentes não ganham
  estatísticas pela escalação. Sem prazo para aceitar promoção nesta entrega.
- Sorteio legado e montagem manual: seed, versão, ratings, diferença prevista e
  explicação persistidos. Alterar times mantém os gols existentes.
- Gols/assistências/gol contra com placar derivado; correção anula evento antigo
  e cria novo; auditoria, UUID de comando e regras de autoria verificadas.
- Fechamento atômico; votação por 16 horas, proibição de auto-voto; apuração
  servidor 70% votos/30% desempenho `legacy-v1`, componentes e resultado congelados.
  Votos nominais acessíveis só ao próprio votante. Snapshot agrega via identidades
  anônimas. Reabertura mantém eventos e invalida projeções/cards/prêmios antigos.
- Fotos em bucket privado, políticas por patota/proprietário e URLs assinadas.
  Card individual vertical PNG de 1080×1920 sem foto por padrão, números próprios,
  placares e prêmios já apurados. Preview, versão e nova consulta antes de compartilhar.
- Configurações `APP_ENV=dev|homolog|prod`: demonstração permitida apenas em dev.
  CI faz análise, testes, web, APK debug e build de simulador iOS.

## Migração do banco existente

Os arquivos SQL estão em `supabase/migrations`. Não executar `schema.sql` por cima
do banco atualizado: ele é o contrato histórico anterior e reabriria políticas.

1. Fazer backup/exportação do projeto de produção e ensaiar numa cópia isolada.
   Conferir contagens e IDs de todas as tabelas esportivas e dos usuários Auth.
2. Se o projeto já usa o schema antigo, marcar SOMENTE o baseline como aplicado,
   depois de comparar o schema real com ele:
   `supabase migration repair 20261006025435 --status applied --linked`.
   Não executar novamente o baseline em produção. Em banco vazio, aplicar todos
   os arquivos em ordem, incluindo o baseline.
3. Revisar `supabase db push --dry-run --linked`, depois aplicar as duas migrações
   novas com `supabase db push --linked` no ambiente escolhido.
4. Conferir membership da patota legada e último administrador. Visitantes sem
   login continuam sem conta. Não vincular visitantes automaticamente pelo nome.
5. Conferir Auth/SMTP/URL de retorno, testar dois usuários de duas patotas, backup
   restaurável, fotos e partidas reais antes de trocar o aplicativo publicado.

A migração torna `avatars` privado. Links públicos anteriores deixam de funcionar;
o app traduz os caminhos antigos para URLs assinadas. URLs já assinadas podem
continuar válidas até expirar. Não limpar registros nem alterar senhas em massa.

Contas `usuario@patota.local` permanecem com UUID/senha antigos. A troca para e-mail
real usa o fluxo verificado de Auth; projetos com confirmação em ambos os endereços
podem exigir atendimento administrativo, porque o endereço antigo é fictício.
Não desativar segurança global nem aceitar reivindicação de conta pelo username.

## Ambientes e deep links

Copiar os exemplos para arquivos locais ignorados pelo Git. Homolog e produção
devem apontar para projetos Supabase diferentes. Os exemplos não criam projetos.
`config.dev.example.json` abre a demonstração; `config.example.json` é homolog;
`config.prod.example.json` é produção. Chave publishable preferida, anon legada aceita.

No Supabase Auth incluir `br.com.nossapatota://auth-callback/` nas URLs de retorno
nativas. Android e iOS têm esse scheme configurado. Para Chrome, usar o endereço
web exato e porta fixa (por exemplo `flutter run -d chrome --web-port=3000`) como
`AUTH_REDIRECT_URL=http://localhost:3000` no arquivo de configuração web.
App IDs atuais: Android `br.com.nossapatota.nossa_patota`;
iOS `br.com.nossapatota.nossaPatota`.

## Evidência e limites

Testes Dart com fixture congelado do TypeScript preservam estatísticas, sorteio,
PRNG e apuração; compilação JavaScript confirma a mesma equivalência no web.
Testes Flutter cobrem navegação, permissões, onboarding, multi-patota e timezone.
`npm test --prefix tool/db` executa Postgres via PGlite: dados legados, RLS entre
patotas, metadata maliciosa, último admin, rotação/rate limit, FIFO, repetição de
comandos, gols, votos privados, acesso às fotos, apuração/cards e reabertura.

PGlite usa uma conexão: não é teste de corrida simultânea entre conexões. Locks
por rodada estão no SQL; ensaio concorrente com Postgres real e carga de múltiplos
clientes continua sendo gate antes de produção. SMTP/recuperação e deep links
precisam de teste com o projeto e aparelhos reais.

Validação local em 06/10/2026: análise sem issues, 14 testes Flutter aprovados,
equivalência Dart/JavaScript aprovada, testes Postgres aprovados, build web e APK
Android debug concluídos. O APK fica em `build/app/outputs/flutter-apk/app-debug.apk`.
O APK de demonstração não usa o banco remoto nem foi instalado em aparelho real.
CI nativa foi preparada; assinaturas e submissão às lojas não foram executadas.
Build iOS exige macOS/Xcode. Produção ainda não foi migrada. O gate operacional
das fases exige rodada real, builds instalados, ambientes isolados e ensaio de
migração restaurável; código/testes locais não equivalem a esses gates concluídos.
