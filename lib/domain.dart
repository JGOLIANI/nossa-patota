import 'dart:math' as math;
import 'models.dart';

String dateISO(DateTime date) =>
    '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
String roundTitle(String date) =>
    'Partida de ${date.substring(8, 10)}/${date.substring(5, 7)}';
List<String> nextOccurrences(int weekday, String from, int count) {
  final start = DateTime.parse('${from.substring(0, 10)}T12:00:00');
  final first = start.add(
    Duration(days: ((weekday % 7) - start.weekday % 7 + 7) % 7),
  );
  return List.generate(
    math.max(0, count),
    (i) => dateISO(first.add(Duration(days: i * 7))),
  );
}

List<String> missingDates(Snapshot s, String today) => nextOccurrences(
  s.settings.weekday,
  today,
  s.settings.weeksAhead,
).where((d) => !s.rounds.any((r) => r.date == d)).toList();
List<String> staleRounds(Snapshot s, int previous, String today) =>
    previous == s.settings.weekday
    ? []
    : s.rounds
          .where(
            (r) =>
                r.status == 'rascunho' &&
                r.date.compareTo(today) > 0 &&
                s.entries(r.id).isEmpty &&
                DateTime.parse(r.date).weekday % 7 == previous,
          )
          .map((r) => r.id)
          .toList();

List<Json> planResponse(
  List<RoundPlayer> rows,
  String playerId,
  String wants,
  int max,
  String now,
) {
  final current = rows.where((r) => r.playerId == playerId).firstOrNull;
  final others = rows.where((r) => r.playerId != playerId).toList();
  if (current?.attendance == wants ||
      (wants == 'confirmado' && current?.attendance == 'espera')) {
    return [];
  }
  if (wants == 'fora') {
    final waiting = others.where((r) => r.attendance == 'espera').toList()
      ..sort((a, b) => a.respondedAt.compareTo(b.respondedAt));
    return [
      {'player_id': playerId, 'attendance': 'fora', 'responded_at': now},
      if (current?.attendance == 'confirmado' && waiting.isNotEmpty)
        {'player_id': waiting.first.playerId, 'attendance': 'confirmado'},
    ];
  }
  final count = others.where((r) => r.attendance == 'confirmado').length;
  return [
    {
      'player_id': playerId,
      'attendance': max <= 0 || count < max ? 'confirmado' : 'espera',
      'responded_at': now,
    },
  ];
}

Json scoreFromEvents(Match match, Iterable<Goal> events) => {
  'score_a': events
      .where((e) => e.matchId == match.id && e.teamId == match.teamA)
      .length,
  'score_b': events
      .where((e) => e.matchId == match.id && e.teamId == match.teamB)
      .length,
};

class MatchLog {
  MatchLog(
    this.match,
    this.date,
    this.teamId,
    this.position,
    this.goals,
    this.assists,
    this.scoreFor,
    this.scoreAgainst,
  );
  final Match match;
  final String date, teamId, position;
  final int goals, assists, scoreFor, scoreAgainst;
  String get result => scoreFor > scoreAgainst
      ? 'V'
      : scoreFor < scoreAgainst
      ? 'D'
      : 'E';
}

class PlayerStats {
  PlayerStats(this.playerId, List<MatchLog> logs) {
    for (final e in logs) {
      played++;
      if (e.result == 'V') {
        wins++;
      } else if (e.result == 'D') {
        losses++;
      } else {
        draws++;
      }
      goals += e.goals;
      assists += e.assists;
      if (e.position == 'goleiro') {
        keeperMatches++;
        goalsAgainst += e.scoreAgainst;
        if (e.scoreAgainst == 0) cleanSheets++;
      }
    }
  }
  final String playerId;
  int played = 0,
      wins = 0,
      draws = 0,
      losses = 0,
      goals = 0,
      assists = 0,
      keeperMatches = 0,
      goalsAgainst = 0,
      cleanSheets = 0;
  int get participations => goals + assists;
  int get points => wins * 3 + draws;
  double get pointsPct => played == 0 ? 0 : points / (played * 3) * 100;
  double get goalsPerMatch => played == 0 ? 0 : goals / played;
  double get assistsPerMatch => played == 0 ? 0 : assists / played;
  double get participationsPerMatch =>
      played == 0 ? 0 : participations / played;
  double get goalsAgainstPerMatch =>
      keeperMatches == 0 ? 0 : goalsAgainst / keeperMatches;
}

