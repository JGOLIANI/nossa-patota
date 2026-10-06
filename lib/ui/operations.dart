import 'dart:ui' as ui;
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import '../data/backend.dart';
import '../models.dart';
import '../store.dart';
import 'common.dart';

Color teamColor(String value) =>
    Color(int.parse('ff${value.replaceFirst('#', '')}', radix: 16));

Future<String?> askReason(BuildContext context, String title) async {
  final controller = TextEditingController();
  final result = await showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        maxLength: 300,
        decoration: const InputDecoration(
          labelText: 'Motivo',
          hintText: 'Descreva a alteração',
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Voltar'),
        ),
        FilledButton(
          onPressed: () {
            if (controller.text.trim().isNotEmpty) {
              Navigator.pop(ctx, controller.text.trim());
            }
          },
          child: const Text('Confirmar'),
        ),
      ],
    ),
  );
  controller.dispose();
  return result;
}

class PatotaConfigPage extends StatefulWidget {
  const PatotaConfigPage(this.store, {super.key});
  final AppStore store;
  @override
  State<PatotaConfigPage> createState() => _PatotaConfigState();
}

class _PatotaConfigState extends State<PatotaConfigPage> {
  late final TextEditingController name, size, aLabel, bLabel;
  late String modality, zone, aColor, bColor;
  String? code;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    final p = widget.store.snapshot.patota!, s = widget.store.snapshot.settings;
    name = TextEditingController(text: p.name);
    size = TextEditingController(text: '${s.teamSize}');
    aLabel = TextEditingController(text: s.teamALabel);
    bLabel = TextEditingController(text: s.teamBLabel);
    modality = p.modality;
    zone = p.timezone;
    aColor = s.teamAColor;
    bColor = s.teamBColor;
    loadCode();
  }

  Future<void> loadCode({bool rotate = false}) async {
    final result = await perform(context, () async {
      final value = await widget.store.backend.rpc('patota_join_code', {
        'p_patota_id': widget.store.snapshot.activePatotaId,
        'p_rotate': rotate,
      });
      if (mounted) setState(() => code = value as String);
    });
    if (!result && mounted) setState(() => code = null);
  }

  @override
  void dispose() {
    for (final c in [name, size, aLabel, bLabel]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Frame(
    store: widget.store,
    title: 'Configurações da patota',
    builder: (context) => ListView(
      padding: const EdgeInsets.all(16),
      children: [
        field('Nome da patota', name),
        choice(
          'Modalidade',
          modality,
          modalityLabels.keys.toList(),
          (v) => setState(() => modality = v),
          labels: modalityLabels,
        ),
        choice('Fuso horário', zone, [
          'America/Sao_Paulo',
          'America/Manaus',
          'America/Recife',
          'America/Fortaleza',
          'America/Rio_Branco',
          'Europe/Lisbon',
          'UTC',
        ], (v) => setState(() => zone = v)),
        const Panel(
          child: Text(
            'Mudanças de modalidade, fuso e cores padrão valem para novas partidas. O histórico mantém as regras e cores publicadas.',
          ),
        ),
        field('Tamanho sugerido do time', size, number: true),
        const Heading('Identidade dos times'),
        field('Nome do time A', aLabel),
        choice(
          'Cor do time A',
          aColor,
          teamPalette.keys.toList(),
          (v) => setState(() => aColor = v),
          labels: teamPalette,
        ),
        field('Nome do time B', bLabel),
        choice(
          'Cor do time B',
          bColor,
          teamPalette.keys.toList(),
          (v) => setState(() => bColor = v),
          labels: teamPalette,
        ),
        Row(
          children: [
            Expanded(
              child: ListTile(
                leading: Icon(Icons.circle, color: teamColor(aColor)),
                title: Text(aLabel.text),
              ),
            ),
            Expanded(
              child: ListTile(
                leading: Icon(Icons.circle, color: teamColor(bColor)),
                title: Text(bLabel.text),
              ),
            ),
          ],
        ),
        FilledButton(
          onPressed: busy
              ? null
              : () async {
                  final n = int.tryParse(size.text);
                  if (n == null ||
                      n < 1 ||
                      n > 30 ||
                      name.text.trim().length < 2 ||
                      aLabel.text.trim().isEmpty ||
                      bLabel.text.trim().isEmpty ||
                      aColor == bColor) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'Confira nome, tamanho (1–30), nomes dos times e cores diferentes.',
                        ),
                      ),
                    );
                    return;
                  }
                  if (modality != widget.store.snapshot.patota!.modality &&
                      !await confirm(
                        context,
                        'Alterar modalidade?',
                        'A mudança só afeta as novas partidas; revise o tamanho sugerido.',
                      )) {
                    return;
                  }
                  if (!context.mounted) return;
                  setState(() => busy = true);
                  final ok = await perform(
                    context,
                    () => widget.store.updateSettings({
                      'name': name.text.trim(),
                      'modality': modality,
                      'timezone': zone,
                      'team_size': n,
                      'team_a_label': aLabel.text.trim(),
                      'team_b_label': bLabel.text.trim(),
                      'team_a_color': aColor,
                      'team_b_color': bColor,
                    }),
                  );
                  if (mounted) {
                    setState(() => busy = false);
                    if (ok && context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Configurações salvas.')),
                      );
                    }
                  }
                },
          child: const Text('Salvar configurações'),
        ),
        const Heading('Convide sua patota'),
        if (code == null)
          const Text('Carregando código…')
        else
          Panel(
            child: Column(
              children: [
                SelectableText(
                  code!,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const Text(
                  'O código permite entrar como jogador; nunca como administrador.',
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    TextButton(
                      onPressed: () =>
                          Clipboard.setData(ClipboardData(text: code!)),
                      child: const Text('Copiar'),
                    ),
                    TextButton(
                      onPressed: () {
                        final box = context.findRenderObject() as RenderBox?;
                        SharePlus.instance.share(
                          ShareParams(
                            text:
                                'Entre na patota ${name.text} pelo aplicativo Nossa Patota. Código: $code',
                            sharePositionOrigin: box == null
                                ? null
                                : box.localToGlobal(Offset.zero) & box.size,
                          ),
                        );
                      },
                      child: const Text('Compartilhar'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        TextButton(
          onPressed: busy
              ? null
              : () async {
                  if (await confirm(
                        context,
                        'Gerar novo código?',
                        'O anterior deixa de aceitar novas entradas. Os membros e o histórico continuam na patota.',
                      ) &&
                      context.mounted) {
                    await loadCode(rotate: true);
                  }
                },
          child: const Text('Gerar novo código'),
        ),
      ],
    ),
  );
}

class EditRoundPage extends StatefulWidget {
  const EditRoundPage(this.store, this.round, {super.key});
  final AppStore store;
  final Round round;
  @override
  State<EditRoundPage> createState() => _EditRoundState();
}

class _EditRoundState extends State<EditRoundPage> {
  late final TextEditingController title, time, location, capacity;
  late DateTime date;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    final r = widget.round;
    title = TextEditingController(text: r.title);
    time = TextEditingController(text: r.time);
    location = TextEditingController(text: r.location);
    capacity = TextEditingController(text: '${r.maxPlayers}');
    date = DateTime.parse(r.date);
  }

  @override
  void dispose() {
    for (final c in [title, time, location, capacity]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Frame(
    store: widget.store,
    title: 'Editar partida',
    builder: (context) => ListView(
      padding: const EdgeInsets.all(16),
      children: [
        field('Título', title),
        OutlinedButton(
          onPressed: () async {
            final d = await showDatePicker(
              context: context,
              initialDate: date,
              firstDate: DateTime(2020),
              lastDate: DateTime(2100),
            );
            if (d != null && mounted) setState(() => date = d);
          },
          child: Text(prettyDate(date.toIso8601String().substring(0, 10))),
        ),
        field('Horário (HH:MM)', time),
        field('Local', location),
        field('Vagas (0 = sem limite)', capacity, number: true),
        Text('Fuso da partida: ${widget.round.timezone}'),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: busy
              ? null
              : () async {
                  final max = int.tryParse(capacity.text);
                  if (max == null ||
                      max < 0 ||
                      !RegExp(
                        r'^([01]\d|2[0-3]):[0-5]\d$',
                      ).hasMatch(time.text) ||
                      title.text.trim().isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Confira título, horário e capacidade.'),
                      ),
                    );
                    return;
                  }
                  setState(() => busy = true);
                  final ok = await perform(
                    context,
                    () => widget.store.roundCommand(widget.round.id, 'edit', {
                      'expected_version': widget.round.version,
                      'date': date.toIso8601String().substring(0, 10),
                      'title': title.text.trim(),
                      'start_time': time.text,
                      'location': location.text.trim(),
                      'max_players': max,
                    }),
                  );
                  if (mounted) {
                    setState(() => busy = false);
                    if (ok && context.mounted) Navigator.pop(context);
                  }
                },
          child: const Text('Salvar partida'),
        ),
      ],
    ),
  );
}

class RoundHistoryPage extends StatelessWidget {
  const RoundHistoryPage(this.store, this.id, {super.key});
  final AppStore store;
  final String id;
  @override
  Widget build(BuildContext context) => Frame(
    store: store,
    title: 'Histórico de alterações',
    builder: (context) => FutureBuilder<dynamic>(
      future: store.backend.rpc('round_history', {'p_round_id': id}),
      builder: (context, state) {
        if (state.hasError) {
          return Center(child: Text(translateError(state.error!)));
        }
        if (!state.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final rows = state.data as List;
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (rows.isEmpty)
              const Text('Nenhuma alteração registrada após a migração.'),
            for (final row in rows)
              Panel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      const {
                            'MatchScheduled': 'Partida agendada',
                            'AttendanceChanged': 'Presença alterada',
                            'WaitlistPromoted': 'Vaga preenchida pela fila',
                            'TeamsGenerated': 'Times publicados',
                            'Match:edit': 'Partida editada',
                            'Match:cancel': 'Partida cancelada',
                            'Match:uncancel': 'Partida reaberta',
                            'Match:check_in': 'Comparecimento registrado',
                            'Match:close': 'Partida encerrada',
                            'Match:reopen': 'Reabertura para correção',
                            'MatchAction:add': 'Gol registrado',
                            'MatchAction:edit': 'Gol corrigido',
                            'MatchAction:reverse': 'Gol revertido',
                            'AwardsCalculated': 'Prêmios apurados',
                            'PlayerMatchCardGenerated': 'Card gerado',
                          }[row['action']] ??
                          'Alteração registrada',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    Text(
                      '${store.snapshot.players.where((p) => p.userId == row['actor_id']).firstOrNull?.name ?? 'Administrador'} · ${DateTime.tryParse(row['created_at'] as String)?.toLocal() ?? ''}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    if (row['payload']['reason'] != null)
                      Text(row['payload']['reason'] as String),
                    if (row['payload']['explanation'] != null)
                      Text(row['payload']['explanation'] as String),
                    if (row['payload']['algorithm_version'] != null)
                      Text(
                        'Versão: ${row["payload"]["algorithm_version"]} · Seed: ${row["payload"]["seed"]}',
                      ),
                    if (row['payload']['predicted_difference'] != null)
                      Text(
                        'Diferença prevista: ${(row["payload"]["predicted_difference"] as num).toStringAsFixed(2)}',
                      ),
                    if (row['payload']['after']?['reason'] != null)
                      Text(row['payload']['after']['reason'] as String),
                    if (row['action'] == 'AwardsCalculated')
                      for (final type in awardLabels.keys)
                        if (row['payload']['results']?[type]?['components'] !=
                            null)
                          Text(
                            '${awardLabels[type]}: ${(100 * (row["payload"]["results"][type]["components"]["vote_share"] as num)).toStringAsFixed(0)}% dos votos · índice normalizado ${(row["payload"]["results"][type]["components"]["normalized"] as num).toStringAsFixed(2)} · nota ${(row["payload"]["results"][type]["components"]["score"] as num).toStringAsFixed(3)}',
                          ),
                  ],
                ),
              ),
          ],
        );
      },
    ),
  );
}

