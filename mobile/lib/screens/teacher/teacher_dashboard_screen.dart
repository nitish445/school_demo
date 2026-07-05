import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';
import '../../widgets/avatar.dart';
import '../../widgets/badge_chip.dart';

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
    final outline = Theme.of(context).colorScheme.outline;

    return Scaffold(
      appBar: AppBar(
        title: Text(teacher.classTeacherOf != null ? 'Class Teacher' : 'Teacher'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () => auth.signOut(),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Avatar(name: teacher.name, photoUrl: teacher.photoUrl, size: 52),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(teacher.name, style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 2),
                        Text(
                          auth.user?.email ?? '',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: outline),
                        ),
                        const SizedBox(height: 6),
                        BadgeChip(
                          teacher.classTeacherOf != null ? 'Class Teacher' : 'Subject Teacher',
                          variant: BadgeVariant.brand,
                        ),
                      ],
                    ),
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
                  Row(
                    children: [
                      Icon(Icons.school_outlined, size: 18, color: outline),
                      const SizedBox(width: 8),
                      Text('Your Classes', style: Theme.of(context).textTheme.titleMedium),
                    ],
                  ),
                  const SizedBox(height: 12),
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
                      return Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: mine.map((c) => BadgeChip(c.label, variant: BadgeVariant.brand)).toList(),
                      );
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
                  Row(
                    children: [
                      Icon(Icons.campaign_outlined, size: 18, color: outline),
                      const SizedBox(width: 8),
                      Text('Latest Announcements', style: Theme.of(context).textTheme.titleMedium),
                    ],
                  ),
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
                        children: [
                          for (var i = 0; i < items.length; i++) ...[
                            if (i > 0) const Divider(height: 17),
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  margin: const EdgeInsets.only(top: 6),
                                  width: 6,
                                  height: 6,
                                  decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFFD97706)),
                                ),
                                const SizedBox(width: 10),
                                Expanded(child: Text(items[i].title)),
                              ],
                            ),
                          ],
                        ],
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
