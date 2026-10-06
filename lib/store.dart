import 'dart:async';
import 'package:flutter/foundation.dart';
import 'data/backend.dart';
import 'domain.dart';
import 'models.dart';
import 'core/time.dart';
import 'package:uuid/uuid.dart';

class AppStore extends ChangeNotifier {
  AppStore(this.backend);
  final Backend backend;
  Snapshot snapshot = Snapshot({});
  bool ready = false, busy = false;
  String? error;
  StreamSubscription<void>? _subscription;
  Timer? _timer;
  bool _refreshing = false;
  bool _refreshAgain = false;
  Player? get current => snapshot.players
      .where(
        (p) =>
            p.userId == backend.userId ||
            (backend.demo && p.id == backend.userId),
      )
      .firstOrNull;
  bool get isAdmin => snapshot.members.any(
    (m) =>
        m.userId == backend.userId &&
        m.patotaId == snapshot.activePatotaId &&
        m.status == 'ativo' &&
        m.role == 'admin',
  );
  String get today =>
      patotaToday(snapshot.patota?.timezone ?? 'America/Sao_Paulo');
  bool get signedIn => backend.userId != null;
  Map<String, PlayerStats> get stats => computeStats(snapshot);
  Future<void> initialize() async {
    _subscription = backend.changes.listen((_) {
      unawaited(refresh());
    });
    _timer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (signedIn && !busy) unawaited(refresh());
    });
    await refresh();
    ready = true;
    notifyListeners();
  }

  Future<void> refresh() async {
    if (_refreshing || busy) {
      _refreshAgain = true;
      return;
    }
    _refreshing = true;
    try {
      do {
        _refreshAgain = false;
        snapshot = signedIn ? await backend.fetchAll() : Snapshot({});
        if (isAdmin && !current!.mustChangePassword) {
          await ensureSchedule();
          for (final r
              in snapshot.rounds
                  .where(
                    (r) => r.settledAt == null && votingState(r) == 'encerrada',
                  )
                  .toList()) {
            await settle(r.id);
          }
          snapshot = await backend.fetchAll();
        }
        error = null;
      } while (_refreshAgain);
    } catch (e) {
      error = translateError(e);
    } finally {
      _refreshing = false;
      notifyListeners();
    }
  }

  Future<void> run(Future<void> Function() work, {bool admin = false}) async {
    if (busy) throw Exception('Aguarde a operação atual.');
    if (admin && !isAdmin) {
      throw Exception('Ação reservada aos administradores.');
    }
    busy = true;
    error = null;
    notifyListeners();
    try {
      await work();
    } catch (e) {
      error = translateError(e);
      rethrow;
    } finally {
      busy = false;
      await refresh();
      notifyListeners();
    }
  }

  Future<void> signIn(String name, String password) =>
      run(() => backend.signIn(name, password));
  Future<void> signOut() => run(backend.signOut);
  Future<void> changePassword(String password) => run(() async {
    if (password.length < 6) {
      throw Exception('A senha precisa ter pelo menos 6 caracteres.');
    }
    await backend.changePassword(password);
    if (current != null) {
      await backend.update('players', current!.id, {
        'must_change_password': false,
      });
    }
  });
  Future<void> ensureSchedule() async {
    for (final date in missingDates(snapshot, today)) {
      try {
        await backend.insert('rounds', roundInput(date));
      } catch (e) {
        if (!e.toString().contains('rounds_date_key') &&
            !e.toString().contains('rounds_patota_id_date_key')) {
          rethrow;
        }
      }
    }
  }

  Json roundInput(String date) => {
    'date': date,
    'title': roundTitle(date),
    'start_time': snapshot.settings.time,
    'location': snapshot.settings.location,
    'location_url': snapshot.settings.locationUrl,
    'team_count': 2,
    'max_players': snapshot.settings.maxPlayers,
    'status': 'rascunho',
    'series_id': snapshot.settings.nullable('series_id'),
  };
  Future<void> updateSettings(Json patch) => run(() async {
    final previous = snapshot.settings.weekday;
    await backend.rpc('update_patota_settings', {
      'p_patota_id': snapshot.activePatotaId,
      'p_input': patch,
    });
    snapshot = await backend.fetchAll();
    for (final id in staleRounds(snapshot, previous, today)) {
      await backend.rpc('mutate_round', {
        'p_round_id': id,
        'p_action': 'cancel',
        'p_input': {'reason': 'Mudança da agenda recorrente'},
        'p_command_id': const Uuid().v4(),
      });
    }
    snapshot = await backend.fetchAll();
    await ensureSchedule();
  }, admin: true);
  Future<void> choosePatota(String id) => run(() async {
    if (!snapshot.patotas.any((p) => p.id == id)) {
      throw Exception('Patota indisponível.');
    }
    snapshot = Snapshot({});
    await backend.selectPatota(id);
  });
  Future<void> createPatota(String name, String modality, String timezone) =>
      run(() async {
        final id = await backend.rpc('create_patota', {
          'p_name': name,
          'p_modality': modality,
          'p_timezone': timezone,
        });
        await backend.selectPatota(id as String);
      });
  Future<void> joinPatota(String code) => run(() async {
    final id = await backend.rpc('join_patota', {'p_code': code});
    if (id == null) {
      throw Exception(
        'Código inválido ou limite de tentativas atingido. Aguarde um minuto e tente novamente.',
      );
    }
    await backend.selectPatota(id as String);
  });
  Future<void> respond(String roundId, String wants) => run(() async {
    await backend.rpc('respond_to_round', {
      'p_round_id': roundId,
      'p_wants': wants,
      'p_command_id': const Uuid().v4(),
    });
  });
  Future<void> setAttendance(
    String roundId,
    String playerId,
    String attendance,
  ) => run(() => attendanceRaw(roundId, playerId, attendance), admin: true);
  Future<void> attendanceRaw(
    String roundId,
    String playerId,
    String attendance,
  ) async {
    await backend.rpc('respond_to_round', {
      'p_round_id': roundId,
      'p_player_id': playerId,
      'p_wants': attendance == 'espera' ? 'confirmado' : attendance,
      'p_command_id': const Uuid().v4(),
    });
  }

  Future<void> removeFromRound(RoundPlayer rp) =>
      setAttendance(rp.roundId, rp.playerId, 'fora');
  Future<void> roundCommand(String id, String action, Json input) =>
      run(() async {
        await backend.rpc('mutate_round', {
          'p_round_id': id,
          'p_action': action,
          'p_input': input,
          'p_command_id': const Uuid().v4(),
        });
      }, admin: true);
  Future<void> buildTeams(
    String roundId, {
    Map<String, int?>? manual,
    List<String>? colors,
    List<String>? names,
  }) => run(() async {
    final existing = snapshot.roundTeams(roundId);
    final ids = snapshot
        .entries(roundId)
        .where(
          (p) =>
              p.attendance == 'confirmado' && p.actualAttendance != 'ausente',
        )
        .map((p) => p.playerId)
        .toSet();
    final roster = snapshot.players.where((p) => ids.contains(p.id)).toList();
    if (roster.length < 2) {
      throw Exception('São necessários pelo menos dois jogadores confirmados.');
    }
    final history = Snapshot({
      ...snapshot.toJson(),
      'matches': snapshot.matches
          .where((m) => m.roundId != roundId)
          .map((m) => m.json)
          .toList(),
    });
    final lists = manual == null
        ? generateTeams(roster, history, roundId)
        : List.generate(
            2,
            (i) => roster
                .where((p) => manual[p.id] == i)
                .map((p) => p.id)
                .toList(),
          );
    if (lists.any((l) => l.isEmpty)) {
      throw Exception('Cada time precisa de pelo menos um jogador.');
    }
    final ratings = computeRatings(
      roster,
      computeStats(history),
      computeLogs(history),
    );
    final sums = lists
        .map(
          (list) => list.fold<double>(0, (sum, id) => sum + (ratings[id] ?? 0)),
        )
        .toList();
    await backend.rpc('publish_teams', {
      'p_round_id': roundId,
      'p_command_id': const Uuid().v4(),
      'p_input': {
        'algorithm_version': manual == null ? 'legacy-v1' : 'manual-v1',
        'seed': roundId,
        'ratings': ratings,
        'input_players': roster
            .map((p) => {'id': p.id, 'position': p.position, 'level': p.level})
            .toList(),
        'predicted_difference': (sums[0] - sums[1]).abs(),
        'explanation': manual == null
            ? 'Fórmula legada v1; distribuição de goleiros e força estimada.'
            : 'Ajuste manual do administrador; os gols são preservados.',
        'teams': List.generate(
          2,
          (i) => {
            'name':
                names?[i] ??
                (existing.length == 2
                    ? existing[i].name
                    : i == 0
                    ? snapshot.settings.teamALabel
                    : snapshot.settings.teamBLabel),
            'color':
                colors?[i] ??
                (existing.length == 2
                    ? existing[i].color
                    : i == 0
                    ? snapshot.settings.teamAColor
                    : snapshot.settings.teamBColor),
            'players': lists[i],
          },
        ),
      },
    });
  }, admin: true);
  Future<void> goal(
    Match match,
    Json input, {
    String? eventId,
    String reason = 'Correção pelo administrador',
  }) => run(() async {
    await backend.rpc('mutate_goal', {
      'p_match_id': match.id,
      'p_action': eventId == null ? 'add' : 'edit',
      'p_input': {
        ...input,
        'event_id': ?eventId,
        if (eventId != null) 'reason': reason,
      },
      'p_command_id': const Uuid().v4(),
    });
  }, admin: true);
  Future<void> deleteGoal(
    Match match,
    String id, {
    String reason = 'Correção pelo administrador',
  }) => run(() async {
    await backend.rpc('mutate_goal', {
      'p_match_id': match.id,
      'p_action': 'reverse',
      'p_input': {'event_id': id, 'reason': reason},
      'p_command_id': const Uuid().v4(),
    });
  }, admin: true);
  Future<void> closeRound(String id) => roundCommand(id, 'close', {});
  Future<void> reopen(
    Match match, {
    String reason = 'Correção pelo administrador',
  }) => roundCommand(match.roundId, 'reopen', {'reason': reason});
  Future<void> settle(String roundId, {bool early = false}) async {
    await backend.rpc('settle_awards', {
      'p_round_id': roundId,
      'p_early': early,
    });
  }

  Future<void> closeVoting(String roundId) =>
      run(() => settle(roundId, early: true), admin: true);
  Future<void> vote(String roundId, String type, String? playerId) =>
      run(() async {
        await backend.rpc('vote_award', {
          'p_round_id': roundId,
          'p_type': type,
          'p_player_id': playerId,
        });
      });

  @override
  void dispose() {
    _timer?.cancel();
    unawaited(_subscription?.cancel());
    unawaited(backend.dispose());
    super.dispose();
  }
}

String translateError(Object error) {
  final message = error.toString().replaceFirst('Exception: ', '');
  if (message.contains('Invalid login credentials')) {
    return 'Usuário ou senha inválidos.';
  }
  if (message.contains('User already registered')) {
    return 'Este usuário já possui uma conta.';
  }
  if (message.contains('rounds_date_key') ||
      message.contains('rounds_patota_id_date_key')) {
    return 'Já existe uma partida nesta data.';
  }
  if (message.contains('row-level security')) {
    return 'Você não tem permissão para executar esta ação.';
  }
  if (message.contains('PGRST202')) {
    return 'Função ausente no banco. Confira supabase/schema.sql.';
  }
  return message;
}
