import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../services/firestore_service.dart';

T? _firstWhereOrNull<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

String _newComponentId() => DateTime.now().microsecondsSinceEpoch.toString();

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
  List<ExamComponent> _components = [];
  String? _componentsLoadedFor;
  // "studentId-componentId" -> controller
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

  String? get _componentSetId =>
      (_examId != null && _classId != null && _subjectId != null) ? '${_examId}_${_classId}_$_subjectId' : null;

  // The class teacher of this class already has approval authority, so
  // their own entry doesn't need a separate rubber-stamp; anyone else's
  // entry (a subject-only teacher) starts pending and needs the class
  // teacher or an admin to approve it before a parent can see it.
  bool get _isApprover => widget.teacher.classTeacherOf == _classId;

  Future<void> _approve(ExamComponentSet cs) async {
    await FirestoreService.doc('schools/${widget.schoolId}/examComponents/${cs.id}').update({
      'approved': true,
      'approvedBy': widget.teacher.name,
      'approvedAt': DateTime.now().millisecondsSinceEpoch,
    });
  }

  void _addComponentRow() {
    setState(() {
      _components = [
        ..._components,
        ExamComponent(id: _newComponentId(), title: '', maxMark: 100, weightage: 0),
      ];
    });
  }

  void _removeComponentRow(int i) {
    setState(() => _components = [..._components]..removeAt(i));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Marks')),
      body: Column(
        children: [
          if (widget.teacher.classTeacherOf != null)
            StreamBuilder<List<ExamComponentSet>>(
              stream: FirestoreService.collectionStream(
                'schools/${widget.schoolId}/examComponents',
                ExamComponentSet.fromMap,
                build: (q) => q.where('classId', isEqualTo: widget.teacher.classTeacherOf),
              ),
              builder: (context, snap) {
                final pending =
                    (snap.data ?? []).where((cs) => !cs.approved && cs.components.isNotEmpty).toList();
                if (pending.isEmpty) return const SizedBox.shrink();
                return StreamBuilder<List<Exam>>(
                  stream: FirestoreService.collectionStream('schools/${widget.schoolId}/exams', Exam.fromMap),
                  builder: (context, examSnap) {
                    final allExams = examSnap.data ?? [];
                    return StreamBuilder<List<Subject>>(
                      stream:
                          FirestoreService.collectionStream('schools/${widget.schoolId}/subjects', Subject.fromMap),
                      builder: (context, subjSnap) {
                        final allSubjects = subjSnap.data ?? [];
                        return Container(
                          width: double.infinity,
                          margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade50,
                            border: Border.all(color: Colors.amber.shade200),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Marks Awaiting Your Approval (${pending.length})',
                                  style: Theme.of(context).textTheme.titleSmall),
                              const SizedBox(height: 8),
                              for (final cs in pending)
                                Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 4),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          '${_firstWhereOrNull(allSubjects, (s) => s.id == cs.subjectId)?.name ?? cs.subjectId} — '
                                          '${_firstWhereOrNull(allExams, (e) => e.id == cs.examId)?.name ?? cs.examId}',
                                          style: const TextStyle(fontSize: 13),
                                        ),
                                      ),
                                      TextButton(
                                        onPressed: () => _approve(cs),
                                        child: const Text('Approve'),
                                      ),
                                    ],
                                  ),
                                ),
                            ],
                          ),
                        );
                      },
                    );
                  },
                );
              },
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: StreamBuilder<List<SchoolClass>>(
              stream: FirestoreService.collectionStream('schools/${widget.schoolId}/classes', SchoolClass.fromMap),
              builder: (context, classSnap) {
                final classes = (classSnap.data ?? []).where((c) => widget.classIds.contains(c.id)).toList();
                return StreamBuilder<List<Subject>>(
                  stream: FirestoreService.collectionStream('schools/${widget.schoolId}/subjects', Subject.fromMap),
                  builder: (context, subjSnap) {
                    final subjects = _availableSubjects(subjSnap.data ?? []);
                    return StreamBuilder<List<Exam>>(
                      stream: FirestoreService.collectionStream('schools/${widget.schoolId}/exams', Exam.fromMap),
                      builder: (context, examSnap) {
                        final allExams = examSnap.data ?? [];
                        // Admin schedules by grade (applies to every section
                        // in it), not a specific class.
                        final myGrade = _firstWhereOrNull(classes, (c) => c.id == _classId)?.grade;
                        final availableExams = allExams
                            .where(
                              (e) => e.schedule.any((s) => s['grade'] == myGrade && s['subjectId'] == _subjectId),
                            )
                            .toList();
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
                                _examId = null;
                              }),
                            ),
                            const SizedBox(height: 8),
                            DropdownButtonFormField<String>(
                              value: _subjectId,
                              decoration: const InputDecoration(labelText: 'Subject'),
                              items: subjects
                                  .map((s) => DropdownMenuItem(value: s.id, child: Text(s.name)))
                                  .toList(),
                              onChanged: (v) => setState(() {
                                _subjectId = v;
                                _examId = null;
                              }),
                            ),
                            const SizedBox(height: 8),
                            DropdownButtonFormField<String>(
                              value: _examId,
                              decoration: const InputDecoration(labelText: 'Exam'),
                              items: availableExams
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
              child: StreamBuilder<ExamComponentSet?>(
                stream: FirestoreService.docStream(
                  'schools/${widget.schoolId}/examComponents/$_componentSetId',
                  ExamComponentSet.fromMap,
                ),
                builder: (context, componentSetSnap) {
                  final componentSetId = _componentSetId;
                  if (_componentsLoadedFor != componentSetId) {
                    _componentsLoadedFor = componentSetId;
                    _components = componentSetSnap.data?.components ?? [];
                  }

                  final approved = componentSetSnap.data?.approved ?? false;
                  final approvedBy = componentSetSnap.data?.approvedBy;
                  return ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Row(
                        children: [
                          Text('Assessment Components', style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(width: 8),
                          if (componentSetSnap.data != null)
                            Text(
                              approved ? 'Approved by ${approvedBy ?? 'class teacher'}' : 'Pending approval',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: approved ? Colors.green.shade700 : Colors.amber.shade800,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      for (var i = 0; i < _components.length; i++)
                        Padding(
                          key: ValueKey(_components[i].id),
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            children: [
                              Expanded(
                                flex: 3,
                                child: TextFormField(
                                  initialValue: _components[i].title,
                                  decoration: const InputDecoration(labelText: 'Title', isDense: true),
                                  onChanged: (v) => _components[i] =
                                      ExamComponent(
                                        id: _components[i].id,
                                        title: v,
                                        maxMark: _components[i].maxMark,
                                        weightage: _components[i].weightage,
                                      ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: TextFormField(
                                  initialValue: _components[i].maxMark.toString(),
                                  decoration: const InputDecoration(labelText: 'Max', isDense: true),
                                  keyboardType: TextInputType.number,
                                  onChanged: (v) => _components[i] =
                                      ExamComponent(
                                        id: _components[i].id,
                                        title: _components[i].title,
                                        maxMark: num.tryParse(v) ?? _components[i].maxMark,
                                        weightage: _components[i].weightage,
                                      ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: TextFormField(
                                  initialValue: _components[i].weightage.toString(),
                                  decoration: const InputDecoration(labelText: 'Weight %', isDense: true),
                                  keyboardType: TextInputType.number,
                                  onChanged: (v) => _components[i] =
                                      ExamComponent(
                                        id: _components[i].id,
                                        title: _components[i].title,
                                        maxMark: _components[i].maxMark,
                                        weightage: num.tryParse(v) ?? _components[i].weightage,
                                      ),
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.close, size: 18),
                                onPressed: () => _removeComponentRow(i),
                              ),
                            ],
                          ),
                        ),
                      TextButton(onPressed: _addComponentRow, child: const Text('+ Add component')),
                      const Divider(height: 32),
                      if (_components.isEmpty)
                        const Text('Add at least one component above to start entering marks.')
                      else
                        StreamBuilder<List<Student>>(
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
                                return Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Marks', style: Theme.of(context).textTheme.titleMedium),
                                    const SizedBox(height: 8),
                                    for (final s in students)
                                      Padding(
                                        padding: const EdgeInsets.only(bottom: 12),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text('${s.name}  ·  Roll No. ${s.rollNo}',
                                                style: Theme.of(context).textTheme.titleSmall),
                                            const SizedBox(height: 6),
                                            Wrap(
                                              spacing: 10,
                                              runSpacing: 8,
                                              children: [
                                                for (final c in _components)
                                                  SizedBox(
                                                    width: 110,
                                                    child: TextField(
                                                      controller: _controllerFor(
                                                        s.id,
                                                        c.id,
                                                        _firstWhereOrNull(marks, (m) => m.studentId == s.id)
                                                            ?.componentMarks[_subjectId]?[c.id],
                                                      ),
                                                      keyboardType: TextInputType.number,
                                                      decoration: InputDecoration(
                                                        isDense: true,
                                                        labelText: '${c.title} (/${c.maxMark})',
                                                      ),
                                                    ),
                                                  ),
                                              ],
                                            ),
                                            const SizedBox(height: 8),
                                            TextField(
                                              controller: _remarkControllerFor(
                                                s.id,
                                                _firstWhereOrNull(marks, (m) => m.studentId == s.id)
                                                    ?.remarks[_subjectId],
                                              ),
                                              decoration: const InputDecoration(
                                                isDense: true,
                                                labelText: 'Remark (optional)',
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    FilledButton(
                                      onPressed: _saving ? null : () => _save(students, marks),
                                      child: Text(_saving ? 'Saving...' : 'Save Components & Marks'),
                                    ),
                                  ],
                                );
                              },
                            );
                          },
                        ),
                    ],
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

  TextEditingController _controllerFor(String studentId, String componentId, num? existingValue) {
    final key = '$studentId-$componentId';
    final controller = _controllers.putIfAbsent(
      key,
      () => TextEditingController(text: existingValue?.toString() ?? ''),
    );
    if (existingValue != null && controller.text.isEmpty) {
      controller.text = existingValue.toString();
    }
    return controller;
  }

  TextEditingController _remarkControllerFor(String studentId, String? existingValue) {
    final key = '$studentId-remark';
    final controller = _controllers.putIfAbsent(
      key,
      () => TextEditingController(text: existingValue ?? ''),
    );
    if ((existingValue ?? '').isNotEmpty && controller.text.isEmpty) {
      controller.text = existingValue!;
    }
    return controller;
  }

  // Persists the component definitions first, then the marks that reference
  // them -- previously these were two separate buttons, which meant a
  // teacher could enter marks against components that were never actually
  // written to `examComponents`. The marks would "save" but a parent's
  // Report Card (which reads components from that collection, not from
  // whatever's on screen) could never resolve them.
  Future<void> _save(List<Student> students, List<Marks> existingMarks) async {
    final componentSetId = _componentSetId;
    if (_examId == null || _subjectId == null || componentSetId == null) return;
    setState(() => _saving = true);
    try {
      await FirestoreService.doc('schools/${widget.schoolId}/examComponents/$componentSetId').set({
        'examId': _examId,
        'classId': _classId,
        'subjectId': _subjectId,
        'components': _components
            .where((c) => c.title.isNotEmpty)
            .map((c) => {'id': c.id, 'title': c.title, 'maxMark': c.maxMark, 'weightage': c.weightage})
            .toList(),
        'approved': _isApprover,
        'approvedBy': _isApprover ? widget.teacher.name : null,
        'approvedAt': _isApprover ? DateTime.now().millisecondsSinceEpoch : null,
      });

      final batch = FirestoreService.batch();
      for (final s in students) {
        final enteredComponentMarks = <String, num>{};
        for (final c in _components) {
          final controller = _controllers['${s.id}-${c.id}'];
          final text = controller?.text ?? '';
          if (text.isEmpty) continue;
          final value = num.tryParse(text);
          if (value == null) continue;
          enteredComponentMarks[c.id] = value;
        }
        final remark = (_controllers['${s.id}-remark']?.text ?? '').trim();
        if (enteredComponentMarks.isEmpty && remark.isEmpty) continue;

        final existing = _firstWhereOrNull(existingMarks, (m) => m.studentId == s.id);
        final markId = '${_examId}_${s.id}';
        final updatedComponentMarks = {...existing?.componentMarks ?? {}};
        updatedComponentMarks[_subjectId!] = {
          ...(updatedComponentMarks[_subjectId] ?? {}),
          ...enteredComponentMarks,
        };
        final updatedRemarks = {...existing?.remarks ?? {}};
        updatedRemarks[_subjectId!] = remark;
        batch.set(
          FirestoreService.doc('schools/${widget.schoolId}/marks/$markId'),
          {
            'studentId': s.id,
            'examId': _examId,
            'componentMarks': updatedComponentMarks,
            'remarks': updatedRemarks,
          },
          SetOptions(merge: true),
        );
      }
      await batch.commit();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Components and marks saved.')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}
