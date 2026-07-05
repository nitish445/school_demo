"use client";

import { useState } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { SchoolClass, Teacher } from "@/types/models";
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

export default function ClassesPage() {
  const schoolId = useSchoolId();
  const { user } = useAuth();
  const { data: classes, loading } = useCollection<SchoolClass>(
    schoolId ? `schools/${schoolId}/classes` : null
  );
  const { data: teachers } = useCollection<Teacher>(schoolId ? `schools/${schoolId}/teachers` : null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [year, setYear] = useState(currentAcademicYear());
  const [submitting, setSubmitting] = useState(false);
  const [showDisabled, setShowDisabled] = useState(false);

  function openAdd() {
    setEditing(null);
    setGrade("");
    setSection("");
    setYear(currentAcademicYear());
    setOpen(true);
  }

  function openEdit(c: SchoolClass) {
    setEditing(c);
    setGrade(c.grade);
    setSection(c.section);
    setYear(c.year ?? currentAcademicYear());
    setOpen(true);
  }

  async function handleSubmit() {
    if (!schoolId || !grade || !section || !year) return;
    setSubmitting(true);
    try {
      if (editing) {
        await updateDoc(doc(db, `schools/${schoolId}/classes/${editing.id}`), { grade, section, year });
        logActivity(schoolId, user, "update", "Class", `${grade}-${section} (${year})`);
      } else {
        await addDoc(collection(db, `schools/${schoolId}/classes`), {
          grade,
          section,
          year,
          status: "active",
        });
        logActivity(schoolId, user, "create", "Class", `${grade}-${section} (${year})`);
      }
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(c: SchoolClass) {
    if (!schoolId) return;
    const status = c.status === "disabled" ? "active" : "disabled";
    await updateDoc(doc(db, `schools/${schoolId}/classes/${c.id}`), { status });
    logActivity(schoolId, user, "update", "Class", `${c.grade}-${c.section} (${status})`);
  }

  const visibleClasses = classes.filter((c) => (showDisabled ? c.status === "disabled" : c.status !== "disabled"));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Classes</h1>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" checked={showDisabled} onChange={(e) => setShowDisabled(e.target.checked)} />
            Show disabled
          </label>
          <button onClick={openAdd} className={primaryButtonClass}>
            Add Class
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Loading...</p>
      ) : (
        <DataTable
          rows={visibleClasses}
          emptyMessage="No classes yet. Add your first class/section."
          columns={[
            { header: "Grade", render: (c) => c.grade },
            { header: "Section", render: (c) => c.section },
            { header: "Year", render: (c) => c.year ?? "—" },
            {
              header: "Class Teacher",
              render: (c) =>
                teachers.find((t) => t.classTeacherOf === c.id)?.name ?? (
                  <span className="text-stone-400">
                    Unassigned — set from the Teachers page
                  </span>
                ),
            },
            {
              header: "Status",
              render: (c) =>
                c.status === "disabled" ? (
                  <Badge variant="warning">Disabled</Badge>
                ) : (
                  <Badge variant="success">Active</Badge>
                ),
            },
            {
              header: "",
              render: (c) => (
                <div className="flex gap-3">
                  <button onClick={() => openEdit(c)} className="text-sm text-stone-700 hover:underline">
                    Edit
                  </button>
                  <button
                    onClick={() => toggleStatus(c)}
                    className="text-sm text-rose-600 hover:underline"
                  >
                    {c.status === "disabled" ? "Enable" : "Disable"}
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
