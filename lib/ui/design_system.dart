import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/scheduler.dart';
import '../models.dart';

/// Nossa Patota: field green, warm medal yellow and an original sports identity.
/// Team colours are domain data, distinct from these interface colours.
abstract final class PatotaColors {
  static const primary = Color(0xff18794e);
  static const primaryDark = Color(0xff105536);
  static const primaryLight = Color(0xffe6f5eb);
  static const secondary = Color(0xffffc857);
  static const success = primary;
  static const warning = Color(0xff9b6500);
  static const error = Color(0xffbd303b);
  static const errorDark = Color(0xff801924);
  static const info = Color(0xff2476cf);
  static const neutral50 = Color(0xfff7faf7);
  static const neutral100 = Color(0xffedf2ed);
  static const neutral200 = Color(0xffdbe5dc);
  static const neutral300 = Color(0xffbecbbf);
  static const neutral500 = Color(0xff637468);
  static const neutral700 = Color(0xff344b3d);
  static const neutral900 = Color(0xff172b20);
  static const background = neutral50;
  static const surface = Color(0xffffffff);
  static const surfaceElevated = primaryLight;
  static const textPrimary = neutral900;
  static const textSecondary = Color(0xff53655a);
  static const textDisabled = neutral500;
  static const darkBackground = Color(0xff121c17);
  static const darkSurface = Color(0xff1e2b23);
  static const darkElevated = Color(0xff2a3c30);
  static const darkPrimary = Color(0xff7adea8);
  static const darkTextPrimary = Color(0xffeef7f0);
  static const darkTextSecondary = Color(0xffb7cbbd);
  static const darkOutline = Color(0xff435a49);
  static const darkError = Color(0xffffa1a8);
  static const darkInfo = Color(0xff95c7ff);
  static const darkWarning = secondary;
  static const transparent = Color(0x00000000);
  static const shareBackground = Color(0xff123b29);
  static const shareText = Color(0xffffffff);
  static const shareMuted = Color(0xffc6dfcf);
  static const shareAccent = secondary;
  static const gold = Color(0xff926000);
  static const silver = Color(0xff586b79);
  static const bronze = Color(0xff9b5530);
}

abstract final class PatotaSpace {
  static const xs = 4.0, sm = 8.0, md = 12.0, lg = 16.0;
  static const xl = 24.0, xxl = 32.0, hero = 40.0, touch = 48.0;
}

abstract final class PatotaRadius {
  static const sm = 8.0, md = 12.0, lg = 16.0, card = 20.0, modal = 24.0;
}

abstract final class PatotaType {
  static const caption = 12.0, small = 14.0, body = 16.0, title = 20.0;
  static const heading = 24.0, hero = 32.0;
}

abstract final class PatotaMotion {
  static const fast = Duration(milliseconds: 120);
  static const normal = Duration(milliseconds: 240);
  static const celebration = Duration(milliseconds: 400);
  static Duration duration(BuildContext context, Duration value) =>
      MediaQuery.disableAnimationsOf(context) ? Duration.zero : value;
}

abstract final class PatotaLayout {
  static const contentWidth = 560.0;
  static const buttonHeight = 52.0;
}

/// Colour tokens derived from the active light/dark theme.
Color statusColor(BuildContext context, String status) {
  final dark = Theme.of(context).brightness == Brightness.dark;
  return switch (status) {
    'fora' ||
    'ausente' ||
    'cancelada' => dark ? PatotaColors.darkError : PatotaColors.error,
    'espera' ||
    'rascunho' => dark ? PatotaColors.darkWarning : PatotaColors.warning,
    'em_andamento' => dark ? PatotaColors.darkInfo : PatotaColors.info,
    _ => Theme.of(context).colorScheme.primary,
  };
}

Color interfaceTint(BuildContext context, Color colour) {
  if (Theme.of(context).brightness != Brightness.dark) return colour;
  if (colour == PatotaColors.primary) {
    return Theme.of(context).colorScheme.primary;
  }
  if (colour == PatotaColors.error) {
    return Theme.of(context).colorScheme.error;
  }
  if (colour == PatotaColors.info || colour == PatotaColors.silver) {
    return PatotaColors.darkInfo;
  }
  if (colour == PatotaColors.warning ||
      colour == PatotaColors.gold ||
      colour == PatotaColors.bronze) {
    return PatotaColors.darkWarning;
  }
  return colour;
}

