import 'package:flutter/material.dart';

import '../grading.dart';
import '../models/models.dart';
import '../services/firestore_service.dart';

T? _firstWhereOrNull<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

/// Shared report-card view: fetches published exams + this student's marks
/// and shows a per-subject weighted-component breakdown (mirrors
/// web/components/ReportCard.tsx). Components come from the subject
/// teacher's own `examComponents` docs, not from the admin-owned Exam.
class ReportCardView extends StatelessWidget {
  const ReportCardView({super.key, required this.schoolId, required this.studentId});

  final String schoolId;
  final String studentId;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<Exam>>(
      stream: FirestoreService.collectionStream(
        'schools/$schoolId/exams',
        Exam.fromMap,
        build: (q) => q.where('published', isEqualTo: true),
      ),
      builder: (context, examsSnap) {
        final exams = examsSnap.data ?? [];
        return StreamBuilder<List<Subject>>(
          stream: FirestoreService.collectionStream('schools/$schoolId/subjects', Subject.fromMap),
          builder: (context, subjectsSnap) {
            final subjects = subjectsSnap.data ?? [];
            return StreamBuilder<List<SchoolClass>>(
              stream: FirestoreService.collectionStream('schools/$schoolId/classes', SchoolClass.fromMap),
              builder: (context, classesSnap) {
                final classes = classesSnap.data ?? [];
                return StreamBuilder<List<Teacher>>(
                  stream: FirestoreService.collectionStream('schools/$schoolId/teachers', Teacher.fromMap),
                  builder: (context, teachersSnap) {
                    final teachers = teachersSnap.data ?? [];
                    return StreamBuilder<List<ExamComponentSet>>(
                      stream: FirestoreService.collectionStream(
                        'schools/$schoolId/examComponents',
                        ExamComponentSet.fromMap,
                      ),
                      builder: (context, componentSetsSnap) {
                        final componentSets = componentSetsSnap.data ?? [];
                        return StreamBuilder<Student?>(
                          stream:
                              FirestoreService.docStream('schools/$schoolId/students/$studentId', Student.fromMap),
                          builder: (context, studentSnap) {
                            final student = studentSnap.data;
                            return StreamBuilder<List<Marks>>(
                              stream: FirestoreService.collectionStream(
                                'schools/$schoolId/marks',
                                Marks.fromMap,
                                build: (q) => q.where('studentId', isEqualTo: studentId),
                              ),
                              builder: (context, marksSnap) {
                                final marks = marksSnap.data ?? [];

                                if (exams.isEmpty) {
                                  return const Padding(
                                    padding: EdgeInsets.all(16),
                                    child: Text('No published results yet.'),
                                  );
                                }

                                final classLabel = _firstWhereOrNull(classes, (c) => c.id == student?.classId);
                                final allResults = computeAllSubjectResults(
                                  exams,
                                  marks,
                                  componentSets,
                                  student?.classId,
                                  classLabel?.grade,
                                );
                                final summary = computeOverallSummary(allResults);

                                // Group by subject first, then by exam within it, so the
                                // same subject (e.g. Mathematics) isn't re-introduced from
                                // scratch under every exam it appears in. Marks aren't
                                // shown to a parent until an admin or class teacher
                                // approves them, so entries with marks but no approval yet
                                // go into a separate pending bucket instead.
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
                                          c.examId == exam.id && c.classId == student?.classId && c.subjectId == subjectId,
                                    );
                                    final record = _firstWhereOrNull(marks, (m) => m.examId == exam.id);
                                    final hasMarks = cs != null &&
                                        cs.components.any((c) => record?.componentMarks[subjectId]?[c.id] != null);
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

                                return ListView(
                                  padding: const EdgeInsets.all(16),
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(
                                          child: _SummaryTile(
                                            label: 'Overall Average',
                                            value: '${summary.averagePercentage.toStringAsFixed(1)}%',
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: _SummaryTile(label: 'Overall Grade', value: summary.overallGrade),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 16),
                                    const _GradingScaleCard(),
                                    const SizedBox(height: 16),
                                    for (final subjectId in pendingSubjectIds)
                                      _PendingApprovalTile(
                                        subject: _firstWhereOrNull(subjects, (s) => s.id == subjectId),
                                        subjectId: subjectId,
                                        exams: pendingExamsBySubject[subjectId]!,
                                      ),
                                    for (final subjectId in subjectIds)
                                      _SubjectCard(
                                        subjectId: subjectId,
                                        exams: examsBySubject[subjectId]!,
                                        marks: marks,
                                        subjects: subjects,
                                        classLabel: classLabel,
                                        studentClassId: student?.classId,
                                        teachers: teachers,
                                        componentSets: componentSets,
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
                );
              },
            );
          },
        );
      },
    );
  }
}

class _PendingApprovalTile extends StatelessWidget {
  const _PendingApprovalTile({required this.subject, required this.subjectId, required this.exams});

  final Subject? subject;
  final String subjectId;
  final List<Exam> exams;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.amber.shade50,
        border: Border.all(color: Colors.amber.shade200),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              '${subject?.name ?? subjectId} — ${exams.map((e) => '${e.name} (${e.term})').join(', ')}',
              style: const TextStyle(fontSize: 13),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            'Pending approval',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.amber.shade800),
          ),
        ],
      ),
    );
  }
}

class _GradingScaleCard extends StatelessWidget {
  const _GradingScaleCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'HOW GRADES ARE CALCULATED',
              style: Theme.of(context)
                  .textTheme
                  .labelSmall
                  ?.copyWith(fontWeight: FontWeight.w700, letterSpacing: 0.5),
            ),
            const SizedBox(height: 4),
            Text(
              "Each subject's percentage is its weighted score across every assessment component "
              '(test, quiz, etc.), then mapped to a letter grade:',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                for (final g in gradingScale)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(text: '${g.grade}  ', style: const TextStyle(fontWeight: FontWeight.w700)),
                          TextSpan(text: g.range, style: TextStyle(color: Colors.grey.shade600)),
                        ],
                      ),
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryTile extends StatelessWidget {
  const _SummaryTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 4),
            Text(value, style: Theme.of(context).textTheme.titleLarge),
          ],
        ),
      ),
    );
  }
}

