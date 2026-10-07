import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:nossa_patota/acquisition.dart';
import 'package:nossa_patota/data/backend.dart';
import 'package:nossa_patota/main.dart';
import 'package:nossa_patota/store.dart';
import 'package:nossa_patota/ui/common.dart';
import 'package:nossa_patota/ui/onboarding.dart';
import 'package:nossa_patota/ui/paywall.dart';
import 'package:nossa_patota/ui/onboarding_football.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));

  Future<AppStore> store() async {
    final backend = DemoBackend(
      await SharedPreferences.getInstance(),
      jsonDecode(File('assets/demo.json').readAsStringSync())
          as Map<String, dynamic>,
    );
    final result = AppStore(backend);
    await result.initialize();
    return result;
  }

  Future<void> tap(WidgetTester tester, String text) async {
    final textFinder = find.text(text);
    for (
      var attempt = 0;
      textFinder.evaluate().isEmpty && attempt < 30;
      attempt++
    ) {
      await tester.drag(find.byType(Scrollable).first, const Offset(0, -120));
      await tester.pumpAndSettle();
    }
    final finder = textFinder.last;
    await tester.ensureVisible(finder);
    await tester.pumpAndSettle();
    await tester.tap(finder);
    await tester.pump();
    await tester.runAsync(
      () => rootBundle.loadString('assets/patota_offer.json'),
    );
    await tester.pumpAndSettle();
  }

  testWidgets(
    'organizador experimenta, personaliza e cria patota gratuitamente',
    (tester) async {
      final app = await store();
      await tester.pumpWidget(PatotaApp(app));
      await tester.pumpAndSettle();
      expect(find.text('Menos correria.\nMais bola rolando.'), findsOneWidget);
      await tap(tester, 'Ver como funciona');
      await tap(tester, 'Confirmar presença no exemplo');
      expect(find.text('9 de 10 presenças'), findsOneWidget);
      expect(app.signedIn, isFalse);
      expect(app.snapshot.rounds, isEmpty);
      await tap(tester, 'Continuar');
      await tap(tester, 'Eu organizo a patota');
      await tap(tester, 'Continuar');
      await tap(tester, 'Montar times equilibrados');
      await tap(tester, 'Ver meu caminho');
      expect(find.text('Prepare os times'), findsOneWidget);
      await tap(tester, 'Conhecer o plano');
      expect(find.byType(PaywallPage), findsOneWidget);
      final goal =
          tester
                  .widget<CustomPaint>(
                    find.byKey(const ValueKey('onboarding-football-scene')),
                  )
                  .painter!
              as FootballPlayPainter;
      expect(goal.scored, isTrue);
      expect(find.text('GRATUITO POR ENQUANTO'), findsOneWidget);
      await tap(tester, 'Continuar gratuitamente');
      expect(find.text('Seu lugar no time começa aqui'), findsOneWidget);
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Nome completo'),
        'Organizador Novo',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'E-mail'),
        'organizador@exemplo.com',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Senha'),
        'senha123',
      );
      await tap(tester, 'Criar meu acesso');
      expect(find.text('Como a turma se chama?'), findsOneWidget);
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Nome da patota'),
        'Turma Nova',
      );
      for (var i = 0; i < 3; i++) {
        await tap(tester, 'Continuar');
      }
      await tap(tester, 'Criar minha patota');
      expect(app.snapshot.patota!.name, 'Turma Nova');
      expect(app.isAdmin, isTrue);
      expect(find.byType(AppShell), findsOneWidget);
      final saved = IntroDraft.load(await SharedPreferences.getInstance());
      expect(saved.completed, isTrue);
      expect(saved.role, IntroRole.organizer);
      expect(saved.goal, IntroGoal.teams);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('jogador segue para convite sem passar pela oferta', (
    tester,
  ) async {
    final app = await store();
    await tester.pumpWidget(PatotaApp(app));
    await tester.pumpAndSettle();
    await tap(tester, 'Ver como funciona');
    await tap(tester, 'Continuar');
    await tap(tester, 'Eu venho para jogar');
    await tap(tester, 'Continuar');
    await tap(tester, 'Organizar presenças');
    await tap(tester, 'Ver meu caminho');
    expect(find.text('Entre com um convite'), findsOneWidget);
    final goal =
        tester
                .widget<CustomPaint>(
                  find.byKey(const ValueKey('onboarding-football-scene')),
                )
                .painter!
            as FootballPlayPainter;
    expect(goal.scored, isTrue);
    await tap(tester, 'Criar minha conta');
    expect(find.byType(PaywallPage), findsNothing);
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Nome completo'),
      'Jogador Novo',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'E-mail'),
      'jogador@exemplo.com',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Senha'),
      'senha123',
    );
    await tap(tester, 'Criar meu acesso');
    expect(find.text('Tem convite? Bora entrar.'), findsOneWidget);
    expect(app.snapshot.patotas, isEmpty);
    expect(app.isAdmin, isFalse);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('rascunho retoma etapa e conserva escolhas ao voltar', (
    tester,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    await const IntroDraft(
      step: 4,
      role: IntroRole.organizer,
      goal: IntroGoal.history,
    ).save(prefs);
    Widget screen(int revision) => MaterialApp(
      theme: appTheme(Brightness.light),
      home: IntroFlow(
        key: ValueKey(revision),
        preferences: prefs,
        initialDraft: IntroDraft.load(prefs),
        onFinished: (_) {},
      ),
    );
    await tester.pumpWidget(screen(1));
    await tester.pumpAndSettle();
    expect(find.text('Feche o jogo e compartilhe'), findsOneWidget);
    await tester.tap(find.byTooltip('Voltar'));
    await tester.pumpAndSettle();
    expect(find.text('Etapa 4 de 6'), findsOneWidget);
    await tester.pumpWidget(screen(2));
    await tester.pumpAndSettle();
    final option = tester.widget<IntroOption>(
      find.byWidgetPredicate(
        (w) => w is IntroOption && w.title == 'Guardar a história dos jogos',
      ),
    );
    expect(option.selected, isTrue);
    await tap(tester, 'Ver meu caminho');
    expect(find.text('Feche o jogo e compartilhe'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test(
    'rascunho corrompido ou incompleto retorna a uma etapa válida',
    () async {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(introPreferenceKey, '{broken');
      expect(IntroDraft.load(prefs).step, 0);
      await prefs.setString(
        introPreferenceKey,
        jsonEncode({'version': 1, 'step': 5, 'role': 'unknown'}),
      );
      expect(IntroDraft.load(prefs).step, 2);
      await prefs.setString(
        introPreferenceKey,
        jsonEncode({'version': 1, 'step': 5, 'role': 'organizer'}),
      );
      expect(IntroDraft.load(prefs).step, 3);
    },
  );

  testWidgets('oferta configurada mostra total anual e continua sem cobrar', (
    tester,
  ) async {
    var continued = 0;
    final offer = PatotaOffer.fromJson({
      'version': 1,
      'title': 'Plano da nossa turma',
      'monthlyPriceCents': 2000,
      'annualPriceCents': 18000,
      'trialDays': 7,
      'futureBenefits': ['Temporadas'],
    });
    await tester.pumpWidget(
      MaterialApp(
        theme: appTheme(Brightness.light),
        home: PaywallPage(offer: offer, onContinue: () => continued++),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('R\$ 180,00 por ano'), 250);
    expect(find.text('25% de economia'), findsOneWidget);
    await tap(tester, 'Mensal');
    expect(find.text('R\$ 20,00 por mês'), findsOneWidget);
    await tap(tester, 'Continuar gratuitamente');
    expect(continued, 1);
    expect(find.textContaining('Teste previsto de 7 dias'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'telas estreitas com texto ampliado são legíveis nos dois temas',
    (tester) async {
      tester.view.physicalSize = const Size(320, 740);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final prefs = await SharedPreferences.getInstance();
      for (final brightness in Brightness.values) {
        for (var step = 0; step < 6; step++) {
          await tester.pumpWidget(
            MaterialApp(
              key: ValueKey('$brightness.$step'),
              theme: appTheme(brightness),
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(textScaler: const TextScaler.linear(1.6)),
                child: child!,
              ),
              home: IntroFlow(
                preferences: prefs,
                initialDraft: IntroDraft(
                  step: step,
                  role: IntroRole.organizer,
                  goal: IntroGoal.history,
                ),
                onFinished: (_) {},
              ),
            ),
          );
          await tester.runAsync(
            () => rootBundle.loadString('assets/patota_offer.json'),
          );
          await tester.pumpAndSettle();
          expect(
            tester.takeException(),
            isNull,
            reason: '$brightness step $step',
          );
          if (step == 5) {
            await tap(tester, 'Como funciona o plano?');
            expect(find.text('Como funciona o plano'), findsOneWidget);
            expect(tester.takeException(), isNull);
          }
        }
      }
    },
  );

  testWidgets('sessão existente abre o app sem onboarding nem oferta', (
    tester,
  ) async {
    final app = await store();
    await app.signIn('admin', 'demo');
    await tester.pumpWidget(PatotaApp(app));
    await tester.pumpAndSettle();
    expect(find.byType(AppShell), findsOneWidget);
    expect(find.byType(IntroFlow), findsNothing);
    expect(find.byType(PaywallPage), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('link direto reabre onboarding concluído sem alterar rascunho', (
    tester,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    await const IntroDraft(
      step: 4,
      role: IntroRole.player,
      goal: IntroGoal.history,
      completed: true,
    ).save(prefs);
    final saved = prefs.getString(introPreferenceKey);
    final app = await store();
    await tester.pumpWidget(PatotaApp(app));
    await tester.pumpAndSettle();
    expect(find.byType(IntroFlow), findsNothing);
    tester
        .state<NavigatorState>(find.byType(Navigator).first)
        .pushNamed('/onboarding');
    await tester.pumpAndSettle();
    expect(find.text('Etapa 1 de 6'), findsOneWidget);
    await tap(tester, 'Ver como funciona');
    expect(find.text('Etapa 2 de 6'), findsOneWidget);
    expect(prefs.getString(introPreferenceKey), saved);
    await tap(tester, 'Já tenho conta');
    expect(find.byType(IntroFlow), findsNothing);
    expect(prefs.getString(introPreferenceKey), saved);
    expect(app.signedIn, isFalse);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets(
    'abertura pelo link mostra onboarding e conserva sessão autenticada',
    (tester) async {
      final prefs = await SharedPreferences.getInstance();
      final app = await store();
      await app.signIn('admin', 'demo');
      final user = app.current!.id;
      tester.binding.platformDispatcher.defaultRouteNameTestValue =
          '/onboarding';
      addTearDown(
        tester.binding.platformDispatcher.clearDefaultRouteNameTestValue,
      );
      await tester.pumpWidget(PatotaApp(app));
      await tester.pumpAndSettle();
      expect(find.text('Etapa 1 de 6'), findsOneWidget);
      await tap(tester, 'Já tenho conta');
      expect(find.byType(AppShell), findsOneWidget);
      expect(app.current!.id, user);
      expect(prefs.containsKey(introPreferenceKey), isFalse);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
