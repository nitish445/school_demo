"use client";

import { useEffect, useState } from "react";
import { doc, setDoc, getDocs, query, collection, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useMyClassIds } from "@/hooks/useMyClassIds";
import { useDoc } from "@/hooks/useDoc";
import { useCollection } from "@/hooks/useCollection";
import type { SchoolClass, DiaryEntry } from "@/types/models";
import { inputClass, labelClass, primaryButtonClass } from "@/components/ui/formStyles";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function TeacherDiaryPage() {
  const schoolId = useSchoolId();
  const { user } = useAuth();
  const { teacher } = useMyClassIds();
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const classId = teacher?.classTeacherOf ?? "";
  const myClass = classes.find((c) => c.id === classId);

  const [date, setDate] = useState(todayIso());
  const entryId = classId ? `${classId}_${date}` : null;
  const { data: existing, loading } = useDoc<DiaryEntry>(
    schoolId && entryId ? `schools/${schoolId}/diary/${entryId}` : null
  );

  const [topicsCovered, setTopicsCovered] = useState("");
  const [bringTomorrow, setBringTomorrow] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Syncing local editable state from the freshly-fetched diary entry when
    // the date changes is intentional, not a render loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTopicsCovered(existing?.topicsCovered ?? "");
    setBringTomorrow(existing?.bringTomorrow ?? "");
    setSpecialNotes(existing?.specialNotes ?? "");
    setSaved(false);
  }, [existing]);

  async function handleSave() {
    if (!schoolId || !user || !classId) return;
    setSaving(true);
    try {
      const rosterSnap = await getDocs(
        query(
          collection(db, `schools/${schoolId}/students`),
          where("classId", "==", classId),
          where("status", "==", "active")
        )
      );
      await setDoc(doc(db, `schools/${schoolId}/diary/${classId}_${date}`), {
        classId,
        date,
        topicsCovered,
        bringTomorrow,
        specialNotes,
        createdBy: user.uid,
        studentIds: rosterSnap.docs.map((d) => d.id),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">Daily Diary</h1>

      {!classId ? (
        <p className="text-sm text-stone-500">You are not a class teacher of any class yet.</p>
      ) : (
        <>
          <div className="mb-6 flex items-end gap-4">
            <div>
              <label className={labelClass}>Class</label>
              <p className="text-sm text-stone-700">{myClass ? `${myClass.grade}-${myClass.section}` : "—"}</p>
            </div>
            <div>
              <label className={labelClass}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-stone-500">Loading...</p>
          ) : (
            <div className="max-w-xl space-y-4">
              <div>
                <label className={labelClass}>Topics Covered</label>
                <textarea
                  value={topicsCovered}
                  onChange={(e) => setTopicsCovered(e.target.value)}
                  className={`${inputClass} h-24`}
                />
              </div>
              <div>
                <label className={labelClass}>Bring Tomorrow</label>
                <textarea
                  value={bringTomorrow}
                  onChange={(e) => setBringTomorrow(e.target.value)}
                  className={`${inputClass} h-20`}
                />
              </div>
              <div>
                <label className={labelClass}>Special Notes</label>
                <textarea
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  className={`${inputClass} h-20`}
                />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleSave} disabled={saving} className={primaryButtonClass}>
                  {saving ? "Saving..." : "Save"}
                </button>
                {saved && <span className="text-sm text-green-700">Saved.</span>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
