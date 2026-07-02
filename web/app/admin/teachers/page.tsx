"use client";

import { useState } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { Teacher, SchoolClass, Subject, TeacherAssignment } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass, cardClass } from "@/components/ui/formStyles";

export default function TeachersPage() {
  const schoolId = useSchoolId();
  const { data: teachers, loading } = useCollection<Teacher>(
    schoolId ? `schools/${schoolId}/teachers` : null
  );
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const { data: subjects } = useCollection<Subject>(schoolId ? `schools/${schoolId}/subjects` : null);

  const [submitting, setSubmitting] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTeacher, setAssignTeacher] = useState<Teacher | null>(null);
  const [classTeacherOf, setClassTeacherOf] = useState("");
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);

  function openAssign(t: Teacher) {
    setAssignTeacher(t);
    setClassTeacherOf(t.classTeacherOf ?? "");
    setAssignments(t.assignments ?? []);
    setAssignOpen(true);
  }

  function addAssignmentRow() {
    setAssignments([...assignments, { classId: "", subjectId: "" }]);
  }

  function updateAssignmentRow(index: number, patch: Partial<TeacherAssignment>) {
    setAssignments(assignments.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function removeAssignmentRow(index: number) {
    setAssignments(assignments.filter((_, i) => i !== index));
  }

  async function handleSaveAssignments() {
    if (!schoolId || !assignTeacher) return;
    setSubmitting(true);
    try {
      const cleanAssignments = assignments.filter((a) => a.classId && a.subjectId);
      const assignedClassIds = Array.from(new Set(cleanAssignments.map((a) => a.classId)));
      await writeBatch(db)
        .set(
          doc(db, `schools/${schoolId}/teachers/${assignTeacher.id}`),
          {
            assignments: cleanAssignments,
            assignedClassIds,
            classTeacherOf: classTeacherOf || null,
          },
          { merge: true }
        )
        .commit();
      setAssignOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(t: Teacher) {
    if (!schoolId) return;
    const status = t.status === "disabled" ? "active" : "disabled";
    await writeBatch(db)
      .set(doc(db, `users/${t.id}`), { status }, { merge: true })
      .set(doc(db, `schools/${schoolId}/teachers/${t.id}`), { status }, { merge: true })
      .commit();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Teachers</h1>
      </div>

      <div className={`${cardClass} mb-6 text-sm text-slate-600`}>
        Adding a teacher creates a login, which needs to run with admin (Admin SDK) privileges — there&apos;s no
        in-browser button for that on the free plan. From <code className="rounded bg-slate-100 px-1">firebase/functions</code>,
        run:
        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100">
          {`npm run create-account -- --schoolId ${schoolId || "<schoolId>"} --kind teacher \\\n  --email jane@example.com --password TempPass123 --name "Jane Doe" --employeeId EMP-1`}
        </pre>
        They&apos;ll show up here once created.
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : (
        <DataTable
          rows={teachers}
          emptyMessage="No teachers yet."
          columns={[
            { header: "Name", render: (t) => t.name },
            { header: "Employee ID", render: (t) => t.employeeId },
            {
              header: "Class Teacher Of",
              render: (t) => {
                const c = classes.find((c) => c.id === t.classTeacherOf);
                return c ? `${c.grade}-${c.section}` : <span className="text-slate-400">—</span>;
              },
            },
            {
              header: "Subjects Taught",
              render: (t) =>
                (t.assignments ?? [])
                  .map((a) => {
                    const c = classes.find((c) => c.id === a.classId);
                    const s = subjects.find((s) => s.id === a.subjectId);
                    return c && s ? `${s.name} (${c.grade}-${c.section})` : null;
                  })
                  .filter(Boolean)
                  .join(", ") || <span className="text-slate-400">None</span>,
            },
            {
              header: "Status",
              render: (t) =>
                t.status === "disabled" ? (
                  <span className="text-amber-700">Disabled</span>
                ) : (
                  <span className="text-green-700">Active</span>
                ),
            },
            {
              header: "",
              render: (t) => (
                <div className="flex gap-3">
                  <button onClick={() => openAssign(t)} className="text-sm text-slate-700 hover:underline">
                    Assign
                  </button>
                  <button
                    onClick={() => toggleStatus(t)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    {t.status === "disabled" ? "Enable" : "Disable"}
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={assignOpen}
        title={`Assign — ${assignTeacher?.name ?? ""}`}
        onClose={() => setAssignOpen(false)}
      >
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Class Teacher Of</label>
            <select value={classTeacherOf} onChange={(e) => setClassTeacherOf(e.target.value)} className={inputClass}>
              <option value="">Not a class teacher</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.grade}-{c.section}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className={labelClass}>Subjects Taught (class + subject)</label>
              <button onClick={addAssignmentRow} className="text-sm text-slate-700 hover:underline">
                + Add row
              </button>
            </div>
            <div className="space-y-2">
              {assignments.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    value={a.classId}
                    onChange={(e) => updateAssignmentRow(i, { classId: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.grade}-{c.section}
                      </option>
                    ))}
                  </select>
                  <select
                    value={a.subjectId}
                    onChange={(e) => updateAssignmentRow(i, { subjectId: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => removeAssignmentRow(i)} className="text-red-600">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setAssignOpen(false)} className={secondaryButtonClass}>
              Cancel
            </button>
            <button onClick={handleSaveAssignments} disabled={submitting} className={primaryButtonClass}>
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