// Groups every exam for one subject under a single header -- previously each
// exam re-rendered its own full subject header, so the same subject (e.g.
// Mathematics) appeared as a brand-new card once per exam instead of once
// overall with each exam nested inside it.
class _SubjectCard extends StatelessWidget {
  const _SubjectCard({
    required this.subjectId,
    required this.exams,
    required this.marks,
    required this.subjects,
    required this.classLabel,
    required this.studentClassId,
    required this.teachers,
    required this.componentSets,
  });

  final String subjectId;
  final List<Exam> exams;
  final List<Marks> marks;
  final List<Subject> subjects;
  final SchoolClass? classLabel;
  final String? studentClassId;
  final List<Teacher> teachers;
  final List<ExamComponentSet> componentSets;

  @override
  Widget build(BuildContext context) {
    final subject = _firstWhereOrNull(subjects, (s) => s.id == subjectId);
    final teacher = _firstWhereOrNull(
      teachers,
      (t) => t.assignments.any((a) => a.classId == studentClassId && a.subjectId == subjectId),
    );

    // Scheduling is grade-wide; the student's actual section still
    // determines whose ExamComponentSet (and marks) apply.
    final graded = <(Exam, Marks?, SubjectResult)>[];
    for (final exam in exams) {
      final componentSet = _firstWhereOrNull(
        componentSets,
        (cs) => cs.examId == exam.id && cs.classId == studentClassId && cs.subjectId == subjectId,
      );
      if (componentSet == null || componentSet.components.isEmpty) continue;
      final record = _firstWhereOrNull(marks, (m) => m.examId == exam.id);
      final result = computeSubjectResult(subjectId, componentSet.components, record?.componentMarks[subjectId]);
      if (!result.components.any((c) => c.present)) continue;
      graded.add((exam, record, result));
    }

    // One combined total across every exam for this subject, so a subject
    // with multiple exams (CAT + Mid-term, say) still ends in a single
    // bottom-line figure instead of leaving the reader to add up several
    // same-labeled "Total" rows themselves.
    var combinedMax = 0.0, combinedWeightage = 0.0, combinedScored = 0.0, combinedWeightageMark = 0.0, combinedLost = 0.0;
    for (final (_, _, result) in graded) {
      combinedMax += result.totalMax;
      combinedWeightage += result.totalWeightage;
      combinedScored += result.totalScored;
      combinedWeightageMark += result.totalWeightageMark;
      combinedLost += result.lostWeightage;
    }
    final combinedPercentage = combinedWeightage > 0 ? (combinedWeightageMark / combinedWeightage) * 100 : 0.0;
    final combinedGrade = gradeForPercentage(combinedPercentage);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            color: Colors.blue.shade700,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Wrap(
              spacing: 12,
              children: [
                Text(subject?.code ?? subjectId, style: const TextStyle(color: Colors.white, fontSize: 12)),
                Text(
                  subject?.name ?? '—',
                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                ),
                if (classLabel != null)
                  Text(classLabel!.label, style: const TextStyle(color: Colors.white, fontSize: 12)),
                if (teacher != null) Text(teacher.name, style: const TextStyle(color: Colors.white, fontSize: 12)),
              ],
            ),
          ),
          for (final (exam, record, result) in graded)
            _ExamSection(exam: exam, remark: record?.remarks[subjectId], result: result),
          if (graded.isNotEmpty)
            Container(
              width: double.infinity,
              color: Colors.blue.shade50,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      'Total: ${combinedScored.toStringAsFixed(1)} / ${combinedMax.toStringAsFixed(1)} '
                      '(${combinedWeightageMark.toStringAsFixed(1)} / ${combinedWeightage.toStringAsFixed(1)}) '
                      '— Lost ${combinedLost.toStringAsFixed(1)}',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                  Text(combinedGrade, style: const TextStyle(fontWeight: FontWeight.w700)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _ExamSection extends StatelessWidget {
  const _ExamSection({
    required this.exam,
    required this.remark,
    required this.result,
  });

  final Exam exam;
  final String? remark;
  final SubjectResult result;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          color: Colors.grey.shade100,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Text(
            '${exam.name} (${exam.term})',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final c in result.components)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Expanded(flex: 3, child: Text(c.title)),
                      Expanded(
                        flex: 2,
                        child: Text('${c.scored?.toStringAsFixed(1) ?? '—'} / ${c.maxMark}'),
                      ),
                      Expanded(
                        flex: 2,
                        child: Text(
                          c.weightageMark != null
                              ? '${c.weightageMark!.toStringAsFixed(1)} / ${c.weightage}'
                              : '— / ${c.weightage}',
                        ),
                      ),
                    ],
                  ),
                ),
              if (remark != null && remark!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  'Teacher remarks: $remark',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
