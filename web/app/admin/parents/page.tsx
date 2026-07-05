"use client";

import { useState } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { Parent, Student } from "@/types/models";
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

export default function ParentsPage() {
  const schoolId = useSchoolId();
  const { user } = useAuth();
  const { data: parents, loading } = useCollection<Parent>(schoolId ? `schools/${schoolId}/parents` : null);
  const { data: students } = useCollection<Student>(schoolId ? `schools/${schoolId}/students` : null);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [pendingUid, setPendingUid] = useState<string | null>(null);

  function openAdd() {
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
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
      await writeAccountProfile(uid, { schoolId, email, displayName: name, phone: phone || undefined, kind: "parent" });
      logActivity(schoolId, user, "create", "Parent", name);
      setAddOpen(false);
    } catch (err) {
      setAddError(describeAuthError(err));
    } finally {
      setAddSubmitting(false);
    }
  }

  async function toggleStatus(p: Parent) {
    if (!schoolId) return;
    const status = p.status === "disabled" ? "active" : "disabled";
    await writeBatch(db)
      .set(doc(db, `users/${p.id}`), { status }, { merge: true })
      .set(doc(db, `schools/${schoolId}/parents/${p.id}`), { status }, { merge: true })
      .commit();
    logActivity(schoolId, user, "update", "Parent", `${p.name} (${status})`);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageHeadingClass}>Parents</h1>
        <button onClick={openAdd} className={primaryButtonClass}>
          Add Parent
        </button>
      </div>

      <div className={`${cardClass} mb-6 text-sm text-stone-600`}>
        Need to add many parents at once? Run this from{" "}
        <code className="rounded bg-stone-100 px-1">firebase/functions</code> instead of adding them one by
        one:
        <pre className="mt-2 overflow-x-auto rounded-lg bg-stone-900 px-3 py-2 text-xs break-all whitespace-pre-wrap text-stone-100">
          {`npm run import-parents -- --schoolId ${schoolId || "<schoolId>"} --file /path/to/parents.csv`}
        </pre>
        See <code className="rounded bg-stone-100 px-1">templates/parents_template.csv</code> for the CSV
        format. Link children to a parent from the Students page (Edit Student → Parents).
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <DataTable
          rows={parents}
          emptyMessage="No parents yet."
          columns={[
            { header: "Name", render: (p) => p.name },
            {
              header: "Children",
              render: (p) =>
                (p.childStudentIds ?? [])
                  .map((id) => students.find((s) => s.id === id)?.name)
                  .filter(Boolean)
                  .join(", ") || <span className="text-stone-400">None linked</span>,
            },
            {
              header: "Status",
              render: (p) =>
                p.status === "disabled" ? (
                  <Badge variant="warning">Disabled</Badge>
                ) : (
                  <Badge variant="success">Active</Badge>
                ),
            },
            {
              header: "",
              render: (p) => (
                <button onClick={() => toggleStatus(p)} className={`${dangerLinkClass} hover:underline`}>
                  {p.status === "disabled" ? "Enable" : "Disable"}
                </button>
              ),
            },
          ]}
        />
      )}

      <Modal open={addOpen} title="Add Parent" onClose={closeAdd}>
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
            <label className={labelClass}>Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder="Optional"
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
              placeholder="Share this with the parent directly"
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
    </div>
  );
}
