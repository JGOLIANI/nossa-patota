# Nossa Patota • Flutter

Aplicação de futsal migrada para **Dart e Flutter**, com projetos web, Android e
iOS. O aplicativo Flutter está na raiz; a implementação React anterior está em
`legacy/react` para consulta. A implementação das fases 0–2 da especificação
v1.5 usa migrações incrementais que preservam os IDs e o histórico existentes.
Consulte [implantação e validação](docs/fases-0-2.md) antes de conectar o app novo
ao banco existente. `supabase/schema.sql` é referência histórica, não instalação
do backend novo.

O visual segue as regras de design do Nossa Patota. Consulte o
[sistema de design e escopo aplicado](docs/design-system.md).

Requer Flutter **3.47.6** (Dart 3.13). Instale o SDK oficial e coloque `flutter`
no PATH ([instalação oficial](https://docs.flutter.dev/install/manual)). O SDK
baixado para validar esta migração está em `.tools/flutter`,
ignorado pelo Git.

```sh
flutter pub get
flutter run -d chrome
```

Sem configuração, entra em modo demonstração: `admin@exemplo.com`, senha `demo123`.
Os dados fictícios são persistidos no aparelho. O armazenamento da demonstração
Flutter é independente do `localStorage` da versão React.

Para usar o mesmo Supabase da aplicação anterior, copie `config.example.json`
para `config.json` e preencha a URL base e a chave pública (`anon` ou publishable).

```sh
flutter run -d chrome --dart-define-from-file=config.json
flutter run -d android --dart-define-from-file=config.json
```

Use o ID do dispositivo de `flutter devices` no lugar de `android`. O Flutter
não lê `.env` automaticamente. Nunca use `service_role` no aplicativo. Novos
cadastros usam e-mail real e senha; configure confirmação, SMTP e URLs de retorno
no Supabase Auth. Cadastros criam apenas o perfil. Criar uma patota torna o criador
administrador daquela patota; entrar por código sempre cria um membro jogador.
Contas antigas continuam acessíveis pelo botão de login com usuário, preservando
o `auth.users.id`. A adoção de e-mail real requer verificação da identidade.

Funcionalidades migradas:

- Login, cadastro, sessão persistente e troca obrigatória da senha provisória.
- Jogadores, visitantes, fotos, níveis, perfis, histórico e permissões.
- Múltiplas patotas, modalidades, fusos e códigos privados com rotação.
- Agenda recorrente, edição/cancelamento, presenças e fila FIFO automática.
- Sorteio equilibrado, montagem manual e mudança de posição na rodada.
- Placar transacional derivado dos gols, assistência, gol contra e correção auditável.
- Encerramento e reabertura, estatísticas, sete rankings e filtros de período.
- Votação de 16 horas, encerramento antecipado, apuração e histórico de prêmios.
- Fotos privadas, card individual versionado e compartilhamento manual de PNG.
- Cores e nomes dos times, mapa, layout responsivo e tema do sistema.

O cliente usa `mobile_snapshot` e RPCs transacionais para presenças, times,
gols, fechamento, votos e apuração. O Supabase aplica RLS por patota, elegibilidade,
capacidade e idempotência. Fórmulas existentes permanecem identificadas como
`legacy-v1`. Atualizações usam Realtime e recarga a cada 30 segundos.

```sh
dart format --output=none --set-exit-if-changed lib test tool
flutter analyze
flutter test
dart run tool/verify_web_parity.dart
npm ci --prefix tool/db --ignore-scripts
npm test --prefix tool/db
flutter build web --release --no-web-resources-cdn --dart-define-from-file=config.json
dart run tool/prepare_web.dart
```

O web build fica em `build/web`. Para subdiretório, acrescente
`--base-href /nossa-patota/`. `prepare_web.dart` prepara um service worker que
cacheia os arquivos públicos do aplicativo. A instalação usa o menu do navegador;
no Safari, Compartilhar → Adicionar à Tela de Início. Operações de produção no
Supabase precisam de internet; o modo demonstração funciona localmente.

CI e deploy no GitHub Pages agora usam Flutter. Os secrets `SUPABASE_URL` e
`SUPABASE_ANON_KEY` substituem os nomes `VITE_*`, que continuam aceitos como
alternativa. Publicar demonstração exige `ALLOW_DEMO_BUILD=true`.

```sh
flutter build apk --release --dart-define-from-file=config.json
# No macOS, com Xcode e assinatura configurados:
flutter build ipa --release --dart-define-from-file=config.json
```

Os projetos nativos foram gerados, mas builds Android/iOS exigem seus SDKs,
dispositivos e configuração de assinatura. A validação local da migração cobre
análise, testes Dart/Flutter e build web; não valida um Supabase remoto sem
credenciais. Os testes de equivalência usam resultados congelados da versão
TypeScript em `test/fixtures/parity.json`.
