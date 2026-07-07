import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../services/firestore_service.dart';
import '../../widgets/gold_button.dart';

const List<String> _dayNames = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat'
];
const List<int> _defaultWorkingDays = [1, 2, 3, 4, 5, 6];

/// Mirrors /web/app/admin/timetable/page.tsx: pick a class, edit its
/// per-day period schedule, and toggle which weekdays the school runs on.
/// Simplified vs. web's drag-grid TimetableEditor into a per-day list editor
/// -- functionally equivalent, just a different widget shape for mobile.
class AdminTimetableScreen extends StatefulWidget {
  const AdminTimetableScreen({super.key, required this.schoolId});

  final String schoolId;

  @override
  State<AdminTimetableScreen> createState() => _AdminTimetableScreenState();
}

class _AdminTimetableScreenState extends State<AdminTimetableScreen> {
  String? _classId;
  int _day = 1;
  List<TimetablePeriod>? _periods;
  bool _loadingPeriods = false;
  bool _saving = false;

  Future<void> _loadPeriods(String classId) async {
    setState(() => _loadingPeriods = true);
    final timetable = await FirestoreService.docGet(
        'schools/${widget.schoolId}/timetables/$classId', Timetable.fromMap);
    if (!mounted) return;
    setState(() {
      _periods = [...(timetable?.periods ?? [])];
      _loadingPeriods = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Timetable')),
      body: StreamBuilder<School?>(
        stream: FirestoreService.docStream(
            'schools/${widget.schoolId}', School.fromMap),
        builder: (context, schoolSnap) {
          final workingDays =
              schoolSnap.data?.workingDays ?? _defaultWorkingDays;
          if (!workingDays.contains(_day) && workingDays.isNotEmpty) {
            _day = workingDays.first;
          }

          return StreamBuilder<List<SchoolClass>>(
            stream: FirestoreService.collectionStream(
                'schools/${widget.schoolId}/classes', SchoolClass.fromMap),
            builder: (context, classesSnap) {
              final classes = <SchoolClass>[...(classesSnap.data ?? [])]
                ..sort((a, b) => a.label.compareTo(b.label));
              _classId ??= classes.isNotEmpty ? classes.first.id : null;
              if (_classId != null && _periods == null && !_loadingPeriods) {
                _loadPeriods(_classId!);
              }

              return StreamBuilder<List<Subject>>(
                stream: FirestoreService.collectionStream(
                    'schools/${widget.schoolId}/subjects', Subject.fromMap),
                builder: (context, subjectsSnap) {
                  final subjects = subjectsSnap.data ?? [];

                  return Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            DropdownButtonFormField<String>(
                              isExpanded: true,
                              value: _classId,
                              decoration:
                                  const InputDecoration(labelText: 'Class'),
                              items: classes
                                  .map((c) => DropdownMenuItem(
                                      value: c.id, child: Text(c.label)))
                                  .toList(),
                              onChanged: (v) {
                                setState(() {
                                  _classId = v;
                                  _periods = null;
                                });
                              },
                            ),
                            const SizedBox(height: 12),
                            const Text('School Days',
                                style: TextStyle(fontWeight: FontWeight.w600)),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              children: List.generate(7, (day) {
                                final on = workingDays.contains(day);
                                return FilterChip(
                                  label: Text(_dayNames[day]),
                                  selected: on,
                                  onSelected: (_) async {
                                    final next = on
                                        ? workingDays
                                            .where((d) => d != day)
                                            .toList()
                                        : ([...workingDays, day]..sort());
                                    await FirestoreService.doc(
                                            'schools/${widget.schoolId}')
                                        .update({'workingDays': next});
                                  },
                                );
                              }),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: [
                              for (final day in workingDays)
                                Padding(
                                  padding: const EdgeInsets.only(right: 8),
                                  child: ChoiceChip(
                                    label: Text(_dayNames[day]),
                                    selected: _day == day,
                                    onSelected: (_) =>
                                        setState(() => _day = day),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                      const Divider(height: 24),
                      Expanded(
                        child: _loadingPeriods || _periods == null
                            ? const Center(child: CircularProgressIndicator())
                            : _PeriodList(
                                periods: _periods!,
                                day: _day,
                                subjects: subjects,
                                onChanged: (updated) =>
                                    setState(() => _periods = updated),
                              ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: SizedBox(
                          width: double.infinity,
                          child: GoldButton(
                            onPressed:
                                _classId == null || _saving ? null : _save,
                            child:
                                Text(_saving ? 'Saving...' : 'Save Timetable'),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _save() async {
    if (_classId == null || _periods == null) return;
    setState(() => _saving = true);
    try {
      await FirestoreService.doc(
              'schools/${widget.schoolId}/timetables/$_classId')
          .set({
        'classId': _classId,
        'periods': _periods!
            .map((p) => {
                  'day': p.day,
                  'period': p.period,
                  'subjectId': p.subjectId,
                  'label': p.label,
                  'startTime': p.startTime,
                  'endTime': p.endTime,
                })
            .toList(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Timetable saved.')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

class _PeriodList extends StatelessWidget {
  const _PeriodList(
      {required this.periods,
      required this.day,
      required this.subjects,
      required this.onChanged});

  final List<TimetablePeriod> periods;
  final int day;
  final List<Subject> subjects;
  final ValueChanged<List<TimetablePeriod>> onChanged;

  @override
  Widget build(BuildContext context) {
    final dayPeriods = periods.where((p) => p.day == day).toList()
      ..sort((a, b) => a.period.compareTo(b.period));

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      children: [
        for (final p in dayPeriods)
          Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  SizedBox(
                    width: 68,
                    child: TextFormField(
                      initialValue: p.period.toString(),
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                          labelText: 'Per.', isDense: true),
                      onChanged: (v) =>
                          _update(p, period: int.tryParse(v) ?? p.period),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      isExpanded: true,
                      isDense: true,
                      value: p.subjectId,
                      decoration: const InputDecoration(labelText: 'Subject'),
                      items: [
                        const DropdownMenuItem<String>(
                            value: null,
                            child: Text('Non-teaching',
                                overflow: TextOverflow.ellipsis)),
                        ...subjects.map((s) => DropdownMenuItem<String>(
                            value: s.id,
                            child:
                                Text(s.name, overflow: TextOverflow.ellipsis))),
                      ],
                      onChanged: (v) => _update(p, subjectId: v),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () =>
                        onChanged(periods.where((x) => x != p).toList()),
                  ),
                ],
              ),
            ),
          ),
        OutlinedButton.icon(
          icon: const Icon(Icons.add),
          label: const Text('Add period'),
          onPressed: () {
            final nextPeriod =
                dayPeriods.isEmpty ? 1 : dayPeriods.last.period + 1;
            onChanged(
                [...periods, TimetablePeriod(day: day, period: nextPeriod)]);
          },
        ),
      ],
    );
  }

  void _update(TimetablePeriod original, {int? period, String? subjectId}) {
    final updated = periods
        .map((p) => p == original
            ? TimetablePeriod(
                day: p.day,
                period: period ?? p.period,
                subjectId: subjectId,
                label: p.label,
                startTime: p.startTime,
                endTime: p.endTime,
              )
            : p)
        .toList();
    onChanged(updated);
  }
}
