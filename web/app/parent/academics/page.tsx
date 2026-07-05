"use client";

import { where } from "firebase/firestore";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useEffectiveChildId } from "@/hooks/useEffectiveChildId";
import { useCollection } from "@/hooks/useCollection";
import { useDoc } from "@/hooks/useDoc";
import type { Exam, SchoolClass, Student, Subject } from "@/types/models";
import { ReportCard } from "@/components/ReportCard";
import { Card } from "@/components/ui/Card";

export default function ParentAcademicsPage() {
  const schoolId = useSchoolId();
  const { effectiveChildId, childStudentIds } = useEffectiveChildId();
  const { data: student } = useDoc<Student>(
    schoolId && effectiveChildId ? `schools/${schoolId}/students/${effectiveChildId}` : null
  );
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const { data: subjects } = useCollection<Subject>(schoolId ? `schools/${schoolId}/subjects` : null);
  const { data: exams } = useCollection<Exam>(
    schoolId ? `schools/${schoolId}/exams` : null,
    [where("published", "==", true)],
    []
  );

  const childGrade = classes.find((c) => c.id === student?.classId)?.grade;
  const upcomingExams = exams
    .flatMap((exam) => exam.schedule.map((entry) => ({ exam, entry })))
    .filter(({ entry }) => entry.grade === childGrade)
    .sort((a, b) => a.entry.date.localeCompare(b.entry.date));

  if (childStudentIds.length === 0) {
    return <p className="text-sm text-stone-500">No children are linked to your account yet.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Academics</h1>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-stone-900">Upcoming Exams</h2>
        {upcomingExams.length === 0 ? (
          <p className="text-sm text-stone-500">No exams scheduled yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100 text-sm">
            {upcomingExams.map(({ exam, entry }, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-stone-800">
                  <span className="font-medium">{exam.name}</span> ({exam.term}) —{" "}
                  {subjects.find((s) => s.id === entry.subjectId)?.name ?? entry.subjectId}
                </span>
                <span className="text-stone-500">{entry.date || "Date TBD"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ReportCard schoolId={schoolId} studentId={effectiveChildId} />
    </div>
  );
}