Map<String, List<MatchLog>> computeLogs(Snapshot s, {String? roundId}) {
  final result = <String, List<MatchLog>>{};
  final matches =
      s.matches
          .where(
            (m) =>
                m.status == 'encerrada' &&
                (roundId == null || m.roundId == roundId),
          )
          .toList()
        ..sort((a, b) {
          final cmp = (s.round(a.roundId)?.date ?? '').compareTo(
            s.round(b.roundId)?.date ?? '',
          );
          return cmp == 0 ? a.sequence.compareTo(b.sequence) : cmp;
        });
  for (final m in matches) {
    final events = s.events.where((e) => e.matchId == m.id).toList();
    for (final rp
        in s
            .entries(m.roundId)
            .where(
              (rp) =>
                  rp.actualAttendance != 'ausente' &&
                  (rp.teamId == m.teamA || rp.teamId == m.teamB),
            )) {
      final isA = rp.teamId == m.teamA;
      (result[rp.playerId] ??= []).add(
        MatchLog(
          m,
          s.round(m.roundId)?.date ?? '',
          rp.teamId!,
          rp.position ?? s.player(rp.playerId)?.position ?? 'linha',
          events.where((e) => e.scorerId == rp.playerId && !e.ownGoal).length,
          events.where((e) => e.assistId == rp.playerId).length,
          isA ? m.scoreA : m.scoreB,
          isA ? m.scoreB : m.scoreA,
        ),
      );
    }
  }
  return result;
}

Map<String, PlayerStats> computeStats(Snapshot s, {String? roundId}) {
  final logs = computeLogs(s, roundId: roundId);
  return {
    for (final id in {...s.players.map((p) => p.id), ...logs.keys})
      id: PlayerStats(id, logs[id] ?? []),
  };
}

double recentForm(List<MatchLog> logs) {
  final recent = logs.skip(math.max(0, logs.length - 5)).toList();
  return recent.isEmpty
      ? 0
      : recent.fold<int>(
              0,
              (sum, e) =>
                  sum +
                  (e.result == 'V'
                      ? 3
                      : e.result == 'E'
                      ? 1
                      : 0),
            ) /
            (recent.length * 3);
}

double normalize(num value, List<num> values) {
  if (values.isEmpty) return .5;
  final numeric = List<num>.from(values);
  final low = numeric.reduce(math.min), high = numeric.reduce(math.max);
  return high == low ? .5 : (value - low) / (high - low);
}

// Exact low 32 bits also when compiled to JavaScript.
int multiply32(int a, int b) {
  final low = (a & 0xffff) * (b & 0xffff);
  final cross =
      ((a >>> 16) * (b & 0xffff) + (b >>> 16) * (a & 0xffff)) & 0xffff;
  return (low + (cross << 16)) & 0xffffffff;
}

int seedFromString(String value) {
  var hash = 2166136261;
  for (final c in value.codeUnits) {
    hash = multiply32(hash ^ c, 16777619);
  }
  return hash;
}

double Function() mulberry32(int seed) {
  var state = seed & 0xffffffff;
  return () {
    state = (state + 0x6d2b79f5) & 0xffffffff;
    var t = multiply32(state ^ (state >>> 15), state | 1);
    t =
        (t ^ ((t + multiply32(t ^ (t >>> 7), t | 61)) & 0xffffffff)) &
        0xffffffff;
    return ((t ^ (t >>> 14)) & 0xffffffff) / 4294967296;
  };
}

