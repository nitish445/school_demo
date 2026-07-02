import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';

class TeacherDashboardScreen extends StatelessWidget {
  const TeacherDashboardScreen({
    super.key,
    required this.schoolId,
    required this.teacher,
    required this.classIds,
  });

  final String schoolId;
  final Teacher teacher;
  final List<String> classIds;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    return Scaffold(
      appBar: AppBar(
        title: Text(teacher.classTeacherOf != null ? 'Class Teacher' : 'Teacher'),
        actions: [
          IconButton(icon: const Icon(Icons.logout), onPressed: () => auth.signOut()),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Signed in as ${auth.user?.email}', style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Your Classes', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  StreamBuilder<List<SchoolClass>>(
                    stream: FirestoreService.collectionStream(
                      'schools/$schoolId/classes',
                      SchoolClass.fromMap,
                    ),
                    builder: (context, snapshot) {
                      final all = snapshot.data ?? [];
                      final mine = all.where((c) => classIds.contains(c.id)).toList();
                      if (mine.isEmpty) {
                        return const Text('No classes assigned yet.');
                      }
                      return Text(mine.map((c) => c.label).join(', '));
                    },
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Latest Announcements', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  StreamBuilder<List<Announcement>>(
                    stream: FirestoreService.collectionStream(
                      'schools/$schoolId/announcements',
                      Announcement.fromMap,
                      build: (q) => q.orderBy('createdAt', descending: true).limit(5),
                    ),
                    builder: (context, snapshot) {
                      final items = snapshot.data ?? [];
                      if (items.isEmpty) return const Text('No announcements yet.');
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: items.map((a) => Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Text('• ${a.title}'),
                        )).toList(),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
