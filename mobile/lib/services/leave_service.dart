import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/models.dart';
import 'firestore_service.dart';

DateTime _parseIsoUtc(String isoDate) {
  final parts = isoDate.split('-').map(int.parse).toList();
  return DateTime.utc(parts[0], parts[1], parts[2]);
}

String _formatIsoUtc(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

List<String> _enumerateDates(String fromDate, String toDate) {
  final dates = <String>[];
  final end = _parseIsoUtc(toDate);
  var cursor = _parseIsoUtc(fromDate);
  while (!cursor.isAfter(end)) {
    dates.add(_formatIsoUtc(cursor));
    cursor = cursor.add(const Duration(days: 1));
  }
  return dates;
}

/// Approves a leave request and auto-marks attendance as `medicalLeave` for
/// every day in the leave's date range. Mirrors /web/lib/leave.ts -- a
/// sensible starting point, not a lock; attendance can still be corrected
/// afterward from Mark Attendance.
Future<void> approveLeave(
    String schoolId, Leave leave, String approverUid) async {
  final batch = FirestoreService.batch();
  batch.update(FirestoreService.doc('schools/$schoolId/leaves/${leave.id}'), {
    'status': 'approved',
    'approvedBy': approverUid,
  });

  for (final date in _enumerateDates(leave.fromDate, leave.toDate)) {
    final recordId = '${leave.studentId}_$date';
    batch.set(
      FirestoreService.doc('schools/$schoolId/attendance/$recordId'),
      {
        'studentId': leave.studentId,
        'classId': leave.classId,
        'date': date,
        'status': 'medicalLeave',
        'markedBy': approverUid,
        'markedAt': DateTime.now().millisecondsSinceEpoch,
      },
      SetOptions(merge: true),
    );
  }

  await batch.commit();
}

Future<void> rejectLeave(String schoolId, String leaveId, String approverUid) {
  return FirestoreService.doc('schools/$schoolId/leaves/$leaveId').update({
    'status': 'rejected',
    'approvedBy': approverUid,
  });
}
