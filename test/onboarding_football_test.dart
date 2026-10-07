import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nossa_patota/ui/common.dart';
import 'package:nossa_patota/ui/onboarding_football.dart';

void main() {
  FootballPlayPainter scene(WidgetTester tester) =>
      tester
              .widget<CustomPaint>(
                find.byKey(const ValueKey('onboarding-football-scene')),
              )
              .painter!
          as FootballPlayPainter;

  Widget screen(
    double? progress, {
    bool reduced = false,
    VoidCallback? onTap,
    bool loading = false,
  }) => MaterialApp(
    theme: appTheme(Brightness.light),
    home: MediaQuery(
      data: MediaQueryData(disableAnimations: reduced),
      child: Scaffold(
        body: Center(
          child: SizedBox(
            width: 300,
            child: FootballContinueButton(
              progress: progress,
              label: 'Avançar',
              onPressed: onTap,
              loading: loading,
            ),
          ),
        ),
      ),
    ),
  );

  testWidgets('movimento contínuo avança, chega ao gol só no final e volta', (
    tester,
  ) async {
    await tester.pumpWidget(screen(0));
    final first = scene(tester).frame;
    await tester.pump(const Duration(milliseconds: 50));
    expect(scene(tester).frame, greaterThan(first));
    final after50ms = scene(tester).frame;
    await tester.pump(const Duration(milliseconds: 16));
    expect(scene(tester).frame, greaterThan(after50ms));
    final intermediate = scene(tester).frame;
    expect(intermediate, isNot(intermediate.roundToDouble()));
    await tester.pump(const Duration(milliseconds: 16));
    expect(scene(tester).frame, greaterThan(intermediate));
    await tester.pumpAndSettle();
    for (final progress in [.2, .4, .6, .8]) {
      final previous = scene(tester).frame;
      await tester.pumpWidget(screen(progress));
      await tester.pump(const Duration(milliseconds: 250));
      expect(scene(tester).frame, greaterThan(previous));
      await tester.pumpAndSettle();
      expect(scene(tester).scored, isFalse);
    }
    await tester.pumpWidget(screen(1));
    await tester.pumpAndSettle();
    expect(scene(tester).scored, isTrue);
    final held = scene(tester).frame;
    await tester.pump(const Duration(seconds: 3));
    expect(scene(tester).frame, held);
    await tester.pumpWidget(screen(.6));
    await tester.pumpAndSettle();
    expect(scene(tester).scored, isFalse);
    expect(tester.takeException(), isNull);
  });

  testWidgets('reduzir movimento mostra a pose final sem iniciar animação', (
    tester,
  ) async {
    await tester.pumpWidget(screen(1, reduced: true));
    expect(scene(tester).scored, isTrue);
    await tester.pump();
    expect(tester.binding.hasScheduledFrame, isFalse);
    final held = scene(tester).frame;
    await tester.pump(const Duration(seconds: 1));
    expect(scene(tester).frame, held);
    await tester.pumpWidget(screen(.4, reduced: true));
    expect(scene(tester).scored, isFalse);
    await tester.pump();
    expect(tester.binding.hasScheduledFrame, isFalse);
    expect(tester.takeException(), isNull);
  });

  testWidgets('lance fica dentro do botão e toda a área continua clicável', (
    tester,
  ) async {
    var taps = 0;
    await tester.pumpWidget(screen(.4, onTap: () => taps++));
    await tester.tap(find.text('Avançar'));
    await tester.pumpAndSettle();
    expect(taps, 1);
    final painting = find.byKey(const ValueKey('onboarding-football-scene'));
    final buttonRect = tester.getRect(find.byType(FilledButton));
    final sceneRect = tester.getRect(painting);
    expect(sceneRect, buttonRect);
    expect(
      tester.getCenter(find.text('Avançar')).dy,
      closeTo(buttonRect.center.dy, 1),
    );
    await tester.pumpWidget(screen(1, onTap: () => taps++));
    await tester.pumpAndSettle();
    expect(scene(tester).scored, isTrue);
    expect(find.text('Avançar'), findsOneWidget);
    expect(
      tester.getCenter(find.text('Avançar')).dy,
      closeTo(buttonRect.center.dy, 1),
    );
    await tester.tapAt(sceneRect.center);
    await tester.pumpAndSettle();
    expect(taps, 2);
    await tester.pumpWidget(screen(null, onTap: () => taps++));
    expect(find.byType(FootballPlayAnimation), findsNothing);
    expect(find.text('Avançar'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('botão desabilitado ou carregando não avança ao tocar no lance', (
    tester,
  ) async {
    var taps = 0;
    await tester.pumpWidget(screen(.4));
    await tester.pumpAndSettle();
    final sceneFinder = find.byKey(const ValueKey('onboarding-football-scene'));
    await tester.tapAt(tester.getCenter(sceneFinder));
    await tester.pumpAndSettle();
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNull,
    );
    await tester.pumpWidget(screen(.4, loading: true, onTap: () => taps++));
    await tester.pump();
    await tester.tapAt(tester.getCenter(sceneFinder));
    await tester.pump();
    expect(taps, 0);
    expect(find.text('Aguarde…'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
}
