import 'package:flutter/material.dart';
import 'package:printing/printing.dart';

import '../../models/models.dart';
import '../../services/firestore_service.dart';
import '../../services/marksheet_pdf.dart';
import '../../widgets/report_card_view.dart';

T? _firstWhereOrNull<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

class TeacherReportCardScreen extends StatefulWidget {
  const TeacherReportCardScreen(
      {super.key, required this.schoolId, required this.classIds});

  final String schoolId;
  final List<String> classIds;

  @override
  State<TeacherReportCardScreen> createState() =>
      _TeacherReportCardScreenState();
}

class _TeacherReportCardScreenState extends State<TeacherReportCardScreen> {
  String? _classId;
  String? _studentId;
  bool _exporting = false;

  @override
  void initState() {
    super.initState();
    _classId = widget.classIds.isNotEmpty ? widget.classIds.first : null;
  }

  Future<void> _downloadOne(Student student) async {
    setState(() => _exporting = true);
    try {
      final bytes = await buildMarksheetsPdf(widget.schoolId, [student]);
      await Printing.sharePdf(
          bytes: bytes, filename: '${student.name} - Report Card.pdf');
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _downloadAll(List<Student> students, String classLabel) async {
    if (students.isEmpty) return;
    setState(() => _exporting = true);
    try {
      final bytes = await buildMarksheetsPdf(widget.schoolId, students);
      await Printing.sharePdf(
          bytes: bytes, filename: '$classLabel - Marksheets.pdf');
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Report Card')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: StreamBuilder<List<SchoolClass>>(
              stream: FirestoreService.collectionStream(
                  'schools/${widget.schoolId}/classes', SchoolClass.fromMap),
              builder: (context, classSnap) {
                final classes = (classSnap.data ?? [])
                    .where((c) => widget.classIds.contains(c.id))
                    .toList();
                return Column(
                  children: [
                    DropdownButtonFormField<String>(
                      isExpanded: true,
                      value: _classId,
                      decoration: const InputDecoration(labelText: 'Class'),
                      items: classes
                          .map((c) => DropdownMenuItem(
                              value: c.id, child: Text(c.label)))
                          .toList(),
                      onChanged: (v) => setState(() {
                        _classId = v;
                        _studentId = null;
                      }),
                    ),
                    const SizedBox(height: 8),
                    StreamBuilder<List<Student>>(
                      stream: FirestoreService.collectionStream(
                        'schools/${widget.schoolId}/students',
                        Student.fromMap,
                        build: (q) => q
                            .where('classId', isEqualTo: _classId)
                            .where('status', isEqualTo: 'active'),
                      ),
                      builder: (context, studentSnap) {
                        final students = studentSnap.data ?? [];
                        final selected = _firstWhereOrNull(
                            students, (s) => s.id == _studentId);
                        final classLabel =
                            _firstWhereOrNull(classes, (c) => c.id == _classId)
                                    ?.label ??
                                'Class';
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            DropdownButtonFormField<String>(
                              isExpanded: true,
                              initialValue: _studentId,
                              decoration:
                                  const InputDecoration(labelText: 'Student'),
                              items: students
                                  .map((s) => DropdownMenuItem(
                                      value: s.id, child: Text(s.name)))
                                  .toList(),
                              onChanged: (v) => setState(() => _studentId = v),
                            ),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                if (selected != null)
                                  OutlinedButton.icon(
                                    onPressed: _exporting
                                        ? null
                                        : () => _downloadOne(selected),
                                    icon: const Icon(
                                        Icons.picture_as_pdf_outlined,
                                        size: 18),
                                    label: Text(_exporting
                                        ? 'Preparing...'
                                        : 'Download PDF'),
                                  ),
                                FilledButton.icon(
                                  onPressed: _exporting || students.isEmpty
                                      ? null
                                      : () =>
                                          _downloadAll(students, classLabel),
                                  icon: const Icon(Icons.download_outlined,
                                      size: 18),
                                  label: Text(_exporting
                                      ? 'Preparing...'
                                      : 'Download All Marksheets (PDF)'),
                                ),
                              ],
                            ),
                          ],
                        );
                      },
                    ),
                  ],
                );
              },
            ),
          ),
          if (_studentId != null)
            Expanded(
                child: ReportCardView(
                    schoolId: widget.schoolId, studentId: _studentId!))
          else
            const Expanded(
                child: Center(child: Text('Choose a class and student.'))),
        ],
      ),
    );
  }
}
