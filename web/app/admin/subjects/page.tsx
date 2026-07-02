"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { Subject } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/formStyles";

export default function SubjectsPage() {
  const schoolId = useSchoolId();
  const { data: subjects, loading } = useCollection<Subject>(
    schoolId ? `schools/${schoolId}/subjects` : null
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function openAdd() {
    setEditing(null);
    setName("");
    setCode("");
    setOpen(true);
  }

  function openEdit(s: Subject) {
    setEditing(s);
    setName(s.name);
    setCode(s.code);
    setOpen(true);
  }

  async function handleSubmit() {
    if (!schoolId || !name) return;
    setSubmitting(true);
    try {
      const payload = { name, code };
      if (editing) {
        await updateDoc(doc(db, `schools/${schoolId}/subjects/${editing.id}`), payload);
      } else {
        await addDoc(collection(db, `schools/${schoolId}/subjects`), payload);
      }
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(s: Subject) {
    if (!schoolId) return;
    if (!confirm(`Delete subject "${s.name}"?`)) return;
    await deleteDoc(doc(db, `schools/${schoolId}/subjects/${s.id}`));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Subjects</h1>
        <button onClick={openAdd} className={primaryButtonClass}>
          Add Subject
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <DataTable
          rows={subjects}
          emptyMessage="No subjects yet."
          columns={[
            { header: "Name", render: (s) => s.name },
            { header: "Code", render: (s) => s.code },
            {
              header: "",
              render: (s) => (
                <div className="flex gap-3">
                  <button onClick={() => openEdit(s)} className="text-sm text-gray-700 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(s)} className="text-sm text-red-600 hover:underline">
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal open={open} title={editing ? "Edit Subject" : "Add Subject"} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mathematics" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Code</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. MATH" className={inputClass} />
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
