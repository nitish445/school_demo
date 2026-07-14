import '../models/models.dart';

T? _firstWhereOrNull<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

/// Every period a teacher personally teaches, merged across all the classes
/// they're assigned a subject in -- each period's label is rewritten to
/// include the class since periods are pooled from several timetables.
/// Shared by TeacherTimetableScreen ("My Timetable") and the dashboard's
/// "Right Now" card so the two can never disagree about what counts as
/// "mine".
List<TimetablePeriod> myMergedPeriods({
  required List<SchoolClass> myClasses,
  required Teacher teacher,
  required List<Timetable> timetables,
  required List<Subject> subjects,
}) {
  final periods = <TimetablePeriod>[];
  for (final c in myClasses) {
    final mySubjectIds = teacher.assignments
        .where((a) => a.classId == c.id)
        .map((a) => a.subjectId)
        .toSet();
    final timetable = _firstWhereOrNull(timetables, (t) => t.id == c.id);
    for (final p in timetable?.periods ?? const <TimetablePeriod>[]) {
      if (p.subjectId == null || !mySubjectIds.contains(p.subjectId)) continue;
      final subjectName =
          _firstWhereOrNull(subjects, (s) => s.id == p.subjectId)?.name ??
              p.subjectId!;
      periods.add(
        TimetablePeriod(
          day: p.day,
          period: p.period,
          subjectId: p.subjectId,
          label: '$subjectName (${c.label})',
          startTime: p.startTime,
          endTime: p.endTime,
        ),
      );
    }
  }
  return periods;
}

int? _parseMinutes(String? hhmm) {
  if (hhmm == null) return null;
  final parts = hhmm.split(':');
  if (parts.length != 2) return null;
  final h = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  if (h == null || m == null) return null;
  return h * 60 + m;
}

/// The period covering `now`, if any -- matched by day-of-week (0=Sun..6=Sat,
/// same convention as TimetablePeriod.day) and start/end time. Periods
/// without both times (e.g. a label-only "Assembly" slot with no times set)
/// can never be "ongoing" since there's nothing to compare against.
TimetablePeriod? currentPeriod(List<TimetablePeriod> periods, DateTime now) {
  final day = now.weekday % 7;
  final nowMinutes = now.hour * 60 + now.minute;
  for (final p in periods) {
    if (p.day != day) continue;
    final start = _parseMinutes(p.startTime);
    final end = _parseMinutes(p.endTime);
    if (start == null || end == null) continue;
    if (nowMinutes >= start && nowMinutes < end) return p;
  }
  return null;
}
