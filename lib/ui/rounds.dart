import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../domain.dart';
import '../data/backend.dart';
import '../models.dart';
import '../store.dart';
import 'common.dart';
import 'sharing.dart';
import 'operations.dart';

class RoundsPage extends StatelessWidget {
  const RoundsPage(this.store, {super.key});
  final AppStore store;
  @override
  Widget build(BuildContext context) {
    final rounds = [...store.snapshot.rounds]
      ..sort((a, b) => b.date.compareTo(a.date));
    final upcoming =
        rounds
            .where((r) => !['encerrada', 'cancelada'].contains(r.status))
            .toList()
          ..sort((a, b) {
            if (a.status == 'em_andamento' && b.status != 'em_andamento') {
              return -1;
            }
            if (b.status == 'em_andamento' && a.status != 'em_andamento') {
              return 1;
            }
            return '${a.date} ${a.time}'.compareTo('${b.date} ${b.time}');
          });
    final history = rounds.where(
      (r) => ['encerrada', 'cancelada'].contains(r.status),
    );
    return ListView(
      padding: const EdgeInsets.all(PatotaSpace.lg),
      children: [
        if (rounds.isEmpty)
          AppEmptyState(
            icon: Icons.sports_soccer_rounded,
            title: 'Ainda não tem jogo por aqui',
            message: store.isAdmin
                ? 'Marque a primeira partida e comece a história da turma.'
                : 'Quando o administrador marcar uma partida, você poderá confirmar sua presença aqui.',
            action: store.isAdmin
                ? PrimaryButton(
                    label: 'Criar primeira partida',
                    icon: Icons.add_rounded,
                    onPressed: () => openPage(context, NewRoundPage(store)),
                  )
                : null,
          ),
        if (upcoming.isNotEmpty) const Heading('Próximos jogos'),
        for (final r in upcoming) roundTile(context, store, r),
        if (history.isNotEmpty) const Heading('História da patota'),
        for (final r in history) roundTile(context, store, r),
      ],
    );
  }
}

Widget roundTile(BuildContext context, AppStore store, Round r) {
  final confirmed = store.snapshot
      .entries(r.id)
      .where((rp) => rp.attendance == 'confirmado')
      .length;
  final waiting = store.snapshot
      .entries(r.id)
      .where((rp) => rp.attendance == 'espera')
      .length;
  final s = store.snapshot,
      match = s.matches.where((m) => m.roundId == r.id).firstOrNull;
  final muted = Theme.of(context).colorScheme.onSurfaceVariant;
  return Card(
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: () => openPage(context, RoundDetail(store, r.id)),
      child: Padding(
        padding: const EdgeInsets.all(PatotaSpace.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    r.title,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                const SizedBox(width: PatotaSpace.sm),
                Icon(Icons.chevron_right_rounded, color: muted),
              ],
            ),
            const SizedBox(height: PatotaSpace.sm),
            IosBadge(
              statusLabel(r.status),
              color: statusColor(context, r.status),
            ),
            const SizedBox(height: PatotaSpace.sm),
            Text(
              '${prettyDate(r.date)} · ${r.time}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if (match != null) ...[
              const SizedBox(height: PatotaSpace.lg),
              const Divider(),
              const SizedBox(height: PatotaSpace.lg),
              Scoreboard(
                teamA: s.team(match.teamA),
                teamB: s.team(match.teamB),
                scoreA: match.scoreA,
                scoreB: match.scoreB,
              ),
            ] else ...[
              const SizedBox(height: PatotaSpace.md),
              Row(
                children: [
                  Icon(Icons.groups_rounded, size: 20, color: muted),
                  const SizedBox(width: PatotaSpace.sm),
                  Expanded(
                    child: Text(
                      '$confirmed${r.maxPlayers > 0 ? '/${r.maxPlayers}' : ''} confirmados${waiting > 0 ? ' · $waiting na espera' : ''}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                ],
              ),
              if (r.maxPlayers > 0 && r.status != 'cancelada') ...[
                const SizedBox(height: PatotaSpace.md),
                ProgressTrack(
                  value: confirmed / r.maxPlayers,
                  label: confirmed >= r.maxPlayers
                      ? 'Vagas preenchidas · entre na fila'
                      : '${r.maxPlayers - confirmed} vagas restantes',
                ),
              ],
            ],
          ],
        ),
      ),
    ),
  );
}

class NewRoundPage extends StatefulWidget {
  const NewRoundPage(this.store, {super.key});
  final AppStore store;
  @override
  State<NewRoundPage> createState() => _NewRoundState();
}

