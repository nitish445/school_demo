import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../services/firestore_service.dart';

class TeacherMarksScreen extends StatefulWidget {
  const TeacherMarksScreen({
    super.key,
    required this.schoolId,
    required this.teacher,
    required this.classIds,
  });

  final String schoolId;
  final Teacher teacher;
  final List<String> classIds;

  @override
  State<TeacherMarksScreen> createState() => _TeacherMarksScreenState();
}

class _TeacherMarksScreenState extends State<TeacherMarksScreen> {
  String? _classId;
  String? _subjectId;
  String? _examId;
  final Map<String, TextEditingController> _controllers = {};
  bool _saving = false;

  List<Subject> _availableSubjects(List<Subject> all) {
    if (_classId == null) return [];
    if (widget.teacher.classTeacherOf == _classId) return all;
    final ids = widget.teacher.assignments.where((a) => a.classId == _classId).map((a) => a.subjectId).toSet();
    return all.where((s) => ids.contains(s.id)).toList();
  }

  @override
  void initState() {
    super.initState();
    _classId = widget.classIds.isNotEmpty ? widget.classIds.first : null;
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Upload Marks')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: StreamBuilder<List<SchoolClass>>(
              stream: FirestoreService.collectionStream('schools/${widget.schoolId}/classes', SchoolClass.fromMap),
              builder: (context, classSnap) {
                final classes =
                    (classSnap.data ?? []).where((c) => widget.classIds.contains(c.id)).toList();
                return StreamBuilder<List<Subject>>(
                  stream: FirestoreService.collectionStream('schools/${widget.schoolId}/subjects', Subject.fromMap),
                  builder: (context, subjSnap) {
                    final subjects = _availableSubjects(subjSnap.data ?? []);
                    return StreamBuilder<List<Exam>>(
                      stream: FirestoreService.collectionStream('schools/${widget.schoolId}/exams', Exam.fromMap),
                      builder: (context, examSnap) {
                        final exams = examSnap.data ?? [];
                        return Column(
                          children: [
                            DropdownButtonFormField<String>(
                              value: _classId,
                              decoration: const InputDecoration(labelText: 'Class'),
                              items: classes
                                  .map((c) => DropdownMenuItem(value: c.id, child: Text(c.label)))
                                  .toList(),
                              onChanged: (v) => setState(() {
                                _classId = v;
                                _subjectId = null;
                              }),
                            ),
                            const SizedBox(height: 8),
                            DropdownButtonFormField<String>(
                              value: _subjectId,
                              decoration: const InputDecoration(labelText: 'Subject'),
                              items: subjects
                                  .map((s) => DropdownMenuItem(value: s.id, child: Text(s.name)))
                                  .toList(),
                              onChanged: (v) => setState(() => _subjectId = v),
                            ),
                            const SizedBox(height: 8),
                            DropdownButtonFormField<String>(
                              value: _examId,
                              decoration: const InputDecoration(labelText: 'Exam'),
                              items: exams
                                  .map((e) => DropdownMenuItem(value: e.id, child: Text('${e.name} (${e.term})')))
                                  .toList(),
                              onChanged: (v) => setState(() => _examId = v),
                            ),
                          ],
                        );
                      },
                    );
                  },
                );
              },
            ),
          ),
          if (_classId != null && _subjectId != null && _examId != null)
            Expanded(
              child: StreamBuilder<List<Student>>(
                stream: FirestoreService.collectionStream(
                  'schools/${widget.schoolId}/students',
                  Student.fromMap,
                  build: (q) => q.where('classId', isEqualTo: _classId).where('status', isEqualTo: 'active'),
                ),
                builder: (context, studentSnap) {
                  final students = studentSnap.data ?? [];
                  return StreamBuilder<List<Marks>>(
                    stream: FirestoreService.collectionStream(
                      'schools/${widget.schoolId}/marks',
                      Marks.fromMap,
                      build: (q) => q.where('examId', isEqualTo: _examId),
                    ),
                    builder: (context, marksSnap) {
                      final marks = marksSnap.data ?? [];
                      return ListView(
                        children: [
                          for (final s in students)
                            ListTile(
                              title: Text(s.name),
                              subtitle: Text('Roll No. ${s.rollNo}'),
                              trailing: SizedBox(
                                width: 80,
                                child: TextField(
                                  controller: _controllerFor(
                                    s.id,
                                    marks.where((m) => m.studentId == s.id).map((m) => m.subjectMarks[_subjectId]).firstOrNull,
                                  ),
                                  keyboardType: TextInputType.number,
                                  decoration: const InputDecoration(isDense: true),
                                ),
                              ),
                            ),
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: FilledButton(
                              onPressed: _saving ? null : () => _save(students, marks),
                              child: Text(_saving ? 'Saving...' : 'Save Marks'),
                            ),
                          ),
                        ],
                      );
                    },
                  );
                },
              ),
            )
          else
            const Expanded(child: Center(child: Text('Choose a class, subject, and exam.'))),
        ],
      ),
    );
  }

  TextEditingController _controllerFor(String studentId, num? existingValue) {
    return _controllers.putIfAbsent(
      '$_examId-$_subjectId-$studentId',
      () => TextEditingController(text: existingValue?.toString() ?? ''),
    );
  }

  Future<void> _save(List<Student> students, List<Marks> existingMarks) async {
    if (_examId == null || _subjectId == null) return;
    setState(() => _saving = true);
    try {
      final batch = FirestoreService.batch();
      for (final s in students) {
        final controller = _controllers['$_examId-$_subjectId-${s.id}'];
        final text = controller?.text ?? '';
        if (text.isEmpty) continue;
        final value = num.tryParse(text);
        if (value == null) continue;
        final existing = existingMarks.where((m) => m.studentId == s.id).firstOrNull;
        final markId = '${_examId}_${s.id}';
        final updatedSubjectMarks = {...(existing?.subjectMarks ?? {}), _subjectId!: value};
        batch.set(
          FirestoreService.doc('schools/${widget.schoolId}/marks/$markId'),
          {'studentId': s.id, 'examId': _examId, 'subjectMarks': updatedSubjectMarks},
          SetOptions(merge: true),
        );
      }
      await batch.commit();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Marks saved.')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
