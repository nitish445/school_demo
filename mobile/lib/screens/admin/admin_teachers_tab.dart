import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/account_service.dart';
import '../../services/audit_log_service.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';
import '../../widgets/avatar.dart';
import '../../widgets/badge_chip.dart';
import '../../widgets/gold_button.dart';

T? _firstWhereOrNull<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

/// Mirrors /web/app/admin/teachers/page.tsx: create a teacher login, assign
/// classes/subjects (and optionally make them a class teacher), and
/// enable/disable. Teachers who are also Admins have their status managed
/// from the Admins tab instead, same restriction as web.
class AdminTeachersTab extends StatelessWidget {
  const AdminTeachersTab(
      {super.key, required this.schoolId, required this.query});

  final String schoolId;
  final String query;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<Teacher>>(
      stream: FirestoreService.collectionStream(
          'schools/$schoolId/teachers', Teacher.fromMap),
      builder: (context, teachersSnap) {
        if (teachersSnap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        var teachers = [...(teachersSnap.data ?? [])]
          ..sort((a, b) => a.name.compareTo(b.name));
        if (query.isNotEmpty) {
          teachers = teachers
              .where((t) => t.name.toLowerCase().contains(query))
              .toList();
        }

        return StreamBuilder<List<Admin>>(
          stream: FirestoreService.collectionStream(
              'schools/$schoolId/admins', Admin.fromMap),
          builder: (context, adminsSnap) {
            final admins = adminsSnap.data ?? [];

            return StreamBuilder<List<SchoolClass>>(
              stream: FirestoreService.collectionStream(
                  'schools/$schoolId/classes', SchoolClass.fromMap),
              builder: (context, classesSnap) {
                final classes = classesSnap.data ?? [];
                return StreamBuilder<List<Subject>>(
                  stream: FirestoreService.collectionStream(
                      'schools/$schoolId/subjects', Subject.fromMap),
                  builder: (context, subjectsSnap) {
                    final subjects = subjectsSnap.data ?? [];

                    return Scaffold(
                      floatingActionButton: FloatingActionButton.extended(
                        onPressed: () => showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          builder: (context) =>
                              _AddTeacherForm(schoolId: schoolId),
                        ),
                        icon: const Icon(Icons.add),
                        label: const Text('Add Teacher'),
                      ),
                      body: teachers.isEmpty
                          ? const Center(child: Text('No teachers found.'))
                          : ListView.separated(
                              padding:
                                  const EdgeInsets.fromLTRB(16, 16, 16, 88),
                              itemCount: teachers.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 8),
                              itemBuilder: (context, i) {
                                final t = teachers[i];
                                final isAdmin = _firstWhereOrNull(
                                        admins, (a) => a.id == t.id) !=
                                    null;
                                final homeRoom = t.classTeacherOf != null
                                    ? _firstWhereOrNull(classes,
                                        (c) => c.id == t.classTeacherOf)
                                    : null;
                                return Card(
                                  child: ListTile(
                                    leading: Avatar(
                                        name: t.name,
                                        photoUrl: t.photoUrl,
                                        size: 40),
                                    title: Text(t.name,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis),
                                    subtitle: Text(
                                      homeRoom != null
                                          ? 'Class Teacher · ${homeRoom.label}'
                                          : 'Subject Teacher',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    trailing: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        if (t.status == 'disabled')
                                          const Padding(
                                            padding: EdgeInsets.only(right: 6),
                                            child: BadgeChip('Disabled',
                                                variant: BadgeVariant.warning),
                                          ),
                                        const Icon(Icons.chevron_right),
                                      ],
                                    ),
                                    onTap: () => _openDetail(
                                        context, t, isAdmin, classes, subjects),
                                  ),
                                );
                              },
                            ),
                    );
                  },
                );
              },
            );
          },
        );
      },
    );
  }

  void _openDetail(
    BuildContext context,
    Teacher t,
    bool isAdmin,
    List<SchoolClass> classes,
    List<Subject> subjects,
  ) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Avatar(name: t.name, photoUrl: t.photoUrl, size: 44),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(t.name,
                            style: Theme.of(context).textTheme.titleMedium),
                        Text(t.employeeId.isNotEmpty
                            ? 'ID: ${t.employeeId}'
                            : ''),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.assignment_ind_outlined),
                title: const Text('Assign classes & subjects'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.pop(context);
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    builder: (context) => _AssignForm(
                        schoolId: schoolId,
                        teacher: t,
                        classes: classes,
                        subjects: subjects),
                  );
                },
              ),
              if (isAdmin)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Text('Status managed from the Admins tab.',
                      style: TextStyle(color: Colors.grey)),
                )
              else
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(t.status == 'disabled'
                      ? Icons.check_circle_outline
                      : Icons.block),
                  title: Text(t.status == 'disabled'
                      ? 'Enable account'
                      : 'Disable account'),
                  onTap: () async {
                    Navigator.pop(context);
                    final auth = context.read<AuthService>();
                    final status =
                        t.status == 'disabled' ? 'active' : 'disabled';
                    final batch = FirestoreService.batch();
                    batch.set(FirestoreService.doc('users/${t.id}'),
                        {'status': status}, SetOptions(merge: true));
                    batch.set(
                        FirestoreService.doc(
                            'schools/$schoolId/teachers/${t.id}'),
                        {'status': status},
                        SetOptions(merge: true));
                    await batch.commit();
                    logActivity(schoolId, auth.user, 'update', 'Teacher',
                        '${t.name} ($status)');
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AddTeacherForm extends StatefulWidget {
  const _AddTeacherForm({required this.schoolId});

  final String schoolId;

  @override
  State<_AddTeacherForm> createState() => _AddTeacherFormState();
}

class _AddTeacherFormState extends State<_AddTeacherForm> {
  final _name = TextEditingController();
  final _employeeId = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _submitting = false;
  String? _error;
  String? _pendingUid;

  @override
  Widget build(BuildContext context) {
    final locked = _pendingUid != null;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
            20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Add Teacher', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            TextField(
                controller: _name,
                enabled: !locked,
                decoration: const InputDecoration(labelText: 'Name')),
            const SizedBox(height: 12),
            TextField(
              controller: _employeeId,
              enabled: !locked,
              decoration: const InputDecoration(labelText: 'Employee ID'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _email,
              enabled: !locked,
              decoration: const InputDecoration(labelText: 'Email'),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              enabled: !locked,
              decoration: const InputDecoration(
                labelText: 'Temporary Password',
                helperText: 'Share this with the teacher directly',
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: TextStyle(color: Colors.red.shade700)),
            ],
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: GoldButton(
                onPressed: _submitting ? null : _submit,
                child: Text(_submitting
                    ? 'Creating...'
                    : (locked ? 'Retry' : 'Create Account')),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final name = _name.text.trim();
    final email = _email.text.trim();
    final password = _password.text;
    if (name.isEmpty || email.isEmpty || password.isEmpty) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    final auth = context.read<AuthService>();
    try {
      final uid = _pendingUid ?? await createAuthUser(email, password);
      _pendingUid = uid;
      await writeAccountProfile(
        uid,
        CreateAccountInput(
          schoolId: widget.schoolId,
          email: email,
          displayName: name,
          kind: AccountKind.teacher,
          employeeId: _employeeId.text.trim(),
        ),
      );
      logActivity(widget.schoolId, auth.user, 'create', 'Teacher', name);
      if (mounted) Navigator.pop(context);
    } catch (err) {
      setState(() => _error = describeAuthError(err));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}

class _AssignForm extends StatefulWidget {
  const _AssignForm(
      {required this.schoolId,
      required this.teacher,
      required this.classes,
      required this.subjects});

  final String schoolId;
  final Teacher teacher;
  final List<SchoolClass> classes;
  final List<Subject> subjects;

  @override
  State<_AssignForm> createState() => _AssignFormState();
}

class _AssignFormState extends State<_AssignForm> {
  String? _classTeacherOf;
  late List<TeacherAssignment> _assignments;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _classTeacherOf = widget.teacher.classTeacherOf;
    _assignments = [...widget.teacher.assignments];
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
              Text('Assign — ${widget.teacher.name}',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                isExpanded: true,
                value: _classTeacherOf,
                decoration:
                    const InputDecoration(labelText: 'Class Teacher Of'),
                items: [
                  const DropdownMenuItem<String>(
                      value: null, child: Text('Not a class teacher')),
                  ...widget.classes.map((c) => DropdownMenuItem<String>(
                      value: c.id, child: Text(c.label))),
                ],
                onChanged: (v) => setState(() => _classTeacherOf = v),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Subjects Taught',
                      style: TextStyle(fontWeight: FontWeight.w600)),
                  TextButton(
                    onPressed: () => setState(() => _assignments = [
                          ..._assignments,
                          TeacherAssignment(classId: '', subjectId: ''),
                        ]),
                    child: const Text('+ Add row'),
                  ),
                ],
              ),
              for (var i = 0; i < _assignments.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          isExpanded: true,
                          value: _assignments[i].classId.isEmpty
                              ? null
                              : _assignments[i].classId,
                          decoration: const InputDecoration(labelText: 'Class'),
                          items: widget.classes
                              .map((c) => DropdownMenuItem<String>(
                                  value: c.id, child: Text(c.label)))
                              .toList(),
                          onChanged: (v) => setState(() {
                            _assignments[i] = TeacherAssignment(
                                classId: v ?? '',
                                subjectId: _assignments[i].subjectId);
                          }),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          isExpanded: true,
                          value: _assignments[i].subjectId.isEmpty
                              ? null
                              : _assignments[i].subjectId,
                          decoration:
                              const InputDecoration(labelText: 'Subject'),
                          items: widget.subjects
                              .map((s) => DropdownMenuItem<String>(
                                  value: s.id, child: Text(s.name)))
                              .toList(),
                          onChanged: (v) => setState(() {
                            _assignments[i] = TeacherAssignment(
                                classId: _assignments[i].classId,
                                subjectId: v ?? '');
                          }),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () =>
                            setState(() => _assignments.removeAt(i)),
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
    setState(() => _submitting = true);
    final auth = context.read<AuthService>();
    try {
      final clean = _assignments
          .where((a) => a.classId.isNotEmpty && a.subjectId.isNotEmpty)
          .toList();
      final assignedClassIds = clean.map((a) => a.classId).toSet().toList();

      final batch = FirestoreService.batch();
      batch.set(
        FirestoreService.doc(
            'schools/${widget.schoolId}/teachers/${widget.teacher.id}'),
        {
          'assignments': clean
              .map((a) => {'classId': a.classId, 'subjectId': a.subjectId})
              .toList(),
          'assignedClassIds': assignedClassIds,
          'classTeacherOf': _classTeacherOf,
        },
        SetOptions(merge: true),
      );

      // Check if this teacher is also an admin -- if so, don't overwrite
      // their role (must stay "admin", not classTeacher/subjectTeacher).
      final adminDoc = await FirestoreService.doc(
              'schools/${widget.schoolId}/admins/${widget.teacher.id}')
          .get();
      if (!adminDoc.exists) {
        final role =
            _classTeacherOf != null ? 'classTeacher' : 'subjectTeacher';
        batch.set(FirestoreService.doc('users/${widget.teacher.id}'),
            {'role': role}, SetOptions(merge: true));
      }

      await batch.commit();
      logActivity(widget.schoolId, auth.user, 'update', 'Teacher',
          '${widget.teacher.name} — assignments updated');
      if (mounted) Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}
