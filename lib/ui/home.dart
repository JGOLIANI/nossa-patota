import 'package:flutter/material.dart';
import '../domain.dart';
import '../models.dart';
import '../store.dart';
import 'common.dart';
import 'rounds.dart';
import 'players.dart';

class HomePage extends StatelessWidget {
  const HomePage(this.store, {super.key});
  final AppStore store;

  @override
  Widget build(BuildContext context) {
    final today = store.today, s = store.snapshot;
    final live =
        s.rounds
            .where(
              (r) => r.status == 'em_andamento' && r.date.compareTo(today) <= 0,
            )
            .toList()
          ..sort((a, b) => b.date.compareTo(a.date));
    final upcoming =
        s.rounds
            .where(
              (r) =>
                  !['encerrada', 'cancelada'].contains(r.status) &&
                  r.date.compareTo(today) >= 0,
            )
            .toList()
          ..sort((a, b) => a.date.compareTo(b.date));
    final recent = s.rounds.where((r) => r.status == 'encerrada').toList()
      ..sort((a, b) => b.date.compareTo(a.date));
    final round =
        live.firstOrNull ?? upcoming.firstOrNull ?? recent.firstOrNull;
    final me = store.current;
    final stats = me == null ? null : store.stats[me.id];
    return RefreshIndicator(
      onRefresh: store.refresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(
          PatotaSpace.lg,
          PatotaSpace.sm,
          PatotaSpace.lg,
          PatotaSpace.xxl,
        ),
        children: [
          if (store.error != null)
            Panel(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.error_outline_rounded,
                    color: Theme.of(context).colorScheme.error,
                  ),
                  const SizedBox(width: PatotaSpace.md),
                  Expanded(child: Text(store.error!)),
                ],
              ),
            ),
          Text(
            s.patota?.name ?? 'Sua patota',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: PatotaSpace.xs),
          Text(
            round?.status == 'em_andamento'
                ? 'A bola está rolando!'
                : round?.status == 'encerrada'
                ? 'Cada jogo conta uma história.'
                : 'Bora jogar juntos?',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: PatotaSpace.lg),
          if (round == null)
            AppEmptyState(
              icon: Icons.sports_soccer_rounded,
              title: 'Ainda não tem jogo por aqui',
              message: store.isAdmin
                  ? 'Marque a primeira partida e comece a história da turma.'
                  : 'Sua próxima partida aparece aqui assim que o administrador marcar o jogo.',
              action: PrimaryButton(
                label: store.isAdmin ? 'Criar primeira partida' : 'Ver a turma',
                icon: store.isAdmin ? Icons.add_rounded : Icons.groups_rounded,
                onPressed: () => openPage(
                  context,
                  store.isAdmin
                      ? NewRoundPage(store)
                      : Frame(
                          store: store,
                          title: 'Elenco',
                          builder: (_) => PlayersPage(store),
                        ),
                ),
              ),
            )
          else
            _HomeMatchCard(store: store, round: round),
          if (stats != null) ...[
            const Heading('Sua história em campo'),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: StatCard(
                    label: 'Partidas',
                    value: '${stats.played}',
                    icon: Icons.sports_soccer_rounded,
                  ),
                ),
                const SizedBox(width: PatotaSpace.md),
                Expanded(
                  child: StatCard(
                    label: 'Vitórias',
                    value: '${stats.wins}',
                    icon: Icons.emoji_events_rounded,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: PatotaSpace.md),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: StatCard(
                    label: 'Gols',
                    value: '${stats.goals}',
                    icon: Icons.sports_soccer_rounded,
                    color: statusColor(context, 'em_andamento'),
                  ),
                ),
                const SizedBox(width: PatotaSpace.md),
                Expanded(
                  child: StatCard(
                    label: stats.keeperMatches > 0
                        ? 'Gols sofridos'
                        : 'Assistências',
                    value:
                        '${stats.keeperMatches > 0 ? stats.goalsAgainst : stats.assists}',
                    icon: stats.keeperMatches > 0
                        ? Icons.shield_rounded
                        : Icons.assistant_direction_rounded,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
              ],
            ),
            Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ProgressTrack(
                    value: stats.pointsPct / 100,
                    label:
                        'Aproveitamento: ${stats.pointsPct.toStringAsFixed(0)}%',
                    detail: stats.played == 0
                        ? 'Seu progresso começa na primeira partida encerrada.'
                        : 'Pontos conquistados nas suas ${stats.played} partidas encerradas.',
                  ),
                  const SizedBox(height: PatotaSpace.sm),
                  TextButton.icon(
                    onPressed: () =>
                        openPage(context, PlayerDetail(store, me!.id)),
                    icon: const Icon(Icons.person_rounded),
                    label: const Text('Ver minha história'),
                  ),
                ],
              ),
            ),
          ],
          if (recent.isNotEmpty) ...[
            const Heading('Destaques do último jogo'),
            Text(
              '${recent.first.title} · ${prettyDate(recent.first.date)}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: PatotaSpace.sm),
            for (final type in awardLabels.keys)
              _AwardHighlight(
                snapshot: s,
                round: recent.first,
                type: type,
                currentPlayerId: me?.id,
              ),
          ],
        ],
      ),
    );
  }
}