class PrimaryButton extends StatefulWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.loading = false,
    this.success = false,
    this.error = false,
    this.successLabel,
  });
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool loading, success, error;
  final String? successLabel;
  @override
  State<PrimaryButton> createState() => _PrimaryButtonState();
}

class _PrimaryButtonState extends State<PrimaryButton> {
  final states = WidgetStatesController();
  @override
  void initState() {
    super.initState();
    states.addListener(changed);
  }

  void changed() {
    if (!mounted) return;
    if (SchedulerBinding.instance.schedulerPhase ==
        SchedulerPhase.persistentCallbacks) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() {});
      });
    } else {
      setState(() {});
    }
  }

  @override
  void dispose() {
    states.removeListener(changed);
    states.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pressed = states.value.contains(WidgetState.pressed);
    final scheme = Theme.of(context).colorScheme;
    final disabled = widget.onPressed == null || widget.loading;
    final colour = widget.error ? scheme.error : scheme.primary;
    return Semantics(
      liveRegion: widget.loading || widget.success || widget.error,
      child: Container(
        decoration: BoxDecoration(
          color: disabled
              ? scheme.outlineVariant
              : widget.error
              ? PatotaColors.errorDark
              : PatotaColors.primaryDark,
          borderRadius: BorderRadius.circular(PatotaRadius.lg),
        ),
        child: AnimatedPadding(
          duration: PatotaMotion.duration(context, PatotaMotion.fast),
          padding: EdgeInsets.only(
            top: pressed ? PatotaSpace.xs : 0,
            bottom: pressed ? 0 : PatotaSpace.xs,
          ),
          child: FilledButton(
            statesController: states,
            onPressed: disabled
                ? null
                : () {
                    HapticFeedback.selectionClick();
                    widget.onPressed!();
                  },
            style: FilledButton.styleFrom(
              disabledForegroundColor: scheme.onSurfaceVariant,
              disabledBackgroundColor: scheme.surfaceContainerHighest,
              backgroundColor: colour,
              foregroundColor: widget.error ? scheme.onError : scheme.onPrimary,
              minimumSize: const Size(
                PatotaSpace.touch,
                PatotaLayout.buttonHeight,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(PatotaRadius.lg),
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: PatotaSpace.sm),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (widget.loading)
                    SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: scheme.onSurfaceVariant,
                      ),
                    )
                  else if (widget.success ||
                      widget.error ||
                      widget.icon != null)
                    Icon(
                      widget.success
                          ? Icons.check_circle_rounded
                          : widget.error
                          ? Icons.error_rounded
                          : widget.icon,
                      size: 22,
                    ),
                  if (widget.loading ||
                      widget.success ||
                      widget.error ||
                      widget.icon != null)
                    const SizedBox(width: PatotaSpace.sm),
                  Flexible(
                    child: Text(
                      widget.loading
                          ? 'Aguarde…'
                          : widget.success
                          ? widget.successLabel ?? widget.label
                          : widget.label,
                      textAlign: TextAlign.center,
                    ),
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

class AppEmptyState extends StatelessWidget {
  const AppEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.action,
  });
  final IconData icon;
  final String title, message;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(
      vertical: PatotaSpace.xxl,
      horizontal: PatotaSpace.lg,
    ),
    child: Column(
      children: [
        Container(
          padding: const EdgeInsets.all(PatotaSpace.xl),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primaryContainer,
            shape: BoxShape.circle,
          ),
          child: Icon(
            icon,
            size: 40,
            color: Theme.of(context).colorScheme.onPrimaryContainer,
          ),
        ),
        const SizedBox(height: PatotaSpace.xl),
        Text(
          title,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: PatotaSpace.sm),
        Text(
          message,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        if (action != null) ...[
          const SizedBox(height: PatotaSpace.xl),
          action!,
        ],
      ],
    ),
  );
}

class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.color,
    this.detail,
  });
  final String label, value;
  final IconData icon;
  final Color? color;
  final String? detail;
  @override
  Widget build(BuildContext context) {
    final tint = interfaceTint(
      context,
      color ?? Theme.of(context).colorScheme.primary,
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(PatotaSpace.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: tint, size: 24),
                const SizedBox(width: PatotaSpace.sm),
                Expanded(
                  child: Text(
                    label,
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                ),
              ],
            ),
            const SizedBox(height: PatotaSpace.md),
            Text(value, style: Theme.of(context).textTheme.headlineLarge),
            if (detail != null) ...[
              const SizedBox(height: PatotaSpace.xs),
              Text(detail!, style: Theme.of(context).textTheme.bodySmall),
            ],
          ],
        ),
      ),
    );
  }
}

