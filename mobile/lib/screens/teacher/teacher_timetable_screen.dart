import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../services/firestore_service.dart';
import '../../widgets/timetable_view.dart';

T? _firstWhereOrNull<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

class TeacherTimetableScreen extends StatelessWidget {
  const TeacherTimetableScreen(
      {super.key,
      required this.schoolId,
      required this.teacher,
      required this.classIds});

  final String schoolId;
  final Teacher teacher;
  final List<String> classIds;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Timetable')),
      body: StreamBuilder<School?>(
        stream: FirestoreService.docStream('schools/$schoolId', School.fromMap),
        builder: (context, schoolSnap) {
          final workingDays =
              schoolSnap.data?.workingDays ?? const [1, 2, 3, 4, 5, 6];
          return StreamBuilder<List<SchoolClass>>(
            stream: FirestoreService.collectionStream(
                'schools/$schoolId/classes', SchoolClass.fromMap),
            builder: (context, classesSnap) {
              final classes = classesSnap.data ?? [];
              final myClasses =
                  classes.where((c) => classIds.contains(c.id)).toList();
              final homeRoomClass = _firstWhereOrNull(
                  classes, (c) => c.id == teacher.classTeacherOf);
              return StreamBuilder<List<Subject>>(
                stream: FirestoreService.collectionStream(
                    'schools/$schoolId/subjects', Subject.fromMap),
                builder: (context, subjectsSnap) {
                  final subjects = subjectsSnap.data ?? [];
                  if (classIds.isEmpty) {
                    return const Center(
                        child: Text("You're not assigned to any classes yet."));
                  }
                  return StreamBuilder<List<Teacher>>(
                    stream: FirestoreService.collectionStream(
                        'schools/$schoolId/teachers', Teacher.fromMap),
                    builder: (context, teachersSnap) {
                      final teachers = teachersSnap.data ?? [];
                      return StreamBuilder<List<Timetable>>(
                        stream: FirestoreService.collectionStream(
                          'schools/$schoolId/timetables',
                          Timetable.fromMap,
                          build: (q) => q.where(FieldPath.documentId,
                              whereIn: classIds.take(10).toList()),
                        ),
                        builder: (context, ttSnap) {
                          final timetables = ttSnap.data ?? [];

                          // "My Timetable" -- only the periods I personally
                          // teach, merged across every class I'm assigned a
                          // subject in (including my own home room, if I
                          // teach a subject there too). Each label is
                          // rewritten to include the class since periods are
                          // pooled from several classes.
                          final myPeriods = <TimetablePeriod>[];
                          for (final c in myClasses) {
                            final mySubjectIds = teacher.assignments
                                .where((a) => a.classId == c.id)
                                .map((a) => a.subjectId)
                                .toSet();
                            final timetable = _firstWhereOrNull(
                                timetables, (t) => t.id == c.id);
                            for (final p
                                in timetable?.periods ?? <TimetablePeriod>[]) {
                              if (p.subjectId == null ||
                                  !mySubjectIds.contains(p.subjectId)) continue;
                              final subjectName = _firstWhereOrNull(
                                          subjects, (s) => s.id == p.subjectId)
                                      ?.name ??
                                  p.subjectId!;
                              myPeriods.add(
                                TimetablePeriod(
                                  day: p.day,
                                  period: p.period,
                                  label: '$subjectName (${c.label})',
                                  startTime: p.startTime,
                                  endTime: p.endTime,
                                ),
                              );
                            }
                          }

                          final homeRoomTimetable = homeRoomClass == null
                              ? null
                              : _firstWhereOrNull(
                                  timetables, (t) => t.id == homeRoomClass.id);

                          return ListView(
                            padding: const EdgeInsets.all(16),
                            children: [
                              Text('My Timetable',
                                  style:
                                      Theme.of(context).textTheme.titleLarge),
                              const Padding(
                                padding: EdgeInsets.only(top: 2, bottom: 8),
                                child: Text(
                                    'Every period you personally teach, across all your classes.'),
                              ),
                              Card(
                                child: TimetableView(
                                    periods: myPeriods,
                                    workingDays: workingDays,
                                    subjects: subjects),
                              ),
                              if (homeRoomClass != null) ...[
                                const SizedBox(height: 20),
                                Text(
                                  'Class Teacher Timetable — ${homeRoomClass.label}',
                                  style: Theme.of(context).textTheme.titleLarge,
                                ),
                                const Padding(
                                  padding: EdgeInsets.only(top: 2, bottom: 8),
                                  child: Text(
                                      'The full schedule for your home-room class.'),
                                ),
                                Card(
                                  child: TimetableView(
                                    periods: homeRoomTimetable?.periods ?? [],
                                    workingDays: workingDays,
                                    subjects: subjects,
                                    classId: homeRoomClass.id,
                                    teachers: teachers,
                                  ),
                                ),
                              ],
                            ],
                          );
                        },
                      );
                    },
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}
