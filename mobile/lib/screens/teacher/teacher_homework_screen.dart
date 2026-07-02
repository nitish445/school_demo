import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';

class TeacherHomeworkScreen extends StatelessWidget {
  const TeacherHomeworkScreen({
    super.key,
    required this.schoolId,
    required this.teacher,
    required this.classIds,
  });

  final String schoolId;
  final Teacher teacher;
  final List<String> classIds;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Homework')),
      floatingActionButton: classIds.isEmpty
          ? null
          : FloatingActionButton(
              onPressed: () => _openAssignSheet(context),
              child: const Icon(Icons.add),
            ),
      body: classIds.isEmpty
          ? const Center(child: Text('No classes assigned yet.'))
          : StreamBuilder<List<SchoolClass>>(
              stream: FirestoreService.collectionStream('schools/$schoolId/classes', SchoolClass.fromMap),
              builder: (context, classSnap) {
                final classes = classSnap.data ?? [];
                return StreamBuilder<List<Subject>>(
                  stream: FirestoreService.collectionStream('schools/$schoolId/subjects', Subject.fromMap),
                  builder: (context, subjectSnap) {
                    final subjects = subjectSnap.data ?? [];
                    return StreamBuilder<List<Homework>>(
                      stream: FirestoreService.collectionStream(
                        'schools/$schoolId/homework',
                        Homework.fromMap,
                        build: (q) => q.where('classId', whereIn: classIds.take(10).toList()),
                      ),
                      builder: (context, hwSnap) {
                        final items = hwSnap.data ?? [];
                        if (items.isEmpty) {
                          return const Center(child: Text('No homework assigned yet.'));
                        }
                        return ListView.builder(
                          itemCount: items.length,
                          itemBuilder: (context, i) {
                            final h = items[i];
                            final cls = classes.where((c) => c.id == h.classId).firstOrNull;
                            final subject = subjects.where((s) => s.id == h.subjectId).firstOrNull;
                            final total = h.studentIds.length;
                            final done = h.submissions.values.where((v) => v == 'completed').length;
                            return ListTile(
                              title: Text(h.title),
                              subtitle: Text(
                                '${cls?.label ?? ''} · ${subject?.name ?? ''} · Due ${h.dueDate}\n'
                                '$done/$total completed',
                              ),
                              isThreeLine: true,
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

  void _openAssignSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AssignHomeworkSheet(schoolId: schoolId, teacher: teacher, classIds: classIds),
    );
  }
}

class _AssignHomeworkSheet extends StatefulWidget {
  const _AssignHomeworkSheet({required this.schoolId, required this.teacher, required this.classIds});

  final String schoolId;
  final Teacher teacher;
  final List<String> classIds;

  @override
  State<_AssignHomeworkSheet> createState() => _AssignHomeworkSheetState();
}

class _AssignHomeworkSheetState extends State<_AssignHomeworkSheet> {
  String? _classId;
  String? _subjectId;
  final _titleController = TextEditingController();
  final _descController = TextEditingController();
  String _dueDate = DateTime.now().toIso8601String().substring(0, 10);
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _classId = widget.classIds.isNotEmpty ? widget.classIds.first : null;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    super.dispose();
  }

  List<Subject> _availableSubjects(List<Subject> all) {
    if (_classId == null) return [];
    if (widget.teacher.classTeacherOf == _classId) return all;
    final ids = widget.teacher.assignments.where((a) => a.classId == _classId).map((a) => a.subjectId).toSet();
    return all.where((s) => ids.contains(s.id)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: StreamBuilder<List<SchoolClass>>(
        stream: FirestoreService.collectionStream('schools/${widget.schoolId}/classes', SchoolClass.fromMap),
        builder: (context, classSnap) {
          final classes = (classSnap.data ?? []).where((c) => widget.classIds.contains(c.id)).toList();
          return StreamBuilder<List<Subject>>(
            stream: FirestoreService.collectionStream('schools/${widget.schoolId}/subjects', Subject.fromMap),
            builder: (context, subjectSnap) {
              final subjects = _availableSubjects(subjectSnap.data ?? []);
              return Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Assign Homework', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _classId,
                    decoration: const InputDecoration(labelText: 'Class'),
                    items: classes.map((c) => DropdownMenuItem(value: c.id, child: Text(c.label))).toList(),
                    onChanged: (v) => setState(() {
                      _classId = v;
                      _subjectId = null;
                    }),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _subjectId,
                    decoration: const InputDecoration(labelText: 'Subject'),
                    items: subjects.map((s) => DropdownMenuItem(value: s.id, child: Text(s.name))).toList(),
                    onChanged: (v) => setState(() => _subjectId = v),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _titleController,
                    decoration: const InputDecoration(labelText: 'Title'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _descController,
                    decoration: const InputDecoration(labelText: 'Description'),
                    maxLines: 3,
                  ),
                  const SizedBox(height: 12),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('Due date: $_dueDate'),
                    trailing: const Icon(Icons.calendar_today),
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: DateTime.now(),
                        firstDate: DateTime.now(),
                        lastDate: DateTime(2100),
                      );
                      if (picked != null) {
                        setState(() => _dueDate = picked.toIso8601String().substring(0, 10));
                      }
                    },
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: _submitting ? null : _submit,
                    child: Text(_submitting ? 'Saving...' : 'Assign'),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _submit() async {
    final uid = context.read<AuthService>().user?.uid;
    if (uid == null || _classId == null || _subjectId == null || _titleController.text.isEmpty) return;
    setState(() => _submitting = true);
    try {
      final rosterSnap = await FirestoreService.collection('schools/${widget.schoolId}/students')
          .where('classId', isEqualTo: _classId)
          .where('status', isEqualTo: 'active')
          .get();
      final studentIds = rosterSnap.docs.map((d) => d.id).toList();
      final submissions = {for (final id in studentIds) id: 'pending'};

      await FirestoreService.collection('schools/${widget.schoolId}/homework').add({
        'classId': _classId,
        'subjectId': _subjectId,
        'title': _titleController.text,
        'description': _descController.text,
        'attachmentUrls': <String>[],
        'dueDate': _dueDate,
        'createdBy': uid,
        'studentIds': studentIds,
        'submissions': submissions,
      });
      if (mounted) Navigator.of(context).pop();
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
