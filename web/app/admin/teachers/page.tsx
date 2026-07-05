"use client";

import { useState } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { Teacher, SchoolClass, Subject, TeacherAssignment, Admin, AdminDesignation } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  cardClass,
  pageHeadingClass,
  dangerLinkClass,
} from "@/components/ui/formStyles";
import { createAuthUser, writeAccountProfile, describeAuthError } from "@/lib/createAccount";
import { logActivity } from "@/lib/auditLog";

const DESIGNATION_LABEL: Record<AdminDesignation, string> = {
  principal: "Principal",
  incharge: "Incharge",
  labAssistant: "Lab Assistant",
  teacher: "Admin",
};

export default function TeachersPage() {
  const schoolId = useSchoolId();
  const { user } = useAuth();
  const { data: teachers, loading } = useCollection<Teacher>(
    schoolId ? `schools/${schoolId}/teachers` : null
  );
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const { data: subjects } = useCollection<Subject>(schoolId ? `schools/${schoolId}/subjects` : null);
  const { data: admins } = useCollection<Admin>(schoolId ? `schools/${schoolId}/admins` : null);
  const adminById = new Map(admins.map((a) => [a.id, a]));

  const [submitting, setSubmitting] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [pendingUid, setPendingUid] = useState<string | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTeacher, setAssignTeacher] = useState<Teacher | null>(null);
  const [classTeacherOf, setClassTeacherOf] = useState("");
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);

  function openAdd() {
    setName("");
    setEmail("");
    setPassword("");
    setEmployeeId("");
    setAddError(null);
    setPendingUid(null);
    setAddOpen(true);
  }

  function closeAdd() {
    setAddOpen(false);
    setPendingUid(null);
    setAddError(null);
  }

  async function handleAdd() {
    if (!schoolId || !name || !email || !password) return;
    setAddSubmitting(true);
    setAddError(null);
    try {
      const uid = pendingUid ?? (await createAuthUser(email, password));
      setPendingUid(uid);
      await writeAccountProfile(uid, { schoolId, email, displayName: name, employeeId, kind: "teacher" });
      logActivity(schoolId, user, "create", "Teacher", name);
      setAddOpen(false);
    } catch (err) {
      setAddError(describeAuthError(err));
    } finally {
      setAddSubmitting(false);
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
      const cleanAssignments = assignments.filter((a) => a.classId && a.subjectId);
      const assignedClassIds = Array.from(new Set(cleanAssignments.map((a) => a.classId)));
      const batch = writeBatch(db).set(
        doc(db, `schools/${schoolId}/teachers/${assignTeacher.id}`),
        {
          assignments: cleanAssignments,
          assignedClassIds,
          classTeacherOf: classTeacherOf || null,
        },
        { merge: true }
      );
      // Keep users/{uid}.role in sync with classTeacherOf: the sidebar (and
      // rules-level role reporting) key off this field, so without this the
      // teacher would have full class-teacher permissions but never see the
      // class-teacher-only nav items (Behaviour, Daily Diary, Leave Approval).
      // Skipped for Admins/Principal teaching here -- their role must stay
      // "admin" (that's what all their other permissions key off), not get
      // overwritten to classTeacher/subjectTeacher.
      if (!adminById.has(assignTeacher.id)) {
        const role = classTeacherOf ? "classTeacher" : "subjectTeacher";
        batch.set(doc(db, `users/${assignTeacher.id}`), { role }, { merge: true });
      }
      await batch.commit();
      logActivity(schoolId, user, "update", "Teacher", `${assignTeacher.name} — assignments updated`);
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
    logActivity(schoolId, user, "update", "Teacher", `${t.name} (${status})`);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageHeadingClass}>Teachers</h1>
        <button onClick={openAdd} className={primaryButtonClass}>
          Add Teacher
        </button>
      </div>

      <div className={`${cardClass} mb-6 text-sm text-stone-600`}>
        Need to add many teachers at once? Run this from{" "}
        <code className="rounded bg-stone-100 px-1">firebase/functions</code> instead of adding them one by
        one:
        <pre className="mt-2 overflow-x-auto rounded-lg bg-stone-900 px-3 py-2 text-xs break-all whitespace-pre-wrap text-stone-100">
          {`npm run create-account -- --schoolId ${schoolId || "<schoolId>"} --kind teacher \\\n  --email jane@example.com --password TempPass123 --name "Jane Doe" --employeeId EMP-1`}
        </pre>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <DataTable
          rows={teachers}
          emptyMessage="No teachers yet."
          columns={[
            { header: "Name", render: (t) => t.name },
            {
              header: "Type",
              render: (t) => {
                const admin = adminById.get(t.id);
                return admin ? (
                  <Badge variant={admin.designation === "principal" ? "brand" : "info"}>
                    {DESIGNATION_LABEL[admin.designation ?? "teacher"]}
                  </Badge>
                ) : (
                  <Badge variant="neutral">Teacher</Badge>
                );
              },
            },
            { header: "Employee ID", render: (t) => t.employeeId },
            {
              header: "Class Teacher Of",
              render: (t) => {
                const c = classes.find((c) => c.id === t.classTeacherOf);
                return c ? `${c.grade}-${c.section}` : <span className="text-stone-400">—</span>;
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
                  .join(", ") || <span className="text-stone-400">None</span>,
            },
            {
              header: "Status",
              render: (t) =>
                t.status === "disabled" ? (
                  <Badge variant="warning">Disabled</Badge>
                ) : (
                  <Badge variant="success">Active</Badge>
                ),
            },
            {
              header: "",
              render: (t) => (
                <div className="flex items-center gap-3">
                  <button onClick={() => openAssign(t)} className="text-sm text-stone-700 hover:underline">
                    Assign
                  </button>
                  {adminById.has(t.id) ? (
                    <span className="text-xs text-stone-400">Status managed from Admins page</span>
                  ) : (
                    <button onClick={() => toggleStatus(t)} className={`${dangerLinkClass} hover:underline`}>
                      {t.status === "disabled" ? "Enable" : "Disable"}
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal open={addOpen} title="Add Teacher" onClose={closeAdd}>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              disabled={!!pendingUid}
            />
          </div>
          <div>
            <label className={labelClass}>Employee ID</label>
            <input
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className={inputClass}
              disabled={!!pendingUid}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              disabled={!!pendingUid}
            />
          </div>
          <div>
            <label className={labelClass}>Temporary Password</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="Share this with the teacher directly"
              disabled={!!pendingUid}
            />
          </div>
          {addError && (
            <p className="text-sm text-rose-600">
              {addError}
              {pendingUid && " The login was created — just retry to finish saving their profile."}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={closeAdd} className={secondaryButtonClass}>
              Cancel
            </button>
            <button onClick={handleAdd} disabled={addSubmitting} className={primaryButtonClass}>
              {addSubmitting ? "Creating..." : pendingUid ? "Retry" : "Create Account"}
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
              {classes
                .filter((c) => c.status !== "disabled" || c.id === classTeacherOf)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.grade}-{c.section}
                    {c.status === "disabled" ? " (disabled)" : ""}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className={labelClass}>Subjects Taught (class + subject)</label>
              <button onClick={addAssignmentRow} className="text-sm text-stone-700 hover:underline">
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
                    {classes
                      .filter((c) => c.status !== "disabled" || c.id === a.classId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.grade}-{c.section}
                          {c.status === "disabled" ? " (disabled)" : ""}
                        </option>
                      ))}
                  </select>
                  <select
                    value={a.subjectId}
                    onChange={(e) => updateAssignmentRow(i, { subjectId: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Subject</option>
                    {subjects
                      .filter((s) => s.status !== "disabled" || s.id === a.subjectId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.status === "disabled" ? " (disabled)" : ""}
                        </option>
                      ))}
                  </select>
                  <button onClick={() => removeAssignmentRow(i)} className="text-rose-600">
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