class _HomeMatchCard extends StatelessWidget {
  const _HomeMatchCard({required this.store, required this.round});
  final AppStore store;
  final Round round;

  Future<void> _respond(BuildContext context, String attendance) async {
    final success = await perform(
      context,
      () => store.respond(round.id, attendance),
    );
    if (!success || !context.mounted) return;
    final mine = store.snapshot
        .entries(round.id)
        .where((p) => p.playerId == store.current?.id)
        .firstOrNull;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          attendance == 'fora'
              ? 'Sua resposta foi atualizada.'
              : mine?.attendance == 'espera'
              ? 'Você entrou na fila. A promoção é automática quando surgir uma vaga.'
              : 'Presença confirmada. Te vemos em campo!',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = store.snapshot;
    final closed = round.status == 'encerrada';
    final entries = s.entries(round.id);
    final confirmed = entries.where((p) => p.attendance == 'confirmado').length;
    final waiting = entries.where((p) => p.attendance == 'espera').toList()
      ..sort((a, b) {
        final dateOrder = a.respondedAt.compareTo(b.respondedAt);
        return dateOrder != 0 ? dateOrder : a.id.compareTo(b.id);
      });
    final mine = entries
        .where((p) => p.playerId == store.current?.id)
        .firstOrNull;
    final queuePosition =
        waiting.indexWhere((p) => p.playerId == store.current?.id) + 1;
    final full = round.maxPlayers > 0 && confirmed >= round.maxPlayers;
    final canConfirm =
        !closed &&
        store.current?.status == 'ativo' &&
        (mine == null || mine.attendance == 'fora');
    final cs = Theme.of(context).colorScheme;
    final matches = s.matches.where((m) => m.roundId == round.id).length;
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: cs.primary.withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(PatotaRadius.lg),
                ),
                child: Icon(Icons.sports_soccer_rounded, color: cs.primary),
              ),
              const SizedBox(width: PatotaSpace.md),
              Expanded(
                child: Text(
                  closed
                      ? 'Último jogo'
                      : round.status == 'em_andamento'
                      ? 'Jogo em andamento'
                      : 'Próxima partida',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: PatotaSpace.lg),
          Text(round.title, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: PatotaSpace.sm),
          Align(
            alignment: Alignment.centerLeft,
            child: IosBadge(
              statusLabel(round.status),
              color: closed
                  ? cs.onSurfaceVariant
                  : statusColor(context, round.status),
            ),
          ),
          const SizedBox(height: PatotaSpace.md),
          _MatchInfo(
            icon: Icons.calendar_month_rounded,
            text: '${prettyDate(round.date)} · ${round.time}',
          ),
          if (round.location.isNotEmpty) ...[
            const SizedBox(height: PatotaSpace.sm),
            _MatchInfo(icon: Icons.location_on_rounded, text: round.location),
          ],
          const SizedBox(height: PatotaSpace.lg),
          if (closed)
            _MatchInfo(
              icon: Icons.sports_score_rounded,
              text:
                  '$matches ${matches == 1 ? 'confronto disputado' : 'confrontos disputados'}',
            )
          else ...[
            if (round.maxPlayers > 0)
              ProgressTrack(
                value: confirmed / round.maxPlayers,
                label: '$confirmed confirmados de ${round.maxPlayers}',
                detail: full
                    ? 'Vagas preenchidas${waiting.isEmpty ? '' : ' · ${waiting.length} na espera'}'
                    : '${round.maxPlayers - confirmed} ${round.maxPlayers - confirmed == 1 ? 'vaga disponível' : 'vagas disponíveis'}${waiting.isEmpty ? '' : ' · ${waiting.length} na espera'}',
              )
            else
              _MatchInfo(
                icon: Icons.groups_rounded,
                text: '$confirmed confirmados · sem limite de vagas',
              ),
            if (mine?.attendance == 'confirmado' ||
                mine?.attendance == 'espera') ...[
              const SizedBox(height: PatotaSpace.lg),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    mine?.attendance == 'confirmado'
                        ? Icons.check_circle_rounded
                        : Icons.hourglass_bottom_rounded,
                    color: mine?.attendance == 'confirmado'
                        ? cs.primary
                        : statusColor(context, 'espera'),
                  ),
                  const SizedBox(width: PatotaSpace.sm),
                  Expanded(
                    child: Text(
                      mine?.attendance == 'confirmado'
                          ? 'Sua presença está confirmada'
                          : 'Você é o $queuePositionº na fila de espera',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
          const SizedBox(height: PatotaSpace.xl),
          PrimaryButton(
            label: canConfirm
                ? full
                      ? 'Entrar na fila de espera'
                      : 'Confirmar presença'
                : closed
                ? 'Ver resultados'
                : 'Abrir partida',
            icon: canConfirm
                ? full
                      ? Icons.hourglass_bottom_rounded
                      : Icons.check_rounded
                : closed
                ? Icons.sports_score_rounded
                : Icons.sports_soccer_rounded,
            loading: canConfirm && store.busy,
            onPressed: store.busy
                ? null
                : canConfirm
                ? () => _respond(context, 'confirmado')
                : () => openPage(context, RoundDetail(store, round.id)),
          ),
          if (canConfirm)
            TextButton(
              onPressed: () => openPage(context, RoundDetail(store, round.id)),
              child: const Text('Ver detalhes da partida'),
            ),
          if (!closed && ['confirmado', 'espera'].contains(mine?.attendance))
            TextButton(
              onPressed: store.busy ? null : () => _respond(context, 'fora'),
              child: Text(
                mine?.attendance == 'confirmado'
                    ? 'Não vou poder ir'
                    : 'Sair da fila de espera',
              ),
            ),
        ],
      ),
    );
  }
}