Map<String, double> computeRatings(
  List<Player> players,
  Map<String, PlayerStats> stats,
  Map<String, List<MatchLog>> logs,
) {
  const weights = [.25, .15, .15, .10, .10, .05, .05, .15];
  List<num> metrics(Player p) {
    final s = stats[p.id] ?? PlayerStats(p.id, []);
    return [
      p.level,
      s.pointsPct,
      s.goalsPerMatch,
      s.assistsPerMatch,
      s.participationsPerMatch,
      s.wins,
      s.losses,
      recentForm(logs[p.id] ?? []),
    ];
  }

  final pools = List.generate(
    8,
    (i) => players
        .where((p) => i == 0 || (stats[p.id]?.played ?? 0) > 0)
        .map((p) => metrics(p)[i])
        .toList(),
  );
  return {
    for (final p in players)
      p.id:
          List.generate(8, (i) {
            var n = i > 0 && (stats[p.id]?.played ?? 0) == 0
                ? .5
                : normalize(metrics(p)[i], pools[i]);
            if (i == 6 && (stats[p.id]?.played ?? 0) > 0) n = 1 - n;
            return n * weights[i];
          }).fold<double>(0, (a, b) => a + b) /
          weights.fold<double>(0, (a, b) => a + b) *
          100,
  };
}

List<List<String>> generateTeams(
  List<Player> players,
  Snapshot history,
  String seed,
) {
  final ratings = computeRatings(
    players,
    computeStats(history),
    computeLogs(history),
  );
  final random = mulberry32(seedFromString(seed));
  final keys = {
    for (final p in players) p.id: ratings[p.id]! + random() * 1e-6,
  };
  final sorted = [...players]
    ..sort((a, b) => keys[b.id]!.compareTo(keys[a.id]!));
  final teams = <List<String>>[[], []];
  final targets = [(players.length / 2).ceil(), players.length ~/ 2];
  final keepers = [0, 0];
  double total(int i) =>
      teams[i].fold<double>(0, (sum, id) => sum + ratings[id]!);
  double average(int i) => teams[i].isEmpty ? 0 : total(i) / teams[i].length;
  double spread() => (average(0) - average(1)).abs();
  for (final p in [
    ...sorted.where((p) => p.position == 'goleiro'),
    ...sorted.where((p) => p.position != 'goleiro'),
  ]) {
    final candidates =
        [0, 1].where((i) => teams[i].length < targets[i]).toList()
          ..sort((a, b) {
            if (p.position == 'goleiro' && keepers[a] != keepers[b]) {
              return keepers[a].compareTo(keepers[b]);
            }
            final cmp = total(a).compareTo(total(b));
            return cmp == 0 ? teams[a].length.compareTo(teams[b].length) : cmp;
          });
    final target = candidates.first;
    teams[target].add(p.id);
    if (p.position == 'goleiro') keepers[target]++;
  }
  final line = players
      .where((p) => p.position != 'goleiro')
      .map((p) => p.id)
      .toSet();
  for (var guard = 0; guard < 200; guard++) {
    var improved = false;
    for (var a = 0; a < teams[0].length && !improved; a++) {
      if (!line.contains(teams[0][a])) continue;
      for (var b = 0; b < teams[1].length; b++) {
        if (!line.contains(teams[1][b])) continue;
        final before = spread(), pa = teams[0][a], pb = teams[1][b];
        teams[0][a] = pb;
        teams[1][b] = pa;
        if (spread() < before - 1e-9) {
          improved = true;
          break;
        }
        teams[0][a] = pa;
        teams[1][b] = pb;
      }
    }
    if (!improved) break;
  }
  for (final team in teams) {
    final order = {for (var i = 0; i < team.length; i++) team[i]: i};
    team.sort((a, b) {
      final cmp = ratings[b]!.compareTo(ratings[a]!);
      return cmp == 0 ? order[a]!.compareTo(order[b]!) : cmp;
    });
  }
  return teams;
}

String votingState(Round r, [DateTime? now]) {
  if (r.status != 'encerrada' || r.closedAt == null) return 'nao-comecou';
  return r.settledAt != null ||
          !(now ?? DateTime.now()).isBefore(
            r.closedAt!.add(const Duration(hours: 16)),
          )
      ? 'encerrada'
      : 'aberta';
}

