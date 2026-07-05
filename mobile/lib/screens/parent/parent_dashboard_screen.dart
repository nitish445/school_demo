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
    final outline = Theme.of(context).colorScheme.outline;

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
                        return _StatCard(
                          label: 'Today',
                          value: status,
                          icon: Icons.event_available_outlined,
                          tint: const Color(0xFF10B981),
                        );
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
                        return _StatCard(
                          label: 'Homework Due',
                          value: '$pending',
                          icon: Icons.menu_book_outlined,
                          tint: const Color(0xFFD97706),
                        );
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
                  return _StatCard(
                    label: 'Fees Pending',
                    value: '₹${pending.toStringAsFixed(0)}',
                    icon: Icons.payments_outlined,
                    tint: const Color(0xFF0284C7),
                  );
                },
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
                          Text('Latest Notices', style: Theme.of(context).textTheme.titleMedium),
                        ],
                      ),
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
                                      decoration: const BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: Color(0xFFD97706),
                                      ),
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
      },
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value, required this.icon, required this.tint});

  final String label;
  final String value;
  final IconData icon;
  final Color tint;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: tint.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              alignment: Alignment.center,
              child: Icon(icon, size: 18, color: tint),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: Theme.of(context).textTheme.bodySmall),
                  const SizedBox(height: 2),
                  Text(value, style: Theme.of(context).textTheme.titleMedium),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
