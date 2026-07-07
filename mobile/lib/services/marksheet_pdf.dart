import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../grading.dart';
import '../models/models.dart';
import 'firestore_service.dart';

T? _firstWhereOrNull<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

// Indigo, matching the app's own theme, so a printed marksheet still reads
// as "this school's system" rather than a generic table.
const _accent = PdfColors.indigo700;
const _accentDark = PdfColors.indigo900;
const _accentLight = PdfColors.indigo50;
const _muted = PdfColors.grey600;

/// Builds one PDF, one page (or more, if content overflows) per student --
/// mirrors the grouping/approval logic in widgets/report_card_view.dart
/// exactly, so the PDF matches what a parent sees on screen. Used for both
/// a single student's "Download PDF" and a class teacher's "Download All".
Future<Uint8List> buildMarksheetsPdf(
    String schoolId, List<Student> students) async {
  final school = await FirestoreService.docGet<School>(
      'schools/$schoolId', School.fromMap);
  final exams = await FirestoreService.collectionGet<Exam>(
    'schools/$schoolId/exams',
    Exam.fromMap,
    build: (q) => q.where('published', isEqualTo: true),
  );
  final subjects = await FirestoreService.collectionGet<Subject>(
      'schools/$schoolId/subjects', Subject.fromMap);
  final classes = await FirestoreService.collectionGet<SchoolClass>(
      'schools/$schoolId/classes', SchoolClass.fromMap);
  final teachers = await FirestoreService.collectionGet<Teacher>(
      'schools/$schoolId/teachers', Teacher.fromMap);
  final componentSets = await FirestoreService.collectionGet<ExamComponentSet>(
      'schools/$schoolId/examComponents', ExamComponentSet.fromMap);

  final doc = pw.Document();

  for (final student in students) {
    final marks = await FirestoreService.collectionGet<Marks>(
      'schools/$schoolId/marks',
      Marks.fromMap,
      build: (q) => q.where('studentId', isEqualTo: student.id),
    );
    final classLabel =
        _firstWhereOrNull(classes, (c) => c.id == student.classId);

    final allResults = computeAllSubjectResults(
        exams, marks, componentSets, student.classId, classLabel?.grade);
    final summary = computeOverallSummary(allResults);

    // Group by subject (approved only), same rule as the parent-facing
    // Report Card: marks aren't final until an admin or class teacher
    // approves them. Anything submitted but not yet approved goes in a
    // separate pending bucket instead of being silently omitted.
    final subjectIds = <String>[];
    final examsBySubject = <String, List<Exam>>{};
    final pendingSubjectIds = <String>[];
    final pendingExamsBySubject = <String, List<Exam>>{};
    for (final exam in exams) {
      for (final entry in exam.schedule) {
        if (entry['grade'] != classLabel?.grade) continue;
        final subjectId = entry['subjectId'] as String? ?? '';
        final cs = _firstWhereOrNull(
          componentSets,
          (c) =>
              c.examId == exam.id &&
              c.classId == student.classId &&
              c.subjectId == subjectId,
        );
        final record = _firstWhereOrNull(marks, (m) => m.examId == exam.id);
        final hasMarks = cs != null &&
            cs.components
                .any((c) => record?.componentMarks[subjectId]?[c.id] != null);
        if (!hasMarks) continue;
        if (!cs.approved) {
          if (!pendingExamsBySubject.containsKey(subjectId)) {
            pendingSubjectIds.add(subjectId);
            pendingExamsBySubject[subjectId] = [];
          }
          pendingExamsBySubject[subjectId]!.add(exam);
          continue;
        }
        if (!examsBySubject.containsKey(subjectId)) {
          subjectIds.add(subjectId);
          examsBySubject[subjectId] = [];
        }
        examsBySubject[subjectId]!.add(exam);
      }
    }

    final content = <pw.Widget>[
      ..._buildLetterhead(school),
      _buildStudentInfo(student, classLabel),
      pw.SizedBox(height: 10),
      _buildSummaryTiles(summary.averagePercentage, summary.overallGrade),
      pw.SizedBox(height: 6),
      pw.Text(
        'Grading scale: ${gradingScale.map((g) => '${g.grade} ${g.range}').join('  ·  ')}',
        style: const pw.TextStyle(fontSize: 7, color: _muted),
      ),
      pw.SizedBox(height: 12),
    ];

    for (final subjectId in pendingSubjectIds) {
      final subject = _firstWhereOrNull(subjects, (s) => s.id == subjectId);
      final examList = pendingExamsBySubject[subjectId]!;
      content.add(
        pw.Container(
          width: double.infinity,
          margin: const pw.EdgeInsets.only(bottom: 8),
          padding: const pw.EdgeInsets.all(8),
          decoration: pw.BoxDecoration(
            color: PdfColors.amber50,
            border: pw.Border.all(color: PdfColors.amber200),
            borderRadius: pw.BorderRadius.circular(4),
          ),
          child: pw.Text(
            '${subject?.name ?? subjectId} -- ${examList.map((e) => '${e.name} (${e.term})').join(', ')} -- Pending teacher approval',
            style: const pw.TextStyle(fontSize: 9),
          ),
        ),
      );
    }

    for (final subjectId in subjectIds) {
      final subject = _firstWhereOrNull(subjects, (s) => s.id == subjectId);
      final teacher = _firstWhereOrNull(
        teachers,
        (t) => t.assignments.any(
            (a) => a.classId == student.classId && a.subjectId == subjectId),
      );
      content.addAll(
        _buildSubjectSection(
          subjectId: subjectId,
          approvedExams: examsBySubject[subjectId]!,
          marks: marks,
          componentSets: componentSets,
          studentClassId: student.classId,
          subject: subject,
          classLabel: classLabel,
          teacher: teacher,
        ),
      );
    }

    if (subjectIds.isEmpty && pendingSubjectIds.isEmpty) {
      content.add(pw.Text('No published results yet.',
          style: pw.TextStyle(fontSize: 10)));
    }

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.fromLTRB(28, 28, 28, 20),
        build: (context) => content,
        footer: (context) => _buildFooter(context),
      ),
    );
  }

  return doc.save();
}

