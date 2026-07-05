import 'package:flutter/material.dart';

import '../models/models.dart';

const List<String> _dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

T? _firstWhereOrNull<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

/// Read-only weekly schedule. Unlike the web app's 7-column grid, phone width
/// can't fit a full week side by side, so this shows one day per tab instead.
class TimetableView extends StatelessWidget {
  const TimetableView({
    super.key,
    required this.periods,
    required this.workingDays,
    required this.subjects,
    this.classId,
    this.teachers = const [],
  });

  final List<TimetablePeriod> periods;
  final List<int> workingDays;
  final List<Subject> subjects;
  /// Needed together with [teachers] to show who teaches each period; omit for merged/personal views.
  final String? classId;
  final List<Teacher> teachers;

  @override
  Widget build(BuildContext context) {
    if (periods.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Text('No timetable has been set up for this class yet.'),
      );
    }

    final days = [...workingDays]..sort();

    return DefaultTabController(
      length: days.length,
      child: SizedBox(
        height: 420,
        child: Column(
          children: [
            TabBar(
              isScrollable: true,
              tabs: days.map((d) => Tab(text: _dayNames[d])).toList(),
            ),
            Expanded(
              child: TabBarView(
                children: days
                    .map(
                      (d) => _DaySchedule(
                        day: d,
                        periods: periods,
                        subjects: subjects,
                        classId: classId,
                        teachers: teachers,
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DaySchedule extends StatelessWidget {
  const _DaySchedule({
    required this.day,
    required this.periods,
    required this.subjects,
    this.classId,
    this.teachers = const [],
  });

  final int day;
  final List<TimetablePeriod> periods;
  final List<Subject> subjects;
  final String? classId;
  final List<Teacher> teachers;

  @override
  Widget build(BuildContext context) {
    final dayPeriods = periods.where((p) => p.day == day).toList()..sort((a, b) => a.period.compareTo(b.period));
    if (dayPeriods.isEmpty) {
      return const Center(child: Text('No periods scheduled.'));
    }
    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: dayPeriods.length,
      separatorBuilder: (_, index) => const Divider(height: 1),
      itemBuilder: (context, i) {
        final p = dayPeriods[i];
        final subject = p.subjectId == null ? null : _firstWhereOrNull(subjects, (s) => s.id == p.subjectId);
        final title = subject?.name ?? p.label ?? '—';
        final teacherName = (classId != null && p.subjectId != null)
            ? _firstWhereOrNull(
                teachers,
                (t) => t.assignments.any((a) => a.classId == classId && a.subjectId == p.subjectId),
              )?.name
            : null;
        final time = (p.startTime != null || p.endTime != null) ? '${p.startTime ?? ''}–${p.endTime ?? ''}' : null;
        final subtitleParts = [if (teacherName != null) teacherName, if (time != null) time];
        return ListTile(
          dense: true,
          leading: CircleAvatar(radius: 14, child: Text('${p.period}', style: const TextStyle(fontSize: 12))),
          title: Text(title),
          subtitle: subtitleParts.isEmpty ? null : Text(subtitleParts.join(' · ')),
        );
      },
    );
  }
}
