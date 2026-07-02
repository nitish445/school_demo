"use client";

import { useState } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { Student, SchoolClass, Parent } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/formStyles";

const emptyForm = {
  name: "",
  admissionNo: "",
  rollNo: "",
  classId: "",
  dob: "",
  gender: "" as "" | "male" | "female" | "other",
  parentIds: [] as string[],
  emergencyContact: "",
  medicalNotes: "",
};

export default function StudentsPage() {
  const schoolId = useSchoolId();
  const { data: students, loading } = useCollection<Student>(
    schoolId ? `schools/${schoolId}/students` : null
  );
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const { data: parents } = useCollection<Parent>(schoolId ? `schools/${schoolId}/parents` : null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(s: Student) {
    setEditing(s);
    setForm({
      name: s.name,
      admissionNo: s.admissionNo,
      rollNo: s.rollNo,
      classId: s.classId,
      dob: s.dob ?? "",
      gender: s.gender ?? "",
      parentIds: s.parentIds ?? [],
      emergencyContact: s.emergencyContact ?? "",
      medicalNotes: s.medicalNotes ?? "",
    });
    setOpen(true);
  }

  async function handleSubmit() {
    if (!schoolId || !form.name || !form.admissionNo || !form.classId) return;
    setSubmitting(true);
    try {
      const cls = classes.find((c) => c.id === form.classId);
      const payload = {
        name: form.name,
        admissionNo: form.admissionNo,
        rollNo: form.rollNo,
        classId: form.classId,
        sectionId: cls?.section ?? "",
        dob: form.dob || null,
        gender: form.gender || null,
        parentIds: form.parentIds,
        emergencyContact: form.emergencyContact || null,
        medicalNotes: form.medicalNotes || null,
        status: editing?.status ?? "active",
      };
      if (editing) {
        await updateDoc(doc(db, `schools/${schoolId}/students/${editing.id}`), payload);
      } else {
        await addDoc(collection(db, `schools/${schoolId}/students`), payload);
      }
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleArchive(s: Student) {
    if (!schoolId) return;
    await updateDoc(doc(db, `schools/${schoolId}/students/${s.id}`), {
      status: s.status === "archived" ? "active" : "archived",
    });
  }

  const visibleStudents = students.filter((s) =>
    showArchived ? s.status === "archived" : s.status !== "archived"
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Students</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          <button onClick={openAdd} className={primaryButtonClass}>
            Add Student
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <DataTable
          rows={visibleStudents}
          emptyMessage="No students yet."
          columns={[
            { header: "Name", render: (s) => s.name },
            { header: "Admission No.", render: (s) => s.admissionNo },
            { header: "Roll No.", render: (s) => s.rollNo },
            {
              header: "Class",
              render: (s) => {
                const c = classes.find((c) => c.id === s.classId);
                return c ? `${c.grade}-${c.section}` : "—";
              },
            },
            {
              header: "Parents",
              render: (s) =>
                s.parentIds
                  .map((id) => parents.find((p) => p.id === id)?.name)
                  .filter(Boolean)
                  .join(", ") || <span className="text-gray-400">None linked</span>,
            },
            {
              header: "",
              render: (s) => (
                <div className="flex gap-3">
                  <button onClick={() => openEdit(s)} className="text-sm text-gray-700 hover:underline">
                    Edit
                  </button>
                  <button
                    onClick={() => toggleArchive(s)}
                    className="text-sm text-amber-700 hover:underline"
                  >
                    {s.status === "archived" ? "Restore" : "Archive"}
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal open={open} title={editing ? "Edit Student" : "Add Student"} onClose={() => setOpen(false)}>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <label className={labelClass}>Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Admission No.</label>
              <input
                value={form.admissionNo}
                onChange={(e) => setForm({ ...form, admissionNo: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Roll No.</label>
              <input
                value={form.rollNo}
                onChange={(e) => setForm({ ...form, rollNo: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Class</label>
            <select
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value })}
              className={inputClass}
            >
              <option value="">Select a class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.grade}-{c.section}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Date of Birth</label>
              <input
                type="date"
                value={form.dob}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Gender</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value as typeof form.gender })}
                className={inputClass}
              >
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Parents</label>
            <select
              multiple
              value={form.parentIds}
              onChange={(e) =>
                setForm({
                  ...form,
                  parentIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                })
              }
              className={`${inputClass} h-24`}
            >
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">Ctrl/Cmd+click to select multiple.</p>
          </div>
          <div>
            <label className={labelClass}>Emergency Contact</label>
            <input
              value={form.emergencyContact}
              onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Medical Notes</label>
            <textarea
              value={form.medicalNotes}
              onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })}
              className={`${inputClass} h-20`}
            />
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
