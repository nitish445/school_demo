import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';
import '../../services/leave_service.dart';
import '../../widgets/stat_card.dart';

String _todayIso() => DateTime.now().toIso8601String().substring(0, 10);

T? _firstWhereOrNull<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

/// Mirrors /web/app/admin/page.tsx: school-wide stat cards, pending leave
/// approvals, and the latest announcements.
class AdminDashboardScreen extends StatelessWidget {
  const AdminDashboardScreen({super.key, required this.schoolId});

  final String schoolId;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final outline = Theme.of(context).colorScheme.outline;
    final today = _todayIso();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () => auth.signOut(),
          ),
        ],
      ),
      body: StreamBuilder<List<Student>>(
        stream: FirestoreService.collectionStream(
            'schools/$schoolId/students', Student.fromMap),
        builder: (context, studentsSnap) {
          final students = studentsSnap.data ?? [];
          final activeStudents =
              students.where((s) => s.status == 'active').length;

          return StreamBuilder<List<Teacher>>(
            stream: FirestoreService.collectionStream(
                'schools/$schoolId/teachers', Teacher.fromMap),
            builder: (context, teachersSnap) {
              final teacherCount = (teachersSnap.data ?? []).length;

              return StreamBuilder<List<FeeRecord>>(
                stream: FirestoreService.collectionStream(
                    'schools/$schoolId/fees', FeeRecord.fromMap),
                builder: (context, feesSnap) {
                  final fees = feesSnap.data ?? [];
                  final pendingFees = fees.fold<num>(
                    0,
                    (sum, f) =>
                        sum +
                        (f.totalDue - f.totalPaid).clamp(0, double.infinity),
                  );

                  return StreamBuilder<List<AttendanceRecord>>(
                    stream: FirestoreService.collectionStream(
                      'schools/$schoolId/attendance',
                      AttendanceRecord.fromMap,
                      build: (q) => q.where('date', isEqualTo: today),
                    ),
                    builder: (context, attendanceSnap) {
                      final todayAttendance = attendanceSnap.data ?? [];
                      final present = todayAttendance
                          .where((a) =>
                              a.status == 'present' || a.status == 'late')
                          .length;
                      final attendancePct = todayAttendance.isEmpty
                          ? null
                          : (present / todayAttendance.length * 100).round();

                      return StreamBuilder<List<SchoolClass>>(
                        stream: FirestoreService.collectionStream(
                            'schools/$schoolId/classes', SchoolClass.fromMap),
                        builder: (context, classesSnap) {
                          final classes = classesSnap.data ?? [];

                          return StreamBuilder<List<Leave>>(
                            stream: FirestoreService.collectionStream(
                              'schools/$schoolId/leaves',
                              Leave.fromMap,
                              build: (q) =>
                                  q.where('status', isEqualTo: 'pending'),
                            ),
                            builder: (context, leavesSnap) {
                              final pendingLeaves = leavesSnap.data ?? [];

                              return StreamBuilder<List<Announcement>>(
                                stream: FirestoreService.collectionStream(
                                  'schools/$schoolId/announcements',
                                  Announcement.fromMap,
                                  build: (q) => q
                                      .orderBy('createdAt', descending: true)
                                      .limit(5),
                                ),
                                builder: (context, announcementsSnap) {
                                  final announcements =
                                      announcementsSnap.data ?? [];

                                  return ListView(
                                    padding: const EdgeInsets.all(16),
                                    children: [
                                      GridView.count(
                                        crossAxisCount: 2,
                                        shrinkWrap: true,
                                        physics:
                                            const NeverScrollableScrollPhysics(),
                                        mainAxisSpacing: 12,
                                        crossAxisSpacing: 12,
                                        childAspectRatio: 1.9,
                                        children: [
                                          StatCard(
                                            label: 'Students',
                                            value: '$activeStudents',
                                            icon: Icons.school_outlined,
                                            tint: StatCardTint.gold,
                                          ),
                                          StatCard(
                                            label: 'Teachers',
                                            value: '$teacherCount',
                                            icon: Icons.groups_outlined,
                                            tint: StatCardTint.sky,
                                          ),
                                          StatCard(
                                            label: "Today's Attendance",
                                            value: attendancePct == null
                                                ? '—'
                                                : '$attendancePct%',
                                            icon: Icons.checklist_outlined,
                                            tint: StatCardTint.emerald,
                                          ),
                                          StatCard(
                                            label: 'Pending Fees',
                                            value:
                                                '₹${pendingFees.toStringAsFixed(0)}',
                                            icon: Icons.payments_outlined,
                                            tint: StatCardTint.amber,
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 16),
                                      Card(
                                        child: Padding(
                                          padding: const EdgeInsets.all(16),
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Icon(
                                                      Icons
                                                          .calendar_month_outlined,
                                                      size: 18,
                                                      color: outline),
                                                  const SizedBox(width: 8),
                                                  Text('Pending Leave Requests',
                                                      style: Theme.of(context)
                                                          .textTheme
                                                          .titleMedium),
                                                ],
                                              ),
                                              const SizedBox(height: 12),
                                              if (pendingLeaves.isEmpty)
                                                const Text(
                                                    'No pending leave requests.')
                                              else
                                                Column(
                                                  children: [
                                                    for (var i = 0;
                                                        i <
                                                            pendingLeaves
                                                                .length;
                                                        i++) ...[
                                                      if (i > 0)
                                                        const Divider(
                                                            height: 21),
                                                      _PendingLeaveTile(
                                                        leave: pendingLeaves[i],
                                                        student: _firstWhereOrNull(
                                                            students,
                                                            (s) =>
                                                                s.id ==
                                                                pendingLeaves[i]
                                                                    .studentId),
                                                        schoolClass:
                                                            _firstWhereOrNull(
                                                                classes,
                                                                (c) =>
                                                                    c.id ==
                                                                    pendingLeaves[
                                                                            i]
                                                                        .classId),
                                                        onApprove: () async {
                                                          final uid =
                                                              auth.user?.uid;
                                                          if (uid == null)
                                                            return;
                                                          await approveLeave(
                                                              schoolId,
                                                              pendingLeaves[i],
                                                              uid);
                                                        },
                                                        onReject: () async {
                                                          final uid =
                                                              auth.user?.uid;
                                                          if (uid == null)
                                                            return;
                                                          await rejectLeave(
                                                              schoolId,
                                                              pendingLeaves[i]
                                                                  .id,
                                                              uid);
                                                        },
                                                      ),
                                                    ],
                                                  ],
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
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Icon(Icons.campaign_outlined,
                                                      size: 18, color: outline),
                                                  const SizedBox(width: 8),
                                                  Text('Latest Announcements',
                                                      style: Theme.of(context)
                                                          .textTheme
                                                          .titleMedium),
                                                ],
                                              ),
                                              const SizedBox(height: 8),
                                              if (announcements.isEmpty)
                                                const Text(
                                                    'No announcements yet.')
                                              else
                                                Column(
                                                  children: [
                                                    for (var i = 0;
                                                        i <
                                                            announcements
                                                                .length;
                                                        i++) ...[
                                                      if (i > 0)
                                                        const Divider(
                                                            height: 17),
                                                      Row(
                                                        crossAxisAlignment:
                                                            CrossAxisAlignment
                                                                .start,
                                                        children: [
                                                          Container(
                                                            margin:
                                                                const EdgeInsets
                                                                    .only(
                                                                    top: 6),
                                                            width: 6,
                                                            height: 6,
                                                            decoration: const BoxDecoration(
                                                                shape: BoxShape
                                                                    .circle,
                                                                color: Color(
                                                                    0xFFD97706)),
                                                          ),
                                                          const SizedBox(
                                                              width: 10),
                                                          Expanded(
                                                              child: Text(
                                                                  announcements[
                                                                          i]
                                                                      .title)),
                                                        ],
                                                      ),
                                                    ],
                                                  ],
                                                ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ],
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
              );
            },
          );
        },
      ),
    );
  }
}

class _PendingLeaveTile extends StatelessWidget {
  const _PendingLeaveTile({
    required this.leave,
    required this.student,
    required this.schoolClass,
    required this.onApprove,
    required this.onReject,
  });

  final Leave leave;
  final Student? student;
  final SchoolClass? schoolClass;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    final outline = Theme.of(context).colorScheme.outline;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: student?.name ?? leave.studentId,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    if (schoolClass != null)
                      TextSpan(
                          text: '  ${schoolClass!.label}',
                          style: TextStyle(color: outline)),
                  ],
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                '${leave.fromDate} → ${leave.toDate} — ${leave.reason}',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: outline),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Column(
          children: [
            TextButton(onPressed: onApprove, child: const Text('Approve')),
            TextButton(
              onPressed: onReject,
              style: TextButton.styleFrom(foregroundColor: Colors.red.shade700),
              child: const Text('Reject'),
            ),
          ],
        ),
      ],
    );
  }
}
