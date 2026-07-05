import type { Exam, ExamComponent, ExamComponentSet, Marks } from "@/types/models";

// Clearly-labeled default cutoffs -- there's no grading-scale config anywhere
// else in this codebase, so these are a reasonable starting point, not
// derived from any existing setting. Easy to adjust in one place later.
export function gradeForPercentage(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 33) return "D"; // 33% is a common Indian-school pass mark
  return "F";
}

// Human-readable version of the same cutoffs above, kept in lockstep with
// gradeForPercentage -- shown alongside grades wherever they appear so it's
// never a mystery how a percentage turned into a letter.
export const GRADING_SCALE: { grade: string; range: string }[] = [
  { grade: "A+", range: "90% and above" },
  { grade: "A", range: "80% – 89.9%" },
  { grade: "B+", range: "70% – 79.9%" },
  { grade: "B", range: "60% – 69.9%" },
  { grade: "C", range: "50% – 59.9%" },
  { grade: "D", range: "33% – 49.9%" },
  { grade: "F", range: "Below 33%" },
];

export interface ComponentResult {
  componentId: string;
  title: string;
  maxMark: number;
  weightage: number;
  scored: number | null; // null = no mark entered yet
  weightageMark: number | null;
  present: boolean;
}

export interface SubjectResult {
  subjectId: string;
  totalMax: number;
  totalWeightage: number;
  totalScored: number;
  totalWeightageMark: number;
  lostWeightage: number;
  /** Out of 100 -- equal to totalWeightageMark when weightages sum to 100, normalized otherwise. */
  percentage: number;
  grade: string;
  components: ComponentResult[];
}

/**
 * Per-component breakdown for one subject within one exam, mirroring a
 * university-style weightage report: each component's scored mark converts
 * to a weightage mark (scored/max * weightage), and the subject's overall
 * percentage is the sum of weightage marks (normalized if weightages don't
 * sum to exactly 100). `components` comes from the subject teacher's own
 * ExamComponentSet, not from the (admin-owned) Exam doc.
 */
export function computeSubjectResult(
  subjectId: string,
  components: ExamComponent[],
  componentMarksForSubject: Record<string, number> | undefined
): SubjectResult {
  const rows: ComponentResult[] = components.map((c) => {
    const scored = componentMarksForSubject?.[c.id];
    const present = scored !== undefined;
    const weightageMark = present ? (scored / c.maxMark) * c.weightage : null;
    return {
      componentId: c.id,
      title: c.title,
      maxMark: c.maxMark,
      weightage: c.weightage,
      scored: present ? scored : null,
      weightageMark,
      present,
    };
  });

  const totalMax = components.reduce((sum, c) => sum + c.maxMark, 0);
  const totalWeightage = components.reduce((sum, c) => sum + c.weightage, 0);
  const totalScored = rows.reduce((sum, r) => sum + (r.scored ?? 0), 0);
  const totalWeightageMark = rows.reduce((sum, r) => sum + (r.weightageMark ?? 0), 0);
  const lostWeightage = totalWeightage - totalWeightageMark;
  const percentage = totalWeightage > 0 ? (totalWeightageMark / totalWeightage) * 100 : 0;

  return {
    subjectId,
    totalMax,
    totalWeightage,
    totalScored,
    totalWeightageMark,
    lostWeightage,
    percentage,
    grade: gradeForPercentage(percentage),
    components: rows,
  };
}

/**
 * Every subject-within-exam result for a student, across every published
 * exam whose schedule includes the student's grade (scheduling is grade-wide,
 * not per-section). `componentSets` is the full `examComponents` collection
 * (subject-teacher-owned, still keyed by the student's actual class since
 * marks are entered per-section).
 */
export function computeAllSubjectResults(
  exams: Exam[],
  marks: Marks[],
  componentSets: ExamComponentSet[],
  studentClassId: string | undefined,
  studentGrade: string | undefined
): (SubjectResult & { examId: string })[] {
  if (!studentClassId || !studentGrade) return [];
  const results: (SubjectResult & { examId: string })[] = [];
  for (const exam of exams) {
    const record = marks.find((m) => m.examId === exam.id);
    for (const entry of exam.schedule.filter((s) => s.grade === studentGrade)) {
      const componentSet = componentSets.find(
        (cs) => cs.examId === exam.id && cs.classId === studentClassId && cs.subjectId === entry.subjectId
      );
      // Not visible to parents/summary stats until an admin or class teacher
      // approves it -- a subject teacher's own save is not enough.
      if (!componentSet || componentSet.components.length === 0 || !componentSet.approved) continue;
      const result = computeSubjectResult(
        entry.subjectId,
        componentSet.components,
        record?.componentMarks?.[entry.subjectId]
      );
      // Skip subjects with nothing entered yet -- nothing meaningful to show or average in.
      if (!result.components.some((c) => c.present)) continue;
      results.push({ ...result, examId: exam.id });
    }
  }
  return results;
}

export function computeOverallSummary(results: SubjectResult[]): {
  averagePercentage: number;
  overallGrade: string;
} {
  if (results.length === 0) return { averagePercentage: 0, overallGrade: "—" };
  const averagePercentage = results.reduce((sum, r) => sum + r.percentage, 0) / results.length;
  return { averagePercentage, overallGrade: gradeForPercentage(averagePercentage) };
}
