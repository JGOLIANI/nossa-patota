import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:nossa_patota/data/backend.dart';
import 'package:nossa_patota/store.dart';
import 'package:nossa_patota/core/time.dart';
import 'package:nossa_patota/ui/operations.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));
  Future<DemoBackend> demo() async => DemoBackend(
    await SharedPreferences.getInstance(),
    jsonDecode(File('assets/demo.json').readAsStringSync())
        as Map<String, dynamic>,
  );
  testWidgets(
    'preview do card individual cabe no celular e carrega dados registrados',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final store = AppStore(await demo());
      await store.initialize();
      await store.signIn('admin', 'demo123');
      final round = store.snapshot.rounds.firstWhere(
        (r) =>
            r.status == 'encerrada' &&
            store.snapshot
                .entries(r.id)
                .any(
                  (rp) => rp.playerId == store.current!.id && rp.teamId != null,
                ),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: PlayerMatchCardPage(store, round.id, store.current!.id),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('MINHA PARTIDA'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.text('Compartilhar card'),
        150,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
      expect(find.text('Compartilhar card'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    },
  );
  test(
    'cadastro não ganha patota ou permissão; criar, trocar e entrar preserva o legado',
    () async {
      final store = AppStore(await demo());
      await store.initialize();
      await store.signIn('admin', 'demo123');
      final original = store.snapshot.activePatotaId!,
          ids = store.snapshot.rounds.map((r) => r.id).toList();
      await store.createPatota('Society da terça', 'society', 'America/Manaus');
      final newId = store.snapshot.activePatotaId!;
      expect(newId, isNot(original));
      expect(store.snapshot.rounds, isEmpty);
      expect(store.snapshot.settings.teamSize, 7);
      final code = await store.backend.rpc('patota_join_code', {
        'p_patota_id': newId,
        'p_rotate': false,
      });
      await store.choosePatota(original);
      expect(store.snapshot.rounds.map((r) => r.id).toList(), ids);
      await store.signOut();
      await store.backend.signUp({
        'email': 'novo@example.com',
        'password': 'senha123',
        'full_name': 'Novo jogador',
      });
      await store.refresh();
      expect(store.snapshot.activePatotaId, isNull);
      expect(store.isAdmin, isFalse);
      await store.joinPatota(code as String);
      expect(store.snapshot.activePatotaId, newId);
      expect(store.isAdmin, isFalse);
      expect(store.snapshot.rounds, isEmpty);
      await expectLater(store.choosePatota(original), throwsException);
      await store.signOut();
    },
  );
  test(
    'fuso da patota define o dia e o instante, inclusive horário de verão histórico',
    () {
      expect(
        patotaToday('America/Sao_Paulo', now: DateTime.utc(2026, 10, 6, 1)),
        '2026-10-05',
      );
      expect(
        scheduledInstant('2026-10-06', '20:00', 'America/Sao_Paulo'),
        DateTime.utc(2026, 10, 6, 23),
      );
      expect(
        scheduledInstant('2026-10-06', '20:00', 'America/Manaus'),
        DateTime.utc(2026, 10, 7, 0),
      );
      expect(
        scheduledInstant('2018-12-01', '20:00', 'America/Sao_Paulo'),
        DateTime.utc(2018, 12, 1, 22),
      );
    },
  );
}