class ProgressTrack extends StatelessWidget {
  const ProgressTrack({
    super.key,
    required this.value,
    required this.label,
    this.detail,
    this.color,
  });
  final double value;
  final String label;
  final String? detail;
  final Color? color;
  @override
  Widget build(BuildContext context) {
    final ratio = value.isFinite ? value.clamp(0.0, 1.0) : 0.0;
    return Semantics(
      label: label,
      value: '${(ratio * 100).round()}%',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(label, style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: PatotaSpace.sm),
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: ratio),
            duration: PatotaMotion.duration(context, PatotaMotion.normal),
            builder: (context, progress, _) => LinearProgressIndicator(
              value: progress,
              minHeight: 12,
              borderRadius: BorderRadius.circular(PatotaRadius.sm),
              backgroundColor: Theme.of(context).colorScheme.outlineVariant,
              color: color ?? Theme.of(context).colorScheme.primary,
            ),
          ),
          if (detail != null) ...[
            const SizedBox(height: PatotaSpace.sm),
            Text(detail!, style: Theme.of(context).textTheme.bodySmall),
          ],
        ],
      ),
    );
  }
}

class PresencePill extends StatelessWidget {
  const PresencePill({super.key, required this.status, this.queuePosition});
  final String status;
  final int? queuePosition;
  @override
  Widget build(BuildContext context) {
    final label = switch (status) {
      'confirmado' => 'Confirmado',
      'espera' => queuePosition == null ? 'Na fila' : '$queuePositionº na fila',
      'fora' => 'Fora',
      'presente' => 'Presente',
      'ausente' => 'Ausente',
      _ => 'Ainda não respondeu',
    };
    final icon = switch (status) {
      'confirmado' || 'presente' => Icons.check_circle_rounded,
      'espera' => Icons.schedule_rounded,
      'fora' || 'ausente' => Icons.cancel_rounded,
      _ => Icons.help_rounded,
    };
    final tint = statusColor(context, status);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: PatotaSpace.md,
        vertical: PatotaSpace.sm,
      ),
      decoration: BoxDecoration(
        color: tint.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(PatotaRadius.md),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: tint),
          const SizedBox(width: PatotaSpace.xs),
          Flexible(
            child: Text(
              label,
              style: TextStyle(
                color: tint,
                fontWeight: FontWeight.w700,
                fontSize: PatotaType.small,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

Color teamTint(String? value) {
  final raw = value?.replaceFirst('#', '') ?? '';
  return raw.length == 6 && int.tryParse(raw, radix: 16) != null
      ? Color(int.parse('ff$raw', radix: 16))
      : PatotaColors.primary;
}

class Scoreboard extends StatelessWidget {
  const Scoreboard({
    super.key,
    required this.teamA,
    required this.teamB,
    required this.scoreA,
    required this.scoreB,
    this.status,
  });
  final Team? teamA, teamB;
  final int scoreA, scoreB;
  final String? status;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      if (status != null) ...[
        Text(status!, style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: PatotaSpace.md),
      ],
      Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(child: _TeamIdentity(teamA, 'Time A')),
          Flexible(
            child: Semantics(
              label: 'Placar: $scoreA a $scoreB',
              child: Text(
                '$scoreA × $scoreB',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineLarge,
              ),
            ),
          ),
          Expanded(child: _TeamIdentity(teamB, 'Time B')),
        ],
      ),
    ],
  );
}

class _TeamIdentity extends StatelessWidget {
  const _TeamIdentity(this.team, this.fallback);
  final Team? team;
  final String fallback;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Container(
        padding: const EdgeInsets.all(PatotaSpace.sm),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(PatotaRadius.lg),
        ),
        child: Icon(
          Icons.shield_rounded,
          color: teamTint(team?.color),
          size: 32,
          shadows: [
            Shadow(color: Theme.of(context).colorScheme.outline, blurRadius: 1),
          ],
        ),
      ),
      const SizedBox(height: PatotaSpace.sm),
      Text(
        team?.name ?? fallback,
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.titleSmall,
      ),
    ],
  );
}
