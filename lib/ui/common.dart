import 'dart:convert';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import '../models.dart';
import '../store.dart';
import 'auth.dart';

export 'design_system.dart';
import 'design_system.dart';

const brand = PatotaColors.primary;
const iosBlue = PatotaColors.info;
ThemeData appTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final surface = dark ? PatotaColors.darkSurface : PatotaColors.surface;
  final canvas = dark ? PatotaColors.darkBackground : PatotaColors.background;
  final ink = dark ? PatotaColors.darkTextPrimary : PatotaColors.textPrimary;
  final muted = dark
      ? PatotaColors.darkTextSecondary
      : PatotaColors.textSecondary;
  final outline = dark ? PatotaColors.darkOutline : PatotaColors.neutral200;
  final primary = dark ? PatotaColors.darkPrimary : PatotaColors.primary;
  final elevated = dark ? PatotaColors.darkElevated : PatotaColors.neutral100;
  final scheme =
      ColorScheme.fromSeed(
        seedColor: PatotaColors.primary,
        brightness: brightness,
      ).copyWith(
        primary: primary,
        onPrimary: dark ? PatotaColors.primaryDark : PatotaColors.surface,
        primaryContainer: dark
            ? PatotaColors.darkElevated
            : PatotaColors.primaryLight,
        onPrimaryContainer: dark
            ? PatotaColors.darkPrimary
            : PatotaColors.primaryDark,
        secondary: PatotaColors.secondary,
        onSecondary: PatotaColors.neutral900,
        secondaryContainer: dark
            ? PatotaColors.darkElevated
            : PatotaColors.secondary.withValues(alpha: .2),
        onSecondaryContainer: dark
            ? PatotaColors.secondary
            : PatotaColors.warning,
        surface: surface,
        surfaceContainer: surface,
        surfaceContainerHighest: elevated,
        surfaceContainerLow: canvas,
        onSurface: ink,
        onSurfaceVariant: muted,
        outline: dark ? PatotaColors.darkOutline : PatotaColors.neutral300,
        outlineVariant: outline,
        error: dark ? PatotaColors.darkError : PatotaColors.error,
        onError: dark ? PatotaColors.neutral900 : PatotaColors.surface,
      );
  final base = ThemeData(brightness: brightness, fontFamily: 'Inter').textTheme;
  TextStyle type(
    TextStyle? style,
    double size,
    FontWeight weight, {
    Color? colour,
  }) => (style ?? const TextStyle()).copyWith(
    fontSize: size,
    fontWeight: weight,
    color: colour ?? ink,
    height: 1.3,
    letterSpacing: 0,
  );
  final shape = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(PatotaRadius.lg),
  );
  return ThemeData(
    useMaterial3: true,
    platform: TargetPlatform.iOS,
    fontFamily: 'Inter',
    colorScheme: scheme,
    scaffoldBackgroundColor: canvas,
    visualDensity: VisualDensity.standard,
    materialTapTargetSize: MaterialTapTargetSize.padded,
    textTheme: base.copyWith(
      headlineLarge: type(base.headlineLarge, PatotaType.hero, FontWeight.w800),
      headlineMedium: type(base.headlineMedium, 28, FontWeight.w800),
      headlineSmall: type(
        base.headlineSmall,
        PatotaType.heading,
        FontWeight.w800,
      ),
      titleLarge: type(base.titleLarge, PatotaType.title, FontWeight.w800),
      titleMedium: type(base.titleMedium, 18, FontWeight.w700),
      titleSmall: type(base.titleSmall, PatotaType.body, FontWeight.w700),
      bodyLarge: type(base.bodyLarge, PatotaType.body, FontWeight.w500),
      bodyMedium: type(base.bodyMedium, PatotaType.body, FontWeight.w400),
      bodySmall: type(
        base.bodySmall,
        PatotaType.small,
        FontWeight.w500,
        colour: muted,
      ),
      labelLarge: type(base.labelLarge, PatotaType.body, FontWeight.w700),
      labelMedium: type(base.labelMedium, PatotaType.small, FontWeight.w700),
      labelSmall: type(base.labelSmall, PatotaType.caption, FontWeight.w700),
    ),
    cupertinoOverrideTheme: CupertinoThemeData(
      brightness: brightness,
      primaryColor: primary,
      scaffoldBackgroundColor: canvas,
      barBackgroundColor: surface,
      textTheme: CupertinoTextThemeData(
        textStyle: TextStyle(
          fontFamily: 'Inter',
          fontSize: PatotaType.body,
          color: ink,
        ),
        actionTextStyle: TextStyle(
          fontFamily: 'Inter',
          fontSize: PatotaType.body,
          fontWeight: FontWeight.w700,
          color: primary,
        ),
      ),
    ),
    appBarTheme: AppBarTheme(
      centerTitle: false,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: PatotaColors.transparent,
      backgroundColor: canvas,
      foregroundColor: ink,
      titleTextStyle: TextStyle(
        fontFamily: 'Inter',
        fontSize: PatotaType.title,
        fontWeight: FontWeight.w800,
        color: ink,
      ),
      iconTheme: IconThemeData(color: primary, size: 24),
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(PatotaRadius.md),
        borderSide: BorderSide(color: outline, width: 2),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(PatotaRadius.md),
        borderSide: BorderSide(color: outline, width: 2),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(PatotaRadius.md),
        borderSide: BorderSide(color: primary, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(PatotaRadius.md),
        borderSide: BorderSide(color: scheme.error, width: 2),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(PatotaRadius.md),
        borderSide: BorderSide(color: scheme.error, width: 2),
      ),
      fillColor: surface,
      labelStyle: TextStyle(color: muted, fontWeight: FontWeight.w600),
      contentPadding: const EdgeInsets.all(PatotaSpace.lg),
      filled: true,
    ),
    cardTheme: CardThemeData(
      color: surface,
      surfaceTintColor: PatotaColors.transparent,
      elevation: 0,
      margin: const EdgeInsets.symmetric(vertical: PatotaSpace.sm),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(PatotaRadius.card),
        side: BorderSide(color: outline, width: 2),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(PatotaSpace.touch, PatotaLayout.buttonHeight),
        padding: const EdgeInsets.symmetric(
          horizontal: PatotaSpace.xl,
          vertical: PatotaSpace.md,
        ),
        textStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: PatotaType.body,
          fontWeight: FontWeight.w800,
        ),
        shape: shape,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(PatotaSpace.touch, PatotaLayout.buttonHeight),
        foregroundColor: ink,
        backgroundColor: surface,
        side: BorderSide(color: outline, width: 2),
        padding: const EdgeInsets.symmetric(
          horizontal: PatotaSpace.lg,
          vertical: PatotaSpace.md,
        ),
        textStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: PatotaType.body,
          fontWeight: FontWeight.w700,
        ),
        shape: shape,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        minimumSize: const Size(PatotaSpace.touch, PatotaSpace.touch),
        foregroundColor: primary,
        textStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: PatotaType.small,
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        minimumSize: const Size(PatotaSpace.touch, PatotaSpace.touch),
        foregroundColor: muted,
      ),
    ),
    listTileTheme: ListTileThemeData(
      contentPadding: const EdgeInsets.symmetric(
        horizontal: PatotaSpace.lg,
        vertical: PatotaSpace.sm,
      ),
      minTileHeight: 64,
      titleTextStyle: TextStyle(
        fontFamily: 'Inter',
        fontSize: PatotaType.body,
        fontWeight: FontWeight.w700,
        color: ink,
      ),
      subtitleTextStyle: TextStyle(
        fontFamily: 'Inter',
        fontSize: PatotaType.small,
        height: 1.4,
        color: muted,
      ),
      iconColor: primary,
    ),
    dividerTheme: DividerThemeData(color: outline, thickness: 1, space: 1),
    chipTheme: ChipThemeData(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(PatotaRadius.md),
      ),
      labelStyle: TextStyle(
        fontFamily: 'Inter',
        fontSize: PatotaType.small,
        fontWeight: FontWeight.w700,
        color: ink,
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: PatotaSpace.sm,
        vertical: PatotaSpace.sm,
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(PatotaRadius.modal),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: surface,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(PatotaRadius.modal),
        ),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: dark
          ? PatotaColors.darkElevated
          : PatotaColors.neutral900,
      contentTextStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: PatotaType.small,
        color: PatotaColors.surface,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(PatotaRadius.lg),
      ),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: primary,
      linearTrackColor: outline,
      circularTrackColor: outline,
      borderRadius: BorderRadius.circular(PatotaRadius.sm),
    ),
    pageTransitionsTheme: PageTransitionsTheme(
      builders: {
        for (final platform in TargetPlatform.values)
          platform: const CupertinoPageTransitionsBuilder(),
      },
    ),
  );
}

