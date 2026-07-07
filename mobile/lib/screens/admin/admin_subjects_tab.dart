import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/audit_log_service.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';
import '../../widgets/gold_button.dart';

String _currentAcademicYear() {
  final now = DateTime.now();
  final startYear = now.month >= 4 ? now.year : now.year - 1;
  return '$startYear-${startYear + 1}';
}

/// Mirrors /web/app/admin/subjects/page.tsx: add/edit name+code+year and
/// enable/disable.
class AdminSubjectsTab extends StatefulWidget {
  const AdminSubjectsTab(
      {super.key, required this.schoolId, required this.query});

  final String schoolId;
  final String query;

  @override
  State<AdminSubjectsTab> createState() => _AdminSubjectsTabState();
}

class _AdminSubjectsTabState extends State<AdminSubjectsTab> {
  bool _showDisabled = false;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<Subject>>(
      stream: FirestoreService.collectionStream(
          'schools/${widget.schoolId}/subjects', Subject.fromMap),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        var subjects = [...(snap.data ?? [])]
          ..sort((a, b) => a.name.compareTo(b.name));
        subjects = subjects
            .where((s) =>
                _showDisabled ? s.status == 'disabled' : s.status != 'disabled')
            .toList();
        if (widget.query.isNotEmpty) {
          subjects = subjects
              .where((s) => s.name.toLowerCase().contains(widget.query))
              .toList();
        }

        return Scaffold(
          floatingActionButton: FloatingActionButton.extended(
            onPressed: () => _openForm(context),
            icon: const Icon(Icons.add),
            label: const Text('Add Subject'),
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
                child: subjects.isEmpty
                    ? const Center(child: Text('No subjects found.'))
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 88),
                        itemCount: subjects.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, i) {
                          final s = subjects[i];
                          return Card(
                            child: ListTile(
                              leading: const CircleAvatar(
                                  child: Icon(Icons.menu_book_outlined)),
                              title: Text(s.name),
                              subtitle: Text(
                                '${s.code.isNotEmpty ? s.code : 'No code'}${s.year.isNotEmpty ? ' · ${s.year}' : ''}',
                              ),
                              trailing: PopupMenuButton<String>(
                                onSelected: (action) {
                                  if (action == 'edit') {
                                    _openForm(context, editing: s);
                                  } else {
                                    _toggleStatus(context, s);
                                  }
                                },
                                itemBuilder: (context) => [
                                  const PopupMenuItem(
                                      value: 'edit', child: Text('Edit')),
                                  PopupMenuItem(
                                    value: 'toggle',
                                    child: Text(s.status == 'disabled'
                                        ? 'Enable'
                                        : 'Disable'),
                                  ),
                                ],
                              ),
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
  }

  Future<void> _toggleStatus(BuildContext context, Subject s) async {
    final auth = context.read<AuthService>();
    final status = s.status == 'disabled' ? 'active' : 'disabled';
    await FirestoreService.doc('schools/${widget.schoolId}/subjects/${s.id}')
        .update({'status': status});
    logActivity(
        widget.schoolId, auth.user, 'update', 'Subject', '${s.name} ($status)');
  }

  void _openForm(BuildContext context, {Subject? editing}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) =>
          _SubjectForm(schoolId: widget.schoolId, editing: editing),
    );
  }
}

class _SubjectForm extends StatefulWidget {
  const _SubjectForm({required this.schoolId, this.editing});

  final String schoolId;
  final Subject? editing;

  @override
  State<_SubjectForm> createState() => _SubjectFormState();
}

class _SubjectFormState extends State<_SubjectForm> {
  late final _name = TextEditingController(text: widget.editing?.name ?? '');
  late final _code = TextEditingController(text: widget.editing?.code ?? '');
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
            Text(widget.editing != null ? 'Edit Subject' : 'Add Subject',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            TextField(
                controller: _name,
                decoration: const InputDecoration(
                    labelText: 'Name (e.g. Mathematics)')),
            const SizedBox(height: 12),
            TextField(
                controller: _code,
                decoration:
                    const InputDecoration(labelText: 'Code (e.g. MATH)')),
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
    final name = _name.text.trim();
    final code = _code.text.trim();
    final year = _year.text.trim();
    if (name.isEmpty || year.isEmpty) return;
    setState(() => _submitting = true);
    final auth = context.read<AuthService>();
    try {
      if (widget.editing != null) {
        await FirestoreService.doc(
                'schools/${widget.schoolId}/subjects/${widget.editing!.id}')
            .update({'name': name, 'code': code, 'year': year});
        logActivity(
            widget.schoolId, auth.user, 'update', 'Subject', '$name ($year)');
      } else {
        await FirestoreService.collection('schools/${widget.schoolId}/subjects')
            .add(
                {'name': name, 'code': code, 'year': year, 'status': 'active'});
        logActivity(
            widget.schoolId, auth.user, 'create', 'Subject', '$name ($year)');
      }
      if (mounted) Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}
