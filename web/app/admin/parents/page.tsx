"use client";

import { useState } from "react";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { Parent, Student } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/formStyles";
import { createStaffOrParentAccount, setAccountStatus } from "@/lib/functions";

export default function ParentsPage() {
  const schoolId = useSchoolId();
  const { data: parents, loading } = useCollection<Parent>(schoolId ? `schools/${schoolId}/parents` : null);
  const { data: students } = useCollection<Student>(schoolId ? `schools/${schoolId}/students` : null);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setName("");
    setEmail("");
    setPassword("");
    setError(null);
    setOpen(true);
  }

  async function handleAdd() {
    if (!schoolId || !name || !email || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await createStaffOrParentAccount({ schoolId, email, password, displayName: name, kind: "parent" });
      setOpen(false);
    } catch {
      setError("Could not create the account. Check the email isn't already in use.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(p: Parent) {
    if (!schoolId) return;
    await setAccountStatus({
      schoolId,
      uid: p.id,
      status: p.status === "disabled" ? "active" : "disabled",
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Parents</h1>
        <button onClick={openAdd} className={primaryButtonClass}>
          Add Parent
        </button>
      </div>
      <p className="mb-4 text-sm text-gray-500">
        Link children to a parent from the Students page (Edit Student → Parents).
      </p>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
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
                  .join(", ") || <span className="text-gray-400">None linked</span>,
            },
            {
              header: "Status",
              render: (p) =>
                p.status === "disabled" ? (
                  <span className="text-amber-700">Disabled</span>
                ) : (
                  <span className="text-green-700">Active</span>
                ),
            },
            {
              header: "",
              render: (p) => (
                <button onClick={() => toggleStatus(p)} className="text-sm text-red-600 hover:underline">
                  {p.status === "disabled" ? "Enable" : "Disable"}
                </button>
              ),
            },
          ]}
        />
      )}

      <Modal open={open} title="Add Parent" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
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
              placeholder="Share this with the parent directly"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpen(false)} className={secondaryButtonClass}>
              Cancel
            </button>
            <button onClick={handleAdd} disabled={submitting} className={primaryButtonClass}>
              {submitting ? "Creating..." : "Create Account"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
