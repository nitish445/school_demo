import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/audit_log_service.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';
import '../../widgets/gold_button.dart';

T? _firstWhereOrNull<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

/// Mirrors /web/app/admin/exams/page.tsx: admin sets the exam name, term,
/// and which grade+subject is scheduled on which date (applies to every
/// section in that grade), publishes it, and approves subject-teacher mark
/// component sets pending school-wide. Exam-schedule PDF export stays
/// web-only.
class AdminExamsScreen extends StatelessWidget {
  const AdminExamsScreen({super.key, required this.schoolId});

  final String schoolId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Exams')),
      body: StreamBuilder<List<Exam>>(
        stream: FirestoreService.collectionStream(
            'schools/$schoolId/exams', Exam.fromMap),
        builder: (context, examsSnap) {
          final exams = examsSnap.data ?? [];

          return StreamBuilder<List<SchoolClass>>(
            stream: FirestoreService.collectionStream(
                'schools/$schoolId/classes', SchoolClass.fromMap),
            builder: (context, classesSnap) {
              final classes = classesSnap.data ?? [];
              final grades = classes.map((c) => c.grade).toSet().toList()
                ..sort();

              return StreamBuilder<List<Subject>>(
                stream: FirestoreService.collectionStream(
                    'schools/$schoolId/subjects', Subject.fromMap),
                builder: (context, subjectsSnap) {
                  final subjects = subjectsSnap.data ?? [];

                  return StreamBuilder<List<ExamComponentSet>>(
                    stream: FirestoreService.collectionStream(
                        'schools/$schoolId/examComponents',
                        ExamComponentSet.fromMap),
                    builder: (context, componentsSnap) {
                      final componentSets = componentsSnap.data ?? [];
                      final pending = componentSets
                          .where(
                              (cs) => !cs.approved && cs.components.isNotEmpty)
                          .toList();

                      return Column(
                        children: [
                          Expanded(
                            child: ListView(
                              padding:
                                  const EdgeInsets.fromLTRB(16, 16, 16, 88),
                              children: [
                                if (pending.isNotEmpty) ...[
                                  Card(
                                    color: Colors.amber.shade50,
                                    child: Padding(
                                      padding: const EdgeInsets.all(14),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                              'Marks Awaiting Approval (${pending.length})',
                                              style: const TextStyle(
                                                  fontWeight: FontWeight.w600)),
                                          const SizedBox(height: 8),
                                          for (final cs in pending)
                                            Padding(
                                              padding: const EdgeInsets.only(
                                                  bottom: 8),
                                              child: Row(
                                                children: [
                                                  Expanded(
                                                    child: Text(
                                                      '${_firstWhereOrNull(subjects, (s) => s.id == cs.subjectId)?.name ?? cs.subjectId} — '
                                                      '${_firstWhereOrNull(classes, (c) => c.id == cs.classId)?.label ?? cs.classId} — '
                                                      '${_firstWhereOrNull(exams, (e) => e.id == cs.examId)?.name ?? cs.examId}',
                                                      style: const TextStyle(
                                                          fontSize: 13),
                                                    ),
                                                  ),
                                                  TextButton(
                                                    onPressed: () async {
                                                      final auth = context
                                                          .read<AuthService>();
                                                      await FirestoreService.doc(
                                                              'schools/$schoolId/examComponents/${cs.id}')
                                                          .update({
                                                        'approved': true,
                                                        'approvedBy':
                                                            auth.user?.email ??
                                                                'admin',
                                                        'approvedAt': DateTime
                                                                .now()
                                                            .millisecondsSinceEpoch,
                                                      });
                                                    },
                                                    child:
                                                        const Text('Approve'),
                                                  ),
                                                ],
                                              ),
                                            ),
                                        ],
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                ],
                                if (exams.isEmpty)
                                  const Center(child: Text('No exams yet.')),
                                for (final e in exams)
                                  Card(
                                    margin: const EdgeInsets.only(bottom: 8),
                                    child: ListTile(
                                      title: Text(e.name),
                                      subtitle: Text(
                                          '${e.term} · ${e.schedule.length} scheduled · ${e.published ? "Published" : "Draft"}'),
                                      trailing: PopupMenuButton<String>(
                                        onSelected: (action) async {
                                          final auth =
                                              context.read<AuthService>();
                                          if (action == 'edit') {
                                            _openForm(context,
                                                schoolId: schoolId,
                                                grades: grades,
                                                subjects: subjects,
                                                editing: e);
                                          } else if (action == 'publish') {
                                            await FirestoreService.doc(
                                                    'schools/$schoolId/exams/${e.id}')
                                                .update({
                                              'published': !e.published
                                            });
                                            logActivity(
                                                schoolId,
                                                auth.user,
                                                'update',
                                                'Exam',
                                                '${e.name} (${e.published ? "unpublished" : "published"})');
                                          } else if (action == 'delete') {
                                            await FirestoreService.doc(
                                                    'schools/$schoolId/exams/${e.id}')
                                                .delete();
                                            logActivity(schoolId, auth.user,
                                                'delete', 'Exam', e.name);
                                          }
                                        },
                                        itemBuilder: (context) => [
                                          const PopupMenuItem(
                                              value: 'edit',
                                              child: Text('Edit')),
                                          PopupMenuItem(
                                            value: 'publish',
                                            child: Text(e.published
                                                ? 'Unpublish'
                                                : 'Publish'),
                                          ),
                                          const PopupMenuItem(
                                              value: 'delete',
                                              child: Text('Delete')),
                                        ],
                                      ),
                                    ),
                                  ),
                              ],
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
      ),
      floatingActionButton: StreamBuilder<List<SchoolClass>>(
        stream: FirestoreService.collectionStream(
            'schools/$schoolId/classes', SchoolClass.fromMap),
        builder: (context, classesSnap) {
          final grades = (classesSnap.data ?? [])
              .map((c) => c.grade)
              .toSet()
              .toList()
            ..sort();
          return StreamBuilder<List<Subject>>(
            stream: FirestoreService.collectionStream(
                'schools/$schoolId/subjects', Subject.fromMap),
            builder: (context, subjectsSnap) {
              final subjects = subjectsSnap.data ?? [];
              return FloatingActionButton.extended(
                onPressed: () => _openForm(context,
                    schoolId: schoolId, grades: grades, subjects: subjects),
                icon: const Icon(Icons.add),
                label: const Text('Create Exam'),
              );
            },
          );
        },
      ),
    );
  }

  void _openForm(
    BuildContext context, {
    required String schoolId,
    required List<String> grades,
    required List<Subject> subjects,
    Exam? editing,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => _ExamForm(
          schoolId: schoolId,
          grades: grades,
          subjects: subjects,
          editing: editing),
    );
  }
}

class _ScheduleRow {
  _ScheduleRow({this.grade = '', this.subjectId = '', this.date = ''});
  String grade;
  String subjectId;
  String date;
}

class _ExamForm extends StatefulWidget {
  const _ExamForm(
      {required this.schoolId,
      required this.grades,
      required this.subjects,
      this.editing});

  final String schoolId;
  final List<String> grades;
  final List<Subject> subjects;
  final Exam? editing;

  @override
  State<_ExamForm> createState() => _ExamFormState();
}

class _ExamFormState extends State<_ExamForm> {
  late final _name = TextEditingController(text: widget.editing?.name ?? '');
  late final _term = TextEditingController(text: widget.editing?.term ?? '');
  late List<_ScheduleRow> _rows;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _rows = (widget.editing?.schedule ?? [])
        .map((s) => _ScheduleRow(
              grade: s['grade'] as String? ?? '',
              subjectId: s['subjectId'] as String? ?? '',
              date: s['date'] as String? ?? '',
            ))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
            20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.editing != null ? 'Edit Exam' : 'Create Exam',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              TextField(
                  controller: _name,
                  decoration: const InputDecoration(
                      labelText: 'Name (e.g. Midterm Exam)')),
              const SizedBox(height: 12),
              TextField(
                  controller: _term,
                  decoration:
                      const InputDecoration(labelText: 'Term (e.g. Term 1)')),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Grade-wise Schedule',
                      style: TextStyle(fontWeight: FontWeight.w600)),
                  TextButton(
                    onPressed: () =>
                        setState(() => _rows = [..._rows, _ScheduleRow()]),
                    child: const Text('+ Add row'),
                  ),
                ],
              ),
              for (var i = 0; i < _rows.length; i++)
                Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    border: Border.all(
                        color: Theme.of(context).colorScheme.outlineVariant),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: DropdownButtonFormField<String>(
                              isExpanded: true,
                              isDense: true,
                              value: _rows[i].grade.isEmpty
                                  ? null
                                  : _rows[i].grade,
                              decoration:
                                  const InputDecoration(labelText: 'Grade'),
                              items: widget.grades
                                  .map((g) => DropdownMenuItem(
                                      value: g,
                                      child: Text('Grade $g',
                                          overflow: TextOverflow.ellipsis)))
                                  .toList(),
                              onChanged: (v) =>
                                  setState(() => _rows[i].grade = v ?? ''),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: DropdownButtonFormField<String>(
                              isExpanded: true,
                              isDense: true,
                              value: _rows[i].subjectId.isEmpty
                                  ? null
                                  : _rows[i].subjectId,
                              decoration:
                                  const InputDecoration(labelText: 'Subject'),
                              items: widget.subjects
                                  .map((s) => DropdownMenuItem(
                                      value: s.id,
                                      child: Text(s.name,
                                          overflow: TextOverflow.ellipsis)))
                                  .toList(),
                              onChanged: (v) =>
                                  setState(() => _rows[i].subjectId = v ?? ''),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () async {
                                final picked = await showDatePicker(
                                  context: context,
                                  initialDate:
                                      DateTime.tryParse(_rows[i].date) ??
                                          DateTime.now(),
                                  firstDate: DateTime(2020),
                                  lastDate: DateTime(2100),
                                );
                                if (picked != null) {
                                  setState(() => _rows[i].date = picked
                                      .toIso8601String()
                                      .substring(0, 10));
                                }
                              },
                              child: Text(
                                _rows[i].date.isEmpty
                                    ? 'Pick a date'
                                    : _rows[i].date,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ),
                          IconButton(
                              icon: const Icon(Icons.close),
                              onPressed: () =>
                                  setState(() => _rows.removeAt(i))),
                        ],
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: GoldButton(
                  onPressed: _submitting ? null : _submit,
                  child: Text(_submitting ? 'Saving...' : 'Save'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final name = _name.text.trim();
    final term = _term.text.trim();
    if (name.isEmpty || term.isEmpty) return;
    setState(() => _submitting = true);
    final auth = context.read<AuthService>();
    try {
      final schedule = _rows
          .where((r) => r.grade.isNotEmpty && r.subjectId.isNotEmpty)
          .map((r) =>
              {'grade': r.grade, 'subjectId': r.subjectId, 'date': r.date})
          .toList();
      final payload = {
        'name': name,
        'term': term,
        'schedule': schedule,
        'published': widget.editing?.published ?? false,
      };
      if (widget.editing != null) {
        await FirestoreService.doc(
                'schools/${widget.schoolId}/exams/${widget.editing!.id}')
            .update(payload);
        logActivity(widget.schoolId, auth.user, 'update', 'Exam', name);
      } else {
        await FirestoreService.collection('schools/${widget.schoolId}/exams')
            .add(payload);
        logActivity(widget.schoolId, auth.user, 'create', 'Exam', name);
      }
      if (mounted) Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}
