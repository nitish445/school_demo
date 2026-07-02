"use client";

import { where } from "firebase/firestore";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useEffectiveChildId } from "@/hooks/useEffectiveChildId";
import { useCollection } from "@/hooks/useCollection";
import type { Exam, Marks, Subject } from "@/types/models";

export default function ParentAcademicsPage() {
  const schoolId = useSchoolId();
  const { effectiveChildId, childStudentIds } = useEffectiveChildId();

  const { data: exams, loading: loadingExams } = useCollection<Exam>(
    schoolId ? `schools/${schoolId}/exams` : null,
    [where("published", "==", true)],
    []
  );
  const { data: subjects } = useCollection<Subject>(schoolId ? `schools/${schoolId}/subjects` : null);
  const { data: marks, loading: loadingMarks } = useCollection<Marks>(
    schoolId && effectiveChildId ? `schools/${schoolId}/marks` : null,
    effectiveChildId ? [where("studentId", "==", effectiveChildId)] : [],
    [effectiveChildId]
  );

  if (childStudentIds.length === 0) {
    return <p className="text-sm text-gray-500">No children are linked to your account yet.</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Academics</h1>

      {loadingExams || loadingMarks ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : exams.length === 0 ? (
        <p className="text-sm text-gray-500">No published results yet.</p>
      ) : (
        <div className="space-y-6">
          {exams.map((exam) => {
            const record = marks.find((m) => m.examId === exam.id);
            return (
              <div key={exam.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <h2 className="mb-3 text-sm font-semibold text-gray-900">
                  {exam.name} ({exam.term})
                </h2>
                {!record ? (
                  <p className="text-sm text-gray-500">Marks not entered yet.</p>
                ) : (
                  <>
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead>
                        <tr>
                          <th className="px-2 py-1 text-left font-medium text-gray-600">Subject</th>
                          <th className="px-2 py-1 text-left font-medium text-gray-600">Marks</th>
                          <th className="px-2 py-1 text-left font-medium text-gray-600">Max</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {exam.subjects.map((examSubject) => (
                          <tr key={examSubject.subjectId}>
                            <td className="px-2 py-1 text-gray-800">
                              {subjects.find((s) => s.id === examSubject.subjectId)?.name ??
                                examSubject.subjectId}
                            </td>
                            <td className="px-2 py-1 text-gray-800">
                              {record.subjectMarks[examSubject.subjectId] ?? "—"}
                            </td>
                            <td className="px-2 py-1 text-gray-500">{examSubject.maxMarks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {record.remarks && (
                      <p className="mt-3 text-sm text-gray-600">
                        <span className="font-medium">Teacher remarks:</span> {record.remarks}
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
