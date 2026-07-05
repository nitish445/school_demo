"use client";

import { useState } from "react";
import { deleteField, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { Admin, AdminDesignation, Teacher } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  pageHeadingClass,
  dangerLinkClass,
  mutedTextClass,
} from "@/components/ui/formStyles";
import { createAuthUser, writeAccountProfile, describeAuthError } from "@/lib/createAccount";
import { logActivity } from "@/lib/auditLog";

// "teacher" here means "no special title" -- they're still a full Admin.
// Labeled "General" (not "Teacher") so it's never mistaken for demoting
// someone out of Admin access -- that's the separate "Remove Admin Access"
// action below, which actually changes their role back to a teacher role.
const DESIGNATION_LABEL: Record<AdminDesignation, string> = {
  principal: "Principal",
  incharge: "Incharge",
  labAssistant: "Lab Assistant",
  teacher: "General",
};

const ASSIGNABLE_DESIGNATIONS: AdminDesignation[] = ["incharge", "labAssistant", "teacher"];

export default function AdminsPage() {
  const schoolId = useSchoolId();
  const { user, profile } = useAuth();
  const isPrincipal = profile?.designation === "principal";
  const { data: admins, loading } = useCollection<Admin>(schoolId ? `schools/${schoolId}/admins` : null);
  const { data: teachers } = useCollection<Teacher>(schoolId ? `schools/${schoolId}/teachers` : null);
  const promotableTeachers = teachers.filter((t) => !admins.some((a) => a.id === t.id));

  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"new" | "existing">("new");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [pendingUid, setPendingUid] = useState<string | null>(null);

  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [promoteDesignation, setPromoteDesignation] = useState<AdminDesignation>("teacher");

  function openAdd() {
    setAddMode("new");
    setName("");
    setEmail("");
    setPassword("");
    setAddError(null);
    setPendingUid(null);
    setSelectedTeacherId("");
    setPromoteDesignation("teacher");
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
      await writeAccountProfile(uid, { schoolId, email, displayName: name, kind: "admin" });
      logActivity(schoolId, user, "create", "Admin", name);
      setAddOpen(false);
    } catch (err) {
      setAddError(describeAuthError(err));
    } finally {
      setAddSubmitting(false);
    }
  }

  async function handlePromote() {
    if (!schoolId || !selectedTeacherId) return;
    const teacher = promotableTeachers.find((t) => t.id === selectedTeacherId);
    if (!teacher) return;
    setAddSubmitting(true);
    setAddError(null);
    try {
      await writeBatch(db)
        .set(doc(db, `users/${teacher.id}`), { role: "admin", designation: promoteDesignation }, { merge: true })
        .set(
          doc(db, `schools/${schoolId}/admins/${teacher.id}`),
          { name: teacher.name, email: teacher.email ?? "", status: "active", designation: promoteDesignation },
          { merge: true }
        )
        .commit();
      logActivity(
        schoolId,
        user,
        "update",
        "Admin",
        `${teacher.name} — promoted from Teacher (${DESIGNATION_LABEL[promoteDesignation]})`
      );
      setAddOpen(false);
    } catch {
      setAddError("Could not promote this teacher. Please try again.");
    } finally {
      setAddSubmitting(false);
    }
  }

  async function toggleStatus(a: Admin) {
    if (!schoolId) return;
    const status = a.status === "disabled" ? "active" : "disabled";
    await writeBatch(db)
      .set(doc(db, `users/${a.id}`), { status }, { merge: true })
      .set(doc(db, `schools/${schoolId}/admins/${a.id}`), { status }, { merge: true })
      .commit();
    logActivity(schoolId, user, "update", "Admin", `${a.name} (${status})`);
  }

  async function changeDesignation(a: Admin, designation: AdminDesignation) {
    if (!schoolId) return;
    await writeBatch(db)
      .set(doc(db, `users/${a.id}`), { designation }, { merge: true })
      .set(doc(db, `schools/${schoolId}/admins/${a.id}`), { designation }, { merge: true })
      .commit();
    logActivity(schoolId, user, "update", "Admin", `${a.name} — designation set to ${DESIGNATION_LABEL[designation]}`);
  }

  async function removeAdminAccess(a: Admin) {
    if (!schoolId) return;
    if (!confirm(`Remove Admin access from ${a.name}? They'll go back to being a plain teacher.`)) return;
    const teacher = teachers.find((t) => t.id === a.id);
    const role = teacher?.classTeacherOf ? "classTeacher" : "subjectTeacher";
    await writeBatch(db)
      .update(doc(db, `users/${a.id}`), { role, designation: deleteField() })
      .delete(doc(db, `schools/${schoolId}/admins/${a.id}`))
      .commit();
    logActivity(schoolId, user, "update", "Admin", `${a.name} — Admin access removed (back to Teacher)`);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageHeadingClass}>Admins</h1>
        {isPrincipal && (
          <button onClick={openAdd} className={primaryButtonClass}>
            Add Admin
          </button>
        )}
      </div>

      {!isPrincipal && (
        <p className={`${mutedTextClass} mb-4`}>
          Only the Principal can create Admin accounts or change their designation and status.
        </p>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <DataTable
          rows={admins}
          emptyMessage="No admins yet."
          columns={[
            {
              header: "Name",
              render: (a) => (
                <>
                  {a.name}
                  {a.id === user?.uid && <span className="ml-2 text-xs text-stone-400">(you)</span>}
                </>
              ),
            },
            { header: "Email", render: (a) => a.email ?? "—" },
            {
              header: "Designation",
              render: (a) =>
                isPrincipal && a.id !== user?.uid && a.designation !== "principal" ? (
                  <select
                    value={a.designation ?? "teacher"}
                    onChange={(e) => changeDesignation(a, e.target.value as AdminDesignation)}
                    className={`${inputClass} w-auto py-1 text-sm`}
                  >
                    {ASSIGNABLE_DESIGNATIONS.map((d) => (
                      <option key={d} value={d}>
                        {DESIGNATION_LABEL[d]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge variant={a.designation === "principal" ? "brand" : "neutral"}>
                    {DESIGNATION_LABEL[a.designation ?? "teacher"]}
                  </Badge>
                ),
            },
            {
              header: "Status",
              render: (a) =>
                a.status === "disabled" ? (
                  <Badge variant="warning">Disabled</Badge>
                ) : (
                  <Badge variant="success">Active</Badge>
                ),
            },
            {
              header: "",
              render: (a) =>
                isPrincipal && a.id !== user?.uid ? (
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleStatus(a)} className={`${dangerLinkClass} hover:underline`}>
                      {a.status === "disabled" ? "Enable" : "Disable"}
                    </button>
                    {a.designation !== "principal" && (
                      <button
                        onClick={() => removeAdminAccess(a)}
                        className="text-sm text-stone-500 hover:underline"
                      >
                        Remove Admin Access
                      </button>
                    )}
                  </div>
                ) : null,
            },
          ]}
        />
      )}

      <Modal open={addOpen} title="Add Admin" onClose={closeAdd}>
        <div className="space-y-4">
          <div className="flex gap-2 rounded-lg bg-stone-100 p-1">
            <button
              onClick={() => setAddMode("new")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                addMode === "new" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
              }`}
            >
              New Account
            </button>
            <button
              onClick={() => setAddMode("existing")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                addMode === "existing" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
              }`}
            >
              Existing Faculty
            </button>
          </div>

          {addMode === "new" ? (
            <>
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
                  placeholder="Share this with them directly"
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
            </>
          ) : (
            <>
              {promotableTeachers.length === 0 ? (
                <p className={mutedTextClass}>
                  Every current teacher is already an Admin. Add a teacher first from the Teachers page.
                </p>
              ) : (
                <>
                  <div>
                    <label className={labelClass}>Teacher</label>
                    <select
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select a teacher</option>
                      {promotableTeachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.email ? `(${t.email})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Designation</label>
                    <select
                      value={promoteDesignation}
                      onChange={(e) => setPromoteDesignation(e.target.value as AdminDesignation)}
                      className={inputClass}
                    >
                      {ASSIGNABLE_DESIGNATIONS.map((d) => (
                        <option key={d} value={d}>
                          {DESIGNATION_LABEL[d]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className={mutedTextClass}>
                    They keep their existing teaching assignments and login — this just adds Admin access.
                  </p>
                </>
              )}
              {addError && <p className="text-sm text-rose-600">{addError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={closeAdd} className={secondaryButtonClass}>
                  Cancel
                </button>
                <button
                  onClick={handlePromote}
                  disabled={addSubmitting || !selectedTeacherId}
                  className={primaryButtonClass}
                >
                  {addSubmitting ? "Promoting..." : "Promote to Admin"}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
