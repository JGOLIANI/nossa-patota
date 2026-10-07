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
  final form = GlobalKey<FormState>();
  String modality = 'futsal', timezone = 'America/Sao_Paulo';
  String view = 'welcome';
  int step = 0;
  bool busy = false;
  SharedPreferences? prefs;
  String get draftKey => 'patota.onboarding.${widget.store.backend.userId}';
  int get teamSize => {'futsal': 5, 'society': 7, 'campo': 11}[modality] ?? 5;

  static const zones = {
    'America/Sao_Paulo': 'Brasília · São Paulo',
    'America/Manaus': 'Manaus',
    'America/Recife': 'Recife',
    'America/Fortaleza': 'Fortaleza',
    'America/Rio_Branco': 'Rio Branco',
    'Europe/Lisbon': 'Lisboa',
    'UTC': 'UTC',
  };

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
    setState(() {
      final savedModality = p.getString('$draftKey.modality');
      if (modalityLabels.containsKey(savedModality)) modality = savedModality!;
      final savedZone = p.getString('$draftKey.timezone');
      if (zones.containsKey(savedZone)) timezone = savedZone!;
      final savedStep = p.getInt('$draftKey.step') ?? 0;
      step = name.text.trim().isEmpty ? 0 : savedStep.clamp(0, 3);
    });
    name.addListener(saveDraft);
  }

  void saveDraft() {
    prefs?.setString('$draftKey.name', name.text);
    prefs?.setString('$draftKey.modality', modality);
    prefs?.setString('$draftKey.timezone', timezone);
    prefs?.setInt('$draftKey.step', step);
  }

  @override
  void dispose() {
    name.removeListener(saveDraft);
    name.dispose();
    code.dispose();
    super.dispose();
  }

  void back() {
    if (busy) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      if (view == 'create' && step > 0) {
        step--;
      } else {
        view = 'welcome';
      }
    });
    saveDraft();
  }

  void next() {
    if (step == 0 && !form.currentState!.validate()) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() => step++);
    saveDraft();
  }

  Future<void> submit() async {
    if (view == 'join' && !form.currentState!.validate()) return;
    FocusManager.instance.primaryFocus?.unfocus();
    final creating = view == 'create';
    final key = draftKey;
    setState(() => busy = true);
    final ok = await perform(
      context,
      () => creating
          ? widget.store.createPatota(name.text.trim(), modality, timezone)
          : widget.store.joinPatota(code.text.trim()),
    );
    if (ok && creating) {
      for (final suffix in ['name', 'modality', 'timezone', 'step']) {
        await prefs?.remove('$key.$suffix');
      }
    }
    if (mounted) {
      setState(() => busy = false);
      if (ok) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle_rounded),
                const SizedBox(width: PatotaSpace.md),
                Expanded(
                  child: Text(
                    creating
                        ? 'Sua patota está pronta! Bora jogar.'
                        : 'Você entrou na patota. Bom jogo!',
                  ),
                ),
              ],
            ),
          ),
        );
        if (Navigator.canPop(context)) Navigator.pop(context);
      }
    }
  }

  Future<void> selectPatota(String id) async {
    setState(() => busy = true);
    final ok = await perform(context, () => widget.store.choosePatota(id));
    if (mounted) {
      setState(() => busy = false);
      if (ok && Navigator.canPop(context)) Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: view == 'welcome' && !busy,
    onPopInvokedWithResult: (didPop, result) {
      if (!didPop) back();
    },
    child: Scaffold(
      appBar: AppBar(
        title: Text(
          view == 'create'
              ? 'Nova patota'
              : view == 'join'
              ? 'Entre para o time'
              : 'Suas patotas',
        ),
        leading: view != 'welcome'
            ? IconButton(
                tooltip: 'Voltar',
                onPressed: busy ? null : back,
                icon: const Icon(Icons.arrow_back_rounded),
              )
            : null,
      ),
      body: SafeArea(
        bottom: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 512),
            child: Form(
              key: form,
              child: ListView(
                padding: const EdgeInsets.all(PatotaSpace.lg),
                children: [
                  if (widget.store.error != null)
                    _Notice(
                      icon: Icons.error_outline_rounded,
                      message: widget.store.error!,
                      isError: true,
                    ),
                  if (view == 'welcome') ...welcome(context),
                  if (view == 'create') ...[
                    ProgressTrack(
                      value: (step + 1) / 4,
                      label: 'Etapa ${step + 1} de 4',
                      detail: 'Uma coisa de cada vez. Seu rascunho fica salvo.',
                    ),
                    const SizedBox(height: PatotaSpace.xxl),
                    AnimatedSwitcher(
                      duration: MediaQuery.disableAnimationsOf(context)
                          ? Duration.zero
                          : const Duration(milliseconds: 180),
                      child: KeyedSubtree(
                        key: ValueKey(step),
                        child: stepContent(context),
                      ),
                    ),
                  ],
                  if (view == 'join') ...join(context),
                  const SizedBox(height: PatotaSpace.xl),
                ],
              ),
            ),
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 512),
            child: Padding(
              padding: const EdgeInsets.all(PatotaSpace.lg),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  PrimaryButton(
                    label: view == 'join'
                        ? 'Entrar na patota'
                        : view == 'create'
                        ? step < 3
                              ? 'Continuar'
                              : 'Criar minha patota'
                        : name.text.isEmpty
                        ? 'Criar minha patota'
                        : 'Continuar criação',
                    icon: view == 'create' && step == 3
                        ? Icons.check_rounded
                        : Icons.arrow_forward_rounded,
                    loading: busy,
                    onPressed: busy
                        ? null
                        : view == 'welcome'
                        ? () => setState(() => view = 'create')
                        : view == 'create' && step < 3
                        ? next
                        : submit,
                  ),
                  if (view == 'welcome')
                    TextButton(
                      onPressed: busy
                          ? null
                          : () => setState(() => view = 'join'),
                      child: const Text('Já tenho um código de convite'),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );

  List<Widget> welcome(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return [
      if (widget.store.snapshot.patotas.isNotEmpty) ...[
        Text(
          'Sua turma está aqui',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: PatotaSpace.sm),
        const Text('Escolha a patota que vai entrar em campo.'),
        const SizedBox(height: PatotaSpace.lg),
        for (final p in widget.store.snapshot.patotas)
          Card(
            margin: const EdgeInsets.only(bottom: PatotaSpace.md),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: scheme.primaryContainer,
                foregroundColor: scheme.primary,
                child: const Icon(Icons.groups_rounded),
              ),
              title: Text(
                p.name,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text(modalityLabels[p.modality] ?? p.modality),
              trailing: p.id == widget.store.snapshot.activePatotaId
                  ? IosBadge('Atual', color: scheme.primary)
                  : const Icon(Icons.chevron_right_rounded),
              onTap: busy ? null : () => selectPatota(p.id),
            ),
          ),
        const SizedBox(height: PatotaSpace.xl),
      ] else ...[
        AppEmptyState(
          icon: Icons.groups_rounded,
          title: 'Falta só reunir a turma',
          message: 'Crie sua patota ou use o código de quem organiza o jogo.',
        ),
        const SizedBox(height: PatotaSpace.lg),
      ],
      _Notice(
        icon: Icons.sports_soccer_rounded,
        message: widget.store.snapshot.patotas.isEmpty
            ? 'Sua patota, sua história. Organize presenças, monte times e acompanhe os números da turma.'
            : 'Mais uma turma para jogar? Crie outra patota ou entre com um convite.',
      ),
      TextButton(
        onPressed: busy ? null : () => perform(context, widget.store.signOut),
        style: TextButton.styleFrom(foregroundColor: scheme.onSurfaceVariant),
        child: const Text('Sair da conta'),
      ),
    ];
  }

  Widget stepContent(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: switch (step) {
        0 => [
          Text('Como a turma se chama?', style: text.headlineSmall),
          const SizedBox(height: PatotaSpace.sm),
          const Text(
            'Vale o nome do bairro, da resenha ou aquele apelido que pegou.',
          ),
          const SizedBox(height: PatotaSpace.xl),
          TextFormField(
            controller: name,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.next,
            maxLength: 80,
            decoration: const InputDecoration(
              labelText: 'Nome da patota',
              hintText: 'Ex.: Pelada de quinta',
              prefixIcon: Icon(Icons.groups_rounded),
            ),
            validator: (v) => (v ?? '').trim().length < 2
                ? 'Informe um nome com pelo menos 2 letras para continuar.'
                : null,
            onFieldSubmitted: (_) => busy ? null : next(),
          ),
        ],
        1 => [
          Text('Como sua patota joga?', style: text.headlineSmall),
          const SizedBox(height: PatotaSpace.sm),
          const Text(
            'A modalidade prepara uma sugestão de tamanho para os times.',
          ),
          const SizedBox(height: PatotaSpace.xl),
          for (final entry in modalityLabels.entries)
            _ModalityOption(
              title: entry.value,
              detail:
                  '${{'futsal': 5, 'society': 7, 'campo': 11}[entry.key]} jogadores por time',
              selected: entry.key == modality,
              onTap: () {
                setState(() => modality = entry.key);
                saveDraft();
              },
            ),
        ],
        2 => [
          Text('No horário da sua turma', style: text.headlineSmall),
          const SizedBox(height: PatotaSpace.sm),
          const Text('Qual fuso deve ser usado para os horários das partidas?'),
          const SizedBox(height: PatotaSpace.xl),
          choice('Fuso horário', timezone, zones.keys.toList(), (v) {
            setState(() => timezone = v);
            saveDraft();
          }, labels: zones),
          const SizedBox(height: PatotaSpace.lg),
          _Notice(
            icon: Icons.info_rounded,
            message:
                '$teamSize jogadores por time como ponto de partida. Você pode ajustar capacidade, cores e agenda nas configurações antes do primeiro jogo.',
          ),
        ],
        _ => [
          Text('Tudo pronto para começar?', style: text.headlineSmall),
          const SizedBox(height: PatotaSpace.sm),
          const Text('Confira sua patota antes de chamar a turma.'),
          const SizedBox(height: PatotaSpace.xl),
          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name.text.trim(), style: text.headlineSmall),
                const SizedBox(height: PatotaSpace.lg),
                _ReviewRow(
                  Icons.sports_soccer_rounded,
                  modalityLabels[modality] ?? modality,
                ),
                const SizedBox(height: PatotaSpace.md),
                _ReviewRow(
                  Icons.groups_rounded,
                  '$teamSize jogadores por time · sugestão inicial',
                ),
                const SizedBox(height: PatotaSpace.md),
                _ReviewRow(Icons.schedule_rounded, zones[timezone] ?? timezone),
              ],
            ),
          ),
          const SizedBox(height: PatotaSpace.lg),
          const _Notice(
            icon: Icons.share_rounded,
            message:
                'Depois de criar, abra Configurações da patota para copiar ou compartilhar seu código e convidar os jogadores.',
          ),
        ],
      },
    );
  }

  List<Widget> join(BuildContext context) => [
    AppEmptyState(
      icon: Icons.confirmation_number_rounded,
      title: 'Tem convite? Bora entrar.',
      message: 'Peça o código a quem organiza a patota e digite aqui.',
    ),
    const SizedBox(height: PatotaSpace.xl),
    TextFormField(
      controller: code,
      textCapitalization: TextCapitalization.characters,
      textAlign: TextAlign.center,
      autocorrect: false,
      enableSuggestions: false,
      maxLength: 8,
      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
        fontWeight: FontWeight.w800,
        letterSpacing: 4,
      ),
      decoration: const InputDecoration(
        labelText: 'Código da patota',
        hintText: 'K7M4X2AB',
      ),
      validator: (v) => (v ?? '').trim().isEmpty
          ? 'Digite o código do convite para entrar.'
          : null,
      onFieldSubmitted: (_) => busy ? null : submit(),
    ),
    const SizedBox(height: PatotaSpace.lg),
    const _Notice(
      icon: Icons.shield_rounded,
      message:
          'Ao entrar, seu perfil fica disponível para os membros dessa patota. O compartilhamento externo é sempre manual.',
    ),
  ];
}

