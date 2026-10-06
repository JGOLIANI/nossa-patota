import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../data/backend.dart';
import '../store.dart';
import 'common.dart';

class PatotasPage extends StatefulWidget {
  const PatotasPage(this.store, {super.key});
  final AppStore store;
  @override
  State<PatotasPage> createState() => _PatotasState();
}

class _PatotasState extends State<PatotasPage> {
  final name = TextEditingController(), code = TextEditingController();
  String modality = 'futsal', timezone = 'America/Sao_Paulo';
  bool create = true, busy = false;
  SharedPreferences? prefs;
  String get draftKey => 'patota.onboarding.${widget.store.backend.userId}';
  @override
  void initState() {
    super.initState();
    loadDraft();
  }

  Future<void> loadDraft() async {
    final p = await SharedPreferences.getInstance();
    if (!mounted) return;
    prefs = p;
    name.text = p.getString('$draftKey.name') ?? '';
    setState(() => modality = p.getString('$draftKey.modality') ?? 'futsal');
    name.addListener(saveDraft);
  }

  void saveDraft() {
    prefs?.setString('$draftKey.name', name.text);
    prefs?.setString('$draftKey.modality', modality);
  }

  @override
  void dispose() {
    name.removeListener(saveDraft);
    name.dispose();
    code.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    setState(() => busy = true);
    final ok = await perform(
      context,
      () => create
          ? widget.store.createPatota(name.text, modality, timezone)
          : widget.store.joinPatota(code.text),
    );
    if (mounted) {
      setState(() => busy = false);
      if (ok && Navigator.canPop(context)) {
        Navigator.pop(context);
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Suas patotas')),
    body: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 512),
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (widget.store.error != null)
              Panel(child: Text(widget.store.error!)),
            if (widget.store.snapshot.patotas.isNotEmpty) ...[
              const Heading('Escolha uma patota'),
              for (final p in widget.store.snapshot.patotas)
                Card(
                  child: ListTile(
                    title: Text(p.name),
                    subtitle: Text(
                      '${modalityLabels[p.modality] ?? p.modality} · ${p.timezone}',
                    ),
                    trailing: p.id == widget.store.snapshot.activePatotaId
                        ? const Icon(Icons.check)
                        : const Icon(Icons.chevron_right),
                    onTap: busy
                        ? null
                        : () async {
                            await perform(
                              context,
                              () => widget.store.choosePatota(p.id),
                            );
                            if (context.mounted && Navigator.canPop(context)) {
                              Navigator.pop(context);
                            }
                          },
                  ),
                ),
            ],
            const Heading('Organize sua próxima partida'),
            const Text(
              'Crie uma patota ou entre com o código do organizador. Acompanhe presenças, monte times e preserve o histórico do grupo.',
            ),
            const SizedBox(height: 16),
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: true, label: Text('Criar patota')),
                ButtonSegment(value: false, label: Text('Entrar com código')),
              ],
              selected: {create},
              onSelectionChanged: busy
                  ? null
                  : (v) => setState(() => create = v.first),
            ),
            const SizedBox(height: 20),
            if (create) ...[
              field('Nome da patota', name),
              choice('Modalidade', modality, modalityLabels.keys.toList(), (v) {
                setState(() => modality = v);
                saveDraft();
              }, labels: modalityLabels),
              choice('Fuso horário', timezone, const [
                'America/Sao_Paulo',
                'America/Manaus',
                'America/Recife',
                'America/Fortaleza',
                'America/Rio_Branco',
                'Europe/Lisbon',
                'UTC',
              ], (v) => setState(() => timezone = v)),
              Panel(
                child: Text(
                  '${modalityLabels[modality]}: ${{'futsal': 5, 'society': 7, 'campo': 11}[modality]} jogadores por time como sugestão. Você pode ajustar capacidade e regras antes da primeira partida.',
                ),
              ),
            ] else
              TextField(
                controller: code,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(
                  labelText: 'Código da patota',
                  hintText: 'K7M4X2AB',
                ),
              ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: busy ? null : submit,
              child: Text(
                busy
                    ? 'Preparando sua patota…'
                    : create
                    ? 'Criar minha patota'
                    : 'Entrar na patota',
              ),
            ),
            TextButton(
              onPressed: busy
                  ? null
                  : () => perform(context, widget.store.signOut),
              child: const Text('Sair da conta'),
            ),
          ],
        ),
      ),
    ),
  );
}
