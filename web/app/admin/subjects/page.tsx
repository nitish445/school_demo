"use client";

import { useState } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { Subject } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/formStyles";
import { logActivity } from "@/lib/auditLog";

function currentAcademicYear(): string {
  const now = new Date();
  const startYear = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

export default function SubjectsPage() {
  const schoolId = useSchoolId();
  const { user } = useAuth();
  const { data: subjects, loading } = useCollection<Subject>(
    schoolId ? `schools/${schoolId}/subjects` : null
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [year, setYear] = useState(currentAcademicYear());
  const [submitting, setSubmitting] = useState(false);
  const [showDisabled, setShowDisabled] = useState(false);

  function openAdd() {
    setEditing(null);
    setName("");
    setCode("");
    setYear(currentAcademicYear());
    setOpen(true);
  }

  function openEdit(s: Subject) {
    setEditing(s);
    setName(s.name);
    setCode(s.code);
    setYear(s.year ?? currentAcademicYear());
    setOpen(true);
  }

  async function handleSubmit() {
    if (!schoolId || !name || !year) return;
    setSubmitting(true);
    try {
      if (editing) {
        await updateDoc(doc(db, `schools/${schoolId}/subjects/${editing.id}`), { name, code, year });
        logActivity(schoolId, user, "update", "Subject", `${name} (${year})`);
      } else {
        await addDoc(collection(db, `schools/${schoolId}/subjects`), { name, code, year, status: "active" });
        logActivity(schoolId, user, "create", "Subject", `${name} (${year})`);
      }
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(s: Subject) {
    if (!schoolId) return;
    const status = s.status === "disabled" ? "active" : "disabled";
    await updateDoc(doc(db, `schools/${schoolId}/subjects/${s.id}`), { status });
    logActivity(schoolId, user, "update", "Subject", `${s.name} (${status})`);
  }

  const visibleSubjects = subjects.filter((s) => (showDisabled ? s.status === "disabled" : s.status !== "disabled"));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Subjects</h1>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" checked={showDisabled} onChange={(e) => setShowDisabled(e.target.checked)} />
            Show disabled
          </label>
          <button onClick={openAdd} className={primaryButtonClass}>
            Add Subject
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Loading...</p>
      ) : (
        <DataTable
          rows={visibleSubjects}
          emptyMessage="No subjects yet."
          columns={[
            { header: "Name", render: (s) => s.name },
            { header: "Code", render: (s) => s.code },
            { header: "Year", render: (s) => s.year ?? "—" },
            {
              header: "Status",
              render: (s) =>
                s.status === "disabled" ? (
                  <Badge variant="warning">Disabled</Badge>
                ) : (
                  <Badge variant="success">Active</Badge>
                ),
            },
            {
              header: "",
              render: (s) => (
                <div className="flex gap-3">
                  <button onClick={() => openEdit(s)} className="text-sm text-stone-700 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => toggleStatus(s)} className="text-sm text-rose-600 hover:underline">
                    {s.status === "disabled" ? "Enable" : "Disable"}
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
          <div>
            <label className={labelClass}>Academic Year</label>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 2026-2027"
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