Future<bool> perform(
  BuildContext context,
  Future<void> Function() action, {
  String? successMessage,
}) async {
  try {
    await action();
    if (successMessage != null && context.mounted) {
      showFeedback(context, successMessage);
    }
    return true;
  } catch (e) {
    if (context.mounted) {
      showFeedback(context, translateError(e), error: true);
    }
    return false;
  }
}

void showFeedback(BuildContext context, String message, {bool error = false}) {
  final messenger = ScaffoldMessenger.of(context);
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(
    SnackBar(
      content: Row(
        children: [
          Icon(
            error ? Icons.error_rounded : Icons.check_circle_rounded,
            color: PatotaColors.shareText,
            size: 24,
          ),
          const SizedBox(width: PatotaSpace.md),
          Expanded(child: Text(message)),
        ],
      ),
      backgroundColor: error ? PatotaColors.error : PatotaColors.primaryDark,
    ),
  );
}

Future<bool> confirm(
  BuildContext context,
  String title,
  String message,
) async =>
    await showCupertinoDialog<bool>(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          CupertinoDialogAction(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          CupertinoDialogAction(
            isDefaultAction: true,
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Confirmar'),
          ),
        ],
      ),
    ) ??
    false;
void openPage(BuildContext context, Widget page) =>
    Navigator.of(context).push(CupertinoPageRoute<void>(builder: (_) => page));

