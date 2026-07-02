"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { SchoolClass, Teacher } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/formStyles";

export default function ClassesPage() {
  const schoolId = useSchoolId();
  const { data: classes, loading } = useCollection<SchoolClass>(
    schoolId ? `schools/${schoolId}/classes` : null
  );
  const { data: teachers } = useCollection<Teacher>(schoolId ? `schools/${schoolId}/teachers` : null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function openAdd() {
    setEditing(null);
    setGrade("");
    setSection("");
    setOpen(true);
  }

  function openEdit(c: SchoolClass) {
    setEditing(c);
    setGrade(c.grade);
    setSection(c.section);
    setOpen(true);
  }

  async function handleSubmit() {
    if (!schoolId || !grade || !section) return;
    setSubmitting(true);
    try {
      const payload = { grade, section };
      if (editing) {
        await updateDoc(doc(db, `schools/${schoolId}/classes/${editing.id}`), payload);
      } else {
        await addDoc(collection(db, `schools/${schoolId}/classes`), payload);
      }
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(c: SchoolClass) {
    if (!schoolId) return;
    if (!confirm(`Delete class ${c.grade}-${c.section}? This does not move existing students.`)) return;
    await deleteDoc(doc(db, `schools/${schoolId}/classes/${c.id}`));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Classes</h1>
        <button onClick={openAdd} className={primaryButtonClass}>
          Add Class
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <DataTable
          rows={classes}
          emptyMessage="No classes yet. Add your first class/section."
          columns={[
            { header: "Grade", render: (c) => c.grade },
            { header: "Section", render: (c) => c.section },
            {
              header: "Class Teacher",
              render: (c) =>
                teachers.find((t) => t.classTeacherOf === c.id)?.name ?? (
                  <span className="text-gray-400">
                    Unassigned — set from the Teachers page
                  </span>
                ),
            },
            {
              header: "",
              render: (c) => (
                <div className="flex gap-3">
                  <button onClick={() => openEdit(c)} className="text-sm text-gray-700 hover:underline">
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal open={open} title={editing ? "Edit Class" : "Add Class"} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Grade</label>
            <input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="e.g. Grade 6"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Section</label>
            <input
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="e.g. A"
              className={inputClass}
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
