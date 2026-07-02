"use client";

import { useEffect, useState } from "react";
import { doc, getDocs, query, collection, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useMyClassIds } from "@/hooks/useMyClassIds";
import { useCollection } from "@/hooks/useCollection";
import type { SchoolClass, Subject, Exam, Student, Marks } from "@/types/models";
import { inputClass, labelClass, primaryButtonClass } from "@/components/ui/formStyles";

export default function TeacherMarksPage() {
  const schoolId = useSchoolId();
  const { classIds, teacher } = useMyClassIds();
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const { data: subjects } = useCollection<Subject>(schoolId ? `schools/${schoolId}/subjects` : null);
  const { data: exams } = useCollection<Exam>(schoolId ? `schools/${schoolId}/exams` : null);
  const myClasses = classes.filter((c) => classIds.includes(c.id));

  const [classId, setClassId] = useState("");
  const effectiveClassId = classId || myClasses[0]?.id || "";
  const [subjectId, setSubjectId] = useState("");
  const [examId, setExamId] = useState("");
  const [marksInput, setMarksInput] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const availableSubjects = !effectiveClassId
    ? []
    : teacher?.classTeacherOf === effectiveClassId
      ? subjects
      : subjects.filter((s) =>
          (teacher?.assignments ?? []).some(
            (a) => a.classId === effectiveClassId && a.subjectId === s.id
          )
        );

  const { data: students, loading: loadingStudents } = useCollection<Student>(
    schoolId && effectiveClassId ? `schools/${schoolId}/students` : null,
    effectiveClassId ? [where("classId", "==", effectiveClassId), where("status", "==", "active")] : [],
    [effectiveClassId]
  );

  const { data: existingMarks, loading: loadingMarks } = useCollection<Marks>(
    schoolId && examId ? `schools/${schoolId}/marks` : null,
    examId ? [where("examId", "==", examId)] : [],
    [examId]
  );

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const s of students) {
      const m = existingMarks.find((m) => m.studentId === s.id);
      const value = subjectId ? m?.subjectMarks?.[subjectId] : undefined;
      next[s.id] = value !== undefined ? String(value) : "";
    }
    // Syncing local editable state from freshly-fetched data when the
    // class/subject/exam changes is intentional, not a render loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMarksInput(next);
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students.length, existingMarks.length, subjectId, examId]);

  async function handleSave() {
    if (!schoolId || !examId || !subjectId) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      for (const s of students) {
        const value = marksInput[s.id];
        if (value === "" || value === undefined) continue;
        const markId = `${examId}_${s.id}`;
        const existingDoc = existingMarks.find((m) => m.id === markId);
        // Re-read to merge subjectMarks safely rather than clobbering other subjects.
        let existingSubjectMarks: Record<string, number> = existingDoc?.subjectMarks ?? {};
        if (!existingDoc) {
          const snap = await getDocs(
            query(collection(db, `schools/${schoolId}/marks`), where("examId", "==", examId), where("studentId", "==", s.id))
          );
          existingSubjectMarks = snap.docs[0]?.data().subjectMarks ?? {};
        }
        batch.set(
          doc(db, `schools/${schoolId}/marks/${markId}`),
          {
            studentId: s.id,
            examId,
            subjectMarks: { ...existingSubjectMarks, [subjectId]: Number(value) },
          },
          { merge: true }
        );
      }
      await batch.commit();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Upload Marks</h1>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className={labelClass}>Class</label>
          <select
            value={effectiveClassId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSubjectId("");
            }}
            className={inputClass}
          >
            {myClasses.length === 0 && <option value="">No classes assigned</option>}
            {myClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.grade}-{c.section}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Subject</label>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputClass}>
            <option value="">Select a subject</option>
            {availableSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Exam</label>
          <select value={examId} onChange={(e) => setExamId(e.target.value)} className={inputClass}>
            <option value="">Select an exam</option>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.term})
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !examId || !subjectId}
          className={primaryButtonClass}
        >
          {saving ? "Saving..." : "Save Marks"}
        </button>
        {saved && <span className="text-sm text-green-700">Saved.</span>}
      </div>

      {!effectiveClassId || !subjectId || !examId ? (
        <p className="text-sm text-gray-500">Choose a class, subject, and exam to enter marks.</p>
      ) : loadingStudents || loadingMarks ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Roll No.</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Marks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 text-gray-800">{s.rollNo}</td>
                  <td className="px-4 py-2 text-gray-800">{s.name}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={marksInput[s.id] ?? ""}
                      onChange={(e) => setMarksInput({ ...marksInput, [s.id]: e.target.value })}
                      className={`${inputClass} w-24`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
