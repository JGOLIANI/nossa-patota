import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'data/backend.dart';
import 'store.dart';
import 'ui/auth.dart';
import 'ui/onboarding.dart';
import 'ui/common.dart';
import 'ui/home.dart';
import 'ui/players.dart';
import 'ui/rounds.dart';
import 'ui/settings.dart';
import 'ui/patotas.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    const rawUrl = String.fromEnvironment('SUPABASE_URL');
    const key = String.fromEnvironment(
      'SUPABASE_PUBLISHABLE_KEY',
      defaultValue: String.fromEnvironment('SUPABASE_ANON_KEY'),
    );
    const environment = String.fromEnvironment('APP_ENV', defaultValue: 'dev');
    if (!['dev', 'homolog', 'prod'].contains(environment)) {
      throw Exception('APP_ENV deve ser dev, homolog ou prod.');
    }
    final url = normalizeProjectUrl(rawUrl);
    if (url.isEmpty != key.isEmpty) {
      throw Exception('Informe SUPABASE_URL e SUPABASE_ANON_KEY juntos.');
    }
    final Backend backend;
    if (url.isNotEmpty) {
      await Supabase.initialize(url: url, anonKey: key);
      backend = SupabaseBackend(Supabase.instance.client);
    } else {
      if (environment != 'dev') {
        throw Exception('Configure o Supabase para este ambiente.');
      }
      backend = await DemoBackend.load();
    }
    final store = AppStore(backend);
    runApp(PatotaApp(store));
    await store.initialize();
  } catch (e) {
    runApp(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(PatotaSpace.xl),
              child: SelectableText(
                'Não foi possível iniciar o aplicativo.\n${translateError(e)}',
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class PatotaApp extends StatefulWidget {
  const PatotaApp(this.store, {super.key});
  final AppStore store;
  @override
  State<PatotaApp> createState() => _PatotaAppState();
}

class _PatotaAppState extends State<PatotaApp> {
  final navigator = GlobalKey<NavigatorState>();
  bool? wasSignedIn;
  String? previousPatota;
  @override
  void initState() {
    super.initState();
    widget.store.addListener(sessionChanged);
  }

  void sessionChanged() {
    if (wasSignedIn == true && !widget.store.signedIn) {
      navigator.currentState?.popUntil((r) => r.isFirst);
    }
    wasSignedIn = widget.store.signedIn;
    final id = widget.store.snapshot.activePatotaId;
    if (previousPatota != null && id != null && previousPatota != id) {
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => navigator.currentState?.popUntil((r) => r.isFirst),
      );
    }
    if (id != null) previousPatota = id;
  }

  @override
  void dispose() {
    widget.store.removeListener(sessionChanged);
    widget.store.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Nossa Patota',
    navigatorKey: navigator,
    debugShowCheckedModeBanner: false,
    theme: appTheme(Brightness.light),
    darkTheme: appTheme(Brightness.dark),
    locale: const Locale('pt', 'BR'),
    supportedLocales: const [Locale('pt', 'BR')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    onGenerateRoute: (route) => MaterialPageRoute<void>(
      settings: route,
      builder: (context) => ListenableBuilder(
        listenable: widget.store,
        builder: (context, _) {
          final path = Uri.tryParse(route.name ?? '/')?.pathSegments ?? [];
          if (path.length == 1 && path.single == 'onboarding') {
            return const OnboardingPreviewPage();
          }
          final store = widget.store;
          if (!store.ready) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          if (!store.signedIn) return EntryPage(store);
          if (store.backend.recoveryPending) {
            return PasswordPage(store, requiredChange: true);
          }
          if (store.current?.mustChangePassword == true) {
            return PasswordPage(store, requiredChange: true);
          }
          if (store.snapshot.activePatotaId == null) return PatotasPage(store);
          if (path.length == 2 && path[0] == 'jogadores') {
            return PlayerDetail(store, path[1]);
          }
          if (path.length == 2 && path[0] == 'partidas') {
            return LiveMatchPage(store, path[1]);
          }
          if (path.length == 2 && path[0] == 'rodadas') {
            return path[1] == 'nova'
                ? NewRoundPage(store)
                : RoundDetail(store, path[1]);
          }
          if (path.isNotEmpty && path[0] == 'admin') {
            return path.length == 2 && path[1] == 'agenda'
                ? SettingsPage(store)
                : AdminPage(store);
          }
          final tab =
              {
                'jogadores': 1,
                'rodadas': 2,
                'rankings': 3,
                'perfil': 4,
              }[path.firstOrNull] ??
              0;
          return AppShell(store, initialTab: tab);
        },
      ),
    ),
    home: ListenableBuilder(
      listenable: widget.store,
      builder: (context, _) {
        final store = widget.store;
        if (!store.ready) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (!store.signedIn) return EntryPage(store);
        if (store.backend.recoveryPending) {
          return PasswordPage(store, requiredChange: true);
        }
        if (store.current?.mustChangePassword == true) {
          return PasswordPage(store, requiredChange: true);
        }
        if (store.snapshot.activePatotaId == null) return PatotasPage(store);
        return AppShell(store);
      },
    ),
  );
}

class AppShell extends StatefulWidget {
  const AppShell(this.store, {super.key, this.initialTab = 0});
  final AppStore store;
  final int initialTab;
  @override
  State<AppShell> createState() => _ShellState();
}

class _ShellState extends State<AppShell> {
  late int selected = widget.initialTab;
  static const titles = [
    'Início',
    'Jogadores',
    'Partidas',
    'Rankings',
    'Perfil',
  ];
  @override
  Widget build(BuildContext context) {
    final store = widget.store;
    final pages = [
      HomePage(store),
      PlayersPage(store),
      RoundsPage(store),
      RankingsPage(store),
      ProfilePage(store),
    ];
    final scheme = Theme.of(context).colorScheme;
    final compactNav =
        MediaQuery.textScalerOf(context).scale(PatotaType.caption) >
            PatotaType.caption * 1.3 &&
        MediaQuery.sizeOf(context).width <= PatotaLayout.contentWidth;
    final navIndices = [0, 2, 3, 1, 4];
    final navLabels = ['Início', 'Partidas', 'Rankings', 'Elenco', 'Perfil'];
    final navIcons = [
      Icons.home_rounded,
      Icons.calendar_month_rounded,
      Icons.emoji_events_rounded,
      Icons.groups_rounded,
      Icons.person_rounded,
    ];
    return Scaffold(
      appBar: PreferredSize(
        preferredSize: Size.fromHeight(
          PatotaSpace.touch +
              PatotaSpace.xl +
              PatotaSpace.sm +
              MediaQuery.textScalerOf(context).scale(PatotaType.heading) * 1.3,
        ),
        child: IosHeader(
          title: selected == 0
              ? 'Olá, ${store.current?.name.split(' ').first ?? 'jogador'}'
              : selected == 1
              ? 'Elenco'
              : titles[selected],
          store: store,
          onProfile: () => setState(() => selected = 4),
          action: store.isAdmin && [1, 2].contains(selected)
              ? IconButton(
                  onPressed: () => openPage(
                    context,
                    selected == 1 ? PlayerForm(store) : NewRoundPage(store),
                  ),
                  icon: Semantics(
                    label: selected == 1 ? 'Adicionar jogador' : 'Nova partida',
                    child: const Icon(Icons.add_circle_rounded, size: 28),
                  ),
                )
              : null,
        ),
      ),
      body: Column(
        children: [
          if (store.backend.demo)
            Container(
              width: double.infinity,
              color: scheme.secondaryContainer,
              padding: const EdgeInsets.symmetric(
                vertical: PatotaSpace.sm,
                horizontal: PatotaSpace.lg,
              ),
              child: Text(
                'Modo demonstração · dados só neste aparelho',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: PatotaType.caption,
                  fontWeight: FontWeight.w600,
                  color: scheme.onSecondaryContainer,
                ),
              ),
            ),
          if (store.busy) const LinearProgressIndicator(),
          Expanded(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(
                  maxWidth: PatotaLayout.contentWidth,
                ),
                child: IndexedStack(
                  key: ValueKey(store.snapshot.activePatotaId),
                  index: selected,
                  children: List.generate(
                    pages.length,
                    (i) => Offstage(
                      offstage: i != selected,
                      child: TickerMode(
                        enabled: i == selected,
                        child: ExcludeFocus(
                          excluding: i != selected,
                          child: pages[i],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: scheme.surface,
          border: Border(
            top: BorderSide(color: scheme.outlineVariant, width: 2),
          ),
        ),
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              maxWidth: PatotaLayout.contentWidth,
            ),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.all(PatotaSpace.sm),
                child: Row(
                  children: List.generate(navIndices.length, (i) {
                    final active = selected == navIndices[i];
                    final colour = active
                        ? scheme.primary
                        : scheme.onSurfaceVariant;
                    return Expanded(
                      flex: compactNav && active ? 2 : 1,
                      child: Semantics(
                        selected: active,
                        button: true,
                        label: navLabels[i],
                        child: Material(
                          color: PatotaColors.transparent,
                          child: InkWell(
                            borderRadius: BorderRadius.circular(
                              PatotaRadius.lg,
                            ),
                            onTap: () =>
                                setState(() => selected = navIndices[i]),
                            child: AnimatedContainer(
                              duration: PatotaMotion.duration(
                                context,
                                PatotaMotion.fast,
                              ),
                              constraints: const BoxConstraints(minHeight: 64),
                              padding: const EdgeInsets.symmetric(
                                vertical: PatotaSpace.sm,
                                horizontal: PatotaSpace.xs,
                              ),
                              decoration: BoxDecoration(
                                color: active
                                    ? scheme.primaryContainer
                                    : PatotaColors.transparent,
                                borderRadius: BorderRadius.circular(
                                  PatotaRadius.lg,
                                ),
                              ),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(navIcons[i], color: colour, size: 26),
                                  if (!compactNav || active)
                                    const SizedBox(height: PatotaSpace.xs),
                                  if (!compactNav || active)
                                    Text(
                                      navLabels[i],
                                      maxLines: 2,
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: PatotaType.caption,
                                        fontWeight: active
                                            ? FontWeight.w800
                                            : FontWeight.w600,
                                        color: colour,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  }),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
