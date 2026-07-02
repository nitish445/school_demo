"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useMyClassIds } from "@/hooks/useMyClassIds";
import { useCollection } from "@/hooks/useCollection";
import type { SchoolClass, Subject, Homework } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/formStyles";

export default function TeacherHomeworkPage() {
  const schoolId = useSchoolId();
  const { user } = useAuth();
  const { classIds, teacher } = useMyClassIds();
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const { data: subjects } = useCollection<Subject>(schoolId ? `schools/${schoolId}/subjects` : null);
  const myClasses = classes.filter((c) => classIds.includes(c.id));

  const { data: homework, loading } = useCollection<Homework>(
    schoolId ? `schools/${schoolId}/homework` : null,
    classIds.length > 0 ? [where("classId", "in", classIds.slice(0, 10))] : [],
    [classIds.join(",")]
  );

  const [open, setOpen] = useState(false);
  const [formClassId, setFormClassId] = useState("");
  const [formSubjectId, setFormSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const availableSubjects = !formClassId
    ? []
    : teacher?.classTeacherOf === formClassId
      ? subjects
      : subjects.filter((s) =>
          (teacher?.assignments ?? []).some((a) => a.classId === formClassId && a.subjectId === s.id)
        );

  function openAdd() {
    setFormClassId(myClasses[0]?.id ?? "");
    setFormSubjectId("");
    setTitle("");
    setDescription("");
    setDueDate("");
    setOpen(true);
  }

  async function handleSubmit() {
    if (!schoolId || !user || !formClassId || !formSubjectId || !title || !dueDate) return;
    setSubmitting(true);
    try {
      const rosterSnap = await getDocs(
        query(
          collection(db, `schools/${schoolId}/students`),
          where("classId", "==", formClassId),
          where("status", "==", "active")
        )
      );
      const studentIds = rosterSnap.docs.map((d) => d.id);
      const submissions = Object.fromEntries(studentIds.map((id) => [id, "pending"]));

      await addDoc(collection(db, `schools/${schoolId}/homework`), {
        classId: formClassId,
        subjectId: formSubjectId,
        title,
        description,
        attachmentUrls: [],
        dueDate,
        createdBy: user.uid,
        studentIds,
        submissions,
      });
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(h: Homework) {
    if (!schoolId) return;
    if (!confirm(`Delete homework "${h.title}"?`)) return;
    await deleteDoc(doc(db, `schools/${schoolId}/homework/${h.id}`));
  }

  function completionRate(hw: Homework) {
    const total = hw.studentIds?.length ?? 0;
    if (total === 0) return "—";
    const done = Object.values(hw.submissions ?? {}).filter((s) => s === "completed").length;
    return `${done}/${total} completed`;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Homework</h1>
        <button onClick={openAdd} disabled={myClasses.length === 0} className={primaryButtonClass}>
          Assign Homework
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <DataTable
          rows={homework}
          emptyMessage="No homework assigned yet."
          columns={[
            { header: "Title", render: (h) => h.title },
            {
              header: "Class",
              render: (h) => {
                const c = classes.find((c) => c.id === h.classId);
                return c ? `${c.grade}-${c.section}` : "—";
              },
            },
            {
              header: "Subject",
              render: (h) => subjects.find((s) => s.id === h.subjectId)?.name ?? "—",
            },
            { header: "Due Date", render: (h) => h.dueDate },
            { header: "Completion", render: (h) => completionRate(h) },
            {
              header: "",
              render: (h) =>
                h.createdBy === user?.uid && (
                  <button onClick={() => handleDelete(h)} className="text-sm text-red-600 hover:underline">
                    Delete
                  </button>
                ),
            },
          ]}
        />
      )}

      <Modal open={open} title="Assign Homework" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Class</label>
            <select
              value={formClassId}
              onChange={(e) => {
                setFormClassId(e.target.value);
                setFormSubjectId("");
              }}
              className={inputClass}
            >
              {myClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.grade}-{c.section}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Subject</label>
            <select value={formSubjectId} onChange={(e) => setFormSubjectId(e.target.value)} className={inputClass}>
              <option value="">Select a subject</option>
              {availableSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} h-24`}
            />
          </div>
          <div>
            <label className={labelClass}>Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpen(false)} className={secondaryButtonClass}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={submitting} className={primaryButtonClass}>
              {submitting ? "Saving..." : "Assign"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
