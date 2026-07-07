import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/account_service.dart';
import '../../services/audit_log_service.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';
import '../../widgets/badge_chip.dart';
import '../../widgets/gold_button.dart';

T? _firstWhereOrNull<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

const List<String> _assignableDesignations = [
  'incharge',
  'labAssistant',
  'teacher'
];

/// Mirrors /web/app/admin/admins/page.tsx: view every Admin account; only
/// the Principal can create new ones (from scratch or by promoting an
/// existing teacher), change designation/status, or remove Admin access.
class AdminAdminsScreen extends StatelessWidget {
  const AdminAdminsScreen({super.key, required this.schoolId});

  final String schoolId;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final uid = auth.user!.uid;

    return Scaffold(
      appBar: AppBar(title: const Text('Admins')),
      body: StreamBuilder<List<Admin>>(
        stream: FirestoreService.collectionStream(
            'schools/$schoolId/admins', Admin.fromMap),
        builder: (context, adminsSnap) {
          if (adminsSnap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final admins = [...(adminsSnap.data ?? [])]
            ..sort((a, b) => a.name.compareTo(b.name));
          final me = _firstWhereOrNull(admins, (a) => a.id == uid);
          final isPrincipal = me?.designation == 'principal';

          return StreamBuilder<List<Teacher>>(
            stream: FirestoreService.collectionStream(
                'schools/$schoolId/teachers', Teacher.fromMap),
            builder: (context, teachersSnap) {
              final teachers = teachersSnap.data ?? [];
              final promotable = teachers
                  .where((t) => !admins.any((a) => a.id == t.id))
                  .toList();

              return Scaffold(
                floatingActionButton: isPrincipal
                    ? FloatingActionButton.extended(
                        onPressed: () => showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          builder: (context) => _AddAdminForm(
                              schoolId: schoolId,
                              promotableTeachers: promotable),
                        ),
                        icon: const Icon(Icons.add),
                        label: const Text('Add Admin'),
                      )
                    : null,
                body: Column(
                  children: [
                    if (!isPrincipal)
                      const Padding(
                        padding: EdgeInsets.all(16),
                        child: Text(
                          'Only the Principal can create Admin accounts or change their designation and status.',
                          style: TextStyle(color: Colors.grey),
                        ),
                      ),
                    Expanded(
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 88),
                        itemCount: admins.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, i) {
                          final a = admins[i];
                          final canManage = isPrincipal && a.id != uid;
                          return Card(
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text.rich(
                                          TextSpan(
                                            children: [
                                              TextSpan(
                                                  text: a.name,
                                                  style: const TextStyle(
                                                      fontWeight:
                                                          FontWeight.w600)),
                                              if (a.id == uid)
                                                const TextSpan(
                                                    text: '  (you)',
                                                    style: TextStyle(
                                                        color: Colors.grey)),
                                            ],
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      BadgeChip(
                                        a.status == 'disabled'
                                            ? 'Disabled'
                                            : 'Active',
                                        variant: a.status == 'disabled'
                                            ? BadgeVariant.warning
                                            : BadgeVariant.success,
                                      ),
                                    ],
                                  ),
                                  Text(a.email ?? '—',
                                      style: const TextStyle(
                                          color: Colors.grey, fontSize: 13)),
                                  const SizedBox(height: 8),
                                  if (canManage && a.designation != 'principal')
                                    DropdownButtonFormField<String>(
                                      isExpanded: true,
                                      value: _assignableDesignations
                                              .contains(a.designation)
                                          ? a.designation
                                          : 'teacher',
                                      isDense: true,
                                      decoration: const InputDecoration(
                                          labelText: 'Designation'),
                                      items: _assignableDesignations
                                          .map((d) => DropdownMenuItem(
                                              value: d,
                                              child: Text(
                                                  adminDesignationLabels[d]!)))
                                          .toList(),
                                      onChanged: (d) async {
                                        if (d == null) return;
                                        final authRead =
                                            context.read<AuthService>();
                                        final batch = FirestoreService.batch();
                                        batch.set(
                                            FirestoreService.doc(
                                                'users/${a.id}'),
                                            {'designation': d},
                                            SetOptions(merge: true));
                                        batch.set(
                                            FirestoreService.doc(
                                                'schools/$schoolId/admins/${a.id}'),
                                            {'designation': d},
                                            SetOptions(merge: true));
                                        await batch.commit();
                                        logActivity(
                                            schoolId,
                                            authRead.user,
                                            'update',
                                            'Admin',
                                            '${a.name} — designation set to ${adminDesignationLabels[d]}');
                                      },
                                    )
                                  else
                                    BadgeChip(
                                      adminDesignationLabels[
                                              a.designation ?? 'teacher'] ??
                                          'Admin',
                                      variant: a.designation == 'principal'
                                          ? BadgeVariant.brand
                                          : BadgeVariant.neutral,
                                    ),
                                  if (canManage) ...[
                                    const SizedBox(height: 8),
                                    Wrap(
                                      spacing: 4,
                                      children: [
                                        TextButton(
                                          onPressed: () =>
                                              _toggleStatus(context, a),
                                          child: Text(a.status == 'disabled'
                                              ? 'Enable'
                                              : 'Disable'),
                                        ),
                                        if (a.designation != 'principal')
                                          TextButton(
                                            onPressed: () => _removeAdminAccess(
                                                context, a, teachers),
                                            child: const Text(
                                                'Remove Admin Access'),
                                          ),
                                      ],
                                    ),
                                  ],
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
        },
      ),
    );
  }

  Future<void> _toggleStatus(BuildContext context, Admin a) async {
    final auth = context.read<AuthService>();
    final status = a.status == 'disabled' ? 'active' : 'disabled';
    final batch = FirestoreService.batch();
    batch.set(FirestoreService.doc('users/${a.id}'), {'status': status},
        SetOptions(merge: true));
    batch.set(FirestoreService.doc('schools/$schoolId/admins/${a.id}'),
        {'status': status}, SetOptions(merge: true));
    await batch.commit();
    logActivity(schoolId, auth.user, 'update', 'Admin', '${a.name} ($status)');
  }

  Future<void> _removeAdminAccess(
      BuildContext context, Admin a, List<Teacher> teachers) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove Admin access?'),
        content: Text("${a.name} will go back to being a plain teacher."),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          GoldButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Remove')),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    final auth = context.read<AuthService>();
    final teacher = _firstWhereOrNull(teachers, (t) => t.id == a.id);
    final role =
        teacher?.classTeacherOf != null ? 'classTeacher' : 'subjectTeacher';
    final batch = FirestoreService.batch();
    batch.update(FirestoreService.doc('users/${a.id}'),
        {'role': role, 'designation': FieldValue.delete()});
    batch.delete(FirestoreService.doc('schools/$schoolId/admins/${a.id}'));
    await batch.commit();
    logActivity(schoolId, auth.user, 'update', 'Admin',
        '${a.name} — Admin access removed (back to Teacher)');
  }
}

class _AddAdminForm extends StatefulWidget {
  const _AddAdminForm(
      {required this.schoolId, required this.promotableTeachers});

  final String schoolId;
  final List<Teacher> promotableTeachers;

  @override
  State<_AddAdminForm> createState() => _AddAdminFormState();
}

class _AddAdminFormState extends State<_AddAdminForm> {
  bool _newAccount = true;
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  String? _selectedTeacherId;
  String _promoteDesignation = 'teacher';
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
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Add Admin', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              SegmentedButton<bool>(
                segments: const [
                  ButtonSegment(value: true, label: Text('New Account')),
                  ButtonSegment(value: false, label: Text('Existing Faculty')),
                ],
                selected: {_newAccount},
                onSelectionChanged: (s) =>
                    setState(() => _newAccount = s.first),
              ),
              const SizedBox(height: 16),
              if (_newAccount) ...[
                TextField(
                    controller: _name,
                    enabled: !locked,
                    decoration: const InputDecoration(labelText: 'Name')),
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
                    helperText: 'Share this with them directly',
                  ),
                ),
              ] else if (widget.promotableTeachers.isEmpty) ...[
                const Text(
                    'Every current teacher is already an Admin. Add a teacher first from Directory.'),
              ] else ...[
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: _selectedTeacherId,
                  decoration: const InputDecoration(labelText: 'Teacher'),
                  items: widget.promotableTeachers
                      .map((t) =>
                          DropdownMenuItem(value: t.id, child: Text(t.name)))
                      .toList(),
                  onChanged: (v) => setState(() => _selectedTeacherId = v),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: _promoteDesignation,
                  decoration: const InputDecoration(labelText: 'Designation'),
                  items: _assignableDesignations
                      .map((d) => DropdownMenuItem(
                          value: d, child: Text(adminDesignationLabels[d]!)))
                      .toList(),
                  onChanged: (v) =>
                      setState(() => _promoteDesignation = v ?? 'teacher'),
                ),
                const SizedBox(height: 8),
                const Text(
                  'They keep their existing teaching assignments and login — this just adds Admin access.',
                  style: TextStyle(color: Colors.grey, fontSize: 12),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(_error!, style: TextStyle(color: Colors.red.shade700)),
              ],
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: GoldButton(
                  onPressed: _submitting
                      ? null
                      : (_newAccount ? _submitNew : _submitPromote),
                  child: Text(_submitting
                      ? (_newAccount ? 'Creating...' : 'Promoting...')
                      : (_newAccount
                          ? (locked ? 'Retry' : 'Create Account')
                          : 'Promote to Admin')),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submitNew() async {
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
            kind: AccountKind.admin),
      );
      logActivity(widget.schoolId, auth.user, 'create', 'Admin', name);
      if (mounted) Navigator.pop(context);
    } catch (err) {
      setState(() => _error = describeAuthError(err));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _submitPromote() async {
    if (_selectedTeacherId == null) return;
    final teacher = _firstWhereOrNull(
        widget.promotableTeachers, (t) => t.id == _selectedTeacherId);
    if (teacher == null) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    final auth = context.read<AuthService>();
    try {
      final batch = FirestoreService.batch();
      batch.set(
          FirestoreService.doc('users/${teacher.id}'),
          {'role': 'admin', 'designation': _promoteDesignation},
          SetOptions(merge: true));
      batch.set(
        FirestoreService.doc('schools/${widget.schoolId}/admins/${teacher.id}'),
        {
          'name': teacher.name,
          'email': teacher.email ?? '',
          'status': 'active',
          'designation': _promoteDesignation
        },
        SetOptions(merge: true),
      );
      await batch.commit();
      logActivity(widget.schoolId, auth.user, 'update', 'Admin',
          '${teacher.name} — promoted from Teacher (${adminDesignationLabels[_promoteDesignation]})');
      if (mounted) Navigator.pop(context);
    } catch (_) {
      setState(
          () => _error = 'Could not promote this teacher. Please try again.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}