class Frame extends StatelessWidget {
  const Frame({
    super.key,
    required this.store,
    required this.title,
    required this.builder,
    this.actions,
  });
  final AppStore store;
  final String title;
  final Widget Function(BuildContext) builder;
  final List<Widget>? actions;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: store,
    builder: (context, _) {
      if (store.current?.mustChangePassword == true) {
        return PasswordPage(store, requiredChange: true);
      }
      if (!store.signedIn) {
        return const Scaffold(
          body: Center(child: Text('Sessão encerrada. Volte para entrar.')),
        );
      }
      return Scaffold(
        appBar: AppBar(
          title: Text(title),
          actions: actions,
          leading: Navigator.canPop(context)
              ? CupertinoButton(
                  padding: EdgeInsets.zero,
                  onPressed: () => Navigator.maybePop(context),
                  child: const Icon(Icons.arrow_back_rounded, size: 24),
                )
              : null,
        ),
        body: SafeArea(
          top: false,
          child: Column(
            children: [
              if (store.busy) const LinearProgressIndicator(),
              Expanded(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      maxWidth: PatotaLayout.contentWidth,
                    ),
                    child: builder(context),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

class IosHeader extends StatelessWidget implements PreferredSizeWidget {
  const IosHeader({
    super.key,
    required this.title,
    required this.store,
    required this.onProfile,
    this.action,
  });
  final String title;
  final AppStore store;
  final VoidCallback onProfile;
  final Widget? action;
  @override
  Size get preferredSize => const Size.fromHeight(112);
  @override
  Widget build(BuildContext context) => SafeArea(
    bottom: false,
    child: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: PatotaLayout.contentWidth),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            PatotaSpace.lg,
            PatotaSpace.sm,
            PatotaSpace.lg,
            PatotaSpace.lg,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                height: PatotaSpace.touch,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    ?action,
                    if (store.current != null)
                      Semantics(
                        button: true,
                        label: 'Abrir meu perfil',
                        child: GestureDetector(
                          onTap: onProfile,
                          child: SizedBox(
                            width: PatotaSpace.touch,
                            height: PatotaSpace.touch,
                            child: PlayerAvatar(store.current!),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Text(
                title,
                style: Theme.of(context).textTheme.headlineSmall,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class IosBadge extends StatelessWidget {
  const IosBadge(this.label, {super.key, this.color});
  final String label;
  final Color? color;
  @override
  Widget build(BuildContext context) {
    final tint = interfaceTint(
      context,
      color ?? Theme.of(context).colorScheme.primary,
    );
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: PatotaSpace.md,
        vertical: PatotaSpace.sm,
      ),
      decoration: BoxDecoration(
        color: tint.withValues(alpha: .10),
        borderRadius: BorderRadius.circular(PatotaRadius.md),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: PatotaType.small,
          fontWeight: FontWeight.w700,
          color: tint,
        ),
      ),
    );
  }
}

class MetricTile extends StatelessWidget {
  const MetricTile({
    super.key,
    required this.value,
    required this.label,
    required this.icon,
    this.color = brand,
  });
  final String value, label;
  final IconData icon;
  final Color color;
  @override
  Widget build(BuildContext context) =>
      StatCard(value: value, label: label, icon: icon, color: color);
}

class Panel extends StatelessWidget {
  const Panel({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.symmetric(vertical: PatotaSpace.sm),
    child: Padding(padding: const EdgeInsets.all(PatotaSpace.lg), child: child),
  );
}

class Heading extends StatelessWidget {
  const Heading(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: PatotaSpace.xl, bottom: PatotaSpace.md),
    child: Text(text, style: Theme.of(context).textTheme.titleLarge),
  );
}

class PlayerAvatar extends StatelessWidget {
  const PlayerAvatar(this.player, {super.key});
  final Player player;
  @override
  Widget build(BuildContext context) {
    final url = player.photo;
    ImageProvider? image;
    if (url != null && url.isNotEmpty) {
      image = url.startsWith('data:')
          ? MemoryImage(base64Decode(url.split(',').last))
          : NetworkImage(url);
    }
    return CircleAvatar(
      backgroundColor: Theme.of(
        context,
      ).colorScheme.primary.withValues(alpha: .10),
      foregroundColor: Theme.of(context).colorScheme.primary,
      foregroundImage: image,
      onForegroundImageError: image == null ? null : (_, _) {},
      child: Text(
        player.name
            .split(' ')
            .where((s) => s.isNotEmpty)
            .take(2)
            .map((s) => s[0])
            .join()
            .toUpperCase(),
      ),
    );
  }
}

Widget choice(
  String label,
  String value,
  List<String> values,
  ValueChanged<String> onChange, {
  Map<String, String>? labels,
}) => Builder(
  builder: (context) {
    final selected = values.contains(value) ? value : values.first;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: PatotaSpace.sm),
      child: Semantics(
        button: true,
        label: '$label: ${labels?[selected] ?? selected}',
        child: Material(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(PatotaRadius.md),
          child: InkWell(
            borderRadius: BorderRadius.circular(PatotaRadius.md),
            onTap: () async {
              FocusManager.instance.primaryFocus?.unfocus();
              final next = await showCupertinoModalPopup<String>(
                context: context,
                builder: (ctx) => CupertinoActionSheet(
                  title: Text(label),
                  actions: values
                      .map(
                        (v) => CupertinoActionSheetAction(
                          isDefaultAction: v == selected,
                          onPressed: () => Navigator.pop(ctx, v),
                          child: Text(labels?[v] ?? v),
                        ),
                      )
                      .toList(),
                  cancelButton: CupertinoActionSheetAction(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Cancelar'),
                  ),
                ),
              );
              if (next != null && context.mounted) onChange(next);
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: PatotaSpace.lg,
                vertical: PatotaSpace.md,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          label,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: PatotaSpace.xs),
                        Text(
                          labels?[selected] ?? selected,
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.unfold_more_rounded,
                    size: 24,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  },
);
Widget field(
  String label,
  TextEditingController controller, {
  bool password = false,
  bool number = false,
}) => Padding(
  padding: const EdgeInsets.symmetric(vertical: PatotaSpace.sm),
  child: TextFormField(
    controller: controller,
    obscureText: password,
    keyboardType: number ? TextInputType.number : TextInputType.text,
    decoration: InputDecoration(labelText: label),
    validator: (v) => (v ?? '').trim().isEmpty
        ? 'Informe ${label.toLowerCase()} para continuar.'
        : null,
  ),
);
String prettyDate(String date) => date.length >= 10
    ? '${date.substring(8, 10)}/${date.substring(5, 7)}/${date.substring(0, 4)}'
    : date;
String statusLabel(String status) =>
    {
      'rascunho': 'Rascunho',
      'em_andamento': 'Ao vivo',
      'encerrada': 'Encerrada',
      'cancelada': 'Cancelada',
    }[status] ??
    status;
