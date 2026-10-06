import 'dart:async';
import 'dart:convert';
import 'dart:math' show Random;
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';
import '../domain.dart';
import '../models.dart';
import '../core/time.dart';
part 'demo_mobile.dart';

String get kAuthRedirect {
  const configured = String.fromEnvironment('AUTH_REDIRECT_URL');
  return configured.isNotEmpty
      ? configured
      : kIsWeb
      ? Uri.base.replace(query: '', fragment: '').toString()
      : 'br.com.nossapatota://auth-callback/';
}

String normalizeUsername(String value) => value.trim().toLowerCase();
String usernameToEmail(String value) =>
    '${normalizeUsername(value)}@patota.local';
String normalizeProjectUrl(String value) => value
    .trim()
    .replaceFirst(RegExp(r'/+$'), '')
    .replaceFirst(
      RegExp(
        r'/(rest|auth|storage|realtime|functions)/v\d+$',
        caseSensitive: false,
      ),
      '',
    );
String nowISO() => DateTime.now().toUtc().toIso8601String();

abstract class Backend {
  bool get demo;
  String? get userId;
  String? get accountEmail;
  bool get recoveryPending;
  Future<void> selectPatota(String? id);
  Future<void> resetPassword(String email);
  Future<void> updateEmail(String email);
  Stream<void> get changes;
  Future<void> signIn(String username, String password);
  Future<bool> signUp(Json input);
  Future<void> signOut();
  Future<void> changePassword(String password);
  Future<Snapshot> fetchAll();
  Future<Json> insert(String table, Json input);
  Future<void> update(String table, String id, Json patch);
  Future<void> delete(String table, String id);
  Future<dynamic> rpc(String name, Json params);
  Future<String> uploadAvatar(
    String playerId,
    Uint8List bytes,
    String extension,
  );
  Future<void> dispose();
}

