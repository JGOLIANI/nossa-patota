import 'package:timezone/data/latest.dart' as data;
import 'package:timezone/timezone.dart' as tz;
import '../domain.dart';

bool _ready = false;
tz.Location patotaLocation(String name) {
  if (!_ready) {
    data.initializeTimeZones();
    _ready = true;
  }
  return tz.getLocation(name);
}

String patotaToday(String name, {DateTime? now}) =>
    dateISO(tz.TZDateTime.from(now ?? DateTime.now(), patotaLocation(name)));

DateTime scheduledInstant(String date, String time, String timezone) {
  final d = DateTime.parse(date);
  final parts = time.split(':');
  return tz.TZDateTime(
    patotaLocation(timezone),
    d.year,
    d.month,
    d.day,
    int.parse(parts[0]),
    int.parse(parts[1]),
  ).toUtc();
}
