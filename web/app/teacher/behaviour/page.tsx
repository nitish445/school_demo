"use client";

import { useState } from "react";
import { addDoc, collection, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useMyClassIds } from "@/hooks/useMyClassIds";
import { useCollection } from "@/hooks/useCollection";
import type { SchoolClass, Student, BehaviourNote, BehaviourNoteType } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/formStyles";

const TYPE_LABEL: Record<BehaviourNoteType, string> = {
  good: "Good Behaviour",
  lateComing: "Late Coming",
  misconduct: "Misconduct",
  achievement: "Achievement",
};

export default function TeacherBehaviourPage() {
  const schoolId = useSchoolId();
  const { user } = useAuth();
  const { teacher } = useMyClassIds();
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);

  // Behaviour notes can only be written by the class (home-room) teacher,
  // per the Firestore rules -- not by subject teachers.
  const effectiveClassId = teacher?.classTeacherOf ?? "";
  const myClass = classes.find((c) => c.id === effectiveClassId);

  const { data: students } = useCollection<Student>(
    schoolId && effectiveClassId ? `schools/${schoolId}/students` : null,
    effectiveClassId ? [where("classId", "==", effectiveClassId), where("status", "==", "active")] : [],
    [effectiveClassId]
  );

  const { data: notes, loading } = useCollection<BehaviourNote>(
    schoolId && effectiveClassId ? `schools/${schoolId}/behaviourNotes` : null,
    effectiveClassId ? [where("classId", "==", effectiveClassId), orderBy("date", "desc")] : [],
    [effectiveClassId]
  );

  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState<BehaviourNoteType>("good");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function openAdd() {
    setStudentId(students[0]?.id ?? "");
    setType("good");
    setNote("");
    setOpen(true);
  }

  async function handleSubmit() {
    if (!schoolId || !user || !studentId || !note) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, `schools/${schoolId}/behaviourNotes`), {
        studentId,
        classId: effectiveClassId,
        type,
        note,
        date: new Date().toISOString().slice(0, 10),
        createdBy: user.uid,
      });
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Behaviour Notes</h1>
        <button onClick={openAdd} disabled={!effectiveClassId} className={primaryButtonClass}>
          Add Note
        </button>
      </div>

      <p className="mb-6 text-sm text-gray-500">
        {myClass ? `Class: ${myClass.grade}-${myClass.section}` : "You are not a class teacher of any class yet."}
      </p>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <DataTable
          rows={notes}
          emptyMessage="No behaviour notes yet."
          columns={[
            {
              header: "Student",
              render: (n) => students.find((s) => s.id === n.studentId)?.name ?? n.studentId,
            },
            { header: "Type", render: (n) => TYPE_LABEL[n.type] },
            { header: "Note", render: (n) => n.note },
            { header: "Date", render: (n) => n.date },
          ]}
        />
      )}

      <Modal open={open} title="Add Behaviour Note" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Student</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={inputClass}>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as BehaviourNoteType)} className={inputClass}>
              {Object.entries(TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Note</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} h-24`} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpen(false)} className={secondaryButtonClass}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={submitting} className={primaryButtonClass}>
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