class PlayerMatchCardPage extends StatefulWidget {
  const PlayerMatchCardPage(
    this.store,
    this.roundId,
    this.playerId, {
    super.key,
  });
  final AppStore store;
  final String roundId, playerId;
  @override
  State<PlayerMatchCardPage> createState() => _PlayerMatchCardState();
}

class _PlayerMatchCardState extends State<PlayerMatchCardPage> {
  final boundary = GlobalKey();
  late final Future<dynamic> card;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    card = widget.store.backend.rpc('player_match_card', {
      'p_round_id': widget.roundId,
      'p_player_id': widget.playerId,
    });
  }

  @override
  Widget build(BuildContext context) => Frame(
    store: widget.store,
    title: 'Compartilhar minha partida',
    builder: (context) => FutureBuilder<dynamic>(
      future: card,
      builder: (context, state) {
        if (state.hasError) {
          return Center(child: Text(translateError(state.error!)));
        }
        if (!state.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final record = Map<String, dynamic>.from(state.data as Map),
            payload = Map<String, dynamic>.from(record['payload'] as Map);
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              'Revise seus números antes de compartilhar. Somente seus dados pessoais aparecem no card; foto e métricas não registradas ficam de fora.',
            ),
            const SizedBox(height: 16),
            RepaintBoundary(
              key: boundary,
              child: AspectRatio(
                aspectRatio: 9 / 16,
                child: Container(
                  decoration: BoxDecoration(
                    color: const Color(0xff102d20),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  padding: const EdgeInsets.all(24),
                  child: DefaultTextStyle(
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      color: Colors.white,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          (payload['patota'] as String).toUpperCase(),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 15,
                            letterSpacing: 2,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          prettyDate(payload['date'] as String),
                          style: const TextStyle(color: Colors.white70),
                        ),
                        const Spacer(),
                        Text(
                          payload['name'] as String,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 30,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 8),
                        if (payload['team'] != null)
                          Row(
                            children: [
                              Container(
                                width: 16,
                                height: 16,
                                decoration: BoxDecoration(
                                  color: teamColor(
                                    payload['team']['color'] as String,
                                  ),
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Colors.white54),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  payload['team']['name'] as String,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        const Text(
                          'MINHA PARTIDA',
                          style: TextStyle(
                            color: Color(0xff30d158),
                            letterSpacing: 2,
                          ),
                        ),
                        const SizedBox(height: 24),
                        Row(
                          children: [
                            for (final metric in {
                              'Gols': payload['goals'],
                              'Assistências': payload['assists'],
                              'Vitórias': payload['wins'],
                            }.entries)
                              Expanded(
                                child: Column(
                                  children: [
                                    Text(
                                      '${metric.value}',
                                      style: const TextStyle(
                                        fontSize: 36,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    Text(
                                      metric.key,
                                      style: const TextStyle(fontSize: 12),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 24),
                        for (final score in payload['scores'] as List)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Text(
                              '${score['team_a']}  ${score['score_a']} × ${score['score_b']}  ${score['team_b']}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 13),
                            ),
                          ),
                        for (final award in payload['awards'] as List)
                          Text(
                            awardLabels[award] ?? '',
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Color(0xff30d158)),
                          ),
                        const Spacer(),
                        const Text(
                          'NOSSA PATOTA',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            letterSpacing: 2,
                          ),
                        ),
                        Text(
                          'Dados da partida · versão ${payload['round_version']}',
                          style: const TextStyle(
                            fontSize: 10,
                            color: Colors.white54,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: busy
                  ? null
                  : () async {
                      setState(() => busy = true);
                      await perform(context, () async {
                        final fresh = await widget.store.backend
                            .rpc('player_match_card', {
                              'p_round_id': widget.roundId,
                              'p_player_id': widget.playerId,
                            });
                        if (jsonEncode(fresh['payload']) !=
                            jsonEncode(payload)) {
                          throw Exception(
                            'Os dados foram atualizados. Abra novamente o card antes de compartilhar.',
                          );
                        }
                        final current = widget.store.snapshot.round(
                          widget.roundId,
                        );
                        if (current?.status != 'encerrada' ||
                            current!.version != payload['round_version']) {
                          throw Exception(
                            'A partida foi corrigida. Abra novamente o card para gerar a versão atual.',
                          );
                        }
                        await WidgetsBinding.instance.endOfFrame;
                        final render =
                            boundary.currentContext!.findRenderObject()
                                as RenderRepaintBoundary;
                        final img = await render.toImage(
                          pixelRatio: 1080 / render.size.width,
                        );
                        try {
                          final bytes = (await img.toByteData(
                            format: ui.ImageByteFormat.png,
                          ))!.buffer.asUint8List();
                          if (!context.mounted) return;
                          final box = context.findRenderObject() as RenderBox?;
                          await SharePlus.instance.share(
                            ShareParams(
                              files: [
                                XFile.fromData(
                                  bytes,
                                  mimeType: 'image/png',
                                  name: 'minha-partida.png',
                                ),
                              ],
                              fileNameOverrides: ['minha-partida.png'],
                              text: 'Minha partida na ${payload['patota']}',
                              sharePositionOrigin: box == null
                                  ? null
                                  : box.localToGlobal(Offset.zero) & box.size,
                            ),
                          );
                        } finally {
                          img.dispose();
                        }
                      });
                      if (mounted) setState(() => busy = false);
                    },
              icon: const Icon(Icons.ios_share),
              label: const Text('Compartilhar card'),
            ),
          ],
        );
      },
    ),
  );
}
