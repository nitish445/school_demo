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

String _currentAcademicYear() {
  final now = DateTime.now();
  final startYear = now.month >= 4 ? now.year : now.year - 1;
  return '$startYear-${startYear + 1}';
}

/// Mirrors /web/app/admin/classes/page.tsx: add/edit grade+section+year,
/// enable/disable, and shows which teacher is the class teacher (read-only
/// here -- that's set from the Teachers tab's Assign dialog).
class AdminClassesTab extends StatefulWidget {
  const AdminClassesTab(
      {super.key, required this.schoolId, required this.query});

  final String schoolId;
  final String query;

  @override
  State<AdminClassesTab> createState() => _AdminClassesTabState();
}

class _AdminClassesTabState extends State<AdminClassesTab> {
  bool _showDisabled = false;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<SchoolClass>>(
      stream: FirestoreService.collectionStream(
          'schools/${widget.schoolId}/classes', SchoolClass.fromMap),
      builder: (context, classesSnap) {
        if (classesSnap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        var classes = [...(classesSnap.data ?? [])]
          ..sort((a, b) => a.label.compareTo(b.label));
        classes = classes
            .where((c) =>
                _showDisabled ? c.status == 'disabled' : c.status != 'disabled')
            .toList();
        if (widget.query.isNotEmpty) {
          classes = classes
              .where((c) => c.label.toLowerCase().contains(widget.query))
              .toList();
        }

        return StreamBuilder<List<Teacher>>(
          stream: FirestoreService.collectionStream(
              'schools/${widget.schoolId}/teachers', Teacher.fromMap),
          builder: (context, teachersSnap) {
            final teachers = teachersSnap.data ?? [];
            return Scaffold(
              floatingActionButton: FloatingActionButton.extended(
                onPressed: () => _openForm(context),
                icon: const Icon(Icons.add),
                label: const Text('Add Class'),
              ),
              body: Column(
                children: [
                  SwitchListTile(
                    dense: true,
                    title: const Text('Show disabled'),
                    value: _showDisabled,
                    onChanged: (v) => setState(() => _showDisabled = v),
                  ),
                  Expanded(
                    child: classes.isEmpty
                        ? const Center(child: Text('No classes found.'))
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 88),
                            itemCount: classes.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: 8),
                            itemBuilder: (context, i) {
                              final c = classes[i];
                              final classTeacher = _firstWhereOrNull(
                                  teachers, (t) => t.classTeacherOf == c.id);
                              return Card(
                                child: ListTile(
                                  leading: CircleAvatar(child: Text(c.grade)),
                                  title: Text(c.label),
                                  subtitle: Text(
                                    '${c.year.isNotEmpty ? c.year : 'No year set'}'
                                    '${classTeacher != null ? ' · ${classTeacher.name}' : ' · Unassigned'}',
                                  ),
                                  trailing: PopupMenuButton<String>(
                                    onSelected: (action) {
                                      if (action == 'edit') {
                                        _openForm(context, editing: c);
                                      } else {
                                        _toggleStatus(context, c);
                                      }
                                    },
                                    itemBuilder: (context) => [
                                      const PopupMenuItem(
                                          value: 'edit', child: Text('Edit')),
                                      PopupMenuItem(
                                        value: 'toggle',
                                        child: Text(c.status == 'disabled'
                                            ? 'Enable'
                                            : 'Disable'),
                                      ),
                                    ],
                                  ),
                                  isThreeLine: false,
                                  dense: false,
                                  minVerticalPadding: 12,
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _toggleStatus(BuildContext context, SchoolClass c) async {
    final auth = context.read<AuthService>();
    final status = c.status == 'disabled' ? 'active' : 'disabled';
    await FirestoreService.doc('schools/${widget.schoolId}/classes/${c.id}')
        .update({'status': status});
    logActivity(
        widget.schoolId, auth.user, 'update', 'Class', '${c.label} ($status)');
  }

  void _openForm(BuildContext context, {SchoolClass? editing}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) =>
          _ClassForm(schoolId: widget.schoolId, editing: editing),
    );
  }
}

class _ClassForm extends StatefulWidget {
  const _ClassForm({required this.schoolId, this.editing});

  final String schoolId;
  final SchoolClass? editing;

  @override
  State<_ClassForm> createState() => _ClassFormState();
}

class _ClassFormState extends State<_ClassForm> {
  late final _grade = TextEditingController(text: widget.editing?.grade ?? '');
  late final _section =
      TextEditingController(text: widget.editing?.section ?? '');
  late final _year = TextEditingController(
      text: widget.editing?.year ?? _currentAcademicYear());
  bool _submitting = false;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
            20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.editing != null ? 'Edit Class' : 'Add Class',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            TextField(
                controller: _grade,
                decoration:
                    const InputDecoration(labelText: 'Grade (e.g. Grade 6)')),
            const SizedBox(height: 12),
            TextField(
                controller: _section,
                decoration:
                    const InputDecoration(labelText: 'Section (e.g. A)')),
            const SizedBox(height: 12),
            TextField(
                controller: _year,
                decoration: const InputDecoration(labelText: 'Academic Year')),
            const SizedBox(height: 20),
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
    );
  }

  Future<void> _submit() async {
    final grade = _grade.text.trim();
    final section = _section.text.trim();
    final year = _year.text.trim();
    if (grade.isEmpty || section.isEmpty || year.isEmpty) return;
    setState(() => _submitting = true);
    final auth = context.read<AuthService>();
    try {
      if (widget.editing != null) {
        await FirestoreService.doc(
                'schools/${widget.schoolId}/classes/${widget.editing!.id}')
            .update({'grade': grade, 'section': section, 'year': year});
        logActivity(widget.schoolId, auth.user, 'update', 'Class',
            '$grade-$section ($year)');
      } else {
        await FirestoreService.collection('schools/${widget.schoolId}/classes')
            .add({
          'grade': grade,
          'section': section,
          'year': year,
          'status': 'active'
        });
        logActivity(widget.schoolId, auth.user, 'create', 'Class',
            '$grade-$section ($year)');
      }
      if (mounted) Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}