class SupabaseBackend implements Backend {
  SupabaseBackend(this.client) {
    _auth = client.auth.onAuthStateChange.listen((event) {
      if (event.event == AuthChangeEvent.passwordRecovery) _recovery = true;
      if (event.event == AuthChangeEvent.signedOut) {
        _recovery = false;
        _activeId = null;
        _photos.clear();
      }
      _changes.add(null);
    });
    _channel = client
        .channel('patota-flutter')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          callback: (_) => _changes.add(null),
        )
        .subscribe();
  }
  final SupabaseClient client;
  String? _activeId;
  bool _recovery = false;
  SharedPreferences? _preferences;
  final _photos = <String, (String, DateTime)>{};
  static String get authRedirect => kAuthRedirect;
  @override
  bool get recoveryPending => _recovery;
  @override
  String? get accountEmail => client.auth.currentUser?.email;
  @override
  Future<void> selectPatota(String? id) async {
    _preferences ??= await SharedPreferences.getInstance();
    _activeId = id;
    _photos.clear();
    if (id == null) {
      await _preferences!.remove('patota.active.$userId');
    } else {
      await _preferences!.setString('patota.active.$userId', id);
    }
  }

  @override
  Future<void> resetPassword(String email) => client.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    redirectTo: authRedirect,
  );
  @override
  Future<void> updateEmail(String email) async {
    await client.auth.updateUser(
      UserAttributes(email: email.trim().toLowerCase()),
      emailRedirectTo: authRedirect,
    );
  }

  final _changes = StreamController<void>.broadcast();
  late final StreamSubscription<AuthState> _auth;
  late final RealtimeChannel _channel;
  @override
  bool get demo => false;
  @override
  String? get userId => client.auth.currentUser?.id;
  @override
  Stream<void> get changes => _changes.stream;
  @override
  Future<void> signIn(String username, String password) async {
    await client.auth.signInWithPassword(
      email: username.contains('@')
          ? username.trim().toLowerCase()
          : usernameToEmail(username),
      password: password,
    );
  }

  @override
  Future<bool> signUp(Json input) async {
    final result = await client.auth.signUp(
      email: (input['email'] as String).trim().toLowerCase(),
      password: input['password'] as String,
      emailRedirectTo: authRedirect,
      data: {'full_name': input['full_name']},
    );
    return result.session != null;
  }

  @override
  Future<void> signOut() => client.auth.signOut();
  @override
  Future<void> changePassword(String password) async {
    await client.auth.updateUser(UserAttributes(password: password));
    _recovery = false;
  }

  @override
  Future<Snapshot> fetchAll() async {
    _preferences ??= await SharedPreferences.getInstance();
    _activeId ??= _preferences!.getString('patota.active.$userId');
    Json json;
    try {
      json = Map<String, dynamic>.from(
        await rpc('mobile_snapshot', {'p_patota_id': _activeId}) as Map,
      );
    } catch (e) {
      if (_activeId == null || !e.toString().contains('não pertence')) rethrow;
      await selectPatota(null);
      json = Map<String, dynamic>.from(await rpc('mobile_snapshot', {}) as Map);
    }
    _activeId = json['activePatotaId'] as String?;
    final players = json['players'] as List;
    await Future.wait(
      players.map((row) async {
        final url = row['photo_url'] as String?;
        if (url == null || url.isEmpty || url.startsWith('data:')) return;
        String? path;
        if (url.startsWith('storage:avatars/')) {
          path = url.substring('storage:avatars/'.length);
        } else {
          final uri = Uri.tryParse(url);
          if (uri?.host == Uri.parse(client.rest.url).host &&
              uri!.path.contains('/avatars/')) {
            path = Uri.decodeComponent(uri.path.split('/avatars/').last);
          }
        }
        if (path == null) {
          row['photo_url'] = null;
          return;
        }
        try {
          final cached = _photos[path];
          if (cached != null && cached.$2.isAfter(DateTime.now())) {
            row['photo_url'] = cached.$1;
          } else {
            final signed = await client.storage
                .from('avatars')
                .createSignedUrl(path, 3600);
            _photos[path] = (
              signed,
              DateTime.now().add(const Duration(minutes: 45)),
            );
            row['photo_url'] = signed;
          }
        } catch (_) {
          row['photo_url'] = null;
        }
      }),
    );
    return Snapshot(json);
  }

  @override
  Future<Json> insert(String table, Json input) async {
    if (_activeId == null) throw Exception('Escolha uma patota.');
    if (table == 'rounds') {
      final id = await rpc('create_round', {
        'p_patota_id': _activeId,
        'p_input': input,
        'p_command_id': const Uuid().v4(),
      });
      return await client.from('rounds').select().eq('id', id).single();
    }
    return await client
        .from(table)
        .insert({...input, 'patota_id': _activeId})
        .select()
        .single();
  }

  @override
  Future<void> update(String table, String id, Json patch) async {
    if (table == 'patota_settings') {
      await rpc('update_patota_settings', {
        'p_patota_id': _activeId,
        'p_input': patch,
      });
      return;
    }
    if (table == 'players' && patch.containsKey('role')) {
      final p = await client
          .from('players')
          .select('user_id')
          .eq('id', id)
          .eq('patota_id', _activeId!)
          .single();
      await rpc('set_member_role', {
        'p_patota_id': _activeId,
        'p_user_id': p['user_id'],
        'p_role': patch['role'],
      });
      return;
    }
    if (table == 'round_players') {
      final row = await client
          .from(table)
          .select('round_id,player_id')
          .eq('id', id)
          .eq('patota_id', _activeId!)
          .single();
      await rpc('mutate_round', {
        'p_round_id': row['round_id'],
        'p_action': 'position',
        'p_input': {'player_id': row['player_id'], ...patch},
        'p_command_id': const Uuid().v4(),
      });
      return;
    }
    await client
        .from(table)
        .update(patch)
        .eq('id', id)
        .eq('patota_id', _activeId!);
  }

  @override
  Future<void> delete(String table, String id) async {
    if (table == 'players') {
      await update(table, id, {'status': 'inativo'});
      return;
    }
    throw Exception('Use cancelamento ou reversão para preservar o histórico.');
  }

  @override
  Future<dynamic> rpc(String name, Json params) =>
      client.rpc(name, params: params);
  @override
  Future<String> uploadAvatar(
    String playerId,
    Uint8List bytes,
    String extension,
  ) async {
    final path =
        '$playerId/${DateTime.now().millisecondsSinceEpoch}.$extension';
    await client.storage
        .from('avatars')
        .uploadBinary(
          path,
          bytes,
          fileOptions: FileOptions(
            contentType: extension == 'png' ? 'image/png' : 'image/jpeg',
          ),
        );
    return 'storage:avatars/$path';
  }

  @override
  Future<void> dispose() async {
    await _auth.cancel();
    await client.removeChannel(_channel);
    await _changes.close();
  }
}

class DemoBackend implements Backend {
  DemoBackend(this.preferences, this.data)
    : _userId = preferences.getString('patota.flutter.session') {
    _upgradeDemo(this);
  }
  final SharedPreferences preferences;
  Json data;
  String? _userId;
  String? _activeId;
  Future<void> _commandQueue = Future.value();
  @override
  bool get recoveryPending => false;
  @override
  String? get accountEmail =>
      (data['accounts'] as List)
              .where((p) => p['id'] == _userId)
              .firstOrNull?['email']
          as String?;
  @override
  Future<void> selectPatota(String? id) async {
    _activeId = id;
    await preferences.setString('patota.demo.active.$userId', id ?? '');
  }

