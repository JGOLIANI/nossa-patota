import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:nossa_patota/data/backend.dart';
import 'package:nossa_patota/store.dart';
import 'package:nossa_patota/ui/common.dart';
import 'package:nossa_patota/ui/operations.dart';
import 'package:nossa_patota/ui/sharing.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('card completo cabe em 320px e exporta PNG de 1080 por 1920', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final boundary = GlobalKey();
    final payload = <String, dynamic>{
      'patota': 'Nossa turma de amigos do futebol de quarta-feira',
      'date': '2026-10-06',
      'name': 'Jogador com nome completo bastante comprido',
      'team': {
        'name': 'Time verde dos amigos da quarta-feira',
        'color': '#18794e',
      },
      'goals': 123,
      'assists': 12,
      'wins': 10,
      'round_version': 3,
      'scores': List.generate(
        10,
        (i) => {
          'team_a': 'Time verde dos amigos da quarta-feira',
          'team_b': 'Time amarelo dos amigos da quarta-feira',
          'score_a': 120 + i,
          'score_b': 90 + i,
        },
      ),
      'awards': ['jogador_rodada', 'goleiro_menos_vazado', 'pior_jogador'],
    };
    await tester.pumpWidget(
      MaterialApp(
        theme: appTheme(Brightness.dark),
        home: MediaQuery(
          data: const MediaQueryData(
            size: Size(320, 700),
            textScaler: TextScaler.linear(1.6),
          ),
          child: Scaffold(
            body: Padding(
              padding: const EdgeInsets.all(PatotaSpace.lg),
              child: Align(
                alignment: Alignment.topCenter,
                child: RepaintBoundary(
                  key: boundary,
                  child: ExportPlayerMatchCard(payload: payload),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('MINHA PARTIDA'), findsOneWidget);
    expect(find.textContaining('120 × 90'), findsOneWidget);
    expect(find.textContaining('129 × 99'), findsOneWidget);
    final render =
        boundary.currentContext!.findRenderObject() as RenderRepaintBoundary;
    await tester.runAsync(() async {
      final image = await render.toImage(pixelRatio: 1080 / render.size.width);
      try {
        expect(image.width, 1080);
        expect(image.height, 1920);
        final png = await image.toByteData(format: ui.ImageByteFormat.png);
        expect(png, isNotNull);
        expect(png!.lengthInBytes, greaterThan(1000));
      } finally {
        image.dispose();
      }
    });
  });

  testWidgets(
    'revisão e ações de compartilhamento ficam acessíveis com texto ampliado',
    (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      SharedPreferences.setMockInitialValues({});
      final store = AppStore(
        DemoBackend(
          await SharedPreferences.getInstance(),
          jsonDecode(File('assets/demo.json').readAsStringSync())
              as Map<String, dynamic>,
        ),
      );
      await store.initialize();
      await store.signIn('admin', 'demo');
      final round = store.snapshot.rounds.firstWhere(
        (r) => r.status == 'rascunho',
      );
      final players = {
        store.current!.id,
        ...store.snapshot.players
            .where((p) => p.status == 'ativo')
            .take(6)
            .map((p) => p.id),
      };
      for (final id in players) {
        await store.setAttendance(round.id, id, 'confirmado');
      }
      await store.buildTeams(round.id);
      await store.closeRound(round.id);
      await store.closeVoting(round.id);
      for (final brightness in Brightness.values) {
        for (final page in <Widget>[
          SharePage(store, round.id),
          SharePage(store, round.id, result: true),
          PlayerMatchCardPage(store, round.id, store.current!.id),
        ]) {
          await tester.pumpWidget(
            MaterialApp(
              theme: appTheme(brightness),
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(textScaler: const TextScaler.linear(1.6)),
                child: child!,
              ),
              home: page,
            ),
          );
          await tester.pumpAndSettle();
          expect(
            tester.takeException(),
            isNull,
            reason: '${page.runtimeType}, $brightness',
          );
          final review = find.text(
            page is SharePage ? 'Ver mensagem em texto' : 'Ver dados em texto',
          );
          await tester.scrollUntilVisible(
            review,
            300,
            scrollable: find.byType(Scrollable).first,
          );
          await tester.pumpAndSettle();
          await tester.tap(review);
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          final share = find.text(
            page is SharePage
                ? 'Compartilhar imagem e mensagem'
                : 'Compartilhar card',
          );
          await tester.scrollUntilVisible(
            share,
            300,
            scrollable: find.byType(Scrollable).first,
          );
          await tester.pumpAndSettle();
          expect(share.hitTestable(), findsOneWidget);
          expect(tester.takeException(), isNull);
          await tester.pumpWidget(const SizedBox());
        }
      }
      store.dispose();
    },
  );
}
