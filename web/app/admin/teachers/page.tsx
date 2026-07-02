"use client";

import { useState } from "react";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { Teacher, SchoolClass, Subject, TeacherAssignment } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/formStyles";
import { createStaffOrParentAccount, setAccountStatus, setTeacherAssignments } from "@/lib/functions";

export default function TeachersPage() {
  const schoolId = useSchoolId();
  const { data: teachers, loading } = useCollection<Teacher>(
    schoolId ? `schools/${schoolId}/teachers` : null
  );
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const { data: subjects } = useCollection<Subject>(schoolId ? `schools/${schoolId}/subjects` : null);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTeacher, setAssignTeacher] = useState<Teacher | null>(null);
  const [classTeacherOf, setClassTeacherOf] = useState("");
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);

  function openAdd() {
    setName("");
    setEmail("");
    setPassword("");
    setEmployeeId("");
    setError(null);
    setAddOpen(true);
  }

  async function handleAdd() {
    if (!schoolId || !name || !email || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await createStaffOrParentAccount({
        schoolId,
        email,
        password,
        displayName: name,
        employeeId,
        kind: "teacher",
      });
      setAddOpen(false);
    } catch {
      setError("Could not create the account. Check the email isn't already in use.");
    } finally {
      setSubmitting(false);
    }
  }

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
      await setTeacherAssignments({
        schoolId,
        teacherId: assignTeacher.id,
        assignments: assignments.filter((a) => a.classId && a.subjectId),
        classTeacherOf: classTeacherOf || null,
      });
      setAssignOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(t: Teacher) {
    if (!schoolId) return;
    await setAccountStatus({
      schoolId,
      uid: t.id,
      status: t.status === "disabled" ? "active" : "disabled",
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Teachers</h1>
        <button onClick={openAdd} className={primaryButtonClass}>
          Add Teacher
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
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
                return c ? `${c.grade}-${c.section}` : <span className="text-gray-400">—</span>;
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
                  .join(", ") || <span className="text-gray-400">None</span>,
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
                  <button onClick={() => openAssign(t)} className="text-sm text-gray-700 hover:underline">
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

      <Modal open={addOpen} title="Add Teacher" onClose={() => setAddOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Employee ID</label>
            <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Temporary Password</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="Share this with the teacher directly"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setAddOpen(false)} className={secondaryButtonClass}>
              Cancel
            </button>
            <button onClick={handleAdd} disabled={submitting} className={primaryButtonClass}>
              {submitting ? "Creating..." : "Create Account"}
            </button>
          </div>
        </div>
      </Modal>

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
              <button onClick={addAssignmentRow} className="text-sm text-gray-700 hover:underline">
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