class _NewRoundState extends State<NewRoundPage> {
  DateTime date = DateTime.now();
  late final TextEditingController title, time, location, url, max;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    final s = widget.store.snapshot.settings;
    date = DateTime.parse(widget.store.today);
    title = TextEditingController(text: roundTitle(dateISO(date)));
    time = TextEditingController(text: s.time);
    location = TextEditingController(text: s.location);
    url = TextEditingController(text: s.locationUrl);
    max = TextEditingController(text: '${s.maxPlayers}');
  }

  @override
  void dispose() {
    for (final c in [title, time, location, url, max]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Frame(
    store: widget.store,
    title: 'Nova partida',
    builder: (context) {
      if (!widget.store.isAdmin) {
        return const Center(child: Text('Acesso reservado ao administrador.'));
      }
      return ListView(
        padding: const EdgeInsets.all(PatotaSpace.lg),
        children: [
          OutlinedButton.icon(
            onPressed: () async {
              final selected = await showDatePicker(
                context: context,
                initialDate: date,
                firstDate: DateTime(2020),
                lastDate: DateTime(2100),
              );
              if (selected != null && mounted) {
                setState(() {
                  date = selected;
                  title.text = roundTitle(dateISO(date));
                });
              }
            },
            icon: const Icon(Icons.calendar_month_rounded),
            label: Text(prettyDate(dateISO(date))),
          ),
          field('Título', title),
          field('Horário (HH:MM)', time),
          field('Local', location),
          TextField(
            controller: url,
            decoration: const InputDecoration(labelText: 'Link do Google Maps'),
          ),
          field('Vagas (0 = sem limite)', max, number: true),
          PrimaryButton(
            label: 'Criar partida',
            icon: Icons.add_rounded,
            loading: busy,
            onPressed: busy
                ? null
                : () async {
                    final capacity = int.tryParse(max.text);
                    if (title.text.trim().isEmpty ||
                        capacity == null ||
                        capacity < 0 ||
                        !RegExp(
                          r'^([01]\d|2[0-3]):[0-5]\d$',
                        ).hasMatch(time.text)) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Confira o título, o horário e as vagas.',
                          ),
                        ),
                      );
                      return;
                    }
                    setState(() => busy = true);
                    final ok = await perform(
                      context,
                      () => widget.store.run(() async {
                        await widget.store.backend.insert('rounds', {
                          ...widget.store.roundInput(dateISO(date)),
                          'title': title.text.trim(),
                          'start_time': time.text,
                          'location': location.text.trim(),
                          'location_url': url.text.trim(),
                          'max_players': capacity,
                        });
                      }, admin: true),
                      successMessage: 'Partida criada',
                    );
                    if (mounted) {
                      setState(() => busy = false);
                      if (ok && context.mounted) Navigator.pop(context);
                    }
                  },
          ),
        ],
      );
    },
  );
}

