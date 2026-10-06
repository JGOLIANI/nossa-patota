typedef Json = Map<String, dynamic>;

const awardLabels = {
  'jogador_rodada': 'Craque da Partida',
  'goleiro_menos_vazado': 'Paredão',
  'pior_jogador': 'Bagre da Rodada',
};
const weekdays = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];
const defaultSettings = <String, dynamic>{
  'id': 'default',
  'weekday': 5,
  'start_time': '20:00',
  'location': '',
  'location_url': '',
  'max_players': 0,
  'weeks_ahead': 4,
  'join_code': '',
};

// The wire format stays compatible with the existing Supabase schema.
abstract class Entity {
  Entity(Json value) : json = Map.unmodifiable(value);
  final Json json;
  String get id => text('id');
  String text(String key, [String fallback = '']) =>
      json[key] as String? ?? fallback;
  String? nullable(String key) => json[key] as String?;
  int number(String key, [int fallback = 0]) =>
      (json[key] as num?)?.toInt() ?? fallback;
}

class Player extends Entity {
  Player(super.value);
  String? get userId => nullable('user_id');
  String get username => text('username');
  String get name => text('full_name');
  String? get photo => nullable('photo_url');
  String get type => text('player_type', 'mensalista');
  String get foot => text('dominant_foot', 'direita');
  String get position => text('position', 'linha');
  String get status => text('status', 'ativo');
  String get role => text('role', 'jogador');
  int get level => number('level', 3);
  bool get mustChangePassword => json['must_change_password'] == true;
  bool get sharePhoto => json['share_photo'] == true;
}

class Patota extends Entity {
  Patota(super.value);
  String get name => text('name');
  String get modality => text('modality', 'futsal');
  String get timezone => text('timezone', 'America/Sao_Paulo');
}

class Membership extends Entity {
  Membership(super.value);
  String get patotaId => text('patota_id');
  String get userId => text('user_id');
  String get role => text('role', 'jogador');
  String get status => text('status', 'ativo');
}

class Round extends Entity {
  Round(super.value);
  String get date => text('date');
  String get title => text('title');
  String get time => text('start_time');
  String get location => text('location');
  String get locationUrl => text('location_url');
  int get maxPlayers => number('max_players');
  String get status => text('status', 'rascunho');
  DateTime? get closedAt => DateTime.tryParse(text('closed_at'));
  DateTime? get settledAt => DateTime.tryParse(text('awards_settled_at'));
  String get timezone => text('timezone', 'America/Sao_Paulo');
  int get version => number('version', 1);
  String? get cancelReason => nullable('cancel_reason');
}

class Team extends Entity {
  Team(super.value);
  String get roundId => text('round_id');
  String get name => text('name');
  String get color => text('color', '#000000');
  int get position => number('position');
}

class RoundPlayer extends Entity {
  RoundPlayer(super.value);
  String get roundId => text('round_id');
  String get playerId => text('player_id');
  String? get teamId => nullable('team_id');
  String? get position => nullable('position');
  String get attendance => text('attendance');
  String get respondedAt => text('responded_at');
  String? get actualAttendance => nullable('actual_attendance');
}

class Match extends Entity {
  Match(super.value);
  String get roundId => text('round_id');
  String get teamA => text('team_a_id');
  String get teamB => text('team_b_id');
  int get scoreA => number('score_a');
  int get scoreB => number('score_b');
  int get sequence => number('sequence');
  String get status => text('status');
}

class Goal extends Entity {
  Goal(super.value);
  String get matchId => text('match_id');
  String get teamId => text('team_id');
  String? get scorerId => nullable('scorer_id');
  String? get assistId => nullable('assist_id');
  bool get ownGoal => json['own_goal'] == true;
}

class Award extends Entity {
  Award(super.value);
  String get roundId => text('round_id');
  String get type => text('type');
  String get playerId => text('player_id');
}

class Vote extends Award {
  Vote(super.value);
  String get voterId => text('voter_id');
}

class Settings extends Entity {
  Settings(Json value) : super({...defaultSettings, ...value});
  int get weekday => number('weekday');
  String get time => text('start_time');
  String get location => text('location');
  String get locationUrl => text('location_url');
  int get maxPlayers => number('max_players');
  int get weeksAhead => number('weeks_ahead');
  String get joinCode => text('join_code');
  String get teamAColor => text('team_a_color', '#000000');
  String get teamBColor => text('team_b_color', '#ffffff');
  String get teamALabel => text('team_a_label', 'Time Preto');
  String get teamBLabel => text('team_b_label', 'Time Branco');
  int get teamSize => number('team_size', 5);
}

class Snapshot {
  Snapshot(Json json)
    : activePatotaId = json['activePatotaId'] as String?,
      patotas = _rows(json, 'patotas', Patota.new),
      members = _rows(json, 'members', Membership.new),
      players = _rows(json, 'players', Player.new),
      rounds = _rows(json, 'rounds', Round.new),
      teams = _rows(json, 'teams', Team.new),
      roundPlayers = _rows(json, 'roundPlayers', RoundPlayer.new),
      matches = _rows(json, 'matches', Match.new),
      events = _rows(json, 'events', Goal.new),
      awards = _rows(json, 'awards', Award.new),
      votes = _rows(json, 'votes', Vote.new),
      settings = Settings(
        Map<String, dynamic>.from(json['settings'] as Map? ?? {}),
      );
  final List<Player> players;
  final String? activePatotaId;
  final List<Patota> patotas;
  final List<Membership> members;
  Patota? get patota =>
      patotas.where((p) => p.id == activePatotaId).firstOrNull;
  final List<Round> rounds;
  final List<Team> teams;
  final List<RoundPlayer> roundPlayers;
  final List<Match> matches;
  final List<Goal> events;
  final List<Award> awards;
  final List<Vote> votes;
  final Settings settings;
  static List<T> _rows<T>(Json json, String key, T Function(Json) create) =>
      (json[key] as List? ?? [])
          .map((e) => create(Map<String, dynamic>.from(e as Map)))
          .toList();
  Json toJson() => {
    'activePatotaId': activePatotaId,
    'patotas': patotas.map((p) => p.json).toList(),
    'members': members.map((p) => p.json).toList(),
    'players': players.map((e) => e.json).toList(),
    'rounds': rounds.map((e) => e.json).toList(),
    'teams': teams.map((e) => e.json).toList(),
    'roundPlayers': roundPlayers.map((e) => e.json).toList(),
    'matches': matches.map((e) => e.json).toList(),
    'events': events.map((e) => e.json).toList(),
    'awards': awards.map((e) => e.json).toList(),
    'votes': votes.map((e) => e.json).toList(),
    'settings': settings.json,
  };
  Player? player(String? id) => players.where((p) => p.id == id).firstOrNull;
  Team? team(String? id) => teams.where((t) => t.id == id).firstOrNull;
  Round? round(String id) => rounds.where((r) => r.id == id).firstOrNull;
  List<RoundPlayer> entries(String id) =>
      roundPlayers.where((r) => r.roundId == id).toList()
        ..sort((a, b) => a.respondedAt.compareTo(b.respondedAt));
  List<Team> roundTeams(String id) =>
      teams.where((t) => t.roundId == id).toList()
        ..sort((a, b) => a.position.compareTo(b.position));
}
