import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:nossa_patota/domain.dart';
import 'package:nossa_patota/models.dart';

void main() {
  final fixture =
      jsonDecode(File('test/fixtures/parity.json').readAsStringSync()) as Json;
  final snapshot = Snapshot(fixture['snapshot'] as Json);
  test('estatísticas mantêm os resultados da implementação TypeScript', () {
    final stats = computeStats(snapshot);
    for (final entry in (fixture['stats'] as Json).entries) {
      final p = stats[entry.key]!, expected = entry.value as Json;
      expect(p.played, expected['played']);
      expect(p.goals, expected['goals']);
      expect(p.assists, expected['assists']);
      expect(p.wins, expected['wins']);
      expect(p.draws, expected['draws']);
      expect(p.losses, expected['losses']);
      expect(p.goalsAgainst, expected['goalsAgainst']);
      expect(p.keeperMatches, expected['keeperMatches']);
      expect(
        p.pointsPct,
        closeTo((expected['pointsPct'] as num).toDouble(), 1e-9),
      );
    }
  });
  test('sorteio mantém os mesmos times do TypeScript', () {
    expect(
      generateTeams(snapshot.players, snapshot, 'flutter-parity'),
      fixture['teams'],
    );
  });
  test('gerador determinístico mantém a sequência em Dart e JavaScript', () {
    final random = mulberry32(seedFromString('flutter-parity'));
    for (final n in fixture['random'] as List) {
      expect(random(), n);
    }
  });
  test('apuração preserva os vencedores do TypeScript', () {
    for (final round in (fixture['awards'] as Json).entries) {
      for (final type in awardLabels.keys) {
        expect(
          tallyAward(snapshot, round.key, type),
          (round.value as Json)[type],
        );
      }
    }
  });
  test(
    'gol contra altera placar e não entra na artilharia; jogo aberto não conta',
    () {
      final data = snapshot.toJson();
      final match = snapshot.matches.first;
      final event = Goal({
        'id': 'own',
        'match_id': match.id,
        'team_id': match.teamA,
        'scorer_id': snapshot.players.first.id,
        'own_goal': true,
      });
      final score = scoreFromEvents(match, [...snapshot.events, event]);
      expect(
        score['score_a'],
        scoreFromEvents(match, snapshot.events)['score_a'] + 1,
      );
      final before = computeStats(snapshot)[snapshot.players.first.id]!.goals;
      data['events'] = [...snapshot.events.map((e) => e.json), event.json];
      expect(
        computeStats(Snapshot(data))[snapshot.players.first.id]!.goals,
        before,
      );
      data['matches'] = snapshot.matches
          .map((m) => {...m.json, 'status': 'em_andamento'})
          .toList();
      expect(
        computeStats(Snapshot(data)).values.every((p) => p.played == 0),
        isTrue,
      );
    },
  );
  test('fila promove o primeiro e preserva o horário da confirmação', () {
    final rows = [
      RoundPlayer({
        'player_id': 'a',
        'attendance': 'confirmado',
        'responded_at': '01',
      }),
      RoundPlayer({
        'player_id': 'b',
        'attendance': 'espera',
        'responded_at': '02',
      }),
      RoundPlayer({
        'player_id': 'c',
        'attendance': 'espera',
        'responded_at': '03',
      }),
    ];
    expect(planResponse(rows, 'a', 'fora', 1, '04'), [
      {'player_id': 'a', 'attendance': 'fora', 'responded_at': '04'},
      {'player_id': 'b', 'attendance': 'confirmado'},
    ]);
    expect(
      planResponse(rows, 'd', 'confirmado', 1, '04').single['attendance'],
      'espera',
    );
  });
  test('agenda inclui o dia atual, sem duplicar partidas existentes', () {
    expect(nextOccurrences(5, '2026-10-05', 2), ['2026-10-09', '2026-10-16']);
    expect(nextOccurrences(5, '2026-10-09', 1), ['2026-10-09']);
    final s = Snapshot({
      'settings': {'weekday': 5, 'weeks_ahead': 2},
      'rounds': [
        {'date': '2026-10-09'},
      ],
    });
    expect(missingDates(s, '2026-10-05'), ['2026-10-16']);
  });
  test('urna fecha exatamente em 16 horas ou na apuração antecipada', () {
    final r = Round({
      'status': 'encerrada',
      'closed_at': '2026-10-05T00:00:00Z',
    });
    expect(votingState(r, DateTime.parse('2026-10-05T15:59:59Z')), 'aberta');
    expect(votingState(r, DateTime.parse('2026-10-05T16:00:00Z')), 'encerrada');
    expect(
      votingState(
        Round({...r.json, 'awards_settled_at': '2026-10-05T01:00:00Z'}),
        DateTime.parse('2026-10-05T02:00:00Z'),
      ),
      'encerrada',
    );
  });
}
