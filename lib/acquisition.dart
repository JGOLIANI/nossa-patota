import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

const introPreferenceKey = 'patota.intro.v1';

enum IntroRole { organizer, player }

enum IntroGoal { attendance, teams, history }

class IntroDraft {
  const IntroDraft({
    this.step = 0,
    this.role,
    this.goal,
    this.completed = false,
  });
  final int step;
  final IntroRole? role;
  final IntroGoal? goal;
  final bool completed;

  static IntroDraft load(SharedPreferences preferences) {
    try {
      final value = preferences.getString(introPreferenceKey);
      if (value == null) return const IntroDraft();
      final json = jsonDecode(value) as Map<String, dynamic>;
      if (json['version'] != 1) return const IntroDraft();
      final role = IntroRole.values
          .where((r) => r.name == json['role'])
          .firstOrNull;
      final goal = IntroGoal.values
          .where((g) => g.name == json['goal'])
          .firstOrNull;
      var step = json['step'] is int ? (json['step'] as int).clamp(0, 5) : 0;
      if (role == null && step > 2) step = 2;
      if (goal == null && step > 3) step = 3;
      if (role == IntroRole.player && step == 5) step = 4;
      return IntroDraft(
        step: step,
        role: role,
        goal: goal,
        completed: json['completed'] == true,
      );
    } catch (_) {
      return const IntroDraft();
    }
  }

  Future<void> save(SharedPreferences preferences) async {
    final saved = await preferences.setString(
      introPreferenceKey,
      jsonEncode({
        'version': 1,
        'step': step,
        'role': role?.name,
        'goal': goal?.name,
        'completed': completed,
      }),
    );
    if (!saved) throw StateError('Não foi possível salvar seu progresso.');
  }

  IntroDraft copyWith({
    int? step,
    IntroRole? role,
    IntroGoal? goal,
    bool? completed,
  }) => IntroDraft(
    step: step ?? this.step,
    role: role ?? this.role,
    goal: goal ?? this.goal,
    completed: completed ?? this.completed,
  );
}

String goalLabel(IntroGoal goal) => switch (goal) {
  IntroGoal.attendance => 'Organizar presenças',
  IntroGoal.teams => 'Montar times equilibrados',
  IntroGoal.history => 'Guardar a história dos jogos',
};

String goalOutcome(IntroGoal? goal) => switch (goal) {
  IntroGoal.attendance => 'Saiba quem vem antes de sair de casa.',
  IntroGoal.teams => 'Menos discussão na hora de montar os times.',
  IntroGoal.history => 'Cada partida vira parte da história da turma.',
  null => 'Mais jogo. Menos trabalho para organizar.',
};

/// Presentation-only offer. Prices never grant access or start a purchase.
class PatotaOffer {
  const PatotaOffer({
    this.title = 'Mais jogo. Menos trabalho.',
    this.monthlyPriceCents,
    this.annualPriceCents,
    this.trialDays = 0,
    this.futureBenefits = const [
      'Temporadas e recordes da turma',
      'Conquistas e retrospectivas',
      'Ferramentas para o caixa da patota',
    ],
  });
  final String title;
  final int? monthlyPriceCents, annualPriceCents;
  final int trialDays;
  final List<String> futureBenefits;

  factory PatotaOffer.fromJson(Map<String, dynamic> json) {
    if (json['version'] != 1) {
      throw const FormatException('Versão de oferta desconhecida.');
    }
    int? price(String key) {
      final value = json[key];
      if (value == null) return null;
      if (value is! int || value <= 0) {
        throw FormatException('Preço inválido: $key');
      }
      return value;
    }

    final trial = json['trialDays'] ?? 0;
    if (trial is! int || trial < 0) {
      throw const FormatException('Período de teste inválido.');
    }
    final title = json['title'];
    if (title is! String || title.trim().isEmpty) {
      throw const FormatException('Informe o título da oferta.');
    }
    final benefits = json['futureBenefits'];
    if (benefits is! List ||
        benefits.isEmpty ||
        benefits.any((b) => b is! String || b.trim().isEmpty)) {
      throw const FormatException('Informe os benefícios previstos.');
    }
    return PatotaOffer(
      title: title.trim(),
      monthlyPriceCents: price('monthlyPriceCents'),
      annualPriceCents: price('annualPriceCents'),
      trialDays: trial,
      futureBenefits: List<String>.unmodifiable(benefits.cast<String>()),
    );
  }

  int? get annualSavingsPercent {
    final monthly = monthlyPriceCents, annual = annualPriceCents;
    if (monthly == null || annual == null || annual >= monthly * 12) {
      return null;
    }
    final percentage = ((1 - annual / (monthly * 12)) * 100).floor();
    return percentage > 0 ? percentage : null;
  }
}

String brl(int cents) {
  final reais = (cents ~/ 100).toString().replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => '.',
  );
  return 'R\$ $reais,${(cents % 100).toString().padLeft(2, '0')}';
}