List<pw.Widget> _buildLetterhead(School? school) {
  return [
    pw.Center(
      child: pw.Text(
        school?.name ?? 'School',
        style: pw.TextStyle(
            fontSize: 18, fontWeight: pw.FontWeight.bold, color: _accentDark),
      ),
    ),
    if (school?.address != null || (school?.academicYear ?? '').isNotEmpty) ...[
      pw.SizedBox(height: 3),
      pw.Center(
        child: pw.Text(
          [
            school?.address,
            if ((school?.academicYear ?? '').isNotEmpty)
              'Academic Year ${school!.academicYear}'
          ].where((s) => s != null && s.isNotEmpty).join('   ·   '),
          style: const pw.TextStyle(fontSize: 9, color: _muted),
        ),
      ),
    ],
    pw.SizedBox(height: 6),
    pw.Container(height: 1, color: _accent),
    pw.SizedBox(height: 8),
    pw.Center(
      child: pw.Text(
        'ACADEMIC REPORT CARD',
        style: pw.TextStyle(
            fontSize: 13,
            fontWeight: pw.FontWeight.bold,
            color: _accent,
            letterSpacing: 1.2),
      ),
    ),
    pw.SizedBox(height: 3),
    pw.Container(height: 0.6, color: _accent),
    pw.SizedBox(height: 12),
  ];
}

pw.Widget _buildStudentInfo(Student student, SchoolClass? classLabel) {
  pw.Widget cell(String text, {bool isLabel = false}) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      color: isLabel ? _accentLight : null,
      child: pw.Text(
        text,
        style: pw.TextStyle(
            fontSize: 9,
            fontWeight: isLabel ? pw.FontWeight.bold : pw.FontWeight.normal),
      ),
    );
  }

  return pw.Table(
    border: pw.TableBorder.all(color: PdfColors.grey300, width: 0.5),
    columnWidths: const {
      0: pw.FlexColumnWidth(1.1),
      1: pw.FlexColumnWidth(1.6),
      2: pw.FlexColumnWidth(1.1),
      3: pw.FlexColumnWidth(1.6),
    },
    children: [
      pw.TableRow(children: [
        cell('Student Name', isLabel: true),
        cell(student.name),
        cell('Class', isLabel: true),
        cell(classLabel != null ? classLabel.label : '-'),
      ]),
      pw.TableRow(children: [
        cell('Roll No.', isLabel: true),
        cell(student.rollNo),
        cell('Admission No.', isLabel: true),
        cell(student.admissionNo),
      ]),
    ],
  );
}

pw.Widget _buildSummaryTiles(double averagePercentage, String overallGrade) {
  pw.Widget tile(String label, String value) {
    return pw.Expanded(
      child: pw.Container(
        padding: const pw.EdgeInsets.all(10),
        decoration: pw.BoxDecoration(
            color: _accentLight, borderRadius: pw.BorderRadius.circular(4)),
        child: pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text(label,
                style: const pw.TextStyle(fontSize: 7.5, color: _muted)),
            pw.SizedBox(height: 3),
            pw.Text(value,
                style: pw.TextStyle(
                    fontSize: 15,
                    fontWeight: pw.FontWeight.bold,
                    color: _accentDark)),
          ],
        ),
      ),
    );
  }

  return pw.Row(
    children: [
      tile('OVERALL AVERAGE', '${averagePercentage.toStringAsFixed(1)}%'),
      pw.SizedBox(width: 8),
      tile('OVERALL GRADE', overallGrade),
    ],
  );
}

