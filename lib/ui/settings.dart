import 'package:flutter/material.dart';
import '../data/backend.dart';
import '../models.dart';
import '../store.dart';
import 'common.dart';
import 'operations.dart';

class AdminPage extends StatelessWidget {
  const AdminPage(this.store, {super.key});
  final AppStore store;
  @override
  Widget build(BuildContext context) => Frame(
    store: store,
    title: 'Administração',
    builder: (context) {
      if (!store.isAdmin) {
        return const Center(child: Text('Acesso reservado ao administrador.'));
      }
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Panel(
            child: ListTile(
              title: const Text('Identidade, times e convite'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => openPage(context, PatotaConfigPage(store)),
            ),
          ),
          Panel(
            child: ListTile(
              title: const Text('Agenda da patota'),
              subtitle: Text(
                '${weekdays[store.snapshot.settings.weekday]} às ${store.snapshot.settings.time}',
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => openPage(context, SettingsPage(store)),
            ),
          ),
          const Heading('Contas e permissões'),
          for (final p in store.snapshot.players.where((p) => p.userId != null))
            Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(p.name),
                  if (p.id == store.current?.id)
                    const Text('Você • administrador')
                  else
                    choice('Permissão', p.role, ['jogador', 'admin'], (
                      role,
                    ) async {
                      if (await confirm(
                            context,
                            'Alterar permissão?',
                            '${p.name} passará a ter acesso de $role.',
                          ) &&
                          context.mounted) {
                        await perform(
                          context,
                          () => store.run(
                            () => store.backend.rpc('set_member_role', {
                              'p_patota_id': store.snapshot.activePatotaId,
                              'p_user_id': p.userId,
                              'p_role': role,
                            }),
                            admin: true,
                          ),
                        );
                      }
                    }),
                ],
              ),
            ),
          if (store.backend is DemoBackend)
            TextButton(
              onPressed: store.busy
                  ? null
                  : () async {
                      if (await confirm(
                            context,
                            'Restaurar demonstração?',
                            'As alterações locais serão substituídas pelos dados fictícios originais.',
                          ) &&
                          context.mounted) {
                        await perform(
                          context,
                          () => store.run(
                            (store.backend as DemoBackend).reset,
                            admin: true,
                          ),
                        );
                      }
                    },
              child: const Text('Restaurar dados da demonstração'),
            ),
        ],
      );
    },
  );
}

class SettingsPage extends StatefulWidget {
  const SettingsPage(this.store, {super.key});
  final AppStore store;
  @override
  State<SettingsPage> createState() => _SettingsState();
}

class _SettingsState extends State<SettingsPage> {
  late final TextEditingController time, location, url, max, weeks;
  late int weekday;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    final s = widget.store.snapshot.settings;
    weekday = s.weekday;
    time = TextEditingController(text: s.time);
    location = TextEditingController(text: s.location);
    url = TextEditingController(text: s.locationUrl);
    max = TextEditingController(text: '${s.maxPlayers}');
    weeks = TextEditingController(text: '${s.weeksAhead}');
  }

  @override
  void dispose() {
    for (final c in [time, location, url, max, weeks]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Frame(
    store: widget.store,
    title: 'Agenda da patota',
    builder: (context) {
      if (!widget.store.isAdmin) {
        return const Center(child: Text('Acesso reservado ao administrador.'));
      }
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          choice(
            'Dia da semana',
            '$weekday',
            List.generate(7, (i) => '$i'),
            (v) => setState(() => weekday = int.parse(v)),
            labels: {for (var i = 0; i < 7; i++) '$i': weekdays[i]},
          ),
          field('Horário (HH:MM)', time),
          field('Nome da quadra', location),
          TextField(
            controller: url,
            decoration: const InputDecoration(labelText: 'Link do Google Maps'),
          ),
          field('Vagas (0 = sem limite)', max, number: true),
          field('Semanas futuras (0 = desativado)', weeks, number: true),
          const Panel(
            child: Text(
              'O aplicativo cria as próximas partidas quando um administrador abre a patota. Ao mudar o dia, cancela rascunhos futuros sem respostas e preserva o histórico.',
            ),
          ),
          FilledButton(
            onPressed: busy
                ? null
                : () async {
                    final capacity = int.tryParse(max.text),
                        ahead = int.tryParse(weeks.text),
                        mapUrl = Uri.tryParse(url.text.trim());
                    if (!RegExp(
                          r'^([01]\d|2[0-3]):[0-5]\d$',
                        ).hasMatch(time.text) ||
                        capacity == null ||
                        capacity < 0 ||
                        ahead == null ||
                        ahead < 0 ||
                        ahead > 12 ||
                        (url.text.isNotEmpty &&
                            (mapUrl == null ||
                                !['https', 'http'].contains(mapUrl.scheme)))) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Confira horário, vagas, semanas (0 a 12) e link.',
                          ),
                        ),
                      );
                      return;
                    }
                    setState(() => busy = true);
                    final ok = await perform(
                      context,
                      () => widget.store.updateSettings({
                        'weekday': weekday,
                        'start_time': time.text,
                        'location': location.text.trim(),
                        'location_url': url.text.trim(),
                        'max_players': capacity,
                        'weeks_ahead': ahead,
                      }),
                    );
                    if (mounted) {
                      setState(() => busy = false);
                      if (ok && context.mounted) Navigator.pop(context);
                    }
                  },
            child: const Text('Salvar agenda'),
          ),
        ],
      );
    },
  );
}
