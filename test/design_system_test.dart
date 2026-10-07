import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:nossa_patota/data/backend.dart';
import 'package:nossa_patota/store.dart';
import 'package:nossa_patota/ui/common.dart';
import 'package:nossa_patota/ui/patotas.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('tokens de texto têm contraste legível nos dois temas', () {
    double contrast(Color a, Color b) {
      final x = a.computeLuminance(), y = b.computeLuminance();
      return ((x > y ? x : y) + .05) / ((x < y ? x : y) + .05);
    }

    for (final brightness in Brightness.values) {
      final theme = appTheme(brightness), scheme = theme.colorScheme;
      expect(
        contrast(scheme.primary, scheme.onPrimary),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        contrast(scheme.onSurface, scheme.surface),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        contrast(scheme.onSurfaceVariant, scheme.surface),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        contrast(scheme.onSurfaceVariant, theme.scaffoldBackgroundColor),
        greaterThanOrEqualTo(4.5),
      );
    }
  });
  testWidgets('botão dá resposta tátil e bloqueia ações enquanto carrega', (
    tester,
  ) async {
    var taps = 0;
    Widget screen({
      bool loading = false,
      bool success = false,
      bool error = false,
    }) => MaterialApp(
      theme: appTheme(Brightness.light),
      home: Scaffold(
        body: Center(
          child: PrimaryButton(
            label: 'Confirmar presença',
            onPressed: () => taps++,
            loading: loading,
            success: success,
            error: error,
            successLabel: 'Presença confirmada',
          ),
        ),
      ),
    );
    await tester.pumpWidget(screen());
    final gesture = await tester.startGesture(
      tester.getCenter(find.byType(FilledButton)),
    );
    await tester.pump(PatotaMotion.fast);
    final padding = tester.widget<AnimatedPadding>(
      find.descendant(
        of: find.byType(PrimaryButton),
        matching: find.byType(AnimatedPadding),
      ),
    );
    expect(padding.padding, const EdgeInsets.only(top: PatotaSpace.xs));
    await gesture.up();
    await tester.pumpAndSettle();
    expect(taps, 1);
    await tester.pumpWidget(screen(loading: true));
    expect(find.text('Aguarde…'), findsOneWidget);
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNull,
    );
    await tester.pumpWidget(screen(success: true));
    expect(find.text('Presença confirmada'), findsOneWidget);
    expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);
    await tester.pumpWidget(screen(error: true));
    expect(find.byIcon(Icons.error_rounded), findsOneWidget);
  });
  testWidgets(
    'criação em etapas valida o nome e mantém os dados escolhidos ao voltar',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final backend = DemoBackend(
        await SharedPreferences.getInstance(),
        jsonDecode(File('assets/demo.json').readAsStringSync())
            as Map<String, dynamic>,
      );
      await backend.signUp({
        'email': 'design@example.com',
        'password': 'senha123',
        'full_name': 'Design',
      });
      final store = AppStore(backend);
      store.snapshot = await backend.fetchAll();
      addTearDown(store.dispose);
      tester.view.physicalSize = const Size(320, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          theme: appTheme(Brightness.light),
          home: PatotasPage(store),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Criar minha patota'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Continuar'));
      await tester.pumpAndSettle();
      expect(
        find.text('Informe um nome com pelo menos 2 letras para continuar.'),
        findsOneWidget,
      );
      await tester.enterText(find.byType(TextFormField), 'Turma de quinta');
      await tester.tap(find.text('Continuar'));
      await tester.pumpAndSettle();
      expect(find.text('Etapa 2 de 4'), findsOneWidget);
      await tester.tap(find.text('Society'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Voltar'));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<TextFormField>(find.byType(TextFormField))
            .controller!
            .text,
        'Turma de quinta',
      );
      await tester.tap(find.text('Continuar'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Continuar'));
      await tester.pumpAndSettle();
      expect(find.text('Etapa 3 de 4'), findsOneWidget);
      await tester.tap(find.text('Continuar'));
      await tester.pumpAndSettle();
      expect(find.text('Etapa 4 de 4'), findsOneWidget);
      await tester.tap(find.text('Criar minha patota'));
      await tester.pumpAndSettle();
      expect(store.snapshot.patota!.name, 'Turma de quinta');
      expect(store.snapshot.patota!.modality, 'society');
      expect(store.snapshot.settings.teamSize, 7);
      expect(store.isAdmin, isTrue);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
