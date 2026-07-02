import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';

String _todayIso() => DateTime.now().toIso8601String().substring(0, 10);

class ParentDashboardScreen extends StatelessWidget {
  const ParentDashboardScreen({super.key, required this.schoolId, required this.childId});

  final String schoolId;
  final String childId;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    return StreamBuilder<Student?>(
      stream: FirestoreService.docStream('schools/$schoolId/students/$childId', Student.fromMap),
      builder: (context, studentSnap) {
        final student = studentSnap.data;
        return Scaffold(
          appBar: AppBar(
            title: Text(student?.name ?? 'Dashboard'),
            actions: [IconButton(icon: const Icon(Icons.logout), onPressed: () => auth.signOut())],
          ),
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Expanded(
                    child: StreamBuilder<List<AttendanceRecord>>(
                      stream: FirestoreService.collectionStream(
                        'schools/$schoolId/attendance',
                        AttendanceRecord.fromMap,
                        build: (q) => q
                            .where('studentId', isEqualTo: childId)
                            .where('date', isEqualTo: _todayIso()),
                      ),
                      builder: (context, snap) {
                        final status = snap.data?.isNotEmpty == true ? snap.data!.first.status : 'Not marked';
                        return _StatCard(label: 'Today', value: status);
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: StreamBuilder<List<Homework>>(
                      stream: FirestoreService.collectionStream(
                        'schools/$schoolId/homework',
                        Homework.fromMap,
                        build: (q) => q.where('studentIds', arrayContains: childId),
                      ),
                      builder: (context, snap) {
                        final pending = (snap.data ?? [])
                            .where((h) => h.submissions[childId] != 'completed')
                            .length;
                        return _StatCard(label: 'Homework Due', value: '$pending');
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              StreamBuilder<FeeRecord?>(
                stream: FirestoreService.docStream('schools/$schoolId/fees/$childId', FeeRecord.fromMap),
                builder: (context, snap) {
                  final fee = snap.data;
                  final pending = fee == null ? 0 : (fee.totalDue - fee.totalPaid).clamp(0, double.infinity);
                  return _StatCard(label: 'Fees Pending', value: '₹${pending.toStringAsFixed(0)}');
                },
              ),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Latest Notices', style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 8),
                      StreamBuilder<List<Announcement>>(
                        stream: FirestoreService.collectionStream(
                          'schools/$schoolId/announcements',
                          Announcement.fromMap,
                          build: (q) => q.orderBy('createdAt', descending: true).limit(5),
                        ),
                        builder: (context, snap) {
                          final items = snap.data ?? [];
                          if (items.isEmpty) return const Text('No announcements yet.');
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: items
                                .map((a) => Padding(
                                      padding: const EdgeInsets.only(bottom: 6),
                                      child: Text('• ${a.title}'),
                                    ))
                                .toList(),
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
      },
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 4),
            Text(value, style: Theme.of(context).textTheme.titleMedium),
          ],
        ),
      ),
    );
  }
}
