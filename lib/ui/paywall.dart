import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../acquisition.dart';
import 'common.dart';
import 'onboarding_football.dart';

class PaywallPage extends StatefulWidget {
  const PaywallPage({
    super.key,
    this.patotaName,
    this.goal,
    this.offer,
    this.onContinue,
    this.onBack,
    this.loading = false,
    this.error,
    this.onboardingProgress,
  });
  final String? patotaName;
  final IntroGoal? goal;
  final PatotaOffer? offer;
  final VoidCallback? onContinue, onBack;
  final bool loading;
  final String? error;
  final double? onboardingProgress;
  @override
  State<PaywallPage> createState() => _PaywallState();
}

class _PaywallState extends State<PaywallPage> {
  late final Future<PatotaOffer> offer = loadOffer();
  bool annual = true;
  int goalCelebration = 0;

  void choosePlan(bool yearly) {
    if (widget.loading) return;
    setState(() {
      annual = yearly;
      goalCelebration++;
    });
  }

  Future<PatotaOffer> loadOffer() async {
    if (widget.offer != null) return widget.offer!;
    try {
      return PatotaOffer.fromJson(
        jsonDecode(await rootBundle.loadString('assets/patota_offer.json'))
            as Map<String, dynamic>,
      );
    } catch (_) {
      // An invalid offer must never prevent free access.
      return const PatotaOffer();
    }
  }

