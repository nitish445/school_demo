import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';
import '../../widgets/badge_chip.dart';
import '../../widgets/profile_hero.dart';
import 'parent_report_card_screen.dart';

class ParentProfileScreen extends StatelessWidget {
  const ParentProfileScreen({super.key, required this.schoolId, required this.childId});

  final String schoolId;
  final String childId;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final uid = auth.user!.uid;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [IconButton(icon: const Icon(Icons.logout), onPressed: () => auth.signOut())],
      ),
      body: StreamBuilder<ParentProfile?>(
        stream: FirestoreService.docStream('schools/$schoolId/parents/$uid', ParentProfile.fromMap),
        builder: (context, parentSnap) {
          final parent = parentSnap.data;
          return StreamBuilder<Student?>(
            stream: FirestoreService.docStream('schools/$schoolId/students/$childId', Student.fromMap),
            builder: (context, studentSnap) {
              final student = studentSnap.data;
              return ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  ProfileHero(
                    uid: uid,
                    name: parent?.name ?? 'Parent',
                    subtitle: auth.user?.email,
                    photoUrl: parent?.photoUrl,
                    extraDocPaths: ['schools/$schoolId/parents/$uid'],
                    badges: [
                      BadgeChip(
                        parent?.status == 'disabled' ? 'Disabled' : 'Active',
                        variant: parent?.status == 'disabled' ? BadgeVariant.warning : BadgeVariant.success,
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
                          Text('Student Details', style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 8),
                          Text('Name: ${student?.name ?? '—'}'),
                          Text('Admission No.: ${student?.admissionNo ?? '—'}'),
                          Text('Roll No.: ${student?.rollNo ?? '—'}'),
                          Text('Date of Birth: ${student?.dob ?? '—'}'),
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
                          Text('Emergency & Medical', style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 8),
                          Text('Emergency Contact: ${student?.emergencyContact ?? '—'}'),
                          Text('Medical Notes: ${student?.medicalNotes ?? '—'}'),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.assessment_outlined),
                      title: const Text('Report Card'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => ParentReportCardScreen(schoolId: schoolId, childId: childId),
                        ),
                      ),
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
