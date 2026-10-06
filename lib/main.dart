import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'data/backend.dart';
import 'store.dart';
import 'ui/auth.dart';
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
              padding: const EdgeInsets.all(24),
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
          final store = widget.store;
          if (!store.ready) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          if (!store.signedIn) return LoginPage(store);
          if (store.backend.recoveryPending) {
            return PasswordPage(store, requiredChange: true);
          }
          if (store.current?.mustChangePassword == true) {
            return PasswordPage(store, requiredChange: true);
          }
          final path = Uri.tryParse(route.name ?? '/')?.pathSegments ?? [];
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
        if (!store.signedIn) return LoginPage(store);
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
    final dark = Theme.of(context).brightness == Brightness.dark;
    final navIndices = [0, 2, 3, 1];
    final navLabels = ['Início', 'Partidas', 'Rankings', 'Elenco'];
    final navIcons = [
      CupertinoIcons.house,
      CupertinoIcons.calendar,
      CupertinoIcons.rosette,
      CupertinoIcons.person_2,
    ];
    return Scaffold(
      appBar: IosHeader(
        title: selected == 0
            ? 'Olá, ${store.current?.name.split(' ').first ?? 'jogador'}'
            : selected == 1
            ? 'Elenco'
            : titles[selected],
        store: store,
        onProfile: () => setState(() => selected = 4),
        action: store.isAdmin && [1, 2].contains(selected)
            ? CupertinoButton(
                padding: const EdgeInsets.all(8),
                onPressed: () => openPage(
                  context,
                  selected == 1 ? PlayerForm(store) : NewRoundPage(store),
                ),
                child: Semantics(
                  label: selected == 1 ? 'Adicionar jogador' : 'Nova partida',
                  child: const Icon(CupertinoIcons.add, size: 24),
                ),
              )
            : null,
      ),
      body: Column(
        children: [
          if (store.backend.demo)
            Container(
              width: double.infinity,
              color: dark ? const Color(0xff2e2312) : const Color(0xfffff2e5),
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Text(
                'Modo demonstração · dados só neste aparelho',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 11,
                  color: dark
                      ? const Color(0xffff9f0a)
                      : const Color(0xffb25000),
                ),
              ),
            ),
          if (store.busy) const LinearProgressIndicator(),
          Expanded(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 512),
                child: IndexedStack(
                  key: ValueKey(store.snapshot.activePatotaId),
                  index: selected,
                  children: pages,
                ),
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        color: dark ? const Color(0xff1c1c1e) : const Color(0xfff9f9fb),
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 512),
            child: CupertinoTabBar(
              currentIndex: navIndices.indexOf(selected).clamp(0, 3),
              onTap: (i) => setState(() => selected = navIndices[i]),
              activeColor: Theme.of(context).colorScheme.primary,
              inactiveColor: dark
                  ? const Color(0xff68686e)
                  : const Color(0xffa3a3a8),
              backgroundColor: dark
                  ? const Color(0xff1c1c1e)
                  : const Color(0xfff9f9fb),
              iconSize: 26,
              height: 52,
              items: List.generate(
                4,
                (i) => BottomNavigationBarItem(
                  icon: Icon(navIcons[i]),
                  label: navLabels[i],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
