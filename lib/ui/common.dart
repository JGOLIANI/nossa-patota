import 'dart:convert';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import '../models.dart';
import '../store.dart';
import 'auth.dart';

const brand = Color(0xff34c759);
const iosBlue = Color(0xff007aff);
ThemeData appTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final surface = dark ? const Color(0xff1c1c1e) : Colors.white;
  final canvas = dark ? const Color(0xff000000) : const Color(0xfff2f2f7);
  final ink = dark ? const Color(0xffffffff) : const Color(0xff000000);
  final muted = dark ? const Color(0xff98989f) : const Color(0xff6c6c70);
  final scheme = ColorScheme.fromSeed(seedColor: brand, brightness: brightness)
      .copyWith(
        primary: dark ? const Color(0xff30d158) : brand,
        onPrimary: dark ? const Color(0xff04220f) : Colors.white,
        surface: surface,
        onSurface: ink,
        onSurfaceVariant: muted,
        outlineVariant: dark
            ? const Color(0xff38383a)
            : const Color(0xffd6d6da),
      );
  final base = ThemeData(brightness: brightness, fontFamily: 'Inter').textTheme;
  return ThemeData(
    useMaterial3: true,
    platform: TargetPlatform.iOS,
    fontFamily: 'Inter',
    colorScheme: scheme,
    scaffoldBackgroundColor: canvas,
    cupertinoOverrideTheme: CupertinoThemeData(
      brightness: brightness,
      primaryColor: scheme.primary,
      scaffoldBackgroundColor: canvas,
      barBackgroundColor: surface.withValues(alpha: .82),
      textTheme: CupertinoTextThemeData(
        textStyle: TextStyle(fontFamily: 'Inter', fontSize: 17, color: ink),
        actionTextStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 17,
          color: iosBlue,
        ),
        tabLabelTextStyle: TextStyle(
          fontFamily: 'Inter',
          fontSize: 10,
          fontWeight: FontWeight.w500,
          color: muted,
        ),
        navTitleTextStyle: TextStyle(
          fontFamily: 'Inter',
          fontSize: 17,
          fontWeight: FontWeight.w600,
          color: ink,
        ),
        navLargeTitleTextStyle: TextStyle(
          fontFamily: 'Inter',
          fontSize: 34,
          fontWeight: FontWeight.w700,
          color: ink,
        ),
      ),
    ),
    textTheme: base.copyWith(
      headlineLarge: base.headlineLarge?.copyWith(
        fontSize: 34,
        fontWeight: FontWeight.w700,
        letterSpacing: -1.2,
        color: ink,
      ),
      headlineMedium: base.headlineMedium?.copyWith(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        letterSpacing: -.8,
        color: ink,
      ),
      headlineSmall: base.headlineSmall?.copyWith(
        fontSize: 22,
        fontWeight: FontWeight.w700,
        letterSpacing: -.6,
        color: ink,
      ),
      titleLarge: base.titleLarge?.copyWith(
        fontSize: 20,
        fontWeight: FontWeight.w600,
        letterSpacing: -.5,
        color: ink,
      ),
      titleMedium: base.titleMedium?.copyWith(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        letterSpacing: -.25,
        color: ink,
      ),
      bodyLarge: base.bodyLarge?.copyWith(
        fontSize: 16,
        height: 1.4,
        letterSpacing: -.25,
        color: ink,
      ),
      bodyMedium: base.bodyMedium?.copyWith(
        fontSize: 15,
        height: 1.45,
        letterSpacing: -.15,
        color: ink,
      ),
      bodySmall: base.bodySmall?.copyWith(
        fontSize: 13,
        height: 1.4,
        color: muted,
      ),
    ),
    appBarTheme: AppBarTheme(
      centerTitle: true,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
      backgroundColor: dark ? surface : const Color(0xfff9f9fb),
      foregroundColor: ink,
      titleTextStyle: TextStyle(
        fontFamily: 'Inter',
        fontSize: 17,
        fontWeight: FontWeight.w600,
        color: ink,
      ),
      iconTheme: IconThemeData(color: scheme.primary, size: 22),
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: scheme.primary, width: 1.5),
      ),
      fillColor: dark ? const Color(0xff2c2c2e) : const Color(0xffeeeef2),
      labelStyle: TextStyle(color: muted, fontWeight: FontWeight.w400),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 17),
      filled: true,
    ),
    cardTheme: CardThemeData(
      color: surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: const EdgeInsets.symmetric(vertical: 5),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 50),
        textStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 48),
        foregroundColor: ink,
        backgroundColor: dark
            ? const Color(0xff2c2c2e)
            : const Color(0xffeeeef2),
        side: BorderSide.none,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: scheme.primary),
    ),
    listTileTheme: ListTileThemeData(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      titleTextStyle: TextStyle(
        fontFamily: 'Inter',
        fontSize: 16,
        fontWeight: FontWeight.w500,
        color: ink,
      ),
      subtitleTextStyle: TextStyle(
        fontFamily: 'Inter',
        fontSize: 13,
        height: 1.45,
        color: muted,
      ),
      iconColor: muted,
    ),
    dividerTheme: DividerThemeData(
      color: scheme.outlineVariant,
      thickness: .5,
      space: 1,
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
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
  Future<void> Function() action,
) async {
  try {
    await action();
    return true;
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(translateError(e))));
    }
    return false;
  }
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
                  child: const Icon(CupertinoIcons.chevron_back, size: 23),
                )
              : null,
        ),
        body: Column(
          children: [
            if (store.busy) const LinearProgressIndicator(),
            Expanded(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 512),
                  child: builder(context),
                ),
              ),
            ),
          ],
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
  Size get preferredSize => const Size.fromHeight(108);
  @override
  Widget build(BuildContext context) => SafeArea(
    bottom: false,
    child: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 512),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                height: 36,
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
                            width: 32,
                            height: 32,
                            child: PlayerAvatar(store.current!),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Text(
                title,
                style: Theme.of(context).textTheme.headlineLarge,
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
    final tint = color ?? Theme.of(context).colorScheme.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: tint.withValues(alpha: .10),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
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
  Widget build(BuildContext context) => Panel(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: .12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 19, color: color),
        ),
        const SizedBox(height: 16),
        Text(value, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 3),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    ),
  );
}

class Panel extends StatelessWidget {
  const Panel({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.symmetric(vertical: 6),
    child: Padding(padding: const EdgeInsets.all(16), child: child),
  );
}

class Heading extends StatelessWidget {
  const Heading(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 20, bottom: 8),
    child: Text(
      text,
      style: Theme.of(
        context,
      ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600),
    ),
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
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Semantics(
        button: true,
        label: '$label: ${labels?[selected] ?? selected}',
        child: Material(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
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
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                        const SizedBox(height: 4),
                        Text(
                          labels?[selected] ?? selected,
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    CupertinoIcons.chevron_up_chevron_down,
                    size: 15,
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
  padding: const EdgeInsets.symmetric(vertical: 8),
  child: TextFormField(
    controller: controller,
    obscureText: password,
    keyboardType: number ? TextInputType.number : TextInputType.text,
    decoration: InputDecoration(labelText: label),
    validator: (v) => (v ?? '').trim().isEmpty ? 'Preencha este campo' : null,
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
