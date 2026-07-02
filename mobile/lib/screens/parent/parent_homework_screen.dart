import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../services/firestore_service.dart';

class ParentHomeworkScreen extends StatelessWidget {
  const ParentHomeworkScreen({super.key, required this.schoolId, required this.childId});

  final String schoolId;
  final String childId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Homework')),
      body: StreamBuilder<List<Subject>>(
        stream: FirestoreService.collectionStream('schools/$schoolId/subjects', Subject.fromMap),
        builder: (context, subjectSnap) {
          final subjects = subjectSnap.data ?? [];
          return StreamBuilder<List<Homework>>(
            stream: FirestoreService.collectionStream(
              'schools/$schoolId/homework',
              Homework.fromMap,
              build: (q) => q.where('studentIds', arrayContains: childId),
            ),
            builder: (context, hwSnap) {
              final items = [...(hwSnap.data ?? [])]..sort((a, b) => a.dueDate.compareTo(b.dueDate));
              if (items.isEmpty) {
                return const Center(child: Text('No homework assigned yet.'));
              }
              return ListView.builder(
                itemCount: items.length,
                itemBuilder: (context, i) {
                  final h = items[i];
                  final subjectName =
                      subjects.where((s) => s.id == h.subjectId).map((s) => s.name).firstOrNull ?? '';
                  final completed = h.submissions[childId] == 'completed';
                  return ListTile(
                    title: Text(h.title),
                    subtitle: Text('$subjectName · Due ${h.dueDate}\n${h.description}'),
                    isThreeLine: true,
                    trailing: completed
                        ? const Icon(Icons.check_circle, color: Colors.green)
                        : TextButton(
                            onPressed: () => FirestoreService.doc('schools/$schoolId/homework/${h.id}').update({
                              'submissions.$childId': 'completed',
                            }),
                            child: const Text('Mark Done'),
                          ),
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

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
