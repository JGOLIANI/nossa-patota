import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:image_picker/image_picker.dart';
import '../models.dart';
import '../store.dart';
import '../domain.dart';
import 'common.dart';
import 'auth.dart';
import 'settings.dart';
import 'patotas.dart';

class PlayersPage extends StatefulWidget {
  const PlayersPage(this.store, {super.key});
  final AppStore store;
  @override
  State<PlayersPage> createState() => _PlayersState();
}

class _PlayersState extends State<PlayersPage> {
  String query = '', status = 'todos';
  @override
  Widget build(BuildContext context) {
    final s = widget.store;
    final players =
        s.snapshot.players
            .where(
              (p) =>
                  (switch (status) {
                    'mensalistas' =>
                      p.type == 'mensalista' && p.status == 'ativo',
                    'visitantes' => p.type == 'visitante',
                    'goleiros' =>
                      p.position == 'goleiro' && p.status == 'ativo',
                    'inativos' => p.status == 'inativo',
                    _ => p.status == 'ativo',
                  }) &&
                  '${p.name} ${p.username}'.toLowerCase().contains(
                    query.toLowerCase(),
                  ),
            )
            .toList()
          ..sort((a, b) => a.name.compareTo(b.name));
    return ListView(
      padding: const EdgeInsets.all(PatotaSpace.lg),
      children: [
        CupertinoSearchTextField(
          placeholder: 'Buscar jogador',
          onChanged: (v) => setState(() => query = v),
        ),
        const SizedBox(height: PatotaSpace.md),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final filter in const {
                'todos': 'Todos',
                'mensalistas': 'Mensalistas',
                'visitantes': 'Visitantes',
                'goleiros': 'Goleiros',
                'inativos': 'Inativos',
              }.entries)
                Padding(
                  padding: const EdgeInsets.only(right: PatotaSpace.sm),
                  child: ChoiceChip(
                    label: Text(filter.value),
                    selected: status == filter.key,
                    showCheckmark: false,
                    onSelected: (_) => setState(() => status = filter.key),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: PatotaSpace.lg),
        if (players.isEmpty)
          AppEmptyState(
            icon: Icons.groups_rounded,
            title: query.isEmpty
                ? 'O elenco começa aqui'
                : 'Quem você procura?',
            message: query.isEmpty
                ? 'Adicione os jogadores da turma para preparar a próxima partida.'
                : 'Tente outro nome ou selecione um filtro diferente.',
            action: query.isEmpty && s.isAdmin
                ? PrimaryButton(
                    label: 'Adicionar jogador',
                    icon: Icons.person_add_rounded,
                    onPressed: () => openPage(context, PlayerForm(s)),
                  )
                : null,
          ),
        if (players.isNotEmpty)
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                for (final p in players) ...[
                  ListTile(
                    leading: SizedBox(
                      width: 48,
                      height: 48,
                      child: PlayerAvatar(p),
                    ),
                    title: Text(
                      p.name,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(
                      (s.stats[p.id]?.played ?? 0) > 0
                          ? '${s.stats[p.id]!.played} jogos · ${s.stats[p.id]!.goals} gols · ${s.stats[p.id]!.assists} assist.'
                          : '${p.position} · ${p.type} · sem partidas',
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => openPage(context, PlayerDetail(s, p.id)),
                  ),
                  if (p != players.last) const Divider(indent: 72),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

class PlayerForm extends StatefulWidget {
  const PlayerForm(this.store, {super.key, this.player});
  final AppStore store;
  final Player? player;
  @override
  State<PlayerForm> createState() => _PlayerFormState();
}

class _PlayerFormState extends State<PlayerForm> {
  final form = GlobalKey<FormState>();
  late final TextEditingController name, username;
  late String type, foot, position, status, role;
  late int level;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    final p = widget.player;
    name = TextEditingController(text: p?.name);
    username = TextEditingController(text: p?.username);
    type = p?.type ?? 'visitante';
    foot = p?.foot ?? 'direita';
    position = p?.position ?? 'linha';
    status = p?.status ?? 'ativo';
    role = p?.role ?? 'jogador';
    level = p?.level ?? 3;
  }

  @override
  void dispose() {
    name.dispose();
    username.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Frame(
    store: widget.store,
    title: widget.player == null ? 'Novo jogador' : 'Editar jogador',
    builder: (context) {
      if (!widget.store.isAdmin) {
        return const Center(child: Text('Acesso reservado ao administrador.'));
      }
      return Form(
        key: form,
        child: ListView(
          padding: const EdgeInsets.all(PatotaSpace.lg),
          children: [
            const Heading('Quem é o jogador?'),
            field('Nome completo', name),
            field('Nome de usuário', username),
            choice('Tipo', type, [
              'mensalista',
              'visitante',
            ], (v) => setState(() => type = v)),
            const Heading('Como joga?'),
            choice('Posição', position, [
              'linha',
              'goleiro',
            ], (v) => setState(() => position = v)),
            choice('Pé dominante', foot, [
              'direita',
              'esquerda',
              'ambidestro',
            ], (v) => setState(() => foot = v)),
            choice('Status', status, [
              'ativo',
              'inativo',
            ], (v) => setState(() => status = v)),
            Text('Nível informado: $level'),
            Slider.adaptive(
              min: 1,
              max: 5,
              divisions: 4,
              value: level.toDouble(),
              label: '$level',
              onChanged: (v) => setState(() => level = v.round()),
            ),
            const Text(
              'O nível informado ajuda a equilibrar os times. Ele não altera as estatísticas das partidas.',
            ),
            const SizedBox(height: PatotaSpace.lg),
            PrimaryButton(
              label: 'Salvar jogador',
              icon: Icons.check_rounded,
              loading: busy,
              onPressed: busy
                  ? null
                  : () async {
                      if (!form.currentState!.validate()) return;
                      final normalized = username.text.trim().toLowerCase();
                      if (!RegExp(r'^[a-z0-9._-]+$').hasMatch(normalized)) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                              'Use um usuário sem espaços ou acentos.',
                            ),
                          ),
                        );
                        return;
                      }
                      setState(() => busy = true);
                      final ok = await perform(
                        context,
                        () => widget.store.run(() async {
                          final patch = <String, dynamic>{
                            'full_name': name.text.trim(),
                            'username': normalized,
                            'player_type': type,
                            'position': position,
                            'dominant_foot': foot,
                            'status': status,
                            'level': level,
                          };
                          if (widget.player == null) {
                            await widget.store.backend.insert('players', {
                              ...patch,
                              'role': 'jogador',
                              'must_change_password': false,
                              'photo_url': null,
                              'user_id': null,
                            });
                          } else {
                            await widget.store.backend.update(
                              'players',
                              widget.player!.id,
                              patch,
                            );
                          }
                        }, admin: true),
                        successMessage: 'Jogador salvo',
                      );
                      if (mounted) {
                        setState(() => busy = false);
                        if (ok && context.mounted) Navigator.pop(context);
                      }
                    },
            ),
          ],
        ),
      );
    },
  );
}

Widget statistics(BuildContext context, AppStore store, Player p) {
  final stats = store.stats[p.id] ?? PlayerStats(p.id, []);
  final metrics = <({String label, String value, IconData icon, Color color})>[
    (
      label: 'Partidas',
      value: '${stats.played}',
      icon: Icons.sports_soccer_rounded,
      color: PatotaColors.primary,
    ),
    (
      label: 'Gols',
      value: '${stats.goals}',
      icon: Icons.sports_soccer_rounded,
      color: PatotaColors.primary,
    ),
    (
      label: 'Assistências',
      value: '${stats.assists}',
      icon: Icons.assistant_rounded,
      color: PatotaColors.info,
    ),
    (
      label: 'Vitórias',
      value: '${stats.wins}',
      icon: Icons.emoji_events_rounded,
      color: PatotaColors.primary,
    ),
    (
      label: 'Empates',
      value: '${stats.draws}',
      icon: Icons.balance_rounded,
      color: PatotaColors.info,
    ),
    (
      label: 'Derrotas',
      value: '${stats.losses}',
      icon: Icons.flag_rounded,
      color: PatotaColors.error,
    ),
    if (stats.keeperMatches > 0)
      (
        label: 'Gols sofridos / jogo',
        value: stats.goalsAgainstPerMatch.toStringAsFixed(2),
        icon: Icons.sports_handball_rounded,
        color: PatotaColors.info,
      ),
  ];
  return Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const Heading('História em números'),
      LayoutBuilder(
        builder: (context, constraints) {
          final columns = constraints.maxWidth >= 460 ? 3 : 2;
          final width =
              (constraints.maxWidth - PatotaSpace.md * (columns - 1)) / columns;
          return Wrap(
            spacing: PatotaSpace.md,
            runSpacing: PatotaSpace.md,
            children: [
              for (final metric in metrics)
                SizedBox(
                  width: width,
                  child: StatCard(
                    label: metric.label,
                    value: metric.value,
                    icon: metric.icon,
                    color: metric.color,
                  ),
                ),
            ],
          );
        },
      ),
      const SizedBox(height: PatotaSpace.lg),
      Panel(
        child: ProgressTrack(
          value: stats.pointsPct / 100,
          label: 'Aproveitamento: ${stats.pointsPct.toStringAsFixed(1)}%',
          detail: stats.played == 0
              ? 'Sua evolução aparece depois da primeira partida encerrada.'
              : '${stats.points} de ${stats.played * 3} pontos possíveis · ${stats.played} partidas',
        ),
      ),
    ],
  );
}

Widget playerHero(BuildContext context, Player p) => Panel(
  child: Column(
    children: [
      SizedBox(width: 80, height: 80, child: PlayerAvatar(p)),
      const SizedBox(height: PatotaSpace.md),
      Text(
        p.name,
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.headlineSmall,
      ),
      const SizedBox(height: PatotaSpace.xs),
      Text('@${p.username}', style: Theme.of(context).textTheme.bodySmall),
      const SizedBox(height: PatotaSpace.md),
      Wrap(
        alignment: WrapAlignment.center,
        spacing: PatotaSpace.sm,
        runSpacing: PatotaSpace.sm,
        children: [
          IosBadge(p.position == 'goleiro' ? 'Goleiro' : 'Jogador de linha'),
          IosBadge('Pé ${p.foot}'),
          IosBadge(p.type == 'mensalista' ? 'Mensalista' : 'Visitante'),
          if (p.status == 'inativo')
            IosBadge('Inativo', color: PatotaColors.error),
        ],
      ),
    ],
  ),
);

class PlayerDetail extends StatelessWidget {
  const PlayerDetail(this.store, this.id, {super.key});
  final AppStore store;
  final String id;
  @override
  Widget build(BuildContext context) => Frame(
    store: store,
    title: 'Ficha do jogador',
    builder: (context) {
      final p = store.snapshot.player(id);
      if (p == null) {
        return const Center(child: Text('Jogador não encontrado.'));
      }
      final logs = (computeLogs(store.snapshot)[id] ?? []).reversed;
      return ListView(
        padding: const EdgeInsets.all(PatotaSpace.lg),
        children: [
          playerHero(context, p),
          statistics(context, store, p),
          const Heading('Destaques conquistados'),
          for (final type in awardLabels.keys)
            Panel(
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  type == 'goleiro_menos_vazado'
                      ? Icons.sports_handball_rounded
                      : Icons.emoji_events_rounded,
                  color: Theme.of(context).colorScheme.primary,
                ),
                title: Text(awardLabels[type]!),
                subtitle: const Text('Prêmios de partidas apuradas'),
                trailing: Text(
                  '${store.snapshot.awards.where((a) => a.playerId == id && a.type == type).length}',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
              ),
            ),
          if (store.isAdmin) ...[
            PrimaryButton(
              label: 'Editar jogador',
              onPressed: () => openPage(context, PlayerForm(store, player: p)),
              icon: Icons.edit_rounded,
            ),
            if (p.userId != null && p.id != store.current?.id)
              const Panel(
                child: Text(
                  'O jogador recupera a própria senha pelo e-mail, na tela de acesso.',
                ),
              ),
            if (p.id != store.current?.id)
              TextButton(
                style: TextButton.styleFrom(
                  foregroundColor: Theme.of(context).colorScheme.error,
                ),
                onPressed: store.busy
                    ? null
                    : () async {
                        if (await confirm(
                              context,
                              'Desativar jogador?',
                              'O jogador sai do elenco ativo. Seu histórico será preservado.',
                            ) &&
                            context.mounted) {
                          final ok = await perform(
                            context,
                            () => store.run(
                              () => store.backend.delete('players', id),
                              admin: true,
                            ),
                          );
                          if (ok && context.mounted) Navigator.pop(context);
                        }
                      },
                child: const Text('Desativar jogador'),
              ),
          ],
          const Heading('Histórico'),
          if (logs.isEmpty)
            const AppEmptyState(
              icon: Icons.sports_soccer_rounded,
              title: 'A história está começando',
              message:
                  'As partidas encerradas vão aparecer aqui, com gols, assistências e resultados.',
            ),
          for (final log in logs)
            Panel(
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: IosBadge(
                  {'V': 'Vitória', 'E': 'Empate', 'D': 'Derrota'}[log.result] ??
                      log.result,
                  color: log.result == 'V'
                      ? PatotaColors.primary
                      : log.result == 'D'
                      ? PatotaColors.error
                      : PatotaColors.info,
                ),
                title: Text(
                  '${prettyDate(log.date)} · ${log.scoreFor} × ${log.scoreAgainst}',
                ),
                subtitle: Text(
                  '${log.goals} gols • ${log.assists} assistências • ${log.position}',
                ),
              ),
            ),
        ],
      );
    },
  );
}

