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
      padding: const EdgeInsets.all(16),
      children: [
        CupertinoSearchTextField(
          placeholder: 'Buscar jogador',
          onChanged: (v) => setState(() => query = v),
        ),
        const SizedBox(height: 12),
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
                  padding: const EdgeInsets.only(right: 6),
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
        const SizedBox(height: 16),
        if (players.isEmpty)
          const Panel(child: Text('Nenhum jogador encontrado.')),
        if (players.isNotEmpty)
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                for (final p in players) ...[
                  ListTile(
                    leading: PlayerAvatar(p),
                    title: Text(p.name),
                    subtitle: Text(
                      (s.stats[p.id]?.played ?? 0) > 0
                          ? '${s.stats[p.id]!.played} jogos · ${s.stats[p.id]!.goals} gols · ${s.stats[p.id]!.assists} assist.'
                          : '${p.position} · ${p.type} · sem partidas',
                    ),
                    trailing: const Icon(Icons.chevron_right),
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
          padding: const EdgeInsets.all(16),
          children: [
            field('Nome completo', name),
            field('Nome de usuário', username),
            choice('Tipo', type, [
              'mensalista',
              'visitante',
            ], (v) => setState(() => type = v)),
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
              'O jogador cria o próprio acesso usando este nome de usuário.',
            ),
            const SizedBox(height: 16),
            FilledButton(
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
                      );
                      if (mounted) {
                        setState(() => busy = false);
                        if (ok && context.mounted) Navigator.pop(context);
                      }
                    },
              child: const Text('Salvar jogador'),
            ),
          ],
        ),
      );
    },
  );
}

Widget statistics(BuildContext context, AppStore store, Player p) {
  final stats = store.stats[p.id] ?? PlayerStats(p.id, []);
  final metrics = <String, String>{
    'Partidas': '${stats.played}',
    'Gols': '${stats.goals}',
    'Assistências': '${stats.assists}',
    'Vitórias': '${stats.wins}',
    'Empates': '${stats.draws}',
    'Derrotas': '${stats.losses}',
    'Aproveitamento': '${stats.pointsPct.toStringAsFixed(1)}%',
    if (stats.keeperMatches > 0)
      'Gols sofridos / jogo': stats.goalsAgainstPerMatch.toStringAsFixed(2),
  };
  return Wrap(
    spacing: 12,
    runSpacing: 12,
    children: metrics.entries
        .map(
          (e) => SizedBox(
            width: 140,
            child: Panel(
              child: Column(
                children: [
                  Text(
                    e.value,
                    style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    e.key,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
        )
        .toList(),
  );
}

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
        padding: const EdgeInsets.all(16),
        children: [
          Panel(
            child: ListTile(
              leading: PlayerAvatar(p),
              title: Text(p.name),
              subtitle: Text(
                '@${p.username}\n${p.position} • ${p.type} • pé ${p.foot}',
              ),
            ),
          ),
          statistics(context, store, p),
          const Heading('Prêmios'),
          for (final type in awardLabels.keys)
            ListTile(
              title: Text(awardLabels[type]!),
              trailing: Text(
                '${store.snapshot.awards.where((a) => a.playerId == id && a.type == type).length}',
              ),
            ),
          if (store.isAdmin) ...[
            FilledButton.icon(
              onPressed: () => openPage(context, PlayerForm(store, player: p)),
              icon: const Icon(Icons.edit),
              label: const Text('Editar jogador'),
            ),
            if (p.userId != null && p.id != store.current?.id)
              const Panel(
                child: Text(
                  'O jogador recupera a própria senha pelo e-mail, na tela de acesso.',
                ),
              ),
            if (p.id != store.current?.id)
              TextButton(
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
            const Panel(child: Text('Nenhuma partida encerrada.')),
          for (final log in logs)
            Panel(
              child: ListTile(
                title: Text(
                  '${prettyDate(log.date)} • ${log.result} • ${log.scoreFor} × ${log.scoreAgainst}',
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
      padding: const EdgeInsets.all(16),
      children: [
        ListTile(
          title: Text(store.snapshot.patota?.name ?? 'Sua patota'),
          subtitle: const Text('Criar, entrar ou trocar de patota'),
          trailing: const Icon(Icons.groups),
          onTap: () => openPage(context, PatotasPage(store)),
        ),
        ListTile(
          title: const Text('E-mail da conta'),
          subtitle: Text(
            store.backend.accountEmail ?? 'Vincule um e-mail real',
          ),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => openPage(context, AccountEmailPage(store)),
        ),
        if (p == null)
          const Panel(
            child: Text(
              'Sua conta não está vinculada a um jogador. Confira o cadastro com o administrador.',
            ),
          ),
        if (p != null) ...[
          Panel(
            child: ListTile(
              leading: PlayerAvatar(p),
              title: Text(p.name),
              subtitle: Text('@${p.username} • ${p.role}'),
            ),
          ),
          statistics(context, store, p),
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
            icon: const Icon(Icons.camera_alt),
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
          OutlinedButton(
            onPressed: () => openPage(context, PlayerDetail(store, p.id)),
            child: const Text('Minha ficha e histórico'),
          ),
        ],
        if (store.isAdmin)
          FilledButton(
            onPressed: () => openPage(context, AdminPage(store)),
            child: const Text('Administração'),
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