class RoundDetail extends StatelessWidget {
  const RoundDetail(this.store, this.id, {super.key});
  final AppStore store;
  final String id;
  @override
  Widget build(BuildContext context) => Frame(
    store: store,
    title: 'Partida',
    builder: (context) {
      final s = store.snapshot, r = s.round(id);
      if (r == null) {
        return const Center(child: Text('Partida não encontrada.'));
      }
      final rows = s.entries(id)
            ..sort(
              (a, b) => '${a.json['responded_at']}${a.id}'.compareTo(
                '${b.json['responded_at']}${b.id}',
              ),
            ),
          teams = s.roundTeams(id),
          mine = rows
              .where((rp) => rp.playerId == store.current?.id)
              .firstOrNull;
      final matches = s.matches.where((m) => m.roundId == id).toList()
        ..sort((a, b) => a.sequence.compareTo(b.sequence));
      final confirmed = rows
          .where((rp) => rp.attendance == 'confirmado')
          .length;
      final waiting = rows.where((rp) => rp.attendance == 'espera').toList();
      final capacityReached = r.maxPlayers > 0 && confirmed >= r.maxPlayers;
      final confirmLabel = capacityReached
          ? 'Entrar na fila de espera'
          : 'Vou jogar';
      final confirmIcon = capacityReached
          ? Icons.schedule_rounded
          : Icons.check_circle_rounded;
      final VoidCallback? confirmPresence = store.busy
          ? null
          : () => perform(
              context,
              () => store.respond(id, 'confirmado'),
              successMessage: capacityReached
                  ? 'Você entrou na fila de espera'
                  : 'Presença confirmada',
            );
      final activeMatch = matches
          .where((m) => m.status == 'em_andamento')
          .firstOrNull;
      return ListView(
        padding: const EdgeInsets.all(PatotaSpace.lg),
        children: [
          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                IosBadge(
                  statusLabel(r.status),
                  color: r.status == 'cancelada'
                      ? PatotaColors.error
                      : PatotaColors.primary,
                ),
                const SizedBox(height: PatotaSpace.md),
                Text(r.title, style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: PatotaSpace.sm),
                Text('${prettyDate(r.date)} às ${r.time}'),
                if (r.location.isNotEmpty) Text(r.location),
                if (r.location.isNotEmpty || r.locationUrl.isNotEmpty)
                  TextButton.icon(
                    onPressed: () => perform(context, () async {
                      final uri = Uri.parse(
                        r.locationUrl.isNotEmpty
                            ? r.locationUrl
                            : 'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(r.location)}',
                      );
                      if (!['https', 'http'].contains(uri.scheme) ||
                          !await launchUrl(
                            uri,
                            mode: LaunchMode.externalApplication,
                          )) {
                        throw Exception('Não foi possível abrir o mapa.');
                      }
                    }),
                    icon: const Icon(Icons.location_on_rounded),
                    label: const Text('Abrir mapa'),
                  ),
                if (!['encerrada', 'cancelada'].contains(r.status)) ...[
                  const SizedBox(height: PatotaSpace.md),
                  Text(
                    '$confirmed confirmados${waiting.isNotEmpty ? ' · ${waiting.length} na fila' : ''}',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  if (r.maxPlayers > 0) ...[
                    const SizedBox(height: PatotaSpace.sm),
                    ProgressTrack(
                      value: confirmed / r.maxPlayers,
                      label: capacityReached
                          ? 'Todas as vagas preenchidas'
                          : '${r.maxPlayers - confirmed} vagas restantes',
                    ),
                  ] else
                    const Text('Sem limite de vagas'),
                ],
              ],
            ),
          ),
          if (!['encerrada', 'cancelada'].contains(r.status) &&
              store.current?.status == 'ativo')
            Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  PresencePill(
                    status: mine?.attendance ?? 'não respondeu',
                    queuePosition: mine?.attendance == 'espera'
                        ? waiting.indexOf(mine!) + 1
                        : null,
                  ),
                  const SizedBox(height: PatotaSpace.md),
                  if (mine?.attendance != 'confirmado' &&
                      mine?.attendance != 'espera')
                    store.isAdmin
                        ? OutlinedButton.icon(
                            onPressed: confirmPresence,
                            icon: Icon(confirmIcon),
                            label: Text(confirmLabel),
                          )
                        : PrimaryButton(
                            label: confirmLabel,
                            icon: confirmIcon,
                            loading: store.busy,
                            onPressed: confirmPresence,
                          ),
                  if (mine?.attendance != 'fora')
                    TextButton.icon(
                      onPressed: store.busy
                          ? null
                          : () => perform(
                              context,
                              () => store.respond(id, 'fora'),
                              successMessage:
                                  'Presença atualizada: fora desta partida',
                            ),
                      icon: const Icon(Icons.close_rounded),
                      label: const Text('Não vou'),
                    ),
                  if (mine?.attendance == 'espera')
                    const Text(
                      'Quando alguém desistir, a primeira pessoa da fila entra automaticamente.',
                    ),
                ],
              ),
            ),
          for (final m in matches)
            Panel(
              child: Column(
                children: [
                  Scoreboard(
                    teamA: s.team(m.teamA),
                    teamB: s.team(m.teamB),
                    scoreA: m.scoreA,
                    scoreB: m.scoreB,
                    status: statusLabel(m.status),
                  ),
                  TextButton.icon(
                    onPressed: () =>
                        openPage(context, LiveMatchPage(store, m.id)),
                    icon: const Icon(Icons.chevron_right_rounded),
                    label: Text(
                      m.status == 'em_andamento'
                          ? 'Acompanhar placar'
                          : 'Ver resumo da partida',
                    ),
                  ),
                ],
              ),
            ),
          if (teams.isNotEmpty) ...[
            const Heading('Escalação'),
            for (final t in teams)
              Panel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 18,
                          height: 18,
                          decoration: BoxDecoration(
                            color: teamColor(t.color),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: Theme.of(
                                context,
                              ).colorScheme.outlineVariant,
                            ),
                          ),
                        ),
                        const SizedBox(width: PatotaSpace.sm),
                        Expanded(
                          child: Text(
                            t.name,
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                        ),
                      ],
                    ),
                    for (final rp in rows.where((rp) => rp.teamId == t.id))
                      ListTile(
                        title: Text(
                          s.player(rp.playerId)?.name ?? 'Jogador removido',
                        ),
                        subtitle: Text(
                          rp.position ??
                              s.player(rp.playerId)?.position ??
                              'linha',
                        ),
                        leading: s.player(rp.playerId) == null
                            ? null
                            : PlayerAvatar(s.player(rp.playerId)!),
                        trailing:
                            store.isAdmin &&
                                !['encerrada', 'cancelada'].contains(r.status)
                            ? IconButton(
                                tooltip: 'Alternar posição',
                                icon: const Icon(Icons.swap_vert_rounded),
                                onPressed: store.busy
                                    ? null
                                    : () => perform(
                                        context,
                                        () => store.run(
                                          () => store.backend
                                              .update('round_players', rp.id, {
                                                'position':
                                                    (rp.position ??
                                                            s
                                                                .player(
                                                                  rp.playerId,
                                                                )
                                                                ?.position) ==
                                                        'goleiro'
                                                    ? 'linha'
                                                    : 'goleiro',
                                              }),
                                          admin: true,
                                        ),
                                      ),
                              )
                            : null,
                      ),
                  ],
                ),
              ),
            OutlinedButton.icon(
              onPressed: () => openPage(context, SharePage(store, id)),
              icon: const Icon(Icons.share_rounded),
              label: const Text('Compartilhar escalação'),
            ),
          ],
          if (store.isAdmin &&
              !['encerrada', 'cancelada'].contains(r.status)) ...[
            if (activeMatch != null)
              PrimaryButton(
                label: 'Registrar gol',
                icon: Icons.sports_soccer_rounded,
                onPressed: store.busy
                    ? null
                    : () => openPage(context, GoalForm(store, activeMatch)),
              ),
            if (teams.isEmpty)
              PrimaryButton(
                label: 'Sortear times e iniciar partida',
                icon: Icons.shuffle_rounded,
                loading: store.busy,
                onPressed: store.busy
                    ? null
                    : () => perform(
                        context,
                        () => store.buildTeams(id),
                        successMessage: 'Times definidos. Jogo iniciado!',
                      ),
              ),
            OutlinedButton(
              onPressed: store.busy
                  ? null
                  : () => openPage(context, ManualTeamsPage(store, id)),
              child: const Text('Montar ou ajustar times'),
            ),
            if (matches.isNotEmpty)
              OutlinedButton(
                onPressed: store.busy
                    ? null
                    : () async {
                        if (await confirm(
                              context,
                              'Encerrar partida?',
                              'O placar entra nas estatísticas e a votação abre por 16 horas.',
                            ) &&
                            context.mounted) {
                          await perform(
                            context,
                            () => store.closeRound(id),
                            successMessage:
                                'Partida encerrada. A votação está aberta!',
                          );
                        }
                      },
                child: const Text('Encerrar partida'),
              ),
          ],
          const Heading('Presenças'),
          const Text(
            'Fila por ordem de chegada. Uma desistência promove automaticamente o primeiro da espera.',
          ),
          if (rows.isEmpty)
            const AppEmptyState(
              icon: Icons.groups_rounded,
              title: 'Quem vai jogar?',
              message:
                  'As confirmações e a fila de espera da turma aparecem aqui.',
            ),
          for (final group in ['confirmado', 'espera', 'fora'])
            if (rows.any((rp) => rp.attendance == group))
              Panel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(child: PresencePill(status: group)),
                        Text(
                          '${rows.where((rp) => rp.attendance == group).length}',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ],
                    ),
                    const SizedBox(height: PatotaSpace.sm),
                    for (final rp in rows.where((rp) => rp.attendance == group))
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: s.player(rp.playerId) == null
                            ? null
                            : PlayerAvatar(s.player(rp.playerId)!),
                        title: Text(
                          s.player(rp.playerId)?.name ?? 'Jogador removido',
                        ),
                        subtitle: Text(
                          group == 'espera'
                              ? '${waiting.indexOf(rp) + 1}º na fila de espera'
                              : 'Comparecimento: ${rp.actualAttendance ?? "não registrado"}',
                        ),
                        trailing:
                            store.isAdmin &&
                                !['encerrada', 'cancelada'].contains(r.status)
                            ? PopupMenuButton<String>(
                                tooltip: 'Atualizar presença',
                                enabled: !store.busy,
                                onSelected: (value) => perform(
                                  context,
                                  () => ['presente', 'ausente'].contains(value)
                                      ? store.roundCommand(id, 'check_in', {
                                          'player_id': rp.playerId,
                                          'actual_attendance': value,
                                        })
                                      : value == 'remover'
                                      ? store.removeFromRound(rp)
                                      : store.setAttendance(
                                          id,
                                          rp.playerId,
                                          value,
                                        ),
                                  successMessage: 'Presença atualizada',
                                ),
                                itemBuilder: (_) =>
                                    [
                                          'confirmado',
                                          'fora',
                                          'presente',
                                          'ausente',
                                          'remover',
                                        ]
                                        .map(
                                          (v) => PopupMenuItem(
                                            value: v,
                                            child: Text(
                                              {
                                                'confirmado':
                                                    'Confirmar participação',
                                                'fora': 'Marcar como fora',
                                                'presente':
                                                    'Compareceu à partida',
                                                'ausente': 'Não compareceu',
                                                'remover': 'Retirar da lista',
                                              }[v]!,
                                            ),
                                          ),
                                        )
                                        .toList(),
                              )
                            : null,
                      ),
                  ],
                ),
              ),
          if (store.isAdmin && !['encerrada', 'cancelada'].contains(r.status))
            OutlinedButton.icon(
              onPressed: store.busy
                  ? null
                  : () async {
                      final player = await showDialog<String>(
                        context: context,
                        builder: (ctx) => SimpleDialog(
                          title: const Text('Adicionar participante'),
                          children: [
                            for (final p in s.players.where(
                              (p) =>
                                  p.status == 'ativo' &&
                                  !rows.any((rp) => rp.playerId == p.id),
                            ))
                              SimpleDialogOption(
                                onPressed: () => Navigator.pop(ctx, p.id),
                                child: Text(p.name),
                              ),
                          ],
                        ),
                      );
                      if (player != null && context.mounted) {
                        await perform(
                          context,
                          () => store.setAttendance(id, player, 'confirmado'),
                        );
                      }
                    },
              icon: const Icon(Icons.person_add_rounded),
              label: const Text('Adicionar participante'),
            ),
          if (r.status == 'encerrada') AwardsPanel(store, r),
          if (r.status == 'encerrada' && mine?.teamId != null)
            PrimaryButton(
              label: 'Meu card da partida',
              icon: Icons.ios_share_rounded,
              onPressed: () => openPage(
                context,
                PlayerMatchCardPage(store, id, store.current!.id),
              ),
            ),
          if (r.status == 'cancelada')
            Panel(
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  Icons.event_busy_rounded,
                  color: Theme.of(context).colorScheme.error,
                ),
                title: const Text('Partida cancelada'),
                subtitle: Text(r.cancelReason ?? 'Sem motivo informado'),
              ),
            ),
          if (store.isAdmin)
            OutlinedButton.icon(
              onPressed: () => openPage(context, RoundHistoryPage(store, id)),
              icon: const Icon(Icons.history_rounded),
              label: const Text('Histórico e critérios'),
            ),
          if (store.isAdmin && r.status == 'rascunho')
            OutlinedButton(
              onPressed: () => openPage(context, EditRoundPage(store, r)),
              child: const Text('Editar partida'),
            ),
          if (store.isAdmin && r.status == 'cancelada')
            TextButton(
              onPressed: () => perform(
                context,
                () => store.roundCommand(id, 'uncancel', {}),
              ),
              child: const Text('Restaurar partida'),
            ),
          if (store.isAdmin && r.status == 'rascunho')
            TextButton(
              style: TextButton.styleFrom(
                foregroundColor: Theme.of(context).colorScheme.error,
              ),
              onPressed: store.busy
                  ? null
                  : () async {
                      final reason = await askReason(
                        context,
                        'Cancelar partida',
                      );
                      if (reason != null && context.mounted) {
                        await perform(
                          context,
                          () => store.roundCommand(id, 'cancel', {
                            'reason': reason,
                          }),
                        );
                      }
                    },
              child: const Text('Cancelar partida'),
            ),
        ],
      );
    },
  );
}

