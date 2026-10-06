part of 'backend.dart';

const _mobileRpcNames = {
  'create_patota',
  'join_patota',
  'patota_join_code',
  'set_member_role',
  'mobile_snapshot',
  'respond_to_round',
  'create_round',
  'update_patota_settings',
  'mutate_round',
  'publish_teams',
  'mutate_goal',
  'vote_award',
  'settle_awards',
  'player_match_card',
  'round_history',
};
const teamPalette = {
  '#000000': 'Preto',
  '#ffffff': 'Branco',
  '#007aff': 'Azul',
  '#ff3b30': 'Vermelho',
  '#34c759': 'Verde',
  '#ffcc00': 'Amarelo',
  '#af52de': 'Roxo',
  '#ff9500': 'Laranja',
};
const modalityLabels = {
  'futsal': 'Futsal',
  'society': 'Society',
  'campo': 'Campo',
};

void _upgradeDemo(DemoBackend db) {
  if (db.data.containsKey('patotas')) return;
  const group = '00000000-0000-4000-8000-000000000001';
  db.data['patotas'] = <Json>[
    {
      'id': group,
      'name': 'Nossa Patota',
      'modality': 'futsal',
      'timezone': 'America/Sao_Paulo',
      'join_code': 'PATOTA24',
      'created_at': nowISO(),
    },
  ];
  db.data['groupSettings'] = [
    {
      ...defaultSettings,
      ...db.data['settings'] as Map,
      'patota_id': group,
      'id': 'default',
    },
  ];
  db.data['members'] = <Json>[];
  db.data['accounts'] = <Json>[];
  for (final row in db.rows('players')) {
    row['user_id'] ??= row['id'];
    row['patota_id'] = group;
    (db.data['members'] as List).add({
      'id': row['id'],
      'patota_id': group,
      'user_id': row['user_id'],
      'role': row['role'],
      'status': 'ativo',
    });
    (db.data['accounts'] as List).add({
      'id': row['user_id'],
      'email': '${row['username']}@exemplo.com',
      'username': row['username'],
      'full_name': row['full_name'],
    });
  }
  for (final table in [
    'rounds',
    'teams',
    'round_players',
    'matches',
    'match_events',
    'round_awards',
    'round_votes',
  ]) {
    for (final row in db.rows(table)) {
      row['patota_id'] = group;
    }
  }
  db.data['audit'] = <Json>[];
  db.data['receipts'] = <String, dynamic>{};
  db.data['generations'] = <Json>[];
  db.data['awardVersions'] = <Json>[];
  db.data['cards'] = <Json>[];
  db.data['joinAttempts'] = <String, dynamic>{};
}

Snapshot _demoSnapshot(DemoBackend db) {
  final members = (db.data['members'] as List)
      .where((m) => m['user_id'] == db.userId && m['status'] == 'ativo')
      .toList();
  final groups = (db.data['patotas'] as List)
      .where((p) => members.any((m) => m['patota_id'] == p['id']))
      .toList();
  if (!groups.any((g) => g['id'] == db._activeId)) {
    db._activeId = groups.firstOrNull?['id'] as String?;
  }
  final id = db._activeId;
  return Snapshot({
    'activePatotaId': id,
    'patotas': groups,
    'members': (db.data['members'] as List)
        .where((m) => m['patota_id'] == id)
        .toList(),
    'settings':
        (db.data['groupSettings'] as List)
            .where((s) => s['patota_id'] == id)
            .firstOrNull ??
        {},
    for (final entry in {
      'players': 'players',
      'rounds': 'rounds',
      'teams': 'teams',
      'roundPlayers': 'round_players',
      'matches': 'matches',
      'events': 'match_events',
      'awards': 'round_awards',
      'votes': 'round_votes',
    }.entries)
      entry.key: db
          .rows(entry.value)
          .where(
            (row) =>
                row['patota_id'] == id &&
                (entry.key != 'events' || row['voided_at'] == null),
          )
          .toList(),
  });
}

