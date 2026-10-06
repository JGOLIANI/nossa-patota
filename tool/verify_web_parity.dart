import 'dart:io';

Future<void> main() async {
  final fixture = File('test/fixtures/parity.json').readAsStringSync();
  final runner = File('.dart_tool/web_parity.dart');
  await runner.writeAsString('''
import 'dart:convert';
import '../lib/domain.dart';
import '../lib/models.dart';
void main() {
  final fixture = jsonDecode(r\'''$fixture\''') as Json;
  final s = Snapshot(fixture['snapshot'] as Json);
  final random = mulberry32(seedFromString('flutter-parity'));
  for (final n in fixture['random'] as List) {
    if (random() != n) throw StateError('PRNG differs on web');
  }
  if (jsonEncode(generateTeams(s.players, s, 'flutter-parity')) != jsonEncode(fixture['teams'])) throw StateError('Teams differ on web');
  for (final r in (fixture['awards'] as Json).entries) {
    for (final type in awardLabels.keys) {
      if (tallyAward(s, r.key, type) != (r.value as Json)[type]) throw StateError('Awards differ on web');
    }
  }
  print('Web parity passed: PRNG, teams and awards.');
}
''');
  final compiler = await Process.run(Platform.resolvedExecutable, [
    'compile',
    'js',
    '-O2',
    runner.path,
    '-o',
    '.dart_tool/web_parity.js',
  ]);
  stdout.write(compiler.stdout);
  stderr.write(compiler.stderr);
  if (compiler.exitCode != 0) {
    exitCode = compiler.exitCode;
    return;
  }
  final result = await Process.run('node', ['.dart_tool/web_parity.js']);
  stdout.write(result.stdout);
  stderr.write(result.stderr);
  exitCode = result.exitCode;
}
