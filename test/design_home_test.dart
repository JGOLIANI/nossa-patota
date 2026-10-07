import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:nossa_patota/data/backend.dart';
import 'package:nossa_patota/models.dart';
import 'package:nossa_patota/store.dart';
import 'package:nossa_patota/ui/common.dart';
import 'package:nossa_patota/ui/home.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));

  Future<AppStore> demoStore() async {
    final backend = DemoBackend(
      await SharedPreferences.getInstance(),
      jsonDecode(File('assets/demo.json').readAsStringSync())
          as Map<String, dynamic>,
    );
    await backend.signIn('admin', 'demo');
    final store = AppStore(backend);
    store.snapshot = await backend.fetchAll();
    addTearDown(store.dispose);
    return store;
  }

  Widget screen(Widget page, {Brightness brightness = Brightness.light}) =>
      MaterialApp(
        theme: appTheme(brightness),
        home: MediaQuery(
          data: const MediaQueryData(
            size: Size(320, 800),
            textScaler: TextScaler.linear(1.6),
          ),
          child: Scaffold(body: page),
        ),
      );

  testWidgets('home é legível com texto ampliado e vazio orienta a ação', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final store = await demoStore();
    await tester.pumpWidget(screen(HomePage(store)));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.drag(find.byType(ListView), const Offset(0, -600));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);

    store.snapshot = Snapshot({
      ...store.snapshot.toJson(),
      'rounds': <Json>[],
      'matches': <Json>[],
      'events': <Json>[],
      'roundPlayers': <Json>[],
      'awards': <Json>[],
    });
    await tester.pumpWidget(
      screen(HomePage(store), brightness: Brightness.dark),
    );
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, 1500));
    await tester.pumpAndSettle();
    expect(find.text('Ainda não tem jogo por aqui'), findsOneWidget);
    expect(find.text('Criar primeira partida'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('ranking mantém visível a posição própria fora do top 10', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final store = await demoStore();
    final me = store.current!;
    final players = <Json>[
      for (var i = 0; i < 11; i++)
        {
          'id': 'ranking-player-$i',
          'full_name': 'Jogador da Patota $i',
          'position': 'linha',
        },
      me.json,
    ];
    store.snapshot = Snapshot({
      ...store.snapshot.toJson(),
      'players': players,
      'rounds': [
        {'id': 'r', 'date': '2026-06-01', 'status': 'encerrada'},
      ],
      'matches': [
        {
          'id': 'm',
          'round_id': 'r',
          'team_a_id': 'a',
          'team_b_id': 'b',
          'status': 'encerrada',
          'score_a': 1,
          'score_b': 0,
        },
      ],
      'roundPlayers': [
        for (final player in players)
          {
            'round_id': 'r',
            'player_id': player['id'],
            'team_id': 'a',
            'attendance': 'confirmado',
          },
      ],
      'events': [
        for (var i = 0; i < players.length; i++)
          for (var goal = 0; goal < players.length - i; goal++)
            {'match_id': 'm', 'team_id': 'a', 'scorer_id': players[i]['id']},
      ],
    });
    await tester.pumpWidget(screen(RankingsPage(store)));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, -250));
    await tester.pumpAndSettle();
    expect(find.text('Sua posição'), findsOneWidget);
    expect(find.text('12º de 12 jogadores · Artilharia'), findsOneWidget);
    expect(find.text('No topo da patota'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
