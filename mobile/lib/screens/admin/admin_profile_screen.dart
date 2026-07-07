import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';
import '../../widgets/badge_chip.dart';
import '../../widgets/profile_hero.dart';

T? _firstWhereOrNull<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

/// Mirrors /web/app/admin/profile/page.tsx: the admin's own display profile
/// (name/photo/designation), plus teaching info if they also teach a class.
class AdminProfileScreen extends StatelessWidget {
  const AdminProfileScreen({super.key, required this.schoolId});

  final String schoolId;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final uid = auth.user!.uid;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          IconButton(
              icon: const Icon(Icons.logout), onPressed: () => auth.signOut())
        ],
      ),
      body: StreamBuilder<AppUserProfile?>(
        stream:
            FirestoreService.docStream('users/$uid', AppUserProfile.fromMap),
        builder: (context, userSnap) {
          if (userSnap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final profile = userSnap.data;
          final name = profile?.displayName.isNotEmpty == true
              ? profile!.displayName
              : 'Admin';
          final designation = profile?.designation ?? 'teacher';

          return StreamBuilder<Teacher?>(
            stream: FirestoreService.docStream(
                'schools/$schoolId/teachers/$uid', Teacher.fromMap),
            builder: (context, teacherSnap) {
              final teacher = teacherSnap.data;

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

                      final homeRoom = teacher?.classTeacherOf != null
                          ? _firstWhereOrNull(
                              classes, (c) => c.id == teacher!.classTeacherOf)
                          : null;
                      final taught = (teacher?.assignments ?? [])
                          .map((a) {
                            final c = _firstWhereOrNull(
                                classes, (cls) => cls.id == a.classId);
                            final s = _firstWhereOrNull(
                                subjects, (sub) => sub.id == a.subjectId);
                            return c != null && s != null
                                ? '${s.name} (${c.label})'
                                : null;
                          })
                          .whereType<String>()
                          .toList();
                      final hasTeachingInfo =
                          homeRoom != null || taught.isNotEmpty;

                      return ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          ProfileHero(
                            uid: uid,
                            name: name,
                            subtitle: auth.user?.email,
                            photoUrl: profile?.photoUrl,
                            extraDocPaths: [
                              'schools/$schoolId/admins/$uid',
                              if (teacher != null)
                                'schools/$schoolId/teachers/$uid',
                            ],
                            badges: [
                              BadgeChip(
                                  adminDesignationLabels[designation] ??
                                      'Admin',
                                  variant: BadgeVariant.brand),
                              BadgeChip(
                                profile?.status == 'disabled'
                                    ? 'Disabled'
                                    : 'Active',
                                variant: profile?.status == 'disabled'
                                    ? BadgeVariant.warning
                                    : BadgeVariant.success,
                              ),
                            ],
                          ),
                          if (hasTeachingInfo) ...[
                            const SizedBox(height: 12),
                            Card(
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Teaching Assignments',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleMedium),
                                    const SizedBox(height: 8),
                                    Text(
                                        'Class Teacher Of: ${homeRoom?.label ?? '—'}'),
                                    const SizedBox(height: 4),
                                    Text(
                                        'Subjects Taught: ${taught.isNotEmpty ? taught.join(', ') : '—'}'),
                                  ],
                                ),
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
      ),
    );
  }
}
