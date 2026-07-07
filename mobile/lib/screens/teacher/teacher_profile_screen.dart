import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';
import '../../widgets/badge_chip.dart';
import '../../widgets/profile_hero.dart';
import 'teacher_report_card_screen.dart';

T? _firstWhereOrNull<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

class TeacherProfileScreen extends StatelessWidget {
  const TeacherProfileScreen(
      {super.key, required this.schoolId, required this.teacher});

  final String schoolId;
  final Teacher teacher;

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
      body: StreamBuilder<List<SchoolClass>>(
        stream: FirestoreService.collectionStream(
            'schools/$schoolId/classes', SchoolClass.fromMap),
        builder: (context, classesSnap) {
          final classes = classesSnap.data ?? [];
          return StreamBuilder<List<Subject>>(
            stream: FirestoreService.collectionStream(
                'schools/$schoolId/subjects', Subject.fromMap),
            builder: (context, subjectsSnap) {
              final subjects = subjectsSnap.data ?? [];

              SchoolClass? findClass(String id) =>
                  _firstWhereOrNull(classes, (c) => c.id == id);
              Subject? findSubject(String id) =>
                  _firstWhereOrNull(subjects, (s) => s.id == id);

              final homeRoom = teacher.classTeacherOf != null
                  ? findClass(teacher.classTeacherOf!)
                  : null;
              final taught = teacher.assignments
                  .map((a) {
                    final c = findClass(a.classId);
                    final s = findSubject(a.subjectId);
                    return c != null && s != null
                        ? '${s.name} (${c.label})'
                        : null;
                  })
                  .whereType<String>()
                  .toList();

              return ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  ProfileHero(
                    uid: uid,
                    name: teacher.name,
                    subtitle: auth.user?.email,
                    photoUrl: teacher.photoUrl,
                    extraDocPaths: ['schools/$schoolId/teachers/$uid'],
                    badges: [
                      BadgeChip(teacher.classTeacherOf != null
                          ? 'Class Teacher'
                          : 'Subject Teacher'),
                      BadgeChip(
                        teacher.status == 'disabled' ? 'Disabled' : 'Active',
                        variant: teacher.status == 'disabled'
                            ? BadgeVariant.warning
                            : BadgeVariant.success,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Account Details',
                              style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 8),
                          Text(
                              'Employee ID: ${teacher.employeeId.isNotEmpty ? teacher.employeeId : '—'}'),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Teaching Assignments',
                              style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 8),
                          Text('Class Teacher Of: ${homeRoom?.label ?? '—'}'),
                          const SizedBox(height: 4),
                          Text(
                              'Subjects Taught: ${taught.isNotEmpty ? taught.join(', ') : '—'}'),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.assessment_outlined),
                      title: const Text('Student Report Cards'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () {
                        final classIds = <String>{
                          if (teacher.classTeacherOf != null)
                            teacher.classTeacherOf!,
                          ...teacher.assignedClassIds,
                        }.toList();
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => TeacherReportCardScreen(
                                schoolId: schoolId, classIds: classIds),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }
}