Future<bool> _demoSignUp(DemoBackend db, Json input) async {
  final email = (input['email'] as String).trim().toLowerCase();
  if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
    throw Exception('Informe um e-mail válido.');
  }
  if ((db.data['accounts'] as List).any((a) => a['email'] == email)) {
    throw Exception('Este e-mail já possui uma conta.');
  }
  final id = const Uuid().v4();
  (db.data['accounts'] as List).add({
    'id': id,
    'email': email,
    'full_name': input['full_name'],
  });
  db._userId = id;
  db._activeId = null;
  await db.preferences.setString('patota.flutter.session', id);
  await db.save();
  db._changes.add(null);
  return true;
}

String _newDemoCode(DemoBackend db) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  final rng = Random.secure();
  String code;
  do {
    code = List.generate(
      8,
      (_) => alphabet[rng.nextInt(alphabet.length)],
    ).join();
  } while ((db.data['patotas'] as List).any((p) => p['join_code'] == code));
  return code;
}

Json _row(Json input) => {
  'id': const Uuid().v4(),
  'created_at': nowISO(),
  ...input,
};
void _demoAudit(
  DemoBackend db,
  String action,
  String? resource, [
  Json? payload,
]) {
  (db.data['audit'] as List).add(
    _row({
      'patota_id': db._activeId,
      'actor_id': db.userId,
      'action': action,
      'resource_id': resource,
      'payload': payload ?? {},
    }),
  );
}

bool _claim(DemoBackend db, String kind, Json params) {
  final id = params['p_command_id'];
  if (id == null) throw Exception('Identificador de comando obrigatório.');
  final receipts = db.data['receipts'] as Map;
  final value = jsonEncode({
    'actor': db.userId,
    'group': db._activeId,
    'kind': kind,
    'params': params,
  });
  if (receipts.containsKey(id)) {
    if (receipts[id] != value) {
      throw Exception('Identificador de comando já utilizado.');
    }
    return false;
  }
  receipts[id] = value;
  return true;
}

Future<dynamic> _demoMobileRpc(DemoBackend db, String name, Json params) {
  final task = db._commandQueue.then((_) async {
    final before = jsonDecode(jsonEncode(db.data)) as Json;
    final previous = db._activeId;
    try {
      final result = _demoMobileCommand(db, name, params);
      await db.save();
      return result;
    } catch (_) {
      db.data = before;
      db._activeId = previous;
      rethrow;
    }
  });
  db._commandQueue = task.then<void>(
    (_) {},
    onError: (Object _, StackTrace _) {},
  );
  return task;
}

