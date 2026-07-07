import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../services/firestore_service.dart';

String _currentMonth() => DateTime.now().toIso8601String().substring(0, 7);

class ParentAttendanceScreen extends StatefulWidget {
  const ParentAttendanceScreen(
      {super.key, required this.schoolId, required this.childId});

  final String schoolId;
  final String childId;

  @override
  State<ParentAttendanceScreen> createState() => _ParentAttendanceScreenState();
}

class _ParentAttendanceScreenState extends State<ParentAttendanceScreen> {
  String _month = _currentMonth();

  @override
  Widget build(BuildContext context) {
    final monthStart = '$_month-01';
    final monthEnd = '$_month-31';

    return Scaffold(
      appBar: AppBar(title: const Text('Attendance')),
      body: StreamBuilder<List<AttendanceRecord>>(
        stream: FirestoreService.collectionStream(
          'schools/${widget.schoolId}/attendance',
          AttendanceRecord.fromMap,
          build: (q) => q
              .where('studentId', isEqualTo: widget.childId)
              .where('date', isGreaterThanOrEqualTo: monthStart)
              .where('date', isLessThanOrEqualTo: monthEnd),
        ),
        builder: (context, snapshot) {
          final records = [...(snapshot.data ?? [])]
            ..sort((a, b) => a.date.compareTo(b.date));
          final present = records
              .where((r) => r.status == 'present' || r.status == 'late')
              .length;
          final pct =
              records.isEmpty ? null : (present / records.length * 100).round();

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    TextButton(
                      onPressed: () => setState(() {
                        final d = DateTime.parse('$_month-01');
                        _month = DateTime(d.year, d.month - 1)
                            .toIso8601String()
                            .substring(0, 7);
                      }),
                      child: const Icon(Icons.chevron_left),
                    ),
                    Text(_month,
                        style: Theme.of(context).textTheme.titleMedium),
                    TextButton(
                      onPressed: () => setState(() {
                        final d = DateTime.parse('$_month-01');
                        _month = DateTime(d.year, d.month + 1)
                            .toIso8601String()
                            .substring(0, 7);
                      }),
                      child: const Icon(Icons.chevron_right),
                    ),
                    const Spacer(),
                    if (pct != null) Text('$pct% present'),
                  ],
                ),
              ),
              Expanded(
                child: records.isEmpty
                    ? const Center(
                        child: Text('No attendance marked this month.'))
                    : ListView.builder(
                        itemCount: records.length,
                        itemBuilder: (context, i) {
                          final r = records[i];
                          return ListTile(
                              title: Text(r.date), trailing: Text(r.status));
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}
