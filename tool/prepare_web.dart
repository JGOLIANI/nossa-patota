import 'dart:convert';
import 'dart:io';

// Cache only public application files, never API/auth responses.
Future<void> main(List<String> args) async {
  final root = Directory(args.isEmpty ? 'build/web' : args.first);
  if (!root.existsSync()) throw StateError('Execute flutter build web antes.');
  final files = root
      .listSync(recursive: true)
      .whereType<File>()
      .where(
        (f) =>
            !f.path.endsWith('.map') &&
            !f.path.endsWith('patota-sw.js') &&
            !f.path.endsWith('flutter_service_worker.js'),
      )
      .toList();
  final paths =
      files
          .map(
            (f) => f.path.substring(root.path.length + 1).replaceAll('\\', '/'),
          )
          .toList()
        ..sort();
  var hash = 2166136261;
  for (final file in files) {
    for (final byte in file.readAsBytesSync()) {
      hash = ((hash ^ byte) * 16777619) & 0xffffffff;
    }
  }
  final worker =
      '''
const FILES = ${jsonEncode(paths)};
const scope = new URL(self.registration.scope);
const PREFIX = 'patota-flutter-' + scope.pathname;
const CACHE = PREFIX + '$hash';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(path => new URL(path, scope).href))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith(PREFIX) && key !== CACHE) || (key.startsWith('workbox-') && key.includes(scope.href))).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const path = decodeURIComponent(url.pathname.slice(scope.pathname.length));
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(new URL('index.html', scope).href)));
  } else if (FILES.includes(path)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(new URL(path, scope).href).then(cached => cached || fetch(event.request))));
  }
});
''';
  await File('${root.path}/patota-sw.js').writeAsString(worker);
  stdout.writeln(
    'PWA: ${paths.length} arquivos de aplicação preparados para offline.',
  );
}