  @override
  Future<void> resetPassword(String email) async {
    throw Exception(
      'A demonstração não envia e-mails. Configure o Supabase para recuperar sua senha.',
    );
  }

  @override
  Future<void> updateEmail(String email) async {
    requireSession();
    final account = (data['accounts'] as List).firstWhere(
      (p) => p['id'] == _userId,
    );
    account['email'] = email.trim().toLowerCase();
    await save();
  }

  static const storageKey = 'patota.flutter.demo.v1';
  final _changes = StreamController<void>.broadcast();
  static Future<DemoBackend> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw =
        prefs.getString(storageKey) ??
        await rootBundle.loadString('assets/demo.json');
    return DemoBackend(prefs, jsonDecode(raw) as Json);
  }

  Snapshot get snapshot => _demoSnapshot(this);
  Player? get current =>
      snapshot.players.where((p) => (p.userId ?? p.id) == userId).firstOrNull;
  void requireAdmin() {
    if (current?.role != 'admin') {
      throw Exception('Ação reservada aos administradores.');
    }
  }

  void requireSession() {
    if (userId == null) throw Exception('Entre na sua conta.');
  }

  Future<void> save() async {
    await preferences.setString(storageKey, jsonEncode(data));
  }

  @override
  bool get demo => true;
  @override
  String? get userId => _userId;
  @override
  Stream<void> get changes => _changes.stream;
  @override
  Future<void> signIn(String username, String password) async {
    final account = (data['accounts'] as List)
        .where(
          (p) =>
              p['email'] == normalizeUsername(username) ||
              p['username'] == normalizeUsername(username),
        )
        .firstOrNull;
    if (account == null) {
      throw Exception('Usuário não encontrado. Use admin na demonstração.');
    }
    _userId = account['id'] as String;
    _activeId = preferences.getString('patota.demo.active.$userId');
    await preferences.setString('patota.flutter.session', _userId!);
    _changes.add(null);
  }

  @override
  Future<bool> signUp(Json input) async {
    if (input.containsKey('email')) {
      return _demoSignUp(this, input);
    }
    final s = snapshot,
        username = normalizeUsername(input['username'] as String);
    if (s.settings.joinCode.isNotEmpty &&
        s.settings.joinCode != input['join_code']) {
      throw Exception('Código da patota inválido.');
    }
    final existing = s.players.where((p) => p.username == username).firstOrNull;
    if (existing?.userId != null) {
      throw Exception('Este usuário já está cadastrado.');
    }
    final id = existing?.id ?? const Uuid().v4();
    final row = {
      'id': id,
      'user_id': id,
      'username': username,
      'full_name': input['full_name'],
      'player_type': input['player_type'],
      'position': input['position'],
      'dominant_foot': input['dominant_foot'],
      'photo_url': null,
      'level': 3,
      'status': 'ativo',
      'role': s.players.any((p) => p.userId != null) ? 'jogador' : 'admin',
      'must_change_password': false,
      'created_at': nowISO(),
      'patota_id': _activeId,
    };
    rows('players').removeWhere((p) => p['id'] == id);
    rows('players').add(row);
    await save();
    await signIn(username, input['password'] as String);
    return true;
  }

  @override
  Future<void> signOut() async {
    _userId = null;
    _activeId = null;
    await preferences.remove('patota.flutter.session');
    _changes.add(null);
  }

  @override
  Future<void> changePassword(String password) async {
    requireSession();
    if (password.length < 6) throw Exception('Use pelo menos 6 caracteres.');
    await update('players', current!.id, {'must_change_password': false});
  }

  @override
  Future<Snapshot> fetchAll() async {
    requireSession();
    return snapshot;
  }

  static const tableKeys = {
    'round_players': 'roundPlayers',
    'match_events': 'events',
    'round_awards': 'awards',
    'round_votes': 'votes',
  };
  List<dynamic> rows(String table) =>
      data[tableKeys[table] ?? table] as List<dynamic>;
  @override
  Future<Json> insert(String table, Json input) async {
    requireAdmin();
    if (table == 'rounds' &&
        snapshot.rounds.any((r) => r.date == input['date'])) {
      throw Exception('Já existe partida nesta data.');
    }
    if (table == 'players' &&
        snapshot.players.any((p) => p.username == input['username'])) {
      throw Exception('Nome de usuário já cadastrado.');
    }
    final row = <String, dynamic>{
      'id': const Uuid().v4(),
      'created_at': nowISO(),
      ...input,
      'patota_id': _activeId,
    };
    if (table == 'rounds') {
      final group = snapshot.patota!;
      row['timezone'] = group.timezone;
      row['version'] = 1;
      row['starts_at'] = scheduledInstant(
        row['date'] as String,
        row['start_time'] as String? ?? snapshot.settings.time,
        group.timezone,
      ).toIso8601String();
      row['rules_snapshot'] = {
        'version': 'mobile-v1',
        'modality': group.modality,
        'team_size': snapshot.settings.teamSize,
      };
    }
    rows(table).add(row);
    await save();
    return row;
  }

  @override
  Future<void> update(String table, String id, Json patch) async {
    requireSession();
    if (table != 'players' ||
        current!.id != id ||
        patch.keys.any(
          (k) => ![
            'full_name',
            'photo_url',
            'share_photo',
            'must_change_password',
          ].contains(k),
        )) {
      requireAdmin();
    }
    if (table == 'patota_settings') {
      final settings = (data['groupSettings'] as List).firstWhere(
        (s) => s['patota_id'] == _activeId,
      );
      settings.addAll(patch);
    } else {
      final row = rows(
        table,
      ).where((r) => r['id'] == id && r['patota_id'] == _activeId).firstOrNull;
      if (row == null) throw Exception('Registro não encontrado.');
      row.addAll(patch);
    }
    await save();
  }

  @override
  Future<void> delete(String table, String id) async {
    requireAdmin();
    if (table == 'players') {
      await update(table, id, {'status': 'inativo'});
      return;
    }
    throw Exception('Use cancelamento ou reversão para preservar o histórico.');
  }

  @override
  Future<dynamic> rpc(String name, Json params) async {
    if (_mobileRpcNames.contains(name)) {
      return _demoMobileRpc(this, name, params);
    }
    if (name == 'join_code_required') {
      return snapshot.settings.joinCode.isNotEmpty;
    }
    if (name == 'join_code_matches') {
      return snapshot.settings.joinCode.isEmpty ||
          snapshot.settings.joinCode == params['p_code'];
    }
    requireSession();
    final s = snapshot, roundId = params['p_round_id'] as String?;
    if (name == 'respond_attendance') {
      final r = s.round(roundId!)!;
      if (r.status == 'encerrada' || current!.status != 'ativo') {
        throw Exception('Não é possível responder a esta partida.');
      }
      for (final change in planResponse(
        s.entries(roundId),
        current!.id,
        params['p_wants'] as String,
        r.maxPlayers,
        nowISO(),
      )) {
        final existing = rows('round_players')
            .where(
              (rp) =>
                  rp['round_id'] == roundId &&
                  rp['player_id'] == change['player_id'],
            )
            .firstOrNull;
        if (existing == null) {
          rows('round_players').add({
            'id': const Uuid().v4(),
            'round_id': roundId,
            'team_id': null,
            'position': null,
            ...change,
          });
        } else {
          existing.addAll(change);
          if (change['attendance'] != 'confirmado') existing['team_id'] = null;
        }
      }
    } else if (name == 'cast_vote' || name == 'clear_vote') {
      final r = s.round(roundId!)!;
      if (votingState(r) != 'aberta') throw Exception('Votação encerrada.');
      if (!s
          .entries(roundId)
          .any((rp) => rp.playerId == current!.id && rp.teamId != null)) {
        throw Exception('Somente quem jogou pode votar.');
      }
      final type = params['p_type'] as String;
      if (name == 'cast_vote' &&
          (params['p_player_id'] == current!.id ||
              !awardCandidates(
                s,
                roundId,
              )[type]!.any((p) => p.playerId == params['p_player_id']))) {
        throw Exception(
          'Candidato inválido. Não é permitido votar em si mesmo.',
        );
      }
      rows('round_votes').removeWhere(
        (v) =>
            v['round_id'] == roundId &&
            v['type'] == type &&
            v['voter_id'] == current!.id,
      );
      if (name == 'cast_vote') {
        rows('round_votes').add({
          'id': const Uuid().v4(),
          'round_id': roundId,
          'type': type,
          'voter_id': current!.id,
          'player_id': params['p_player_id'],
          'created_at': nowISO(),
        });
      }
    } else if (name == 'admin_set_password') {
      requireAdmin();
      await update('players', params['p_player_id'] as String, {
        'must_change_password': true,
      });
    } else {
      throw UnimplementedError(name);
    }
    await save();
    return null;
  }

  @override
  Future<String> uploadAvatar(
    String playerId,
    Uint8List bytes,
    String extension,
  ) async {
    requireSession();
    if (current!.id != playerId) requireAdmin();
    return 'data:image/${extension == 'png' ? 'png' : 'jpeg'};base64,${base64Encode(bytes)}';
  }

  Future<void> reset() async {
    requireAdmin();
    data = jsonDecode(await rootBundle.loadString('assets/demo.json')) as Json;
    _upgradeDemo(this);
    await save();
  }

  @override
  Future<void> dispose() => _changes.close();
}