class _MatchInfo extends StatelessWidget {
  const _MatchInfo({required this.icon, required this.text});
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(
        icon,
        size: 20,
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
      const SizedBox(width: PatotaSpace.sm),
      Expanded(child: Text(text)),
    ],
  );
}

class _AwardHighlight extends StatelessWidget {
  const _AwardHighlight({
    required this.snapshot,
    required this.round,
    required this.type,
    this.currentPlayerId,
  });
  final Snapshot snapshot;
  final Round round;
  final String type;
  final String? currentPlayerId;
  @override
  Widget build(BuildContext context) {
    final awards = snapshot.awards
        .where((a) => a.roundId == round.id && a.type == type)
        .toList();
    final winners = awards
        .map((a) => snapshot.player(a.playerId)?.name ?? 'Jogador')
        .join(', ');
    final mine = awards.any((a) => a.playerId == currentPlayerId);
    return Panel(
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Theme.of(
                context,
              ).colorScheme.primary.withValues(alpha: .1),
              borderRadius: BorderRadius.circular(PatotaRadius.lg),
            ),
            child: Icon(
              type == 'goleiro_menos_vazado'
                  ? Icons.shield_rounded
                  : Icons.emoji_events_rounded,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
          const SizedBox(width: PatotaSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  awardLabels[type]!,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: PatotaSpace.xs),
                Text(
                  round.settledAt == null
                      ? 'Votação em apuração'
                      : winners.isEmpty
                      ? 'Sem destaque nesta partida'
                      : winners,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                if (mine && round.settledAt != null) ...[
                  const SizedBox(height: PatotaSpace.xs),
                  Text(
                    'Faz parte da sua história!',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (mine && round.settledAt != null) ...[
            const SizedBox(width: PatotaSpace.sm),
            Icon(Icons.stars_rounded, color: statusColor(context, 'rascunho')),
          ],
        ],
      ),
    );
  }
}

class RankingsPage extends StatefulWidget {
  const RankingsPage(this.store, {super.key});
  final AppStore store;
  @override
  State<RankingsPage> createState() => _RankingsState();
}

class _RankingsState extends State<RankingsPage> {
  String period = 'todos', category = 'gols';
  int minMatches = 1;
  @override
  Widget build(BuildContext context) {
    final source = widget.store.snapshot, now = DateTime.now();
    final since = period == 'mes'
        ? dateISO(DateTime(now.year, now.month))
        : period == 'ano'
        ? dateISO(DateTime(now.year))
        : '';
    final s = Snapshot({
      ...source.toJson(),
      'matches': source.matches
          .where(
            (m) => (source.round(m.roundId)?.date ?? '').compareTo(since) >= 0,
          )
          .map((m) => m.json)
          .toList(),
    });
    final stats = computeStats(s),
        ratings = computeRatings(
          s.players.where((p) => (stats[p.id]?.played ?? 0) > 0).toList(),
          stats,
          computeLogs(s),
        );
    const categories = {
      'gols': 'Artilharia',
      'assistencias': 'Assistências',
      'participacoes': 'Participações em gols',
      'melhor': 'Melhor jogador',
      'vitorias': 'Vitórias',
      'aproveitamento': 'Aproveitamento',
      'goleiros': 'Goleiro menos vazado',
    };
    double value(PlayerStats p) => switch (category) {
      'gols' => p.goals.toDouble(),
      'assistencias' => p.assists.toDouble(),
      'participacoes' => p.participations.toDouble(),
      'melhor' => ratings[p.playerId] ?? 0,
      'vitorias' => p.wins.toDouble(),
      'aproveitamento' => p.pointsPct,
      _ => p.goalsAgainstPerMatch,
    };
    final ranked =
        stats.values
            .where(
              (p) =>
                  p.played > 0 &&
                  (category != 'aproveitamento' || p.played >= minMatches) &&
                  (category != 'goleiros' || p.keeperMatches >= minMatches) &&
                  (![
                        'gols',
                        'assistencias',
                        'participacoes',
                        'vitorias',
                      ].contains(category) ||
                      value(p) > 0),
            )
            .toList()
          ..sort(
            (a, b) => category == 'goleiros'
                ? value(a).compareTo(value(b))
                : value(b).compareTo(value(a)),
          );
    String formattedValue(PlayerStats p) =>
        '${value(p).toStringAsFixed(['melhor', 'aproveitamento', 'goleiros'].contains(category) ? 1 : 0)}${category == 'aproveitamento' ? '%' : ''}';
    final me = widget.store.current;
    final myIndex = ranked.indexWhere((p) => p.playerId == me?.id);
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        PatotaSpace.lg,
        PatotaSpace.sm,
        PatotaSpace.lg,
        PatotaSpace.xxl,
      ),
      children: [
        Text(
          'Resenha boa, disputa saudável.',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: PatotaSpace.sm),
        choice(
          'Período',
          period,
          ['todos', 'mes', 'ano'],
          (v) => setState(() => period = v),
          labels: const {
            'todos': 'Todo o histórico',
            'mes': 'Este mês',
            'ano': 'Este ano',
          },
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final item in categories.entries)
                Padding(
                  padding: const EdgeInsets.only(right: PatotaSpace.sm),
                  child: ChoiceChip(
                    avatar: Icon(_categoryIcon(item.key), size: 20),
                    label: Text(item.value),
                    selected: category == item.key,
                    showCheckmark: false,
                    onSelected: (_) => setState(() => category = item.key),
                  ),
                ),
            ],
          ),
        ),
        if (['aproveitamento', 'goleiros'].contains(category))
          choice('Mínimo de partidas', '$minMatches', [
            '1',
            '3',
            '5',
            '10',
          ], (v) => setState(() => minMatches = int.parse(v))),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: PatotaSpace.lg),
          child: Text(
            category == 'goleiros'
                ? 'Somente partidas encerradas. Menos gols sofridos por partida é melhor.'
                : 'Somente partidas encerradas entram nos rankings.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ),
        if (ranked.isEmpty)
          AppEmptyState(
            icon: Icons.leaderboard_rounded,
            title: 'O próximo jogo pode mudar tudo',
            message:
                'Ainda não há resultados para esta categoria e período. As estatísticas aparecem depois que uma partida é encerrada.',
            action: PrimaryButton(
              label: period != 'todos' || minMatches != 1
                  ? 'Ver todo o histórico'
                  : 'Ver partidas',
              icon: period != 'todos' || minMatches != 1
                  ? Icons.history_rounded
                  : Icons.sports_soccer_rounded,
              onPressed: () {
                if (period != 'todos' || minMatches != 1) {
                  setState(() {
                    period = 'todos';
                    minMatches = 1;
                  });
                } else {
                  openPage(
                    context,
                    Frame(
                      store: widget.store,
                      title: 'Partidas',
                      builder: (_) => RoundsPage(widget.store),
                    ),
                  );
                }
              },
            ),
          ),
        if (ranked.isNotEmpty) ...[
          if (me != null)
            Panel(
              child: Row(
                children: [
                  Icon(
                    Icons.person_pin_rounded,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(width: PatotaSpace.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Sua posição',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: PatotaSpace.xs),
                        Text(
                          myIndex >= 0
                              ? '${myIndex + 1}º de ${ranked.length} jogadores · ${categories[category]}'
                              : 'Você ainda não aparece neste ranking. Veja seus números no perfil.',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
                  if (myIndex >= 0) ...[
                    const SizedBox(width: PatotaSpace.md),
                    Text(
                      formattedValue(ranked[myIndex]),
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                  ],
                ],
              ),
            ),
          const Heading('No topo da patota'),
          for (var i = 0; i < ranked.length && i < 3; i++)
            _LeaderboardItem(
              store: widget.store,
              snapshot: s,
              stats: ranked[i],
              place: i + 1,
              value: formattedValue(ranked[i]),
              isCurrent: ranked[i].playerId == me?.id,
              topThree: true,
            ),
          if (ranked.length > 3) ...[
            const Heading('A turma toda'),
            for (var i = 3; i < ranked.length; i++)
              _LeaderboardItem(
                store: widget.store,
                snapshot: s,
                stats: ranked[i],
                place: i + 1,
                value: formattedValue(ranked[i]),
                isCurrent: ranked[i].playerId == me?.id,
              ),
          ],
        ],
      ],
    );
  }
}

IconData _categoryIcon(String category) => switch (category) {
  'gols' => Icons.sports_soccer_rounded,
  'assistencias' => Icons.assistant_direction_rounded,
  'participacoes' => Icons.groups_rounded,
  'melhor' => Icons.stars_rounded,
  'vitorias' => Icons.emoji_events_rounded,
  'aproveitamento' => Icons.trending_up_rounded,
  _ => Icons.shield_rounded,
};

class _LeaderboardItem extends StatelessWidget {
  const _LeaderboardItem({
    required this.store,
    required this.snapshot,
    required this.stats,
    required this.place,
    required this.value,
    required this.isCurrent,
    this.topThree = false,
  });
  final AppStore store;
  final Snapshot snapshot;
  final PlayerStats stats;
  final int place;
  final String value;
  final bool isCurrent, topThree;

  @override
  Widget build(BuildContext context) {
    final player = snapshot.player(stats.playerId);
    final cs = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final tint = isCurrent
        ? cs.primary
        : place == 1
        ? dark
              ? PatotaColors.darkWarning
              : PatotaColors.gold
        : place == 2
        ? dark
              ? PatotaColors.darkInfo
              : PatotaColors.silver
        : place == 3
        ? dark
              ? PatotaColors.darkWarning
              : PatotaColors.bronze
        : cs.onSurfaceVariant;
    return Card(
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(PatotaRadius.card),
        side: BorderSide(
          color: isCurrent ? cs.primary : cs.outlineVariant,
          width: isCurrent ? 2 : 1,
        ),
      ),
      child: InkWell(
        onTap: player == null
            ? null
            : () => openPage(context, PlayerDetail(store, stats.playerId)),
        child: Padding(
          padding: const EdgeInsets.all(PatotaSpace.lg),
          child: Row(
            children: [
              Semantics(
                label: '$placeº lugar',
                excludeSemantics: true,
                child: SizedBox(
                  width: 36,
                  child: Column(
                    children: [
                      if (topThree)
                        Icon(Icons.emoji_events_rounded, color: tint, size: 24),
                      Text(
                        '$placeº',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: PatotaSpace.md),
              if (player != null) ...[
                PlayerAvatar(player),
                const SizedBox(width: PatotaSpace.md),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${player?.name ?? 'Jogador'}${isCurrent ? ' · você' : ''}',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: PatotaSpace.xs),
                    Text(
                      '${stats.played} partidas',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: PatotaSpace.md),
              Text(value, style: Theme.of(context).textTheme.headlineSmall),
            ],
          ),
        ),
      ),
    );
  }
}