  void continueFree() {
    if (widget.onContinue != null) {
      widget.onContinue!();
    } else {
      Navigator.maybePop(context);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Plano da patota'),
      leading: widget.onBack == null
          ? null
          : IconButton(
              tooltip: 'Voltar',
              onPressed: widget.loading ? null : widget.onBack,
              icon: const Icon(Icons.arrow_back_rounded),
            ),
    ),
    body: FutureBuilder<PatotaOffer>(
      future: offer,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final config = snapshot.data!;
        final scheme = Theme.of(context).colorScheme;
        final text = Theme.of(context).textTheme;
        final largeText =
            MediaQuery.textScalerOf(context).scale(PatotaType.hero) >
            PatotaType.hero * 1.3;
        final heading = text.headlineLarge?.copyWith(
          fontSize: largeText && MediaQuery.sizeOf(context).width < 400
              ? PatotaType.heading
              : PatotaType.hero,
        );
        return SafeArea(
          bottom: false,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: ListView(
                padding: const EdgeInsets.all(PatotaSpace.xl),
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: IosBadge(
                      'GRATUITO POR ENQUANTO',
                      color: scheme.primary,
                    ),
                  ),
                  const SizedBox(height: PatotaSpace.lg),
                  Text(config.title, style: heading),
                  const SizedBox(height: PatotaSpace.md),
                  Text(goalOutcome(widget.goal), style: text.titleMedium),
                  const SizedBox(height: PatotaSpace.sm),
                  Text(
                    widget.patotaName == null
                        ? 'Uma patota inteira. Um só plano.'
                        : 'Um só plano para toda a ${widget.patotaName}.',
                    style: text.bodySmall,
                  ),
                  const SizedBox(height: PatotaSpace.xl),
                  Container(
                    padding: const EdgeInsets.all(PatotaSpace.lg),
                    decoration: BoxDecoration(
                      color: scheme.primaryContainer,
                      borderRadius: BorderRadius.circular(PatotaRadius.card),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Sua patota já pode jogar',
                                style: text.titleMedium,
                              ),
                            ),
                            const SizedBox(width: PatotaSpace.md),
                            Flexible(
                              child: Text('R\$ 0', style: text.headlineLarge),
                            ),
                          ],
                        ),
                        const SizedBox(height: PatotaSpace.md),
                        const Text(
                          'Presenças, times, placar e rankings já liberados. Todos os recursos atuais são gratuitos.',
                          style: TextStyle(fontSize: PatotaType.small),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: PatotaSpace.xl),
                  Row(
                    children: [
                      Expanded(
                        child: Text('Nossa Patota Pro', style: text.titleLarge),
                      ),
                      IosBadge('Em breve', color: scheme.onSurfaceVariant),
                    ],
                  ),
                  const SizedBox(height: PatotaSpace.sm),
                  const Text(
                    'Opções previstas para o lançamento do Pro.',
                    style: TextStyle(fontSize: PatotaType.small),
                  ),
                  const SizedBox(height: PatotaSpace.md),
                  _OfferOption(
                    title: 'Anual',
                    detail: config.annualPriceCents == null
                        ? 'Preço a definir'
                        : '${brl(config.annualPriceCents!)} por ano',
                    badge: config.annualSavingsPercent == null
                        ? null
                        : '${config.annualSavingsPercent}% de economia',
                    selected: annual,
                    onTap: () => choosePlan(true),
                  ),
                  const SizedBox(height: PatotaSpace.md),
                  _OfferOption(
                    title: 'Mensal',
                    detail: config.monthlyPriceCents == null
                        ? 'Preço a definir'
                        : '${brl(config.monthlyPriceCents!)} por mês',
                    selected: !annual,
                    onTap: () => choosePlan(false),
                  ),
                  const SizedBox(height: PatotaSpace.lg),
                  Text(
                    'O Pro ainda não está disponível. Escolher uma opção não inicia uma assinatura.',
                    style: text.bodySmall,
                  ),
                  const SizedBox(height: PatotaSpace.xl),
                  Text('Em planejamento para o Pro', style: text.titleMedium),
                  const SizedBox(height: PatotaSpace.md),
                  for (final benefit in config.futureBenefits)
                    _Benefit(benefit, upcoming: true),
                  if (config.trialDays > 0) ...[
                    const SizedBox(height: PatotaSpace.sm),
                    Text(
                      'Teste previsto de ${config.trialDays} dias, disponível apenas no lançamento do Pro.',
                      style: text.bodySmall,
                    ),
                  ],
                  TextButton.icon(
                    onPressed: () => showModalBottomSheet<void>(
                      context: context,
                      showDragHandle: true,
                      isScrollControlled: true,
                      builder: (context) => SafeArea(
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.all(PatotaSpace.xl),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Como funciona o plano',
                                style: text.titleLarge,
                              ),
                              const SizedBox(height: PatotaSpace.lg),
                              const Text(
                                'Hoje o Nossa Patota é gratuito. Não pedimos cartão, não iniciamos um teste e não fazemos cobranças.\n\n'
                                'Quando o Pro for lançado, a oferta será para a patota inteira. Os preços e as condições serão apresentados antes de qualquer contratação. Você poderá decidir naquele momento.',
                              ),
                              const SizedBox(height: PatotaSpace.lg),
                              TextButton(
                                onPressed: () => Navigator.pop(context),
                                child: const Text('Entendi'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    icon: const Icon(Icons.info_outline_rounded),
                    label: const Text('Como funciona o plano?'),
                  ),
                ],
              ),
            ),
          ),
        );
      },
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
                if (widget.error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: PatotaSpace.sm),
                    child: Text(
                      widget.error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
                FootballContinueButton(
                  progress: widget.onboardingProgress,
                  goalCelebration: goalCelebration,
                  label: 'Continuar gratuitamente',
                  loading: widget.loading,
                  onPressed: widget.loading ? null : continueFree,
                ),
                const SizedBox(height: PatotaSpace.sm),
                Text(
                  'Sem cartão. Sem cobrança automática.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class _Benefit extends StatelessWidget {
  const _Benefit(this.text, {this.upcoming = false});
  final String text;
  final bool upcoming;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: PatotaSpace.md),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          upcoming ? Icons.schedule_rounded : Icons.check_circle_rounded,
          color: upcoming
              ? Theme.of(context).colorScheme.onSurfaceVariant
              : Theme.of(context).colorScheme.primary,
          size: 22,
        ),
        const SizedBox(width: PatotaSpace.md),
        Expanded(child: Text(text)),
      ],
    ),
  );
}

class _OfferOption extends StatelessWidget {
  const _OfferOption({
    required this.title,
    required this.detail,
    required this.selected,
    required this.onTap,
    this.badge,
  });
  final String title, detail;
  final String? badge;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
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
              children: [
                Icon(
                  selected
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_unchecked_rounded,
                  color: scheme.primary,
                ),
                const SizedBox(width: PatotaSpace.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: PatotaSpace.xs),
                      Text(detail),
                      if (badge != null) ...[
                        const SizedBox(height: PatotaSpace.sm),
                        Text(
                          badge!,
                          style: TextStyle(
                            color: scheme.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