Map<String, List<PlayerStats>> awardCandidates(Snapshot s, String roundId) {
  final stats = computeStats(s, roundId: roundId), points = <String, int>{};
  for (final m in s.matches.where(
    (m) => m.roundId == roundId && m.status == 'encerrada',
  )) {
    points[m.teamA] =
        (points[m.teamA] ?? 0) +
        (m.scoreA > m.scoreB
            ? 3
            : m.scoreA == m.scoreB
            ? 1
            : 0);
    points[m.teamB] =
        (points[m.teamB] ?? 0) +
        (m.scoreB > m.scoreA
            ? 3
            : m.scoreA == m.scoreB
            ? 1
            : 0);
  }
  final ranked = points.keys.toList()
    ..sort((a, b) => points[b]!.compareTo(points[a]!));
  final draw =
      ranked.length >= 2 && points[ranked.first] == points[ranked.last];
  final winner = ranked.length >= 2 && points[ranked[0]] != points[ranked[1]]
      ? ranked.first
      : null;
  final loser =
      ranked.length >= 2 &&
          points[ranked.last] != points[ranked[ranked.length - 2]]
      ? ranked.last
      : null;
  final rows = s
      .entries(roundId)
      .where((rp) => rp.teamId != null && (stats[rp.playerId]?.played ?? 0) > 0)
      .toList();
  String position(RoundPlayer rp) =>
      rp.position ?? s.player(rp.playerId)?.position ?? 'linha';
  return {
    'jogador_rodada': rows
        .where((rp) => position(rp) == 'linha' && (draw || rp.teamId == winner))
        .map((rp) => stats[rp.playerId]!)
        .toList(),
    'pior_jogador': rows
        .where((rp) => position(rp) == 'linha' && (draw || rp.teamId == loser))
        .map((rp) => stats[rp.playerId]!)
        .toList(),
    'goleiro_menos_vazado': rows
        .where((rp) => position(rp) == 'goleiro')
        .map((rp) => stats[rp.playerId]!)
        .toList(),
  };
}

String? tallyAward(Snapshot s, String roundId, String type) {
  final pool = awardCandidates(s, roundId)[type]!;
  if (pool.isEmpty) return null;
  final ids = pool.map((p) => p.playerId).toSet();
  final votes = s.votes
      .where(
        (v) =>
            v.roundId == roundId && v.type == type && ids.contains(v.playerId),
      )
      .toList();
  if (votes.isEmpty &&
      type != 'goleiro_menos_vazado' &&
      pool.every((p) => p.participations == 0)) {
    return null;
  }
  int count(String id) => votes.where((v) => v.playerId == id).length;
  int metric(PlayerStats p) =>
      type == 'goleiro_menos_vazado' ? p.goalsAgainst : p.participations;
  int fine(PlayerStats p) => type == 'goleiro_menos_vazado'
      ? p.participations
      : (p.goals * 100 + p.assists) * (type == 'pior_jogador' ? -1 : 1);
  int history(String id) => s.awards
      .where((a) => a.roundId != roundId && a.type == type && a.playerId == id)
      .length;
  double score(PlayerStats p) {
    final n = normalize(metric(p), pool.map(metric).toList());
    return .7 * (votes.isEmpty ? 0 : count(p.playerId) / votes.length) +
        .3 * (type == 'jogador_rodada' ? n : 1 - n);
  }

  double luck(String id) => mulberry32(seedFromString('$roundId:$type:$id'))();
  pool.sort((a, b) {
    var cmp = score(b).compareTo(score(a));
    if (cmp == 0) cmp = count(b.playerId).compareTo(count(a.playerId));
    if (cmp == 0) cmp = fine(b).compareTo(fine(a));
    if (cmp == 0) cmp = history(a.playerId).compareTo(history(b.playerId));
    return cmp == 0 ? luck(b.playerId).compareTo(luck(a.playerId)) : cmp;
  });
  return pool.first.playerId;
}
