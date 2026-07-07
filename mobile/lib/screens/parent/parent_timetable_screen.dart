import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../services/firestore_service.dart';
import '../../widgets/timetable_view.dart';

class ParentTimetableScreen extends StatelessWidget {
  const ParentTimetableScreen(
      {super.key, required this.schoolId, required this.childId});

  final String schoolId;
  final String childId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Timetable')),
      body: StreamBuilder<Student?>(
        stream: FirestoreService.docStream(
            'schools/$schoolId/students/$childId', Student.fromMap),
        builder: (context, studentSnap) {
          final classId = studentSnap.data?.classId;
          if (classId == null)
            return const Center(child: CircularProgressIndicator());
          return StreamBuilder<School?>(
            stream:
                FirestoreService.docStream('schools/$schoolId', School.fromMap),
            builder: (context, schoolSnap) {
              final workingDays =
                  schoolSnap.data?.workingDays ?? const [1, 2, 3, 4, 5, 6];
              return StreamBuilder<List<Subject>>(
                stream: FirestoreService.collectionStream(
                    'schools/$schoolId/subjects', Subject.fromMap),
                builder: (context, subjectsSnap) {
                  final subjects = subjectsSnap.data ?? [];
                  return StreamBuilder<List<Teacher>>(
                    stream: FirestoreService.collectionStream(
                        'schools/$schoolId/teachers', Teacher.fromMap),
                    builder: (context, teachersSnap) {
                      final teachers = teachersSnap.data ?? [];
                      return StreamBuilder<Timetable?>(
                        stream: FirestoreService.docStream(
                            'schools/$schoolId/timetables/$classId',
                            Timetable.fromMap),
                        builder: (context, ttSnap) {
                          return Padding(
                            padding: const EdgeInsets.all(16),
                            child: TimetableView(
                              periods: ttSnap.data?.periods ?? [],
                              workingDays: workingDays,
                              subjects: subjects,
                              classId: classId,
                              teachers: teachers,
                            ),
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