class ProfilePage extends StatelessWidget {
  const ProfilePage(this.store, {super.key});
  final AppStore store;
  @override
  Widget build(BuildContext context) {
    final p = store.current;
    return ListView(
      padding: EdgeInsets.fromLTRB(
        PatotaSpace.lg,
        PatotaSpace.lg,
        PatotaSpace.lg,
        PatotaSpace.touch +
            PatotaSpace.lg +
            MediaQuery.viewPaddingOf(context).bottom,
      ),
      children: [
        if (p == null)
          const Panel(
            child: Text(
              'Sua conta não está vinculada a um jogador. Confira o cadastro com o administrador.',
            ),
          ),
        if (p != null) ...[
          playerHero(context, p),
          PrimaryButton(
            label: 'Minha ficha e histórico',
            icon: Icons.history_rounded,
            onPressed: () => openPage(context, PlayerDetail(store, p.id)),
          ),
          statistics(context, store, p),
          const Heading('Seu perfil'),
          OutlinedButton.icon(
            onPressed: store.busy
                ? null
                : () => perform(context, () async {
                    final file = await ImagePicker().pickImage(
                      source: ImageSource.gallery,
                      maxWidth: 512,
                      maxHeight: 512,
                      imageQuality: 85,
                    );
                    if (file == null) return;
                    final bytes = await file.readAsBytes();
                    if (bytes.length > 5 * 1024 * 1024) {
                      throw Exception('Escolha uma imagem de até 5 MB.');
                    }
                    await store.run(() async {
                      final url = await store.backend.uploadAvatar(
                        p.id,
                        bytes,
                        file.name.toLowerCase().endsWith('.png')
                            ? 'png'
                            : 'jpg',
                      );
                      await store.backend.update('players', p.id, {
                        'photo_url': url,
                      });
                    });
                  }),
            icon: const Icon(Icons.camera_alt_rounded),
            label: const Text('Alterar foto'),
          ),
          if (p.photo != null)
            TextButton(
              onPressed: () => perform(
                context,
                () => store.run(
                  () => store.backend.update('players', p.id, {
                    'photo_url': null,
                  }),
                ),
              ),
              child: const Text('Remover foto do perfil'),
            ),
          OutlinedButton(
            onPressed: () => openPage(context, PasswordPage(store)),
            child: const Text('Trocar senha'),
          ),
        ],
        const Heading('Conta e patota'),
        Panel(
          child: Column(
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.groups_rounded),
                title: Text(store.snapshot.patota?.name ?? 'Sua patota'),
                subtitle: const Text('Criar, entrar ou trocar de patota'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => openPage(context, PatotasPage(store)),
              ),
              const Divider(),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.email_rounded),
                title: const Text('E-mail da conta'),
                subtitle: Text(
                  store.backend.accountEmail ?? 'Vincule um e-mail real',
                ),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => openPage(context, AccountEmailPage(store)),
              ),
            ],
          ),
        ),
        if (store.isAdmin)
          OutlinedButton.icon(
            onPressed: () => openPage(context, AdminPage(store)),
            icon: const Icon(Icons.admin_panel_settings_rounded),
            label: const Text('Administração'),
          ),
        if (store.backend.demo)
          const Panel(
            child: Text(
              'Modo demonstração. As alterações são salvas apenas neste aparelho.',
            ),
          ),
        TextButton(
          onPressed: store.busy ? null : () => perform(context, store.signOut),
          child: const Text('Sair da conta'),
        ),
      ],
    );
  }
}
