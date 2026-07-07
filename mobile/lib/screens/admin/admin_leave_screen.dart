import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';
import '../../services/leave_service.dart';
import '../../widgets/badge_chip.dart';

T? _firstWhereOrNull<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

const List<String> _statusFilters = ['', 'pending', 'approved', 'rejected'];
const Map<String, String> _statusLabels = {
  '': 'All',
  'pending': 'Pending',
  'approved': 'Approved',
  'rejected': 'Rejected',
};
const Map<String, BadgeVariant> _statusVariant = {
  'pending': BadgeVariant.warning,
  'approved': BadgeVariant.success,
  'rejected': BadgeVariant.danger,
};

/// Mirrors /web/app/admin/leave/page.tsx: every leave request submitted
/// school-wide, filterable by status, with approve/reject for pending ones.
class AdminLeaveScreen extends StatefulWidget {
  const AdminLeaveScreen({super.key, required this.schoolId});

  final String schoolId;

  @override
  State<AdminLeaveScreen> createState() => _AdminLeaveScreenState();
}

class _AdminLeaveScreenState extends State<AdminLeaveScreen> {
  String _statusFilter = '';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Leave History')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final status in _statusFilters)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(_statusLabels[status]!),
                        selected: _statusFilter == status,
                        onSelected: (_) =>
                            setState(() => _statusFilter = status),
                      ),
                    ),
                ],
              ),
            ),
          ),
          Expanded(
            child: StreamBuilder<List<Leave>>(
              stream: FirestoreService.collectionStream(
                  'schools/${widget.schoolId}/leaves', Leave.fromMap),
              builder: (context, leavesSnap) {
                if (leavesSnap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                var leaves = leavesSnap.data ?? [];
                if (_statusFilter.isNotEmpty) {
                  leaves =
                      leaves.where((l) => l.status == _statusFilter).toList();
                }
                leaves = [...leaves]
                  ..sort((a, b) => b.fromDate.compareTo(a.fromDate));

                if (leaves.isEmpty) {
                  return const Center(child: Text('No leave requests yet.'));
                }

                return StreamBuilder<List<Student>>(
                  stream: FirestoreService.collectionStream(
                      'schools/${widget.schoolId}/students', Student.fromMap),
                  builder: (context, studentsSnap) {
                    final students = studentsSnap.data ?? [];
                    return StreamBuilder<List<SchoolClass>>(
                      stream: FirestoreService.collectionStream(
                          'schools/${widget.schoolId}/classes',
                          SchoolClass.fromMap),
                      builder: (context, classesSnap) {
                        final classes = classesSnap.data ?? [];
                        return ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: leaves.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 10),
                          itemBuilder: (context, i) {
                            final leave = leaves[i];
                            final student = _firstWhereOrNull(
                                students, (s) => s.id == leave.studentId);
                            final schoolClass = _firstWhereOrNull(
                                classes, (c) => c.id == leave.classId);
                            return _LeaveCard(
                              leave: leave,
                              studentName: student?.name ?? leave.studentId,
                              classLabel: schoolClass?.label,
                              onApprove: () async {
                                final uid =
                                    context.read<AuthService>().user?.uid;
                                if (uid == null) return;
                                await approveLeave(widget.schoolId, leave, uid);
                              },
                              onReject: () async {
                                final uid =
                                    context.read<AuthService>().user?.uid;
                                if (uid == null) return;
                                await rejectLeave(
                                    widget.schoolId, leave.id, uid);
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
          ),
        ],
      ),
    );
  }
}

class _LeaveCard extends StatelessWidget {
  const _LeaveCard({
    required this.leave,
    required this.studentName,
    required this.classLabel,
    required this.onApprove,
    required this.onReject,
  });

  final Leave leave;
  final String studentName;
  final String? classLabel;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    final outline = Theme.of(context).colorScheme.outline;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                            text: studentName,
                            style:
                                const TextStyle(fontWeight: FontWeight.w600)),
                        if (classLabel != null)
                          TextSpan(
                              text: '  $classLabel',
                              style: TextStyle(color: outline, fontSize: 13)),
                      ],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                BadgeChip(leave.status,
                    variant:
                        _statusVariant[leave.status] ?? BadgeVariant.neutral),
              ],
            ),
            const SizedBox(height: 6),
            Text('${leave.fromDate} → ${leave.toDate}',
                style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 2),
            Text(leave.reason,
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: outline)),
            if (leave.status == 'pending') ...[
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                      onPressed: onApprove, child: const Text('Approve')),
                  TextButton(
                    onPressed: onReject,
                    style: TextButton.styleFrom(
                        foregroundColor: Colors.red.shade700),
                    child: const Text('Reject'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