class ManualTeamsPage extends StatefulWidget {
  const ManualTeamsPage(this.store, this.id, {super.key});
  final AppStore store;
  final String id;
  @override
  State<ManualTeamsPage> createState() => _ManualTeamsState();
}

class _ManualTeamsState extends State<ManualTeamsPage> {
  late final Map<String, int?> assignments;
  late String aColor, bColor;
  late TextEditingController aName, bName;
  @override
  void initState() {
    super.initState();
    final s = widget.store.snapshot, teams = s.roundTeams(widget.id);
    aColor = teams.isEmpty ? s.settings.teamAColor : teams.first.color;
    bColor = teams.length < 2 ? s.settings.teamBColor : teams[1].color;
    aName = TextEditingController(
      text: teams.isEmpty ? s.settings.teamALabel : teams.first.name,
    );
    bName = TextEditingController(
      text: teams.length < 2 ? s.settings.teamBLabel : teams[1].name,
    );
    assignments = {
      for (final rp
          in s.entries(widget.id).where((rp) => rp.attendance == 'confirmado'))
        rp.playerId: rp.teamId == null
            ? null
            : teams.indexWhere((t) => t.id == rp.teamId),
    };
  }

  @override
  void dispose() {
    aName.dispose();
    bName.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Frame(
    store: widget.store,
    title: 'Montar times',
    builder: (context) {
      if (!widget.store.isAdmin ||
          [
            'encerrada',
            'cancelada',
          ].contains(widget.store.snapshot.round(widget.id)?.status)) {
        return const Center(child: Text('Montagem indisponível.'));
      }
      return ListView(
        padding: const EdgeInsets.all(PatotaSpace.lg),
        children: [
          const Panel(
            child: Text(
              'Escolha o time de cada confirmado. Ajustar times existentes preserva a partida e os gols.',
            ),
          ),
          field('Nome do time A', aName),
          choice(
            'Cor do time A',
            aColor,
            teamPalette.keys.toList(),
            (v) => setState(() => aColor = v),
            labels: teamPalette,
          ),
          field('Nome do time B', bName),
          choice(
            'Cor do time B',
            bColor,
            teamPalette.keys.toList(),
            (v) => setState(() => bColor = v),
            labels: teamPalette,
          ),
          for (final id in assignments.keys)
            choice(
              widget.store.snapshot.player(id)?.name ?? 'Jogador',
              assignments[id]?.toString() ?? 'fora',
              ['fora', '0', '1'],
              (v) => setState(() => assignments[id] = int.tryParse(v)),
              labels: {'fora': 'Sem time', '0': aName.text, '1': bName.text},
            ),
          PrimaryButton(
            label: 'Salvar times',
            icon: Icons.check_rounded,
            loading: widget.store.busy,
            onPressed: widget.store.busy
                ? null
                : () async {
                    final ok = await perform(
                      context,
                      () => widget.store.buildTeams(
                        widget.id,
                        manual: assignments,
                        names: [aName.text.trim(), bName.text.trim()],
                        colors: [aColor, bColor],
                      ),
                      successMessage: 'Escalação salva',
                    );
                    if (ok && context.mounted) Navigator.pop(context);
                  },
          ),
        ],
      );
    },
  );
}

class LiveMatchPage extends StatelessWidget {
  const LiveMatchPage(this.store, this.id, {super.key});
  final AppStore store;
  final String id;
  @override
  Widget build(BuildContext context) => Frame(
    store: store,
    title: 'Placar da partida',
    builder: (context) {
      final s = store.snapshot,
          m = s.matches.where((m) => m.id == id).firstOrNull;
      if (m == null) {
        return const Center(child: Text('Partida não encontrada.'));
      }
      return ListView(
        padding: const EdgeInsets.all(PatotaSpace.lg),
        children: [
          Panel(
            child: Scoreboard(
              teamA: s.team(m.teamA),
              teamB: s.team(m.teamB),
              scoreA: m.scoreA,
              scoreB: m.scoreB,
              status: statusLabel(m.status),
            ),
          ),
          if (store.isAdmin && m.status == 'em_andamento') ...[
            PrimaryButton(
              label: 'Registrar gol',
              icon: Icons.sports_soccer_rounded,
              onPressed: store.busy
                  ? null
                  : () => openPage(context, GoalForm(store, m)),
            ),
            OutlinedButton(
              onPressed: store.busy
                  ? null
                  : () async {
                      if (await confirm(
                            context,
                            'Encerrar partida?',
                            'O placar será consolidado e a votação de prêmios abrirá.',
                          ) &&
                          context.mounted) {
                        await perform(
                          context,
                          () => store.closeRound(m.roundId),
                          successMessage:
                              'Partida encerrada. A votação está aberta!',
                        );
                      }
                    },
              child: const Text('Encerrar partida'),
            ),
          ],
          if (store.isAdmin && m.status == 'encerrada')
            OutlinedButton(
              onPressed: store.busy
                  ? null
                  : () async {
                      final reason = await askReason(
                        context,
                        'Reabrir para corrigir',
                      );
                      if (reason != null && context.mounted) {
                        await perform(
                          context,
                          () => store.reopen(m, reason: reason),
                          successMessage: 'Partida reaberta para correção',
                        );
                      }
                    },
              child: const Text('Reabrir para corrigir'),
            ),
          const Heading('Gols'),
          if (!s.events.any((e) => e.matchId == id))
            AppEmptyState(
              icon: Icons.sports_soccer_rounded,
              title: m.status == 'encerrada'
                  ? 'O placar ficou no zero'
                  : 'A rede ainda não balançou',
              message: m.status == 'encerrada'
                  ? 'Nenhum gol foi registrado nesta partida.'
                  : 'Cada gol e assistência registrados passam a fazer parte da história do jogo.',
            ),
          for (final e
              in s.events.where((e) => e.matchId == id).toList().reversed)
            Panel(
              child: ListTile(
                leading: Icon(
                  Icons.sports_soccer_rounded,
                  color: s.team(e.teamId) == null
                      ? PatotaColors.primary
                      : teamColor(s.team(e.teamId)!.color),
                ),
                title: Text(
                  '${s.player(e.scorerId)?.name ?? 'Sem autor'}${e.ownGoal ? ' (gol contra)' : ''}',
                ),
                subtitle: Text(
                  '${s.team(e.teamId)?.name}${e.assistId != null ? ' • assistência: ${s.player(e.assistId)?.name ?? 'removido'}' : ''}',
                ),
                trailing: store.isAdmin && m.status == 'em_andamento'
                    ? PopupMenuButton<String>(
                        onSelected: (v) async {
                          if (v == 'editar') {
                            openPage(context, GoalForm(store, m, event: e));
                          } else {
                            final reason = await askReason(
                              context,
                              'Anular gol',
                            );
                            if (reason != null && context.mounted) {
                              await perform(
                                context,
                                () => store.deleteGoal(m, e.id, reason: reason),
                                successMessage:
                                    'Gol anulado. Placar atualizado',
                              );
                            }
                          }
                        },
                        itemBuilder: (_) => const [
                          PopupMenuItem(value: 'editar', child: Text('Editar')),
                          PopupMenuItem(
                            value: 'excluir',
                            child: Text('Anular'),
                          ),
                        ],
                      )
                    : null,
              ),
            ),
        ],
      );
    },
  );
}

class GoalForm extends StatefulWidget {
  const GoalForm(this.store, this.match, {super.key, this.event});
  final AppStore store;
  final Match match;
  final Goal? event;
  @override
  State<GoalForm> createState() => _GoalFormState();
}

class _GoalFormState extends State<GoalForm> {
  final minute = TextEditingController();
  final reason = TextEditingController();
  late String team;
  String? scorer, assist;
  bool own = false;
  @override
  void initState() {
    super.initState();
    team = widget.event?.teamId ?? widget.match.teamA;
    scorer = widget.event?.scorerId;
    assist = widget.event?.assistId;
    own = widget.event?.ownGoal ?? false;
    minute.text = widget.event?.json['minute']?.toString() ?? '';
  }

