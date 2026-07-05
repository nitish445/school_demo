"use client";

import { where } from "firebase/firestore";
import { useCollection } from "@/hooks/useCollection";
import { useDoc } from "@/hooks/useDoc";
import type { Exam, ExamComponentSet, Marks, SchoolClass, Student, Subject, Teacher } from "@/types/models";
import {
  computeAllSubjectResults,
  computeOverallSummary,
  computeSubjectResult,
  gradeForPercentage,
  GRADING_SCALE,
} from "@/lib/grading";
import { StatCard } from "@/components/ui/StatCard";
import { Percent, Award, ClipboardCheck } from "lucide-react";

export function ReportCard({ schoolId, studentId }: { schoolId: string; studentId: string }) {
  const { data: exams, loading: loadingExams } = useCollection<Exam>(
    schoolId ? `schools/${schoolId}/exams` : null,
    [where("published", "==", true)],
    []
  );
  const { data: subjects, loading: loadingSubjects } = useCollection<Subject>(
    schoolId ? `schools/${schoolId}/subjects` : null
  );
  const { data: classes, loading: loadingClasses } = useCollection<SchoolClass>(
    schoolId ? `schools/${schoolId}/classes` : null
  );
  const { data: teachers, loading: loadingTeachers } = useCollection<Teacher>(
    schoolId ? `schools/${schoolId}/teachers` : null
  );
  const { data: componentSets, loading: loadingComponentSets } = useCollection<ExamComponentSet>(
    schoolId ? `schools/${schoolId}/examComponents` : null
  );
  const { data: student, loading: loadingStudent } = useDoc<Student>(
    schoolId && studentId ? `schools/${schoolId}/students/${studentId}` : null
  );
  const { data: marks, loading: loadingMarks } = useCollection<Marks>(
    schoolId && studentId ? `schools/${schoolId}/marks` : null,
    studentId ? [where("studentId", "==", studentId)] : [],
    [studentId]
  );

  const allLoaded =
    !loadingExams &&
    !loadingSubjects &&
    !loadingClasses &&
    !loadingTeachers &&
    !loadingComponentSets &&
    !loadingStudent &&
    !loadingMarks;

  if (!allLoaded) {
    return <p className="text-sm text-stone-500">Loading...</p>;
  }

  if (exams.length === 0) {
    return <p className="text-sm text-stone-500">No published results yet.</p>;
  }

  const classLabel = classes.find((c) => c.id === student?.classId);
  const allResults = computeAllSubjectResults(exams, marks, componentSets, student?.classId, classLabel?.grade);
  const summary = computeOverallSummary(allResults);

  // Group by subject first, then by exam within it -- the same subject
  // (e.g. Mathematics) sat under a repeated blue header once per exam
  // before; a parent reading top-to-bottom expects every exam for a given
  // subject together, not the subject re-introduced from scratch each time.
  //
  // Marks aren't shown to a parent until an admin or class teacher approves
  // them -- a subject teacher's save alone isn't enough. Entries with marks
  // but no approval yet still surface as a "Pending approval" line, so it's
  // clear the system is working rather than silently missing.
  const gradedBySubject = new Map<
    string,
    { subjectId: string; entries: { exam: Exam; result: ReturnType<typeof computeSubjectResult> }[] }
  >();
  const pendingBySubject = new Map<string, { subjectId: string; exams: Exam[] }>();
  for (const exam of exams) {
    const record = marks.find((m) => m.examId === exam.id);
    const submittedEntries = exam.schedule.filter((entry) => {
      if (entry.grade !== classLabel?.grade) return false;
      const cs = componentSets.find(
        (c) => c.examId === exam.id && c.classId === student?.classId && c.subjectId === entry.subjectId
      );
      return cs && cs.components.some((c) => record?.componentMarks?.[entry.subjectId]?.[c.id] !== undefined);
    });
    for (const entry of submittedEntries) {
      const componentSet = componentSets.find(
        (c) => c.examId === exam.id && c.classId === student?.classId && c.subjectId === entry.subjectId
      );
      if (!componentSet?.approved) {
        const bucket = pendingBySubject.get(entry.subjectId) ?? { subjectId: entry.subjectId, exams: [] };
        bucket.exams.push(exam);
        pendingBySubject.set(entry.subjectId, bucket);
        continue;
      }
      const result = computeSubjectResult(
        entry.subjectId,
        componentSet.components,
        record?.componentMarks[entry.subjectId]
      );
      const bucket = gradedBySubject.get(entry.subjectId) ?? { subjectId: entry.subjectId, entries: [] };
      bucket.entries.push({ exam, result });
      gradedBySubject.set(entry.subjectId, bucket);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Overall Average" value={`${summary.averagePercentage.toFixed(1)}%`} icon={Percent} tint="sky" />
        <StatCard label="Overall Grade" value={summary.overallGrade} icon={Award} tint="gold" />
        <StatCard label="Subjects Graded" value={allResults.length} icon={ClipboardCheck} tint="emerald" />
      </div>

      <div className="rounded-xl border border-stone-200/80 bg-white px-4 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
          How grades are calculated
        </p>
        <p className="mb-2 text-xs text-stone-500">
          Each subject's percentage is its weighted score across every assessment component (test, quiz, etc.),
          then mapped to a letter grade:
        </p>
        <div className="flex flex-wrap gap-2">
          {GRADING_SCALE.map(({ grade, range }) => (
            <span
              key={grade}
              className="flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-700"
            >
              <span className="font-semibold text-stone-900">{grade}</span>
              <span className="text-stone-500">{range}</span>
            </span>
          ))}
        </div>
      </div>

      {gradedBySubject.size === 0 && pendingBySubject.size === 0 ? (
        <p className="text-sm text-stone-500">Marks not entered yet.</p>
      ) : (
        <>
          {Array.from(pendingBySubject.values()).map(({ subjectId, exams: pendingExams }) => {
            const subject = subjects.find((s) => s.id === subjectId);
            return (
              <div
                key={`pending-${subjectId}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm"
              >
                <span className="text-stone-800">
                  <span className="font-semibold">{subject?.name ?? subjectId}</span> —{" "}
                  {pendingExams.map((e) => `${e.name} (${e.term})`).join(", ")}
                </span>
                <span className="font-medium text-amber-700">Pending teacher approval</span>
              </div>
            );
          })}
          {Array.from(gradedBySubject.values()).map(({ subjectId, entries }) => {
          const subject = subjects.find((s) => s.id === subjectId);
          const teacher = teachers.find((t) =>
            t.assignments.some((a) => a.classId === student?.classId && a.subjectId === subjectId)
          );

          // One combined total across every exam for this subject, so a
          // subject with multiple exams (CAT + Mid-term, say) still ends in
          // a single bottom-line figure instead of leaving the reader to
          // add up several same-labeled "Total" rows themselves.
          const combined = entries.reduce(
            (acc, { result }) => ({
              totalMax: acc.totalMax + result.totalMax,
              totalWeightage: acc.totalWeightage + result.totalWeightage,
              totalScored: acc.totalScored + result.totalScored,
              totalWeightageMark: acc.totalWeightageMark + result.totalWeightageMark,
              lostWeightage: acc.lostWeightage + result.lostWeightage,
            }),
            { totalMax: 0, totalWeightage: 0, totalScored: 0, totalWeightageMark: 0, lostWeightage: 0 }
          );
          const combinedPercentage =
            combined.totalWeightage > 0 ? (combined.totalWeightageMark / combined.totalWeightage) * 100 : 0;
          const combinedGrade = gradeForPercentage(combinedPercentage);

          return (
            <div
              key={subjectId}
              className="overflow-hidden rounded-xl border border-stone-200/80 bg-white shadow-[0_2px_10px_-2px_rgba(41,27,10,0.06)]"
            >
              <div className="flex flex-wrap gap-x-6 gap-y-1 bg-blue-600 px-4 py-2.5 text-xs font-medium text-white">
                <span>{subject?.code ?? subjectId}</span>
                <span className="font-semibold">{subject?.name ?? "—"}</span>
                {classLabel && (
                  <span>
                    {classLabel.grade}-{classLabel.section}
                  </span>
                )}
                {teacher && <span>{teacher.name}</span>}
              </div>

              <table className="min-w-full divide-y divide-stone-200 text-sm">
                <thead className="bg-stone-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-stone-600">Sl.No.</th>
                    <th className="px-3 py-2 text-left font-medium text-stone-600">Exam</th>
                    <th className="px-3 py-2 text-left font-medium text-stone-600">Mark Title</th>
                    <th className="px-3 py-2 text-left font-medium text-stone-600">Max. Mark</th>
                    <th className="px-3 py-2 text-left font-medium text-stone-600">Weightage %</th>
                    <th className="px-3 py-2 text-left font-medium text-stone-600">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-stone-600">Scored Mark</th>
                    <th className="px-3 py-2 text-left font-medium text-stone-600">Weightage Mark</th>
                    <th className="px-3 py-2 text-left font-medium text-stone-600">Remark</th>
                  </tr>
                </thead>
                {(() => {
                  let serial = 0;
                  return entries.map(({ exam, result }) => {
                    const record = marks.find((m) => m.examId === exam.id);
                    const remark = record?.remarks?.[subjectId];
                    return (
                      <tbody key={exam.id} className="divide-y divide-stone-100 border-t border-stone-200/80">
                        {result.components.map((c, i) => {
                          serial += 1;
                          return (
                            <tr key={c.componentId}>
                              <td className="px-3 py-2 text-stone-800">{serial}</td>
                              <td className="px-3 py-2 text-stone-800">
                                {i === 0 ? `${exam.name} (${exam.term})` : ""}
                              </td>
                              <td className="px-3 py-2 text-stone-800">{c.title}</td>
                              <td className="px-3 py-2 text-stone-800">{c.maxMark}</td>
                              <td className="px-3 py-2 text-stone-800">{c.weightage}</td>
                              <td className="px-3 py-2 text-stone-800">{c.present ? "Present" : "Absent"}</td>
                              <td className="px-3 py-2 text-stone-800">{c.scored?.toFixed(1) ?? "—"}</td>
                              <td className="px-3 py-2 text-stone-800">{c.weightageMark?.toFixed(1) ?? "—"}</td>
                              <td className="px-3 py-2 text-stone-500">{i === 0 ? remark : ""}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    );
                  });
                })()}
              </table>

              {entries.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200/80 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-stone-900">
                  <span>
                    Total: {combined.totalScored.toFixed(2)} / {combined.totalMax.toFixed(2)} (
                    {combined.totalWeightageMark.toFixed(2)} / {combined.totalWeightage.toFixed(2)}) — Lost{" "}
                    {combined.lostWeightage.toFixed(2)}
                  </span>
                  <span>Grade: {combinedGrade}</span>
                </div>
              )}
            </div>
          );
          })}
        </>
      )}
    </div>
  );
}
