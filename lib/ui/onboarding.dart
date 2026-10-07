import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../acquisition.dart';
import '../store.dart';
import 'auth.dart';
import 'common.dart';
import 'paywall.dart';
import 'onboarding_football.dart';

TextStyle? _headline(BuildContext context) {
  final largeText =
      MediaQuery.textScalerOf(context).scale(PatotaType.hero) >
      PatotaType.hero * 1.3;
  return Theme.of(context).textTheme.headlineLarge?.copyWith(
    fontSize: largeText && MediaQuery.sizeOf(context).width < 400
        ? PatotaType.heading
        : PatotaType.hero,
  );
}

/// The introduction is local to this installation. Existing accounts can
/// go straight to sign-in; a restored session never passes through this gate.
class EntryPage extends StatefulWidget {
  const EntryPage(this.store, {super.key});
  final AppStore store;
  @override
  State<EntryPage> createState() => _EntryState();
}

class _EntryState extends State<EntryPage> {
  SharedPreferences? preferences;
  IntroDraft draft = const IntroDraft();
  bool login = false, signup = false;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (!mounted) return;
      setState(() {
        preferences = prefs;
        draft = IntroDraft.load(prefs);
        login = draft.completed;
        error = null;
      });
    } catch (_) {
      if (mounted) {
        setState(() => error = 'Não foi possível abrir a introdução.');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (login || widget.store.backend.recoveryPending) {
      return LoginPage(widget.store, createAccount: signup);
    }
    if (error != null) {
      return Scaffold(
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(PatotaSpace.xl),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(error!),
                  TextButton(
                    onPressed: load,
                    child: const Text('Tentar novamente'),
                  ),
                  TextButton(
                    onPressed: () => setState(() => login = true),
                    child: const Text('Ir para o login'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }
    if (preferences == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return IntroFlow(
      preferences: preferences!,
      initialDraft: draft,
      onFinished: (createAccount) => setState(() {
        login = true;
        signup = createAccount;
      }),
    );
  }
}

/// A repeatable introduction for review, independent of the saved draft or
/// signed-in session. Finishing returns to the app's normal entry point.
class OnboardingPreviewPage extends StatefulWidget {
  const OnboardingPreviewPage({super.key});
  @override
  State<OnboardingPreviewPage> createState() => _OnboardingPreviewState();
}

class _OnboardingPreviewState extends State<OnboardingPreviewPage> {
  late final preferences = SharedPreferences.getInstance();

  void exit() =>
      Navigator.of(context).pushNamedAndRemoveUntil('/', (_) => false);

  @override
  Widget build(BuildContext context) => FutureBuilder<SharedPreferences>(
    future: preferences,
    builder: (context, snapshot) {
      if (snapshot.hasError) {
        return Scaffold(
          body: SafeArea(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Não foi possível abrir a introdução.'),
                  TextButton(
                    onPressed: exit,
                    child: const Text('Ir para o app'),
                  ),
                ],
              ),
            ),
          ),
        );
      }
      if (!snapshot.hasData) {
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      }
      return IntroFlow(
        preferences: snapshot.data!,
        saveProgress: false,
        onFinished: (_) => exit(),
      );
    },
  );
}

class IntroFlow extends StatefulWidget {
  const IntroFlow({
    super.key,
    required this.preferences,
    required this.onFinished,
    this.initialDraft = const IntroDraft(),
    this.saveProgress = true,
  });
  final SharedPreferences preferences;
  final IntroDraft initialDraft;
  final bool saveProgress;
  final ValueChanged<bool> onFinished;
  @override
  State<IntroFlow> createState() => _IntroState();
}

class _IntroState extends State<IntroFlow> {
  late IntroDraft draft = widget.initialDraft;
  bool busy = false;
  String? error;

  Future<bool> persist(IntroDraft next) async {
    if (busy) return false;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (widget.saveProgress) await next.save(widget.preferences);
      if (!mounted) return false;
      setState(() => draft = next);
      return true;
    } catch (_) {
      if (mounted) {
        setState(
          () =>
              error = 'Não foi possível salvar seu progresso. Tente novamente.',
        );
      }
      return false;
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> finish({bool existingAccount = false}) async {
    final next = existingAccount
        ? const IntroDraft(completed: true)
        : draft.copyWith(completed: true);
    if (await persist(next) && mounted) widget.onFinished(!existingAccount);
  }

  void next() {
    if (busy) return;
    if (draft.step == 4 && draft.role == IntroRole.player) {
      finish();
    } else {
      persist(draft.copyWith(step: draft.step + 1));
    }
  }

  void back() {
    if (!busy && draft.step > 0) persist(draft.copyWith(step: draft.step - 1));
  }

  @override
  Widget build(BuildContext context) {
    final isPlayer = draft.role == IntroRole.player;
    final canContinue =
        !busy &&
        (draft.step != 2 || draft.role != null) &&
        (draft.step != 3 || draft.goal != null);
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final label = switch (draft.step) {
      0 => 'Ver como funciona',
      3 => 'Ver meu caminho',
      4 => isPlayer ? 'Criar minha conta' : 'Conhecer o plano',
      _ => 'Continuar',
    };
    return PopScope(
      canPop: draft.step == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) back();
      },
      child: draft.step == 5
          ? PaywallPage(
              goal: draft.goal,
              onBack: back,
              onContinue: finish,
              loading: busy,
              error: error,
              onboardingProgress: 1,
            )
          : Scaffold(
              appBar: AppBar(
                title: const Text('Nossa Patota'),
                leading: draft.step == 0
                    ? null
                    : IconButton(
                        tooltip: 'Voltar',
                        onPressed: busy ? null : back,
                        icon: const Icon(Icons.arrow_back_rounded),
                      ),
              ),
              body: SafeArea(
                bottom: false,
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 560),
                    child: ListView(
                      padding: const EdgeInsets.all(PatotaSpace.xl),
                      children: [
                        ProgressTrack(
                          value: (draft.step + 1) / (isPlayer ? 5 : 6),
                          label:
                              'Etapa ${draft.step + 1} de ${isPlayer ? 5 : 6}',
                          detail: draft.step < 2
                              ? 'Veja o jogo acontecer.'
                              : widget.saveProgress
                              ? 'Seu caminho fica salvo neste aparelho.'
                              : 'Seu caminho para entrar em campo.',
                        ),
                        const SizedBox(height: PatotaSpace.xxl),
                        AnimatedSwitcher(
                          duration: PatotaMotion.duration(
                            context,
                            PatotaMotion.fast,
                          ),
                          child: Column(
                            key: ValueKey(draft.step),
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: content(context),
                          ),
                        ),
                        if (error != null) ...[
                          const SizedBox(height: PatotaSpace.lg),
                          Text(error!, style: TextStyle(color: scheme.error)),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
              bottomNavigationBar: SafeArea(
                top: false,
                child: Center(
                  heightFactor: 1,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 560),
                    child: Padding(
                      padding: const EdgeInsets.all(PatotaSpace.lg),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          FootballContinueButton(
                            progress: draft.step / (isPlayer ? 4 : 5),
                            label: label,
                            loading: busy,
                            onPressed: canContinue ? next : null,
                          ),
                          const SizedBox(height: PatotaSpace.sm),
                          Text(
                            draft.step == 2 && draft.role == null
                                ? 'Escolha como você participa para continuar.'
                                : draft.step == 3 && draft.goal == null
                                ? 'Escolha o que faz mais sentido para você.'
                                : 'Gratuito para sua turma. Sem cartão.',
                            textAlign: TextAlign.center,
                            style: text.bodySmall,
                          ),
                          TextButton(
                            onPressed: busy
                                ? null
                                : () => finish(existingAccount: true),
                            child: const Text('Já tenho conta'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
    );
  }

  List<Widget> content(BuildContext context) {
    final heading = _headline(context);
    return switch (draft.step) {
      0 => [
        Text('Menos correria.\nMais bola rolando.', style: heading),
        const SizedBox(height: PatotaSpace.lg),
        const Text(
          'Reúna a turma, organize o jogo e guarde as histórias que merecem uma resenha.',
        ),
        const SizedBox(height: PatotaSpace.xl),
        const _PathStep(
          number: '1',
          title: 'A turma confirma',
          detail: 'Veja quem vem e quem está na fila.',
        ),
        const _PathStep(
          number: '2',
          title: 'Os times ficam prontos',
          detail: 'Sorteie ou monte do seu jeito.',
        ),
        const _PathStep(
          number: '3',
          title: 'A história continua',
          detail: 'Placar, prêmios e números depois do jogo.',
        ),
      ],
      1 => [
        Text('Do convite ao jogo,\nem um lugar.', style: heading),
        const SizedBox(height: PatotaSpace.md),
        const Text(
          'Experimente confirmar presença. É assim que a turma sabe com quem pode contar.',
        ),
        const SizedBox(height: PatotaSpace.xl),
        const DemoMatchPreview(),
      ],
      2 => [
        Text('Como você entra\nem campo?', style: heading),
        const SizedBox(height: PatotaSpace.md),
        const Text('Vamos mostrar o caminho que faz sentido para você.'),
        const SizedBox(height: PatotaSpace.xl),
        IntroOption(
          icon: Icons.event_available_rounded,
          title: 'Eu organizo a patota',
          detail: 'Chamo a turma, cuido das presenças e preparo o jogo.',
          selected: draft.role == IntroRole.organizer,
          onTap: busy
              ? null
              : () => persist(draft.copyWith(role: IntroRole.organizer)),
        ),
        IntroOption(
          icon: Icons.sports_soccer_rounded,
          title: 'Eu venho para jogar',
          detail: 'Entro com um convite e acompanho minha turma.',
          selected: draft.role == IntroRole.player,
          onTap: busy
              ? null
              : () => persist(draft.copyWith(role: IntroRole.player)),
        ),
      ],
      3 => [
        Text(
          draft.role == IntroRole.organizer
              ? 'O que você quer\nresolver primeiro?'
              : 'O que você quer\nacompanhar?',
          style: heading,
        ),
        const SizedBox(height: PatotaSpace.md),
        const Text('Uma escolha para deixar seu primeiro passo mais claro.'),
        const SizedBox(height: PatotaSpace.xl),
        for (final goal in IntroGoal.values)
          IntroOption(
            icon: switch (goal) {
              IntroGoal.attendance => Icons.how_to_reg_rounded,
              IntroGoal.teams => Icons.groups_rounded,
              IntroGoal.history => Icons.emoji_events_rounded,
            },
            title: goalLabel(goal),
            detail: goalOutcome(goal),
            selected: draft.goal == goal,
            onTap: busy ? null : () => persist(draft.copyWith(goal: goal)),
          ),
      ],
      _ => reveal(context),
    };
  }

  List<Widget> reveal(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final organizer = draft.role == IntroRole.organizer;
    final steps = organizer
        ? switch (draft.goal) {
            IntroGoal.attendance => const [
              (
                'Crie sua patota',
                'Escolha nome e modalidade para reunir a turma.',
              ),
              (
                'Marque a primeira partida',
                'Defina horário e vagas. A fila entra em ação quando lotar.',
              ),
              (
                'Convide os jogadores',
                'Compartilhe o código e acompanhe as confirmações.',
              ),
            ],
            IntroGoal.teams => const [
              (
                'Crie sua patota',
                'Escolha a modalidade e o tamanho inicial dos times.',
              ),
              (
                'Chame a turma para o jogo',
                'Os jogadores confirmam presença na partida.',
              ),
              (
                'Prepare os times',
                'Use o sorteio equilibrado ou ajuste a escalação manualmente.',
              ),
            ],
            _ => const [
              ('Crie sua patota', 'Um lugar para os jogos e para a turma.'),
              (
                'Registre a primeira partida',
                'Presenças, times e gols constroem o histórico.',
              ),
              (
                'Feche o jogo e compartilhe',
                'Acompanhe rankings, votação e cards da partida.',
              ),
            ],
          }
        : [
            ('Crie sua conta', 'Seu perfil acompanha você nas patotas.'),
            ('Entre com um convite', 'Use o código de quem organiza o jogo.'),
            switch (draft.goal) {
              IntroGoal.attendance => (
                'Confirme sua presença',
                'Veja a próxima partida, as vagas e a fila.',
              ),
              IntroGoal.teams => (
                'Confira seu time',
                'A escalação aparece quando o organizador publica.',
              ),
              _ => (
                'Acompanhe seus números',
                'Partidas encerradas alimentam seu perfil e os rankings.',
              ),
            },
          ];
    return [
      Text('Seu caminho\npara o próximo jogo.', style: _headline(context)),
      const SizedBox(height: PatotaSpace.md),
      Text(goalOutcome(draft.goal), style: text.titleMedium),
      const SizedBox(height: PatotaSpace.xl),
      Panel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              organizer ? 'Para quem organiza' : 'Para quem joga',
              style: text.bodySmall,
            ),
            const SizedBox(height: PatotaSpace.lg),
            for (var i = 0; i < steps.length; i++)
              _PathStep(
                number: '${i + 1}',
                title: steps[i].$1,
                detail: steps[i].$2,
              ),
          ],
        ),
      ),
      const SizedBox(height: PatotaSpace.lg),
      const Text(
        'Você escolhe o primeiro passo. O Nossa Patota ajuda a turma a seguir junto.',
      ),
    ];
  }
}

class IntroOption extends StatelessWidget {
  const IntroOption({
    super.key,
    required this.icon,
    required this.title,
    required this.detail,
    required this.selected,
    required this.onTap,
  });
  final IconData icon;
  final String title, detail;
  final bool selected;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: PatotaSpace.md),
      child: Semantics(
        selected: selected,
        button: true,
        child: Material(
          color: selected ? scheme.primaryContainer : scheme.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(PatotaRadius.lg),
            side: BorderSide(
              color: selected ? scheme.primary : scheme.outlineVariant,
              width: 2,
            ),
          ),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(PatotaRadius.lg),
            child: Padding(
              padding: const EdgeInsets.all(PatotaSpace.lg),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(icon, color: scheme.primary),
                  const SizedBox(width: PatotaSpace.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: PatotaSpace.sm),
                        Text(
                          detail,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: PatotaSpace.sm),
                  Icon(
                    selected
                        ? Icons.check_circle_rounded
                        : Icons.radio_button_unchecked_rounded,
                    color: scheme.primary,
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

class _PathStep extends StatelessWidget {
  const _PathStep({
    required this.number,
    required this.title,
    required this.detail,
  });
  final String number, title, detail;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: PatotaSpace.lg),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CircleAvatar(
          radius: 16,
          backgroundColor: Theme.of(context).colorScheme.primaryContainer,
          foregroundColor: Theme.of(context).colorScheme.primary,
          child: Text(
            number,
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
        const SizedBox(width: PatotaSpace.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: PatotaSpace.xs),
              Text(detail, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
      ],
    ),
  );
}

class DemoMatchPreview extends StatefulWidget {
  const DemoMatchPreview({super.key});
  @override
  State<DemoMatchPreview> createState() => _DemoMatchState();
}

class _DemoMatchState extends State<DemoMatchPreview> {
  bool confirmed = false;
  @override
  Widget build(BuildContext context) => Panel(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'EXEMPLO DE PARTIDA',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: PatotaSpace.md),
        Text(
          'Pelada de quinta',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: PatotaSpace.sm),
        const Text('Quinta · 20h · Quadra do bairro'),
        const SizedBox(height: PatotaSpace.xl),
        ProgressTrack(
          value: (confirmed ? 9 : 8) / 10,
          label: '${confirmed ? 9 : 8} de 10 presenças',
          detail: confirmed
              ? 'Você entrou na lista. Falta só chegar para jogar.'
              : '2 vagas livres. A próxima pode ser sua.',
        ),
        const SizedBox(height: PatotaSpace.xl),
        PrimaryButton(
          label: confirmed
              ? 'Presença confirmada'
              : 'Confirmar presença no exemplo',
          success: confirmed,
          icon: Icons.how_to_reg_rounded,
          onPressed: confirmed ? null : () => setState(() => confirmed = true),
        ),
        const SizedBox(height: PatotaSpace.md),
        Text(
          'Uma prévia para experimentar. Nenhuma partida real será alterada.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    ),
  );
}