  @override
  void dispose() {
    minute.dispose();
    reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Frame(
    store: widget.store,
    title: widget.event == null ? 'Registrar gol' : 'Corrigir gol',
    builder: (context) {
      final s = widget.store.snapshot, m = widget.match;
      if (!widget.store.isAdmin) {
        return const Center(child: Text('Acesso reservado ao administrador.'));
      }
      final scoringTeam = own ? (team == m.teamA ? m.teamB : m.teamA) : team;
      final roster = s
          .entries(m.roundId)
          .where((rp) => rp.teamId == scoringTeam)
          .toList();
      final assists = s
          .entries(m.roundId)
          .where((rp) => rp.teamId == team && rp.playerId != scorer)
          .toList();
      return ListView(
        padding: const EdgeInsets.all(PatotaSpace.lg),
        children: [
          choice(
            'Time que recebe o ponto',
            team,
            [m.teamA, m.teamB],
            (v) => setState(() {
              team = v;
              scorer = null;
              assist = null;
            }),
            labels: {
              m.teamA: s.team(m.teamA)?.name ?? 'A',
              m.teamB: s.team(m.teamB)?.name ?? 'B',
            },
          ),
          SwitchListTile.adaptive(
            title: const Text('Gol contra'),
            value: own,
            onChanged: (v) => setState(() {
              own = v;
              scorer = null;
              assist = null;
            }),
          ),
          choice(
            'Autor',
            scorer ?? '',
            ['', ...roster.map((rp) => rp.playerId)],
            (v) => setState(() {
              scorer = v.isEmpty ? null : v;
              if (scorer == assist) assist = null;
            }),
            labels: {
              '': 'Sem autor',
              for (final rp in roster)
                rp.playerId: s.player(rp.playerId)?.name ?? 'Removido',
            },
          ),
          if (!own)
            choice(
              'Assistência',
              assist ?? '',
              ['', ...assists.map((rp) => rp.playerId)],
              (v) => setState(() => assist = v.isEmpty ? null : v),
              labels: {
                '': 'Sem assistência',
                for (final rp in assists)
                  rp.playerId: s.player(rp.playerId)?.name ?? 'Removido',
              },
            ),
          field('Minuto (opcional, 0 a 300)', minute, number: true),
          if (widget.event != null) field('Motivo da correção', reason),
          PrimaryButton(
            label: widget.event == null ? 'Registrar gol' : 'Salvar correção',
            icon: Icons.sports_soccer_rounded,
            loading: widget.store.busy,
            onPressed: widget.store.busy
                ? null
                : () async {
                    if ((minute.text.isNotEmpty &&
                            (int.tryParse(minute.text) == null ||
                                int.parse(minute.text) < 0 ||
                                int.parse(minute.text) > 300)) ||
                        (widget.event != null && reason.text.trim().isEmpty)) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Confira o minuto e o motivo da correção.',
                          ),
                        ),
                      );
                      return;
                    }
                    final current = s.matches.firstWhere(
                      (match) => match.id == m.id,
                    );
                    final ok = await perform(
                      context,
                      () => widget.store.goal(
                        current,
                        {
                          'team_id': team,
                          'scorer_id': scorer,
                          'assist_id': own ? null : assist,
                          'own_goal': own,
                          'minute': int.tryParse(minute.text),
                        },
                        eventId: widget.event?.id,
                        reason: reason.text.trim(),
                      ),
                      successMessage: widget.event == null
                          ? 'Gol registrado!'
                          : 'Gol corrigido. Placar atualizado',
                    );
                    if (ok && context.mounted) Navigator.pop(context);
                  },
          ),
        ],
      );
    },
  );
}

