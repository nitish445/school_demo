"use client";

import { orderBy, limit as fsLimit, where } from "firebase/firestore";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useEffectiveChildId } from "@/hooks/useEffectiveChildId";
import { useCollection } from "@/hooks/useCollection";
import { useDoc } from "@/hooks/useDoc";
import type { Student, DiaryEntry } from "@/types/models";

export default function ParentDiaryPage() {
  const schoolId = useSchoolId();
  const { effectiveChildId, childStudentIds } = useEffectiveChildId();

  const { data: student } = useDoc<Student>(
    schoolId && effectiveChildId ? `schools/${schoolId}/students/${effectiveChildId}` : null
  );
  const classId = student?.classId ?? "";

  const { data: entries, loading } = useCollection<DiaryEntry>(
    schoolId && classId ? `schools/${schoolId}/diary` : null,
    classId ? [where("classId", "==", classId), orderBy("date", "desc"), fsLimit(10)] : [],
    [classId]
  );

  if (childStudentIds.length === 0) {
    return <p className="text-sm text-gray-500">No children are linked to your account yet.</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">School Diary</h1>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-500">No diary entries yet.</p>
      ) : (
        <div className="space-y-4">
          {entries.map((e) => (
            <div key={e.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-900">{e.date}</h2>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="font-medium text-gray-600">Topics Covered</dt>
                  <dd className="text-gray-800">{e.topicsCovered || "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-600">Bring Tomorrow</dt>
                  <dd className="text-gray-800">{e.bringTomorrow || "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-600">Special Notes</dt>
                  <dd className="text-gray-800">{e.specialNotes || "—"}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
