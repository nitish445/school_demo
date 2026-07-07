import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../services/firestore_service.dart';

T? _firstWhereOrNull<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

String _completionRate(Homework hw) {
  final total = hw.studentIds.length;
  if (total == 0) return '—';
  final done = hw.submissions.values.where((s) => s == 'completed').length;
  final pct = (done / total * 100).round();
  return '$pct% ($done/$total)';
}

/// Mirrors /web/app/admin/homework/page.tsx: a read-only, school-wide view
/// -- homework is created and graded by class/subject teachers, not admins.
class AdminHomeworkScreen extends StatelessWidget {
  const AdminHomeworkScreen({super.key, required this.schoolId});

  final String schoolId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Homework')),
      body: StreamBuilder<List<Homework>>(
        stream: FirestoreService.collectionStream(
          'schools/$schoolId/homework',
          Homework.fromMap,
          build: (q) => q.orderBy('dueDate', descending: true),
        ),
        builder: (context, homeworkSnap) {
          if (homeworkSnap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final homework = homeworkSnap.data ?? [];

          return StreamBuilder<List<SchoolClass>>(
            stream: FirestoreService.collectionStream(
                'schools/$schoolId/classes', SchoolClass.fromMap),
            builder: (context, classesSnap) {
              final classes = classesSnap.data ?? [];
              return StreamBuilder<List<Subject>>(
                stream: FirestoreService.collectionStream(
                    'schools/$schoolId/subjects', Subject.fromMap),
                builder: (context, subjectsSnap) {
                  final subjects = subjectsSnap.data ?? [];

                  if (homework.isEmpty) {
                    return const Center(
                        child: Text('No homework has been assigned yet.'));
                  }

                  return ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: homework.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      final h = homework[i];
                      final cls =
                          _firstWhereOrNull(classes, (c) => c.id == h.classId);
                      final subject = _firstWhereOrNull(
                          subjects, (s) => s.id == h.subjectId);
                      return Card(
                        child: ListTile(
                          title: Text(h.title),
                          subtitle: Text(
                            '${cls?.label ?? '—'} · ${subject?.name ?? '—'} · Due ${h.dueDate}',
                          ),
                          trailing: Text(_completionRate(h)),
                        ),
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