dynamic _demoMobileCommand(DemoBackend db, String name, Json params) {
  db.requireSession();
  var s = db.snapshot;
  if (name == 'mobile_snapshot') return s.toJson();
  if (name == 'create_patota') {
    final title = (params['p_name'] as String).trim(),
        modality = params['p_modality'] as String;
    final zone = params['p_timezone'] as String? ?? 'America/Sao_Paulo';
    patotaLocation(zone);
    if (title.length < 2 ||
        title.length > 80 ||
        !modalityLabels.containsKey(modality)) {
      throw Exception('Nome ou modalidade inválida.');
    }
    final p = _row({
      'name': title,
      'modality': modality,
      'timezone': zone,
      'join_code': _newDemoCode(db),
    });
    (db.data['patotas'] as List).add(p);
    db._activeId = p['id'] as String;
    final account = (db.data['accounts'] as List).firstWhere(
      (a) => a['id'] == db.userId,
    );
    (db.data['members'] as List).add(
      _row({
        'patota_id': p['id'],
        'user_id': db.userId,
        'role': 'admin',
        'status': 'ativo',
      }),
    );
    db
        .rows('players')
        .add(
          _row({
            'patota_id': p['id'],
            'user_id': db.userId,
            'username': 'jogador.${db.userId!.substring(0, 8)}',
            'full_name': account['full_name'],
            'role': 'admin',
            'status': 'ativo',
            'position': 'linha',
            'player_type': 'mensalista',
            'dominant_foot': 'direita',
            'level': 3,
          }),
        );
    (db.data['groupSettings'] as List).add({
      ...defaultSettings,
      'id': p['id'],
      'patota_id': p['id'],
      'weeks_ahead': 0,
      'team_size': {'futsal': 5, 'society': 7, 'campo': 11}[modality],
    });
    _demoAudit(db, 'PatotaCreated', p['id'] as String, {'modality': modality});
    return p['id'];
  }
  if (name == 'join_patota') {
    final key =
        '${db.userId}:${DateTime.now().millisecondsSinceEpoch ~/ 60000}';
    final attempts = db.data['joinAttempts'] as Map;
    attempts[key] = (attempts[key] as int? ?? 0) + 1;
    if ((attempts[key] as int) > 5) return null;
    final group = (db.data['patotas'] as List)
        .where(
          (p) =>
              p['join_code'] ==
              (params['p_code'] as String).trim().toUpperCase(),
        )
        .firstOrNull;
    if (group == null) return null;
    final member = (db.data['members'] as List)
        .where(
          (m) => m['patota_id'] == group['id'] && m['user_id'] == db.userId,
        )
        .firstOrNull;
    if (member?['status'] == 'inativo') return null;
    db._activeId = group['id'] as String;
    if (member == null) {
      final account = (db.data['accounts'] as List).firstWhere(
        (a) => a['id'] == db.userId,
      );
      (db.data['members'] as List).add(
        _row({
          'patota_id': group['id'],
          'user_id': db.userId,
          'role': 'jogador',
          'status': 'ativo',
        }),
      );
      db
          .rows('players')
          .add(
            _row({
              'patota_id': group['id'],
              'user_id': db.userId,
              'username': 'jogador.${db.userId!.substring(0, 8)}',
              'full_name': account['full_name'],
              'role': 'jogador',
              'status': 'ativo',
              'position': 'linha',
              'player_type': 'mensalista',
              'level': 3,
            }),
          );
      _demoAudit(db, 'PlayerJoined', db.userId);
    }
    return group['id'];
  }
  if (name == 'patota_join_code') {
    if (params['p_patota_id'] != s.activePatotaId) {
      throw Exception('Patota indisponível.');
    }
    db.requireAdmin();
    final group = (db.data['patotas'] as List).firstWhere(
      (p) => p['id'] == db._activeId,
    );
    if (params['p_rotate'] == true) {
      group['join_code'] = _newDemoCode(db);
      _demoAudit(db, 'PatotaJoinCodeRegenerated', db._activeId);
    }
    return group['join_code'];
  }
  if (name == 'set_member_role') {
    db.requireAdmin();
    if (params['p_patota_id'] != db._activeId ||
        !['admin', 'jogador'].contains(params['p_role'])) {
      throw Exception('Permissão inválida.');
    }
    final members = (db.data['members'] as List).where(
      (m) => m['patota_id'] == db._activeId,
    );
    if (params['p_role'] == 'jogador' &&
        !members.any(
          (m) =>
              m['user_id'] != params['p_user_id'] &&
              m['role'] == 'admin' &&
              m['status'] == 'ativo',
        )) {
      throw Exception('A patota precisa manter um administrador.');
    }
    final member = members.firstWhere(
      (m) => m['user_id'] == params['p_user_id'],
    );
    member['role'] = params['p_role'];
    db
            .rows('players')
            .firstWhere(
              (p) =>
                  p['patota_id'] == db._activeId &&
                  p['user_id'] == params['p_user_id'],
            )['role'] =
        params['p_role'];
    _demoAudit(db, 'MemberRoleChanged', params['p_user_id'] as String, {
      'role': params['p_role'],
    });
    return null;
  }
  if (name == 'create_round') {
    db.requireAdmin();
    if (params['p_patota_id'] != db._activeId) {
      throw Exception('Patota indisponível.');
    }
    if (!_claim(db, name, params)) {
      return (db.data['audit'] as List)
          .where((a) => a['payload']['command_id'] == params['p_command_id'])
          .first['resource_id'];
    }
    final input = Map<String, dynamic>.from(params['p_input'] as Map);
    if (s.rounds.any((r) => r.date == input['date'])) {
      throw Exception('Já existe partida nesta data.');
    }
    final round = _row({
      ...input,
      'patota_id': db._activeId,
      'timezone': s.patota!.timezone,
      'version': 1,
      'status': 'rascunho',
      'rules_snapshot': {
        'version': 'mobile-v1',
        'modality': s.patota!.modality,
        'team_size': s.settings.teamSize,
      },
    });
    round['starts_at'] = scheduledInstant(
      round['date'] as String,
      round['start_time'] as String? ?? s.settings.time,
      s.patota!.timezone,
    ).toIso8601String();
    db.rows('rounds').add(round);
    _demoAudit(db, 'MatchScheduled', round['id'] as String, {
      'command_id': params['p_command_id'],
    });
    return round['id'];
  }
  if (name == 'update_patota_settings') {
    db.requireAdmin();
    if (params['p_patota_id'] != db._activeId) {
      throw Exception('Patota indisponível.');
    }
    final patch = Map<String, dynamic>.from(params['p_input'] as Map),
        group = (db.data['patotas'] as List).firstWhere(
          (p) => p['id'] == db._activeId,
        );
    final a = patch['team_a_color'] ?? s.settings.teamAColor,
        b = patch['team_b_color'] ?? s.settings.teamBColor;
    if (a == b || !teamPalette.containsKey(a) || !teamPalette.containsKey(b)) {
      throw Exception('Selecione duas cores diferentes da paleta.');
    }
    if (patch.containsKey('timezone')) {
      patotaLocation(patch['timezone'] as String);
    }
    if (patch.containsKey('modality') &&
        !modalityLabels.containsKey(patch['modality'])) {
      throw Exception('Modalidade inválida.');
    }
    for (final key in ['name', 'modality', 'timezone']) {
      if (patch.containsKey(key)) group[key] = patch[key];
    }
    (db.data['groupSettings'] as List)
        .firstWhere((g) => g['patota_id'] == db._activeId)
        .addAll(patch);
    _demoAudit(db, 'PatotaSettingsChanged', db._activeId, patch);
    return null;
  }
  final roundId = params['p_round_id'] as String?;
  if (name == 'round_history') {
    db.requireAdmin();
    return (db.data['audit'] as List)
        .where(
          (a) =>
              a['patota_id'] == db._activeId &&
              (a['resource_id'] == roundId ||
                  a['payload']['round_id'] == roundId),
        )
        .toList();
  }
  if (name == 'respond_to_round') {
    final round = s.round(roundId!);
    if (round == null || ['encerrada', 'cancelada'].contains(round.status)) {
      throw Exception('Não é possível responder a esta partida.');
    }
    final playerId = params['p_player_id'] as String? ?? db.current?.id;
    if (params['p_player_id'] != null) db.requireAdmin();
    if (playerId == null || s.player(playerId)?.status != 'ativo') {
      throw Exception('Jogador indisponível.');
    }
    if (!['confirmado', 'fora'].contains(params['p_wants'])) {
      throw Exception('Resposta inválida.');
    }
    if (!_claim(db, name, params)) return null;
    for (final change in planResponse(
      s.entries(roundId),
      playerId,
      params['p_wants'] as String,
      round.maxPlayers,
      nowISO(),
    )) {
      final old = db
          .rows('round_players')
          .where(
            (p) =>
                p['round_id'] == roundId &&
                p['player_id'] == change['player_id'],
          )
          .firstOrNull;
      if (old == null) {
        db
            .rows('round_players')
            .add(
              _row({
                'patota_id': db._activeId,
                'round_id': roundId,
                'team_id': null,
                'position': null,
                'source': params['p_player_id'] == null ? 'app' : 'admin',
                ...change,
              }),
            );
      } else {
        old.addAll(change);
        old['version'] = (old['version'] as int? ?? 1) + 1;
      }
      _demoAudit(
        db,
        change['player_id'] == playerId
            ? 'AttendanceChanged'
            : 'WaitlistPromoted',
        change['player_id'] as String,
        {'round_id': roundId, 'after': change['attendance']},
      );
    }
    return null;
  }
  if (name == 'mutate_round') {
    db.requireAdmin();
    final r = s.round(roundId!);
    if (r == null) throw Exception('Partida indisponível.');
    if (!_claim(db, name, params)) return null;
    final row = db.rows('rounds').firstWhere((p) => p['id'] == roundId),
        input = Map<String, dynamic>.from(params['p_input'] as Map),
        action = params['p_action'];
    switch (action) {
      case 'edit':
        if (r.status != 'rascunho' || input['expected_version'] != r.version) {
          throw Exception('A partida mudou ou não está em rascunho.');
        }
        final max = input['max_players'] as int? ?? r.maxPlayers;
        if (max > 0 &&
            max <
                s
                    .entries(roundId)
                    .where((p) => p.attendance == 'confirmado')
                    .length) {
          throw Exception(
            'A capacidade não pode ser menor que os confirmados.',
          );
        }
        row.addAll({...input}..remove('expected_version'));
        row['starts_at'] = scheduledInstant(
          row['date'] as String,
          row['start_time'] as String,
          r.timezone,
        ).toIso8601String();
        var count = s
            .entries(roundId)
            .where((p) => p.attendance == 'confirmado')
            .length;
        for (final waiting
            in s.entries(roundId).where((p) => p.attendance == 'espera')) {
          if (max > 0 && count >= max) break;
          db
                  .rows('round_players')
                  .firstWhere((p) => p['id'] == waiting.id)['attendance'] =
              'confirmado';
          count++;
          _demoAudit(db, 'WaitlistPromoted', waiting.playerId, {
            'round_id': roundId,
          });
        }
      case 'cancel':
        if (r.status != 'rascunho' ||
            (input['reason'] as String? ?? '').trim().isEmpty) {
          throw Exception(
            'Informe o motivo; só é possível cancelar antes de iniciar.',
          );
        }
        row['status'] = 'cancelada';
        row['cancel_reason'] = input['reason'];
      case 'uncancel':
        if (r.status != 'cancelada') {
          throw Exception('A partida não está cancelada.');
        }
        row['status'] = 'rascunho';
        row['cancel_reason'] = null;
      case 'check_in':
        if (['cancelada', 'encerrada'].contains(r.status) ||
            !['presente', 'ausente'].contains(input['actual_attendance'])) {
          throw Exception('Comparecimento indisponível.');
        }
        db
                .rows('round_players')
                .firstWhere(
                  (p) =>
                      p['round_id'] == roundId &&
                      p['player_id'] == input['player_id'],
                )['actual_attendance'] =
            input['actual_attendance'];
      case 'position':
        if (r.status == 'encerrada' ||
            !['linha', 'goleiro'].contains(input['position'])) {
          throw Exception('Posição indisponível.');
        }
        db
                .rows('round_players')
                .firstWhere(
                  (p) =>
                      p['round_id'] == roundId &&
                      p['player_id'] == input['player_id'],
                )['position'] =
            input['position'];
      case 'close':
        if (r.status == 'encerrada') return null;
        if (r.status != 'em_andamento') {
          throw Exception('Inicie a partida primeiro.');
        }
        for (final m
            in db.rows('matches').where((m) => m['round_id'] == roundId)) {
          m['status'] = 'encerrada';
          m['ended_at'] = nowISO();
        }
        row['status'] = 'encerrada';
        row['closed_at'] = nowISO();
        row['awards_settled_at'] = null;
      case 'reopen':
        if (r.status != 'encerrada' ||
            (input['reason'] as String? ?? '').trim().isEmpty) {
          throw Exception('Informe o motivo da reabertura.');
        }
        for (final m
            in db.rows('matches').where((m) => m['round_id'] == roundId)) {
          m['status'] = 'em_andamento';
          m['ended_at'] = null;
        }
        row['status'] = 'em_andamento';
        row['closed_at'] = null;
        row['awards_settled_at'] = null;
        db.rows('round_awards').removeWhere((a) => a['round_id'] == roundId);
        for (final key in ['cards', 'awardVersions']) {
          for (final v in (db.data[key] as List).where(
            (v) => v['round_id'] == roundId && v['superseded_at'] == null,
          )) {
            v['superseded_at'] = nowISO();
          }
        }
      default:
        throw Exception('Comando inválido.');
    }
    row['version'] = r.version + 1;
    _demoAudit(db, 'Match:$action', roundId, input);
    return null;
  }
  if (name == 'publish_teams') {
    db.requireAdmin();
    final r = s.round(roundId!);
    if (r == null || ['encerrada', 'cancelada'].contains(r.status)) {
      throw Exception('Partida indisponível.');
    }
    if (!_claim(db, name, params)) return null;
    final input = Map<String, dynamic>.from(params['p_input'] as Map),
        teams = input['teams'] as List;
    final existing = s.roundTeams(roundId);
    if (teams.length != 2 ||
        !['legacy-v1', 'manual-v1'].contains(input['algorithm_version']) ||
        (existing.isNotEmpty && input['algorithm_version'] != 'manual-v1')) {
      throw Exception(
        'Geração inválida; use montagem manual para preservar os gols.',
      );
    }
    final ids = <String>{};
    for (final team in teams) {
      if (!teamPalette.containsKey(team['color']) ||
          (team['name'] as String).trim().isEmpty ||
          (team['players'] as List).isEmpty) {
        throw Exception('Time inválido.');
      }
      for (final id in team['players'] as List) {
        if (!ids.add(id as String) ||
            !s
                .entries(roundId)
                .any(
                  (rp) => rp.playerId == id && rp.attendance == 'confirmado',
                ) ||
            s.player(id)?.status != 'ativo') {
          throw Exception('Jogador duplicado ou não confirmado.');
        }
      }
    }
    if (teams[0]['color'] == teams[1]['color']) {
      throw Exception('Selecione cores diferentes.');
    }
    for (final rp
        in db.rows('round_players').where((p) => p['round_id'] == roundId)) {
      rp['team_id'] = null;
    }
    final teamIds = <String>[];
    for (var i = 0; i < 2; i++) {
      Json team;
      if (existing.isEmpty) {
        team = _row({
          'patota_id': db._activeId,
          'round_id': roundId,
          'position': i,
          'name': teams[i]['name'],
          'color': teams[i]['color'],
        });
        db.rows('teams').add(team);
      } else {
        team =
            db.rows('teams').firstWhere((t) => t['id'] == existing[i].id)
                as Json;
        team['name'] = teams[i]['name'];
        team['color'] = teams[i]['color'];
      }
      teamIds.add(team['id'] as String);
      for (final id in teams[i]['players'] as List) {
        final rp = db
            .rows('round_players')
            .firstWhere(
              (p) => p['round_id'] == roundId && p['player_id'] == id,
            );
        rp['team_id'] = team['id'];
        rp['position'] ??= s.player(id as String)!.position;
      }
    }
    if (existing.isEmpty) {
      db
          .rows('matches')
          .add(
            _row({
              'patota_id': db._activeId,
              'round_id': roundId,
              'team_a_id': teamIds[0],
              'team_b_id': teamIds[1],
              'sequence': 1,
              'score_a': 0,
              'score_b': 0,
              'status': 'em_andamento',
            }),
          );
      db.rows('rounds').firstWhere((r) => r['id'] == roundId)['status'] =
          'em_andamento';
    }
    (db.data['generations'] as List).add(
      _row({'patota_id': db._activeId, 'round_id': roundId, 'payload': input}),
    );
    _demoAudit(db, 'TeamsGenerated', roundId, input);
    return null;
  }
  if (name == 'mutate_goal') {
    db.requireAdmin();
    final match = s.matches
        .where((m) => m.id == params['p_match_id'])
        .firstOrNull;
    if (match == null || match.status != 'em_andamento') {
      throw Exception('Reabra a partida antes de alterar o placar.');
    }
    if (!_claim(db, name, params)) return null;
    final action = params['p_action'],
        input = Map<String, dynamic>.from(params['p_input'] as Map);
    if (['edit', 'reverse'].contains(action)) {
      if ((input['reason'] as String? ?? '').trim().isEmpty) {
        throw Exception('Informe o motivo da correção.');
      }
      final event = db
          .rows('match_events')
          .firstWhere(
            (e) =>
                e['id'] == input['event_id'] &&
                e['match_id'] == match.id &&
                e['voided_at'] == null,
          );
      event['voided_at'] = nowISO();
      event['correction_reason'] = input['reason'];
    }
    if (['add', 'edit'].contains(action)) {
      if (![match.teamA, match.teamB].contains(input['team_id'])) {
        throw Exception('Time inválido.');
      }
      final minute = input['minute'] as int?;
      if (minute != null && (minute < 0 || minute > 300)) {
        throw Exception('Minuto inválido.');
      }
      final own = input['own_goal'] == true,
          scorer = input['scorer_id'],
          assist = input['assist_id'];
      final scoringTeam = own
          ? (input['team_id'] == match.teamA ? match.teamB : match.teamA)
          : input['team_id'];
      if (scorer != null &&
          !s
              .entries(match.roundId)
              .any((rp) => rp.playerId == scorer && rp.teamId == scoringTeam)) {
        throw Exception('Autor do gol não pertence ao time.');
      }
      if (assist != null &&
          (own ||
              assist == scorer ||
              !s
                  .entries(match.roundId)
                  .any(
                    (rp) =>
                        rp.playerId == assist && rp.teamId == input['team_id'],
                  ))) {
        throw Exception('Assistência inválida.');
      }
      db
          .rows('match_events')
          .add(
            _row(
              {
                  'patota_id': db._activeId,
                  'match_id': match.id,
                  'actor_id': db.userId,
                  ...input,
                }
                ..remove('event_id')
                ..remove('reason'),
            ),
          );
    } else if (action != 'reverse') {
      throw Exception('Comando inválido.');
    }
    db
        .rows('matches')
        .firstWhere((m) => m['id'] == match.id)
        .addAll(scoreFromEvents(match, db.snapshot.events));
    final r = db.rows('rounds').firstWhere((r) => r['id'] == match.roundId);
    r['version'] = (r['version'] as int? ?? 1) + 1;
    _demoAudit(db, 'MatchAction:$action', match.id, input);
    return null;
  }
  if (name == 'vote_award') {
    final r = s.round(roundId!);
    if (r == null || votingState(r) != 'aberta') {
      throw Exception('Votação encerrada.');
    }
    final me = db.current?.id,
        type = params['p_type'] as String,
        target = params['p_player_id'];
    if (!awardLabels.containsKey(type) ||
        !s
            .entries(roundId)
            .any(
              (rp) =>
                  rp.playerId == me &&
                  rp.teamId != null &&
                  rp.actualAttendance != 'ausente',
            )) {
      throw Exception('Somente quem jogou pode votar.');
    }
    if (target != null &&
        (target == me ||
            !awardCandidates(
              s,
              roundId,
            )[type]!.any((p) => p.playerId == target))) {
      throw Exception('Candidato inválido. Não é permitido votar em si mesmo.');
    }
    db
        .rows('round_votes')
        .removeWhere(
          (v) =>
              v['round_id'] == roundId &&
              v['voter_id'] == me &&
              v['type'] == type,
        );
    if (target != null) {
      db
          .rows('round_votes')
          .add(
            _row({
              'patota_id': db._activeId,
              'round_id': roundId,
              'voter_id': me,
              'player_id': target,
              'type': type,
            }),
          );
    }
    return null;
  }
  if (name == 'settle_awards') {
    db.requireAdmin();
    final r = s.round(roundId!);
    if (r == null || r.status != 'encerrada') {
      throw Exception('Encerre a partida primeiro.');
    }
    if (r.settledAt != null ||
        (params['p_early'] != true && votingState(r) != 'encerrada')) {
      return null;
    }
    final results = <String, dynamic>{};
    for (final type in awardLabels.keys) {
      final winner = tallyAward(s, roundId, type);
      results[type] = {'player_id': winner, 'formula_version': 'legacy-v1'};
      if (winner != null) {
        db
            .rows('round_awards')
            .add(
              _row({
                'patota_id': db._activeId,
                'round_id': roundId,
                'type': type,
                'player_id': winner,
              }),
            );
      }
    }
    db
            .rows('rounds')
            .firstWhere((r) => r['id'] == roundId)['awards_settled_at'] =
        nowISO();
    (db.data['awardVersions'] as List).add(
      _row({
        'patota_id': db._activeId,
        'round_id': roundId,
        'formula_version': 'legacy-v1',
        'payload': results,
      }),
    );
    _demoAudit(db, 'AwardsCalculated', roundId, results);
    return null;
  }
  if (name == 'player_match_card') {
    final r = s.round(roundId!),
        player = s.player(params['p_player_id'] as String);
    if (r == null ||
        r.status != 'encerrada' ||
        player == null ||
        (player.userId != db.userId && db.current?.role != 'admin')) {
      throw Exception('Card indisponível.');
    }
    final stats = computeStats(s, roundId: roundId)[player.id]!;
    if (stats.played == 0) throw Exception('Sem participação registrada.');
    final payload = {
      'player_id': player.id,
      'name': player.name,
      'patota': s.patota!.name,
      'date': r.date,
      'round_id': r.id,
      'round_version': r.version,
      'games': stats.played,
      'goals': stats.goals,
      'assists': stats.assists,
      'wins': stats.wins,
      'team': s
          .team(
            s
                    .entries(r.id)
                    .firstWhere((rp) => rp.playerId == player.id)
                    .teamId ??
                '',
          )
          ?.json,
      'template_version': 'player-match-v1',
      'scores': [
        for (final m in s.matches.where((m) => m.roundId == r.id))
          {
            'team_a': s.team(m.teamA)?.name,
            'team_b': s.team(m.teamB)?.name,
            'score_a': m.scoreA,
            'score_b': m.scoreB,
          },
      ],
      'awards': r.settledAt == null
          ? []
          : s.awards
                .where((a) => a.roundId == r.id && a.playerId == player.id)
                .map((a) => a.type)
                .toList(),
    };
    final cards = db.data['cards'] as List;
    final existing = cards
        .where(
          (c) =>
              c['round_id'] == r.id &&
              c['player_id'] == player.id &&
              c['superseded_at'] == null &&
              jsonEncode(c['payload']) == jsonEncode(payload),
        )
        .firstOrNull;
    if (existing != null) return existing;
    for (final old in cards.where(
      (c) =>
          c['round_id'] == r.id &&
          c['player_id'] == player.id &&
          c['superseded_at'] == null,
    )) {
      old['superseded_at'] = nowISO();
    }
    final card = _row({
      'patota_id': db._activeId,
      'round_id': r.id,
      'player_id': player.id,
      'payload': payload,
    });
    cards.add(card);
    _demoAudit(db, 'PlayerMatchCardGenerated', card['id'] as String);
    return card;
  }
  throw UnimplementedError(name);
}