class _ModalityOption extends StatelessWidget {
  const _ModalityOption({
    required this.title,
    required this.detail,
    required this.selected,
    required this.onTap,
  });
  final String title, detail;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: PatotaSpace.md),
      child: Semantics(
        button: true,
        selected: selected,
        label: '$title, $detail',
        child: Material(
          color: selected ? scheme.primaryContainer : scheme.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(PatotaRadius.lg),
            side: BorderSide(
              color: selected ? scheme.primary : scheme.outlineVariant,
              width: selected ? 2 : 1,
            ),
          ),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(PatotaRadius.lg),
            child: Padding(
              padding: const EdgeInsets.all(PatotaSpace.lg),
              child: Row(
                children: [
                  Icon(
                    Icons.sports_soccer_rounded,
                    color: scheme.primary,
                    size: 32,
                  ),
                  const SizedBox(width: PatotaSpace.lg),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: PatotaSpace.xs),
                        Text(
                          detail,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    selected
                        ? Icons.check_circle_rounded
                        : Icons.radio_button_unchecked_rounded,
                    color: selected ? scheme.primary : scheme.onSurfaceVariant,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow(this.icon, this.label);
  final IconData icon;
  final String label;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, color: Theme.of(context).colorScheme.primary),
      const SizedBox(width: PatotaSpace.md),
      Expanded(child: Text(label)),
    ],
  );
}

class _Notice extends StatelessWidget {
  const _Notice({
    required this.icon,
    required this.message,
    this.isError = false,
  });
  final IconData icon;
  final String message;
  final bool isError;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.symmetric(vertical: PatotaSpace.sm),
      padding: const EdgeInsets.all(PatotaSpace.lg),
      decoration: BoxDecoration(
        color: isError ? scheme.errorContainer : scheme.surfaceContainer,
        borderRadius: BorderRadius.circular(PatotaRadius.lg),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: isError ? scheme.error : scheme.primary),
          const SizedBox(width: PatotaSpace.md),
          Expanded(child: Text(message)),
        ],
      ),
    );
  }
}
