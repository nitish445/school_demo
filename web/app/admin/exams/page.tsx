"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { Exam, Subject } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/formStyles";

type ExamSubjectRow = { subjectId: string; date: string; maxMarks: number };

const emptyForm = { name: "", term: "", subjects: [] as ExamSubjectRow[] };

export default function ExamsPage() {
  const schoolId = useSchoolId();
  const { data: exams, loading } = useCollection<Exam>(schoolId ? `schools/${schoolId}/exams` : null);
  const { data: subjects } = useCollection<Subject>(schoolId ? `schools/${schoolId}/subjects` : null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(e: Exam) {
    setEditing(e);
    setForm({ name: e.name, term: e.term, subjects: e.subjects });
    setOpen(true);
  }

  function addSubjectRow() {
    setForm({ ...form, subjects: [...form.subjects, { subjectId: "", date: "", maxMarks: 100 }] });
  }

  function updateSubjectRow(i: number, patch: Partial<ExamSubjectRow>) {
    setForm({
      ...form,
      subjects: form.subjects.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    });
  }

  function removeSubjectRow(i: number) {
    setForm({ ...form, subjects: form.subjects.filter((_, idx) => idx !== i) });
  }

  async function handleSubmit() {
    if (!schoolId || !form.name || !form.term) return;
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        term: form.term,
        subjects: form.subjects.filter((s) => s.subjectId && s.date),
        published: editing?.published ?? false,
      };
      if (editing) {
        await updateDoc(doc(db, `schools/${schoolId}/exams/${editing.id}`), payload);
      } else {
        await addDoc(collection(db, `schools/${schoolId}/exams`), payload);
      }
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePublish(e: Exam) {
    if (!schoolId) return;
    await updateDoc(doc(db, `schools/${schoolId}/exams/${e.id}`), { published: !e.published });
  }

  async function handleDelete(e: Exam) {
    if (!schoolId) return;
    if (!confirm(`Delete exam "${e.name}"?`)) return;
    await deleteDoc(doc(db, `schools/${schoolId}/exams/${e.id}`));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Exams</h1>
        <button onClick={openAdd} className={primaryButtonClass}>
          Create Exam
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <DataTable
          rows={exams}
          emptyMessage="No exams yet."
          columns={[
            { header: "Name", render: (e) => e.name },
            { header: "Term", render: (e) => e.term },
            { header: "Subjects", render: (e) => e.subjects.length },
            {
              header: "Status",
              render: (e) => (e.published ? "Published" : "Draft"),
            },
            {
              header: "",
              render: (e) => (
                <div className="flex gap-3">
                  <button onClick={() => openEdit(e)} className="text-sm text-gray-700 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => togglePublish(e)} className="text-sm text-blue-700 hover:underline">
                    {e.published ? "Unpublish" : "Publish"}
                  </button>
                  <button onClick={() => handleDelete(e)} className="text-sm text-red-600 hover:underline">
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal open={open} title={editing ? "Edit Exam" : "Create Exam"} onClose={() => setOpen(false)}>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <label className={labelClass}>Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Midterm Exam"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Term</label>
            <input
              value={form.term}
              onChange={(e) => setForm({ ...form, term: e.target.value })}
              placeholder="e.g. Term 1"
              className={inputClass}
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className={labelClass}>Subjects &amp; Schedule</label>
              <button onClick={addSubjectRow} className="text-sm text-gray-700 hover:underline">
                + Add subject
              </button>
            </div>
            <div className="space-y-2">
              {form.subjects.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    value={s.subjectId}
                    onChange={(e) => updateSubjectRow(i, { subjectId: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Subject</option>
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={s.date}
                    onChange={(e) => updateSubjectRow(i, { date: e.target.value })}
                    className={inputClass}
                  />
                  <input
                    type="number"
                    value={s.maxMarks}
                    onChange={(e) => updateSubjectRow(i, { maxMarks: Number(e.target.value) })}
                    className={`${inputClass} w-24`}
                    placeholder="Max"
                  />
                  <button onClick={() => removeSubjectRow(i)} className="text-red-600">
                    ✕
                  </button>
                </div>
              ))}
            </div>
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
