import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:nossa_patota/data/backend.dart';
import 'package:nossa_patota/main.dart';
import 'package:nossa_patota/store.dart';
import 'package:nossa_patota/ui/players.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));
  Future<DemoBackend> demo() async => DemoBackend(
    await SharedPreferences.getInstance(),
    jsonDecode(File('assets/demo.json').readAsStringSync())
        as Map<String, dynamic>,
  );
  testWidgets('login demonstração, navegação, cadastro e logout', (
    tester,
  ) async {
    final store = AppStore(await demo());
    await store.initialize();
    await tester.pumpWidget(PatotaApp(store));
    expect(find.text('Entre para ver a partida'), findsOneWidget);
    await tester.enterText(
      find.byType(TextFormField).first,
      'admin@exemplo.com',
    );
    await tester.enterText(find.byType(TextFormField).last, 'demo123');
    await tester.tap(find.text('Entrar'));
    await tester.pumpAndSettle();
    expect(find.text('Olá, Administrador'), findsOneWidget);
    await tester.tap(find.text('Elenco').last);
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('Adicionar jogador'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('Adicionar jogador'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Nome completo'),
      'Novo Visitante',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Nome de usuário'),
      'novo',
    );
    await tester.scrollUntilVisible(
      find.text('Salvar jogador'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Salvar jogador'));
    await tester.pumpAndSettle();
    expect(store.snapshot.players.any((p) => p.username == 'novo'), isTrue);
    await tester.tap(find.bySemanticsLabel(RegExp('Abrir meu perfil')).first);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Sair da conta'),
      250,
      scrollable: find
          .descendant(
            of: find.byType(ProfilePage),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sair da conta'));
    await tester.pumpAndSettle();
    expect(find.text('Entrar'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
  test(
    'fluxo de partida preserva gols ao mover jogadores e encerra votação',
    () async {
      final store = AppStore(await demo());
      await store.initialize();
      await store.signIn('admin', 'demo');
      final round = store.snapshot.rounds.firstWhere(
        (r) => r.status == 'rascunho',
      );
      for (final p in store.snapshot.players.take(6)) {
        await store.setAttendance(round.id, p.id, 'confirmado');
      }
      await store.buildTeams(round.id);
      var match = store.snapshot.matches.firstWhere(
        (m) => m.roundId == round.id,
      );
      final rp = store.snapshot
          .entries(round.id)
          .firstWhere((rp) => rp.teamId == match.teamA);
      await store.goal(match, {
        'team_id': match.teamA,
        'scorer_id': rp.playerId,
        'assist_id': null,
        'own_goal': false,
      });
      match = store.snapshot.matches.firstWhere((m) => m.id == match.id);
      expect(match.scoreA, 1);
      final assignments = {
        for (final row in store.snapshot.entries(round.id))
          row.playerId: row.teamId == match.teamA ? 1 : 0,
      };
      await store.buildTeams(round.id, manual: assignments);
      expect(
        store.snapshot.matches.firstWhere((m) => m.id == match.id).scoreA,
        1,
      );
      expect(
        store.snapshot.events.where((e) => e.matchId == match.id).length,
        1,
      );
      await store.closeRound(round.id);
      expect(store.snapshot.round(round.id)!.status, 'encerrada');
      final bruno = store.snapshot.players.firstWhere(
        (p) => p.username == 'bruno',
      );
      final carlao = store.snapshot.players.firstWhere(
        (p) => p.username == 'carlao',
      );
      await store.signIn('bruno', 'demo');
      await expectLater(
        store.vote(round.id, 'goleiro_menos_vazado', bruno.id),
        throwsException,
      );
      await store.vote(round.id, 'goleiro_menos_vazado', carlao.id);
      expect(
        store.snapshot.votes.any(
          (v) => v.roundId == round.id && v.playerId == carlao.id,
        ),
        isTrue,
      );
      await store.signIn('admin', 'demo');
      await store.closeVoting(round.id);
      expect(store.snapshot.round(round.id)!.settledAt, isNotNull);
      await store.signIn('bruno', 'demo');
      await expectLater(
        store.vote(round.id, 'goleiro_menos_vazado', carlao.id),
        throwsException,
      );
      await store.signIn('admin', 'demo');
      await store.reopen(match);
      expect(store.snapshot.round(round.id)!.settledAt, isNull);
      expect(
        store.snapshot.awards.where((a) => a.roundId == round.id),
        isEmpty,
      );
      store.dispose();
    },
  );
  test('jogador comum não pode alterar agenda', () async {
    final backend = await demo();
    await backend.signIn('bruno', 'demo');
    await expectLater(
      backend.update('patota_settings', 'default', {'join_code': ''}),
      throwsException,
    );
    await backend.dispose();
  });
}
