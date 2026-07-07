import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';
import '../../widgets/gold_button.dart';

String _todayIso() => DateTime.now().toIso8601String().substring(0, 10);

const Map<String, String> _statusLabels = {
  'present': 'Present',
  'absent': 'Absent',
  'late': 'Late',
  'halfDay': 'Half Day',
  'medicalLeave': 'Medical Leave',
};

class TeacherAttendanceScreen extends StatefulWidget {
  const TeacherAttendanceScreen(
      {super.key, required this.schoolId, required this.classIds});

  final String schoolId;
  final List<String> classIds;

  @override
  State<TeacherAttendanceScreen> createState() =>
      _TeacherAttendanceScreenState();
}

class _TeacherAttendanceScreenState extends State<TeacherAttendanceScreen> {
  String? _classId;
  String _date = _todayIso();
  final Map<String, String> _statuses = {};
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mark Attendance')),
      body: StreamBuilder<List<SchoolClass>>(
        stream: FirestoreService.collectionStream(
            'schools/${widget.schoolId}/classes', SchoolClass.fromMap),
        builder: (context, classSnap) {
          final allClasses = classSnap.data ?? [];
          final myClasses =
              allClasses.where((c) => widget.classIds.contains(c.id)).toList();
          _classId ??= myClasses.isNotEmpty ? myClasses.first.id : null;

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        isExpanded: true,
                        value: _classId,
                        decoration: const InputDecoration(labelText: 'Class'),
                        items: myClasses
                            .map((c) => DropdownMenuItem(
                                value: c.id, child: Text(c.label)))
                            .toList(),
                        onChanged: (v) => setState(() => _classId = v),
                      ),
                    ),
                    const SizedBox(width: 12),
                    TextButton(
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: DateTime.parse(_date),
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2100),
                        );
                        if (picked != null) {
                          setState(() => _date =
                              picked.toIso8601String().substring(0, 10));
                        }
                      },
                      child: Text(_date),
                    ),
                  ],
                ),
              ),
              if (_classId == null)
                const Expanded(
                    child: Center(child: Text('No classes assigned yet.')))
              else
                Expanded(
                  child: StreamBuilder<List<Student>>(
                    stream: FirestoreService.collectionStream(
                      'schools/${widget.schoolId}/students',
                      Student.fromMap,
                      build: (q) => q
                          .where('classId', isEqualTo: _classId)
                          .where('status', isEqualTo: 'active'),
                    ),
                    builder: (context, studentSnap) {
                      final students = [...(studentSnap.data ?? [])]
                        ..sort((a, b) => a.rollNo.compareTo(b.rollNo));
                      return StreamBuilder<List<AttendanceRecord>>(
                        stream: FirestoreService.collectionStream(
                          'schools/${widget.schoolId}/attendance',
                          AttendanceRecord.fromMap,
                          build: (q) => q
                              .where('classId', isEqualTo: _classId)
                              .where('date', isEqualTo: _date),
                        ),
                        builder: (context, recordSnap) {
                          final records = recordSnap.data ?? [];
                          for (final s in students) {
                            _statuses.putIfAbsent(
                              s.id,
                              () =>
                                  records
                                      .where((r) => r.studentId == s.id)
                                      .map((r) => r.status)
                                      .firstOrNull ??
                                  'present',
                            );
                          }
                          return ListView.builder(
                            itemCount: students.length,
                            itemBuilder: (context, i) {
                              final s = students[i];
                              return ListTile(
                                title: Text(s.name),
                                subtitle: Text('Roll No. ${s.rollNo}'),
                                trailing: DropdownButton<String>(
                                  value: _statuses[s.id] ?? 'present',
                                  items: attendanceStatuses
                                      .map((v) => DropdownMenuItem(
                                          value: v,
                                          child: Text(_statusLabels[v]!)))
                                      .toList(),
                                  onChanged: (v) =>
                                      setState(() => _statuses[s.id] = v!),
                                ),
                              );
                            },
                          );
                        },
                      );
                    },
                  ),
                ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: SizedBox(
                  width: double.infinity,
                  child: GoldButton(
                    onPressed: _classId == null || _saving
                        ? null
                        : () => _save(context),
                    child: Text(_saving ? 'Saving...' : 'Save Attendance'),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _save(BuildContext context) async {
    final uid = context.read<AuthService>().user?.uid;
    if (uid == null || _classId == null) return;
    setState(() => _saving = true);
    try {
      final batch = FirestoreService.batch();
      final studentsSnap = await FirestoreService.collection(
              'schools/${widget.schoolId}/students')
          .where('classId', isEqualTo: _classId)
          .where('status', isEqualTo: 'active')
          .get();
      for (final doc in studentsSnap.docs) {
        final recordId = '${doc.id}_$_date';
        batch.set(
          FirestoreService.doc(
              'schools/${widget.schoolId}/attendance/$recordId'),
          {
            'studentId': doc.id,
            'classId': _classId,
            'date': _date,
            'status': _statuses[doc.id] ?? 'present',
            'markedBy': uid,
            'markedAt': DateTime.now().millisecondsSinceEpoch,
          },
        );
      }
      await batch.commit();
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Attendance saved.')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
