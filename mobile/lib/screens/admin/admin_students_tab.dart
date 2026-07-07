import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
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

const List<String> _genders = ['male', 'female', 'other'];

/// Mirrors /web/app/admin/students/page.tsx (minus CSV bulk import, which
/// stays a web/desktop workflow): add/edit a student including linking
/// existing parent accounts, and archive/restore. Report card PDF export
/// also stays web-only.
class AdminStudentsTab extends StatefulWidget {
  const AdminStudentsTab(
      {super.key, required this.schoolId, required this.query});

  final String schoolId;
  final String query;

  @override
  State<AdminStudentsTab> createState() => _AdminStudentsTabState();
}

class _AdminStudentsTabState extends State<AdminStudentsTab> {
  bool _showArchived = false;
  String? _classFilter;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<SchoolClass>>(
      stream: FirestoreService.collectionStream(
          'schools/${widget.schoolId}/classes', SchoolClass.fromMap),
      builder: (context, classesSnap) {
        final classes = <SchoolClass>[...(classesSnap.data ?? [])]
          ..sort((a, b) => a.label.compareTo(b.label));

        return StreamBuilder<List<ParentProfile>>(
          stream: FirestoreService.collectionStream(
              'schools/${widget.schoolId}/parents', ParentProfile.fromMap),
          builder: (context, parentsSnap) {
            final parents = <ParentProfile>[...(parentsSnap.data ?? [])]
              ..sort((a, b) => a.name.compareTo(b.name));

            return StreamBuilder<List<Student>>(
              stream: FirestoreService.collectionStream(
                  'schools/${widget.schoolId}/students', Student.fromMap),
              builder: (context, studentsSnap) {
                if (studentsSnap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                var students = [...(studentsSnap.data ?? [])]
                  ..sort((a, b) => a.name.compareTo(b.name));
                students = students
                    .where((s) => _showArchived
                        ? s.status == 'archived'
                        : s.status != 'archived')
                    .toList();
                if (_classFilter != null) {
                  students =
                      students.where((s) => s.classId == _classFilter).toList();
                }
                if (widget.query.isNotEmpty) {
                  students = students
                      .where((s) => s.name.toLowerCase().contains(widget.query))
                      .toList();
                }

                return Scaffold(
                  floatingActionButton: FloatingActionButton.extended(
                    onPressed: () =>
                        _openForm(context, classes: classes, parents: parents),
                    icon: const Icon(Icons.add),
                    label: const Text('Add Student'),
                  ),
                  body: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                        child: Row(
                          children: [
                            Expanded(
                              child: DropdownButtonFormField<String?>(
                                isExpanded: true,
                                value: _classFilter,
                                isDense: true,
                                decoration:
                                    const InputDecoration(labelText: 'Class'),
                                items: [
                                  const DropdownMenuItem<String?>(
                                      value: null, child: Text('All classes')),
                                  ...classes.map((c) =>
                                      DropdownMenuItem<String?>(
                                          value: c.id, child: Text(c.label))),
                                ],
                                onChanged: (v) =>
                                    setState(() => _classFilter = v),
                              ),
                            ),
                          ],
                        ),
                      ),
                      SwitchListTile(
                        dense: true,
                        title: const Text('Show archived'),
                        value: _showArchived,
                        onChanged: (v) => setState(() => _showArchived = v),
                      ),
                      Expanded(
                        child: students.isEmpty
                            ? const Center(child: Text('No students found.'))
                            : ListView.separated(
                                padding:
                                    const EdgeInsets.fromLTRB(16, 0, 16, 88),
                                itemCount: students.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: 8),
                                itemBuilder: (context, i) {
                                  final s = students[i];
                                  final cls = _firstWhereOrNull(
                                      classes, (c) => c.id == s.classId);
                                  return Card(
                                    child: ListTile(
                                      leading: Avatar(name: s.name, size: 40),
                                      title: Text(s.name,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis),
                                      subtitle: Text(
                                          'Roll No. ${s.rollNo}${cls != null ? ' · ${cls.label}' : ''}',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis),
                                      trailing: s.status == 'archived'
                                          ? const BadgeChip('Archived',
                                              variant: BadgeVariant.warning)
                                          : const Icon(Icons.chevron_right),
                                      onTap: () => _openDetail(
                                          context, s, cls, classes, parents),
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
      },
    );
  }

  void _openDetail(
    BuildContext context,
    Student s,
    SchoolClass? cls,
    List<SchoolClass> classes,
    List<ParentProfile> parents,
  ) {
    final linkedParents = s.parentIds
        .map((id) => _firstWhereOrNull(parents, (p) => p.id == id))
        .whereType<ParentProfile>()
        .toList();
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
                  Avatar(name: s.name, size: 44),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(s.name,
                            style: Theme.of(context).textTheme.titleMedium),
                        Text(cls?.label ?? '—'),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _DetailRow('Admission No.',
                  s.admissionNo.isNotEmpty ? s.admissionNo : '—'),
              _DetailRow('Roll No.', s.rollNo.isNotEmpty ? s.rollNo : '—'),
              _DetailRow('Date of Birth', s.dob ?? '—'),
              _DetailRow('Gender', s.gender ?? '—'),
              _DetailRow('Emergency Contact', s.emergencyContact ?? '—'),
              _DetailRow('Medical Notes', s.medicalNotes ?? '—'),
              _DetailRow(
                  'Parents',
                  linkedParents.isNotEmpty
                      ? linkedParents.map((p) => p.name).join(', ')
                      : '—'),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        Navigator.pop(context);
                        _openForm(context,
                            editing: s, classes: classes, parents: parents);
                      },
                      child: const Text('Edit'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton.tonal(
                      onPressed: () async {
                        Navigator.pop(context);
                        final auth = context.read<AuthService>();
                        final nextStatus =
                            s.status == 'archived' ? 'active' : 'archived';
                        await FirestoreService.doc(
                                'schools/${widget.schoolId}/students/${s.id}')
                            .set({'status': nextStatus},
                                SetOptions(merge: true));
                        logActivity(widget.schoolId, auth.user, 'update',
                            'Student', '${s.name} ($nextStatus)');
                      },
                      child:
                          Text(s.status == 'archived' ? 'Restore' : 'Archive'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _openForm(
    BuildContext context, {
    Student? editing,
    required List<SchoolClass> classes,
    required List<ParentProfile> parents,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => _StudentForm(
          schoolId: widget.schoolId,
          editing: editing,
          classes: classes,
          parents: parents),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final outline = Theme.of(context).colorScheme.outline;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
              width: 140,
              child:
                  Text(label, style: TextStyle(color: outline, fontSize: 13))),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}

class _StudentForm extends StatefulWidget {
  const _StudentForm(
      {required this.schoolId,
      this.editing,
      required this.classes,
      required this.parents});

  final String schoolId;
  final Student? editing;
  final List<SchoolClass> classes;
  final List<ParentProfile> parents;

  @override
  State<_StudentForm> createState() => _StudentFormState();
}

class _StudentFormState extends State<_StudentForm> {
  late final _name = TextEditingController(text: widget.editing?.name ?? '');
  late final _admissionNo =
      TextEditingController(text: widget.editing?.admissionNo ?? '');
  late final _rollNo =
      TextEditingController(text: widget.editing?.rollNo ?? '');
  late final _dob = TextEditingController(text: widget.editing?.dob ?? '');
  late final _address =
      TextEditingController(text: widget.editing?.address ?? '');
  late final _emergencyContact =
      TextEditingController(text: widget.editing?.emergencyContact ?? '');
  late final _medicalNotes =
      TextEditingController(text: widget.editing?.medicalNotes ?? '');
  String? _classId;
  String? _gender;
  late List<String> _parentIds;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _classId = widget.editing?.classId;
    _gender = widget.editing?.gender;
    _parentIds = [...(widget.editing?.parentIds ?? [])];
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
              Text(widget.editing != null ? 'Edit Student' : 'Add Student',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              TextField(
                  controller: _name,
                  decoration: const InputDecoration(labelText: 'Name')),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _admissionNo,
                      decoration:
                          const InputDecoration(labelText: 'Admission No.'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                        controller: _rollNo,
                        decoration:
                            const InputDecoration(labelText: 'Roll No.')),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                isExpanded: true,
                value: _classId,
                decoration: const InputDecoration(labelText: 'Class'),
                items: widget.classes
                    .map((c) => DropdownMenuItem<String>(
                        value: c.id, child: Text(c.label)))
                    .toList(),
                onChanged: (v) => setState(() => _classId = v),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _dob,
                      readOnly: true,
                      decoration:
                          const InputDecoration(labelText: 'Date of Birth'),
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate:
                              DateTime.tryParse(_dob.text) ?? DateTime(2015),
                          firstDate: DateTime(1990),
                          lastDate: DateTime.now(),
                        );
                        if (picked != null) {
                          _dob.text = picked.toIso8601String().substring(0, 10);
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      isExpanded: true,
                      value: _gender,
                      decoration: const InputDecoration(labelText: 'Gender'),
                      items: _genders
                          .map(
                              (g) => DropdownMenuItem(value: g, child: Text(g)))
                          .toList(),
                      onChanged: (v) => setState(() => _gender = v),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _address,
                decoration: const InputDecoration(labelText: 'Address'),
                maxLines: 2,
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                icon: const Icon(Icons.family_restroom),
                label: Text(_parentIds.isEmpty
                    ? 'Link Parents'
                    : '${_parentIds.length} parent(s) linked'),
                onPressed: _pickParents,
              ),
              if (_parentIds.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: _parentIds
                        .map((id) => _firstWhereOrNull(
                            widget.parents, (p) => p.id == id))
                        .whereType<ParentProfile>()
                        .map((p) => Chip(label: Text(p.name)))
                        .toList(),
                  ),
                ),
              const SizedBox(height: 12),
              TextField(
                controller: _emergencyContact,
                decoration:
                    const InputDecoration(labelText: 'Emergency Contact'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _medicalNotes,
                decoration: const InputDecoration(labelText: 'Medical Notes'),
                maxLines: 2,
              ),
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
      ),
    );
  }

  Future<void> _pickParents() async {
    final result = await showModalBottomSheet<List<String>>(
      context: context,
      isScrollControlled: true,
      builder: (context) =>
          _ParentPicker(parents: widget.parents, initiallySelected: _parentIds),
    );
    if (result != null) setState(() => _parentIds = result);
  }

  Future<void> _submit() async {
    final name = _name.text.trim();
    final admissionNo = _admissionNo.text.trim();
    if (name.isEmpty || admissionNo.isEmpty || _classId == null) return;
    setState(() => _submitting = true);
    final auth = context.read<AuthService>();
    try {
      final cls = _firstWhereOrNull(widget.classes, (c) => c.id == _classId);
      final payload = {
        'name': name,
        'admissionNo': admissionNo,
        'rollNo': _rollNo.text.trim(),
        'classId': _classId,
        'sectionId': cls?.section ?? '',
        'dob': _dob.text.trim().isEmpty ? null : _dob.text.trim(),
        'gender': _gender,
        'parentIds': _parentIds,
        'address': _address.text.trim().isEmpty ? null : _address.text.trim(),
        'emergencyContact': _emergencyContact.text.trim().isEmpty
            ? null
            : _emergencyContact.text.trim(),
        'medicalNotes': _medicalNotes.text.trim().isEmpty
            ? null
            : _medicalNotes.text.trim(),
        'status': widget.editing?.status ?? 'active',
      };

      final studentRef = widget.editing != null
          ? FirestoreService.doc(
              'schools/${widget.schoolId}/students/${widget.editing!.id}')
          : FirestoreService.collection('schools/${widget.schoolId}/students')
              .doc();

      final beforeParentIds = widget.editing?.parentIds ?? const <String>[];
      final added = _parentIds.where((id) => !beforeParentIds.contains(id));
      final removed = beforeParentIds.where((id) => !_parentIds.contains(id));

      final batch = FirestoreService.batch();
      batch.set(studentRef, payload, SetOptions(merge: true));
      for (final parentId in added) {
        batch.set(
            FirestoreService.doc(
                'schools/${widget.schoolId}/parents/$parentId'),
            {
              'childStudentIds': FieldValue.arrayUnion([studentRef.id])
            },
            SetOptions(merge: true));
      }
      for (final parentId in removed) {
        batch.set(
            FirestoreService.doc(
                'schools/${widget.schoolId}/parents/$parentId'),
            {
              'childStudentIds': FieldValue.arrayRemove([studentRef.id])
            },
            SetOptions(merge: true));
      }
      await batch.commit();
      logActivity(widget.schoolId, auth.user,
          widget.editing != null ? 'update' : 'create', 'Student', name);
      if (mounted) Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}

class _ParentPicker extends StatefulWidget {
  const _ParentPicker({required this.parents, required this.initiallySelected});

  final List<ParentProfile> parents;
  final List<String> initiallySelected;

  @override
  State<_ParentPicker> createState() => _ParentPickerState();
}

class _ParentPickerState extends State<_ParentPicker> {
  late final Set<String> _selected = {...widget.initiallySelected};

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Link Parents', style: Theme.of(context).textTheme.titleLarge),
            SizedBox(
              height: 360,
              child: widget.parents.isEmpty
                  ? const Center(
                      child: Text(
                          'No parents yet. Add one from the Parents tab first.'))
                  : ListView(
                      children: widget.parents
                          .map((p) => CheckboxListTile(
                                value: _selected.contains(p.id),
                                title: Text(p.name),
                                subtitle:
                                    p.email != null ? Text(p.email!) : null,
                                onChanged: (checked) => setState(() {
                                  if (checked == true) {
                                    _selected.add(p.id);
                                  } else {
                                    _selected.remove(p.id);
                                  }
                                }),
                              ))
                          .toList(),
                    ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: GoldButton(
                onPressed: () => Navigator.pop(context, _selected.toList()),
                child: const Text('Done'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
