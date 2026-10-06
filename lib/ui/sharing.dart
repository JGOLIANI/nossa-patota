import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:share_plus/share_plus.dart';
import '../domain.dart';
import '../models.dart';
import '../store.dart';
import 'common.dart';

String shareMessage(Snapshot s, Round r, bool result) {
  final text = StringBuffer(
    '⚽ Nossa Patota • ${r.title}\n${prettyDate(r.date)} às ${r.time}\n${r.location}\n',
  );
  if (r.locationUrl.isNotEmpty) text.writeln(r.locationUrl);
  if (result) {
    for (final m in s.matches.where((m) => m.roundId == r.id)) {
      text.writeln(
        '${s.team(m.teamA)?.name} ${m.scoreA} × ${m.scoreB} ${s.team(m.teamB)?.name}',
      );
    }
    for (final type in awardLabels.keys) {
      final names = s.awards
          .where((a) => a.roundId == r.id && a.type == type)
          .map((a) => s.player(a.playerId)?.name ?? 'Removido')
          .join(', ');
      text.writeln(
        '${awardLabels[type]}: ${names.isEmpty ? 'Sem destaque' : names}',
      );
    }
    final scorers =
        computeStats(s, roundId: r.id).values.where((p) => p.goals > 0).toList()
          ..sort((a, b) => b.goals.compareTo(a.goals));
    text.writeln('Artilharia:');
    for (final p in scorers) {
      text.writeln('${s.player(p.playerId)?.name}: ${p.goals}');
    }
  } else {
    for (final team in s.roundTeams(r.id)) {
      text.writeln('\n${team.name}');
      for (final rp in s.entries(r.id).where((rp) => rp.teamId == team.id)) {
        text.writeln(
          '${s.player(rp.playerId)?.name ?? 'Removido'}${(rp.position ?? s.player(rp.playerId)?.position) == 'goleiro' ? ' • GOLEIRO' : ''}',
        );
      }
    }
  }
  return text.toString();
}

class SharePage extends StatefulWidget {
  const SharePage(this.store, this.roundId, {super.key, this.result = false});
  final AppStore store;
  final String roundId;
  final bool result;
  @override
  State<SharePage> createState() => _ShareState();
}

class _ShareState extends State<SharePage> {
  final boundary = GlobalKey();
  bool busy = false;
  @override
  Widget build(BuildContext context) => Frame(
    store: widget.store,
    title: 'Compartilhar',
    builder: (context) {
      final s = widget.store.snapshot, r = s.round(widget.roundId);
      if (r == null) {
        return const Center(child: Text('Partida não encontrada.'));
      }
      if (widget.result &&
          (votingState(r) != 'encerrada' || r.settledAt == null)) {
        return const Center(
          child: Text(
            'O resultado pode ser compartilhado após o encerramento da votação.',
          ),
        );
      }
      final message = shareMessage(s, r, widget.result);
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          RepaintBoundary(
            key: boundary,
            child: Container(
              color: const Color(0xfff1f3f5),
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'NOSSA PATOTA',
                    style: TextStyle(
                      color: brand,
                      fontSize: 30,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  if (widget.result)
                    for (final m in s.matches.where((m) => m.roundId == r.id))
                      Text(
                        '${m.scoreA} × ${m.scoreB}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Color(0xff101418),
                          fontSize: 84,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                  Text(
                    message,
                    style: const TextStyle(
                      color: Color(0xff101418),
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
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
                      await WidgetsBinding.instance.endOfFrame;
                      final render =
                          boundary.currentContext?.findRenderObject()
                              as RenderRepaintBoundary?;
                      if (render == null) {
                        throw Exception('Aguarde o cartão carregar.');
                      }
                      final image = await render.toImage(pixelRatio: 2);
                      final bytes = await image.toByteData(
                        format: ui.ImageByteFormat.png,
                      );
                      image.dispose();
                      if (bytes == null) {
                        throw Exception('Não foi possível gerar a imagem.');
                      }
                      if (!context.mounted) return;
                      final box = context.findRenderObject() as RenderBox?;
                      await SharePlus.instance.share(
                        ShareParams(
                          text: message,
                          files: [
                            XFile.fromData(
                              bytes.buffer.asUint8List(),
                              mimeType: 'image/png',
                              name: 'patota.png',
                            ),
                          ],
                          fileNameOverrides: ['patota.png'],
                          sharePositionOrigin: box == null
                              ? null
                              : box.localToGlobal(Offset.zero) & box.size,
                        ),
                      );
                    });
                    if (mounted) setState(() => busy = false);
                  },
            icon: const Icon(Icons.share),
            label: const Text('Compartilhar imagem e mensagem'),
          ),
          OutlinedButton(
            onPressed: () => perform(context, () async {
              final box = context.findRenderObject() as RenderBox?;
              await SharePlus.instance.share(
                ShareParams(
                  text: message,
                  sharePositionOrigin: box == null
                      ? null
                      : box.localToGlobal(Offset.zero) & box.size,
                ),
              );
            }),
            child: const Text('Compartilhar só a mensagem'),
          ),
        ],
      );
    },
  );
}
