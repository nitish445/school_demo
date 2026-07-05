import 'models/models.dart';

/// Clearly-labeled default cutoffs, mirroring lib/grading.ts on the web side --
/// there's no grading-scale config anywhere in this codebase, so this is a
/// reasonable starting point, not derived from any existing setting.
String gradeForPercentage(num pct) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 33) return 'D'; // 33% is a common Indian-school pass mark
  return 'F';
}

class GradeRange {
  final String grade;
  final String range;

  const GradeRange(this.grade, this.range);
}

// Human-readable version of the cutoffs above, kept in lockstep with
// gradeForPercentage -- shown alongside grades wherever they appear so it's
// never a mystery how a percentage turned into a letter.
const List<GradeRange> gradingScale = [
  GradeRange('A+', '90% and above'),
  GradeRange('A', '80% – 89.9%'),
  GradeRange('B+', '70% – 79.9%'),
  GradeRange('B', '60% – 69.9%'),
  GradeRange('C', '50% – 59.9%'),
  GradeRange('D', '33% – 49.9%'),
  GradeRange('F', 'Below 33%'),
];

class ComponentResult {
  final String componentId;
  final String title;
  final num maxMark;
  final num weightage;
  final num? scored;
  final double? weightageMark;
  final bool present;

  ComponentResult({
    required this.componentId,
    required this.title,
    required this.maxMark,
    required this.weightage,
    required this.scored,
    required this.weightageMark,
    required this.present,
  });
}

class SubjectResult {
  final String subjectId;
  final num totalMax;
  final num totalWeightage;
  final num totalScored;
  final double totalWeightageMark;
  final double lostWeightage;
  final double percentage;
  final String grade;
  final List<ComponentResult> components;

  SubjectResult({
    required this.subjectId,
    required this.totalMax,
    required this.totalWeightage,
    required this.totalScored,
    required this.totalWeightageMark,
    required this.lostWeightage,
    required this.percentage,
    required this.grade,
    required this.components,
  });
}

/// Per-component breakdown for one subject within one exam -- mirrors
/// computeSubjectResult in web/lib/grading.ts. `components` comes from the
/// subject teacher's own ExamComponentSet, not from the (admin-owned) Exam.
SubjectResult computeSubjectResult(
  String subjectId,
  List<ExamComponent> components,
  Map<String, num>? componentMarksForSubject,
) {
  final rows = components.map((c) {
    final scored = componentMarksForSubject?[c.id];
    final present = scored != null;
    final weightageMark = present ? (scored / c.maxMark) * c.weightage : null;
    return ComponentResult(
      componentId: c.id,
      title: c.title,
      maxMark: c.maxMark,
      weightage: c.weightage,
      scored: present ? scored : null,
      weightageMark: weightageMark?.toDouble(),
      present: present,
    );
  }).toList();

  final totalMax = components.fold<num>(0, (sum, c) => sum + c.maxMark);
  final totalWeightage = components.fold<num>(0, (sum, c) => sum + c.weightage);
  final totalScored = rows.fold<num>(0, (sum, r) => sum + (r.scored ?? 0));
  final totalWeightageMark = rows.fold<double>(0, (sum, r) => sum + (r.weightageMark ?? 0));
  final lostWeightage = totalWeightage - totalWeightageMark;
  final percentage = totalWeightage > 0 ? (totalWeightageMark / totalWeightage) * 100 : 0.0;

  return SubjectResult(
    subjectId: subjectId,
    totalMax: totalMax,
    totalWeightage: totalWeightage,
    totalScored: totalScored,
    totalWeightageMark: totalWeightageMark,
    lostWeightage: lostWeightage.toDouble(),
    percentage: percentage.toDouble(),
    grade: gradeForPercentage(percentage),
    components: rows,
  );
}

T? _firstWhereOrNull<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

/// Every subject-within-exam result for a student, across every published
/// exam whose schedule includes the student's grade (scheduling is
/// grade-wide, not per-section). `componentSets` is the full
/// `examComponents` collection (subject-teacher-owned, still keyed by the
/// student's actual class since marks are entered per-section).
List<SubjectResult> computeAllSubjectResults(
  List<Exam> exams,
  List<Marks> marks,
  List<ExamComponentSet> componentSets,
  String? studentClassId,
  String? studentGrade,
) {
  if (studentClassId == null || studentGrade == null) return [];
  final results = <SubjectResult>[];
  for (final exam in exams) {
    final record = _firstWhereOrNull(marks, (m) => m.examId == exam.id);
    final myScheduleEntries = exam.schedule.where((s) => s['grade'] == studentGrade);
    for (final entry in myScheduleEntries) {
      final subjectId = entry['subjectId'] as String? ?? '';
      final componentSet = _firstWhereOrNull(
        componentSets,
        (cs) => cs.examId == exam.id && cs.classId == studentClassId && cs.subjectId == subjectId,
      );
      // Not visible to parents/summary stats until an admin or class teacher
      // approves it -- a subject teacher's own save is not enough.
      if (componentSet == null || componentSet.components.isEmpty || !componentSet.approved) continue;
      final result = computeSubjectResult(subjectId, componentSet.components, record?.componentMarks[subjectId]);
      if (!result.components.any((c) => c.present)) continue;
      results.add(result);
    }
  }
  return results;
}

class OverallSummary {
  final double averagePercentage;
  final String overallGrade;

  OverallSummary({required this.averagePercentage, required this.overallGrade});
}

OverallSummary computeOverallSummary(List<SubjectResult> results) {
  if (results.isEmpty) return OverallSummary(averagePercentage: 0, overallGrade: '—');
  final average = results.map((r) => r.percentage).reduce((a, b) => a + b) / results.length;
  return OverallSummary(averagePercentage: average, overallGrade: gradeForPercentage(average));
}