pw.Widget _buildFooter(pw.Context context) {
  final isLastPage = context.pageNumber == context.pagesCount;
  return pw.Column(
    crossAxisAlignment: pw.CrossAxisAlignment.stretch,
    children: [
      if (isLastPage) ...[
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Container(width: 130, height: 0.6, color: PdfColors.grey400),
                pw.SizedBox(height: 3),
                pw.Text("Class Teacher's Signature",
                    style: const pw.TextStyle(fontSize: 8, color: _muted)),
              ],
            ),
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Container(width: 130, height: 0.6, color: PdfColors.grey400),
                pw.SizedBox(height: 3),
                pw.Text("Principal's Signature",
                    style: const pw.TextStyle(fontSize: 8, color: _muted)),
              ],
            ),
          ],
        ),
        pw.SizedBox(height: 8),
      ],
      pw.Align(
        alignment: pw.Alignment.centerRight,
        child: pw.Text(
          'Page ${context.pageNumber} of ${context.pagesCount}',
          style: const pw.TextStyle(fontSize: 7.5, color: _muted),
        ),
      ),
    ],
  );
}

List<pw.Widget> _buildSubjectSection({
  required String subjectId,
  required List<Exam> approvedExams,
  required List<Marks> marks,
  required List<ExamComponentSet> componentSets,
  required String? studentClassId,
  required Subject? subject,
  required SchoolClass? classLabel,
  required Teacher? teacher,
}) {
  final rows = <List<String>>[];
  var serial = 0;
  var combinedMax = 0.0,
      combinedWeightage = 0.0,
      combinedScored = 0.0,
      combinedWeightageMark = 0.0,
      combinedLost = 0.0;

  for (final exam in approvedExams) {
    final cs = _firstWhereOrNull(
      componentSets,
      (c) =>
          c.examId == exam.id &&
          c.classId == studentClassId &&
          c.subjectId == subjectId,
    );
    if (cs == null || cs.components.isEmpty) continue;
    final record = _firstWhereOrNull(marks, (m) => m.examId == exam.id);
    final result = computeSubjectResult(
        subjectId, cs.components, record?.componentMarks[subjectId]);
    if (!result.components.any((c) => c.present)) continue;

    combinedMax += result.totalMax;
    combinedWeightage += result.totalWeightage;
    combinedScored += result.totalScored;
    combinedWeightageMark += result.totalWeightageMark;
    combinedLost += result.lostWeightage;

    final remark = record?.remarks[subjectId];
    for (var i = 0; i < result.components.length; i++) {
      serial += 1;
      final c = result.components[i];
      rows.add([
        '$serial',
        i == 0 ? '${exam.name} (${exam.term})' : '',
        c.title,
        '${c.maxMark}',
        '${c.weightage}',
        c.present ? 'Present' : 'Absent',
        c.scored?.toStringAsFixed(1) ?? '-',
        c.weightageMark?.toStringAsFixed(1) ?? '-',
        i == 0 ? (remark ?? '') : '',
      ]);
    }
  }

  if (rows.isEmpty) return [];

  final combinedPercentage = combinedWeightage > 0
      ? (combinedWeightageMark / combinedWeightage) * 100
      : 0.0;
  final combinedGrade = gradeForPercentage(combinedPercentage);

  return [
    pw.Container(
      width: double.infinity,
      color: _accent,
      padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: pw.Wrap(
        spacing: 10,
        children: [
          pw.Text(subject?.code ?? subjectId,
              style: const pw.TextStyle(color: PdfColors.white, fontSize: 9)),
          pw.Text(subject?.name ?? '-',
              style: pw.TextStyle(
                  color: PdfColors.white,
                  fontSize: 9,
                  fontWeight: pw.FontWeight.bold)),
          if (classLabel != null)
            pw.Text(classLabel.label,
                style: const pw.TextStyle(color: PdfColors.white, fontSize: 9)),
          if (teacher != null)
            pw.Text(teacher.name,
                style: const pw.TextStyle(color: PdfColors.white, fontSize: 9)),
        ],
      ),
    ),
    pw.Table.fromTextArray(
      headers: [
        'Sl.No',
        'Exam',
        'Mark Title',
        'Max',
        'Wt %',
        'Status',
        'Scored',
        'Wt Mark',
        'Remark'
      ],
      data: rows,
      headerStyle: pw.TextStyle(
          fontSize: 8, fontWeight: pw.FontWeight.bold, color: _accentDark),
      cellStyle: const pw.TextStyle(fontSize: 8),
      headerDecoration: const pw.BoxDecoration(color: _accentLight),
      cellAlignment: pw.Alignment.centerLeft,
      cellPadding: const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 3),
    ),
    pw.Container(
      width: double.infinity,
      color: _accentLight,
      padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(
            'Total: ${combinedScored.toStringAsFixed(2)} / ${combinedMax.toStringAsFixed(2)} '
            '(${combinedWeightageMark.toStringAsFixed(2)} / ${combinedWeightage.toStringAsFixed(2)}) '
            '-- Lost ${combinedLost.toStringAsFixed(2)}',
            style: pw.TextStyle(
                fontSize: 9,
                fontWeight: pw.FontWeight.bold,
                color: _accentDark),
          ),
          pw.Text('Grade: $combinedGrade',
              style: pw.TextStyle(
                  fontSize: 9,
                  fontWeight: pw.FontWeight.bold,
                  color: _accentDark)),
        ],
      ),
    ),
    pw.SizedBox(height: 14),
  ];
}
