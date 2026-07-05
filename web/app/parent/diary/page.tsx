"use client";

import { orderBy, limit as fsLimit, where } from "firebase/firestore";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useEffectiveChildId } from "@/hooks/useEffectiveChildId";
import { useCollection } from "@/hooks/useCollection";
import type { DiaryEntry } from "@/types/models";

export default function ParentDiaryPage() {
  const schoolId = useSchoolId();
  const { effectiveChildId, childStudentIds, loading: loadingProfile } = useEffectiveChildId();

  const { data: entries, loading } = useCollection<DiaryEntry>(
    schoolId && effectiveChildId ? `schools/${schoolId}/diary` : null,
    effectiveChildId
      ? [where("studentIds", "array-contains", effectiveChildId), orderBy("date", "desc"), fsLimit(10)]
      : [],
    [effectiveChildId]
  );

  if (!loadingProfile && childStudentIds.length === 0) {
    return <p className="text-sm text-stone-500">No children are linked to your account yet.</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">School Diary</h1>

      {loading ? (
        <p className="text-sm text-stone-500">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-stone-500">No diary entries yet.</p>
      ) : (
        <div className="space-y-4">
          {entries.map((e) => (
            <div key={e.id} className="rounded-lg border border-stone-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-stone-900">{e.date}</h2>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="font-medium text-stone-600">Topics Covered</dt>
                  <dd className="text-stone-800">{e.topicsCovered || "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-stone-600">Bring Tomorrow</dt>
                  <dd className="text-stone-800">{e.bringTomorrow || "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-stone-600">Special Notes</dt>
                  <dd className="text-stone-800">{e.specialNotes || "—"}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
