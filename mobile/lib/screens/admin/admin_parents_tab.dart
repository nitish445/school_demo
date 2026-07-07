import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/account_service.dart';
import '../../services/audit_log_service.dart';
import '../../services/auth_service.dart';
import '../../services/firestore_service.dart';
import '../../widgets/avatar.dart';
import '../../widgets/gold_button.dart';

/// Mirrors /web/app/admin/parents/page.tsx: create a parent login and
/// enable/disable. Linking children to a parent happens from the Students
/// tab's Edit form, same as web.
class AdminParentsTab extends StatelessWidget {
  const AdminParentsTab(
      {super.key, required this.schoolId, required this.query});

  final String schoolId;
  final String query;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<ParentProfile>>(
      stream: FirestoreService.collectionStream(
          'schools/$schoolId/parents', ParentProfile.fromMap),
      builder: (context, parentsSnap) {
        if (parentsSnap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        var parents = [...(parentsSnap.data ?? [])]
          ..sort((a, b) => a.name.compareTo(b.name));
        if (query.isNotEmpty) {
          parents = parents
              .where((p) => p.name.toLowerCase().contains(query))
              .toList();
        }

        return StreamBuilder<List<Student>>(
          stream: FirestoreService.collectionStream(
              'schools/$schoolId/students', Student.fromMap),
          builder: (context, studentsSnap) {
            final students = studentsSnap.data ?? [];

            return Scaffold(
              floatingActionButton: FloatingActionButton.extended(
                onPressed: () => showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  builder: (context) => _AddParentForm(schoolId: schoolId),
                ),
                icon: const Icon(Icons.add),
                label: const Text('Add Parent'),
              ),
              body: parents.isEmpty
                  ? const Center(child: Text('No parents found.'))
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
                      itemCount: parents.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, i) {
                        final p = parents[i];
                        final childNames = p.childStudentIds
                            .map((id) => students
                                .where((s) => s.id == id)
                                .map((s) => s.name)
                                .firstOrNull)
                            .whereType<String>()
                            .toList();
                        return Card(
                          child: ListTile(
                            leading: Avatar(
                                name: p.name, photoUrl: p.photoUrl, size: 40),
                            title: Text(p.name,
                                maxLines: 1, overflow: TextOverflow.ellipsis),
                            subtitle: Text(
                              childNames.isNotEmpty
                                  ? childNames.join(', ')
                                  : 'No children linked',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            trailing: TextButton(
                              onPressed: () async {
                                final auth = context.read<AuthService>();
                                final status = p.status == 'disabled'
                                    ? 'active'
                                    : 'disabled';
                                final batch = FirestoreService.batch();
                                batch.set(
                                    FirestoreService.doc('users/${p.id}'),
                                    {'status': status},
                                    SetOptions(merge: true));
                                batch.set(
                                    FirestoreService.doc(
                                        'schools/$schoolId/parents/${p.id}'),
                                    {'status': status},
                                    SetOptions(merge: true));
                                await batch.commit();
                                logActivity(schoolId, auth.user, 'update',
                                    'Parent', '${p.name} ($status)');
                              },
                              child: Text(p.status == 'disabled'
                                  ? 'Enable'
                                  : 'Disable'),
                            ),
                          ),
                        );
                      },
                    ),
            );
          },
        );
      },
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

class _AddParentForm extends StatefulWidget {
  const _AddParentForm({required this.schoolId});

  final String schoolId;

  @override
  State<_AddParentForm> createState() => _AddParentFormState();
}

class _AddParentFormState extends State<_AddParentForm> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
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
            Text('Add Parent', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
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
              controller: _phone,
              enabled: !locked,
              decoration: const InputDecoration(labelText: 'Phone (optional)'),
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              enabled: !locked,
              decoration: const InputDecoration(
                labelText: 'Temporary Password',
                helperText: 'Share this with the parent directly',
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
          phone: _phone.text.trim().isEmpty ? null : _phone.text.trim(),
          kind: AccountKind.parent,
        ),
      );
      logActivity(widget.schoolId, auth.user, 'create', 'Parent', name);
      if (mounted) Navigator.pop(context);
    } catch (err) {
      setState(() => _error = describeAuthError(err));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}