class AwardsPanel extends StatelessWidget {
  const AwardsPanel(this.store, this.round, {super.key});
  final AppStore store;
  final Round round;
  @override
  Widget build(BuildContext context) {
    final s = store.snapshot,
        state = votingState(round),
        candidates = awardCandidates(s, round.id),
        me = store.current?.id;
    final canVote =
        me != null &&
        s
            .entries(round.id)
            .any(
              (rp) =>
                  rp.playerId == me &&
                  rp.teamId != null &&
                  rp.actualAttendance != 'ausente',
            );
    final votes = s.votes.where((v) => v.roundId == round.id).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Heading('Prêmios da partida'),
        const Text(
          'Fórmula legada v1: 70% votos e 30% desempenho. Votos individuais são privados. Desempates preservam os critérios anteriores.',
        ),
        Text(
          state == 'aberta'
              ? 'Votação aberta até ${round.closedAt!.add(const Duration(hours: 16)).toLocal()} • ${votes.map((v) => v.voterId).toSet().length} jogadores votaram'
              : 'Votação encerrada',
        ),
        for (final type in awardLabels.keys)
          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Image.asset(
                      'assets/awards/${type == 'jogador_rodada'
                          ? 'craque'
                          : type == 'pior_jogador'
                          ? 'bagre'
                          : 'paredao'}.png',
                      height: 52,
                      width: 52,
                    ),
                    const SizedBox(width: PatotaSpace.md),
                    Expanded(
                      child: Text(
                        awardLabels[type]!,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                  ],
                ),
                if (state == 'aberta' && canVote) ...[
                  RadioGroup<String>(
                    groupValue: votes
                        .where((v) => v.voterId == me && v.type == type)
                        .firstOrNull
                        ?.playerId,
                    onChanged: (id) {
                      if (!store.busy) {
                        perform(
                          context,
                          () => store.vote(round.id, type, id),
                          successMessage: 'Voto registrado',
                        );
                      }
                    },
                    child: Column(
                      children: [
                        for (final p in candidates[type]!.where(
                          (p) => p.playerId != me,
                        ))
                          RadioListTile<String>(
                            value: p.playerId,
                            title: Text(
                              s.player(p.playerId)?.name ?? 'Removido',
                            ),
                            enabled: !store.busy,
                          ),
                      ],
                    ),
                  ),
                  if (votes.any((v) => v.voterId == me && v.type == type))
                    TextButton(
                      onPressed: store.busy
                          ? null
                          : () => perform(
                              context,
                              () => store.vote(round.id, type, null),
                              successMessage: 'Voto retirado',
                            ),
                      child: const Text('Retirar meu voto'),
                    ),
                ] else if (state == 'aberta')
                  const Text('Somente os jogadores escalados podem votar.')
                else ...[
                  if (round.settledAt != null)
                    Text(
                      s.awards
                              .where(
                                (a) => a.roundId == round.id && a.type == type,
                              )
                              .map(
                                (a) => s.player(a.playerId)?.name ?? 'Removido',
                              )
                              .join(', ')
                              .isEmpty
                          ? 'Sem destaque'
                          : s.awards
                                .where(
                                  (a) =>
                                      a.roundId == round.id && a.type == type,
                                )
                                .map(
                                  (a) =>
                                      s.player(a.playerId)?.name ?? 'Removido',
                                )
                                .join(', '),
                    )
                  else
                    const Text('Aguardando apuração do administrador.'),
                ],
              ],
            ),
          ),
        if (store.isAdmin && state == 'aberta')
          OutlinedButton(
            onPressed: store.busy
                ? null
                : () async {
                    if (await confirm(
                          context,
                          'Encerrar votação?',
                          '${votes.map((v) => v.voterId).toSet().length} jogadores votaram. A apuração é definitiva e recusa novos votos.',
                        ) &&
                        context.mounted) {
                      await perform(
                        context,
                        () => store.closeVoting(round.id),
                        successMessage:
                            'Votação encerrada. Destaques apurados!',
                      );
                    }
                  },
            child: const Text('Encerrar votação e apurar'),
          ),
        if (state == 'encerrada' && round.settledAt != null)
          OutlinedButton.icon(
            onPressed: () =>
                openPage(context, SharePage(store, round.id, result: true)),
            icon: const Icon(Icons.share_rounded),
            label: const Text('Compartilhar resultado'),
          ),
      ],
    );
  }
}
