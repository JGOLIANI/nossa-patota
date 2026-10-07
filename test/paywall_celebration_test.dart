import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nossa_patota/acquisition.dart';
import 'package:nossa_patota/ui/common.dart';
import 'package:nossa_patota/ui/onboarding_football.dart';
import 'package:nossa_patota/ui/paywall.dart';

void main() {
  final marquee = find.byKey(const ValueKey('goal-marquee'));
  GoalMarqueePainter painter(WidgetTester tester) =>
      tester.widget<CustomPaint>(marquee).painter! as GoalMarqueePainter;

  Future<void> select(WidgetTester tester, String plan) async {
    for (
      var attempt = 0;
      find.text(plan).evaluate().isEmpty && attempt < 30;
      attempt++
    ) {
      await tester.drag(
        find.byType(Scrollable).first,
        Offset(0, plan == 'Anual' ? 120 : -120),
      );
      await tester.pumpAndSettle();
    }
    await tester.ensureVisible(find.text(plan));
    await tester.pumpAndSettle();
    await tester.tap(find.text(plan));
    await tester.pump();
  }

  Widget screen({
    VoidCallback? onContinue,
    bool reduced = false,
    Brightness brightness = Brightness.light,
    double scale = 1,
    double? progress = 1,
  }) => MaterialApp(
    key: ValueKey('$brightness.$scale.$progress'),
    theme: appTheme(brightness),
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context).copyWith(
        disableAnimations: reduced,
        textScaler: TextScaler.linear(scale),
      ),
      child: child!,
    ),
    home: PaywallPage(
      offer: const PatotaOffer(),
      onboardingProgress: progress,
      onContinue: onContinue,
    ),
  );

  testWidgets(
    'escolher planos toca letreiro finito, repete e permite continuar',
    (tester) async {
      final semantics = tester.ensureSemantics();
      try {
        var continues = 0;
        await tester.pumpWidget(screen(onContinue: () => continues++));
        await tester.pumpAndSettle();
        final button = find.byType(FilledButton);
        final rect = tester.getRect(button);
        expect(marquee, findsNothing);
        await select(tester, 'Mensal');
        expect(marquee, findsOneWidget);
        expect(tester.getRect(button), rect);
        expect(
          tester.getSemantics(button).label,
          contains('Continuar gratuitamente'),
        );
        final start = painter(tester).progress;
        await tester.pump(const Duration(milliseconds: 500));
        expect(painter(tester).progress, greaterThan(start));
        await tester.tap(button);
        await tester.pumpAndSettle();
        expect(continues, 1);
        expect(marquee, findsNothing);
        expect(
          tester.widget<PrimaryButton>(find.byType(PrimaryButton)).labelOverlay,
          isNull,
        );
        await select(tester, 'Anual');
        await tester.pump(const Duration(milliseconds: 700));
        final previous = painter(tester).progress;
        await tester.tap(find.text('Anual'));
        await tester.pump();
        expect(painter(tester).progress, lessThan(previous));
        await tester.pumpAndSettle();
        expect(marquee, findsNothing);
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    },
  );

  testWidgets('reduzir movimento conserva ação e suprime o letreiro', (
    tester,
  ) async {
    var continues = 0;
    await tester.pumpWidget(
      screen(reduced: true, onContinue: () => continues++),
    );
    await tester.pumpAndSettle();
    for (final plan in ['Mensal', 'Anual']) {
      await select(tester, plan);
      await tester.pumpAndSettle();
      expect(marquee, findsNothing);
      expect(find.text('Continuar gratuitamente'), findsOneWidget);
      expect(tester.binding.hasScheduledFrame, isFalse);
    }
    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();
    expect(continues, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('letreiro cabe em 320px com texto ampliado nos dois temas', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    for (final brightness in Brightness.values) {
      await tester.pumpWidget(
        screen(brightness: brightness, scale: 1.6, progress: null),
      );
      await tester.pumpAndSettle();
      final rect = tester.getRect(find.byType(FilledButton));
      await select(tester, 'Mensal');
      await tester.pump(const Duration(milliseconds: 1100));
      expect(marquee, findsOneWidget);
      expect(tester.getRect(marquee), rect);
      expect(tester.getRect(find.byType(FilledButton)), rect);
      expect(tester.takeException(), isNull);
      await tester.pumpAndSettle();
      expect(marquee, findsNothing);
    }
  });
}
