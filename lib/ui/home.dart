import 'package:flutter/cupertino.dart';
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
    final mine = round == null
        ? null
        : s
              .entries(round.id)
              .where((p) => p.playerId == me?.id)
              .firstOrNull
              ?.attendance;
    return RefreshIndicator(
      onRefresh: store.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        children: [
          if (store.error != null) Panel(child: Text(store.error!)),
          const Heading('Partida'),
          if (round == null)
            const Panel(child: Text('Nenhuma partida ainda'))
          else
            Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              round.title,
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                            Text(
                              prettyDate(round.date),
                              style: Theme.of(context).textTheme.bodyMedium
                                  ?.copyWith(
                                    color: Theme.of(
                                      context,
                                    ).colorScheme.onSurfaceVariant,
                                  ),
                            ),
                          ],
                        ),
                      ),
                      IosBadge(
                        statusLabel(round.status),
                        color: round.status == 'em_andamento'
                            ? brand
                            : Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${round.time} · ${round.location}',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    round.status == 'encerrada'
                        ? '${s.matches.where((m) => m.roundId == round.id).length} partidas disputadas'
                        : '${s.entries(round.id).where((p) => p.attendance == 'confirmado').length}/${round.maxPlayers} confirmados',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  if (round.status != 'encerrada' && me?.status == 'ativo') ...[
                    const SizedBox(height: 16),
                    if (mine == null || mine == 'fora')
                      FilledButton(
                        onPressed: store.busy
                            ? null
                            : () => perform(
                                context,
                                () => store.respond(round.id, 'confirmado'),
                              ),
                        child: Text(
                          round.maxPlayers > 0 &&
                                  s
                                          .entries(round.id)
                                          .where(
                                            (p) => p.attendance == 'confirmado',
                                          )
                                          .length >=
                                      round.maxPlayers
                              ? 'Entrar na lista de espera'
                              : 'Confirmar presença',
                        ),
                      ),
                    if (mine == 'confirmado' || mine == 'espera') ...[
                      Text(
                        mine == 'confirmado'
                            ? 'Sua presença está confirmada'
                            : 'Você está na lista de espera',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.primary,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton(
                        onPressed: store.busy
                            ? null
                            : () => perform(
                                context,
                                () => store.respond(round.id, 'fora'),
                              ),
                        child: Text(
                          mine == 'confirmado'
                              ? 'Não vou poder ir'
                              : 'Sair da lista',
                        ),
                      ),
                    ],
                  ],
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: () =>
                        openPage(context, RoundDetail(store, round.id)),
                    child: Text(
                      round.status == 'encerrada'
                          ? 'Ver resultados'
                          : 'Abrir partida',
                    ),
                  ),
                ],
              ),
            ),
          if (stats != null) ...[
            const Heading('Seus números'),
            Panel(
              child: Column(
                children: [
                  Row(
                    children: [
                      for (final entry in {
                        'Jogos': stats.played,
                        'Vitórias': stats.wins,
                        'Gols': stats.goals,
                        stats.keeperMatches > 0
                            ? 'Sofridos'
                            : 'Assistências': stats.keeperMatches > 0
                            ? stats.goalsAgainst
                            : stats.assists,
                      }.entries)
                        Expanded(
                          child: Column(
                            children: [
                              Text(
                                '${entry.value}',
                                style: TextStyle(
                                  fontSize: 28,
                                  fontWeight: FontWeight.w700,
                                  color: entry.key == 'Vitórias'
                                      ? const Color(0xff248a3d)
                                      : null,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                entry.key,
                                style: Theme.of(
                                  context,
                                ).textTheme.bodySmall?.copyWith(fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  const Divider(),
                  const SizedBox(height: 12),
                  Text(
                    'Aproveitamento de ${stats.pointsPct.toStringAsFixed(0)}%',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ],
          if (recent.isNotEmpty) ...[
            const Heading('Destaques'),
            for (final type in awardLabels.keys)
              Panel(
                child: Row(
                  children: [
                    Icon(
                      CupertinoIcons.rosette,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            awardLabels[type]!,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          Text(
                            recent.first.settledAt == null
                                ? 'Aguardando apuração'
                                : s.awards
                                      .where(
                                        (a) =>
                                            a.roundId == recent.first.id &&
                                            a.type == type,
                                      )
                                      .map(
                                        (a) =>
                                            s.player(a.playerId)?.name ??
                                            'Jogador',
                                      )
                                      .join(', ')
                                      .isEmpty
                                ? 'Sem destaque'
                                : s.awards
                                      .where(
                                        (a) =>
                                            a.roundId == recent.first.id &&
                                            a.type == type,
                                      )
                                      .map(
                                        (a) =>
                                            s.player(a.playerId)?.name ??
                                            'Jogador',
                                      )
                                      .join(', '),
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
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
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
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
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
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
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 16, horizontal: 4),
          child: Text(
            'Somente partidas encerradas entram nos rankings.',
            style: TextStyle(fontSize: 13),
          ),
        ),
        if (ranked.isEmpty)
          const Panel(child: Text('Ainda não há dados para este ranking.')),
        if (ranked.isNotEmpty)
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                for (var i = 0; i < ranked.length; i++) ...[
                  ListTile(
                    leading: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '${i + 1}',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(width: 12),
                        if (s.player(ranked[i].playerId) != null)
                          PlayerAvatar(s.player(ranked[i].playerId)!),
                      ],
                    ),
                    title: Text(
                      s.player(ranked[i].playerId)?.name ?? 'Removido',
                    ),
                    subtitle: Text('${ranked[i].played} partidas'),
                    trailing: Text(
                      '${value(ranked[i]).toStringAsFixed(['melhor', 'aproveitamento', 'goleiros'].contains(category) ? 1 : 0)}${category == 'aproveitamento' ? '%' : ''}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 20,
                      ),
                    ),
                    onTap: () => openPage(
                      context,
                      PlayerDetail(widget.store, ranked[i].playerId),
                    ),
                  ),
                  if (i < ranked.length - 1) const Divider(indent: 88),
                ],
              ],
            ),
          ),
      ],
    );
  }
}
