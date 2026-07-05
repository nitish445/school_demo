"use client";

import { useMemo, useState } from "react";
import { addDoc, collection, doc, increment, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { FeeRecord, Student } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/formStyles";
import { logActivity } from "@/lib/auditLog";

export default function FeesPage() {
  const schoolId = useSchoolId();
  const { user } = useAuth();
  const { data: students, loading: loadingStudents } = useCollection<Student>(
    schoolId ? `schools/${schoolId}/students` : null
  );
  const { data: feeRecords, loading: loadingFees } = useCollection<FeeRecord>(
    schoolId ? `schools/${schoolId}/fees` : null
  );

  const rows = useMemo(
    () =>
      students
        .filter((s) => s.status === "active")
        .map((s) => {
          const fee = feeRecords.find((f) => f.id === s.id);
          return {
            id: s.id,
            name: s.name,
            totalDue: fee?.totalDue ?? 0,
            totalPaid: fee?.totalPaid ?? 0,
          };
        }),
    [students, feeRecords]
  );

  const [dueOpen, setDueOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [activeStudent, setActiveStudent] = useState<{ id: string; name: string } | null>(null);
  const [totalDue, setTotalDue] = useState(0);
  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState<"cash" | "cheque" | "online" | "other">("cash");
  const [submitting, setSubmitting] = useState(false);

  function openSetDue(row: { id: string; name: string; totalDue: number }) {
    setActiveStudent(row);
    setTotalDue(row.totalDue);
    setDueOpen(true);
  }

  function openRecordPayment(row: { id: string; name: string }) {
    setActiveStudent(row);
    setPayAmount(0);
    setPayMode("cash");
    setPayOpen(true);
  }

  async function handleSaveDue() {
    if (!schoolId || !activeStudent) return;
    setSubmitting(true);
    try {
      await setDoc(
        doc(db, `schools/${schoolId}/fees/${activeStudent.id}`),
        { totalDue, totalPaid: 0 },
        { merge: true }
      );
      logActivity(schoolId, user, "update", "Fee", `${activeStudent.name} — due set to ₹${totalDue}`);
      setDueOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecordPayment() {
    if (!schoolId || !activeStudent || payAmount <= 0) return;
    setSubmitting(true);
    try {
      const receiptNo = `RCPT-${Date.now()}`;
      await addDoc(collection(db, `schools/${schoolId}/fees/${activeStudent.id}/payments`), {
        amount: payAmount,
        date: new Date().toISOString().slice(0, 10),
        mode: payMode,
        receiptNo,
      });
      await setDoc(
        doc(db, `schools/${schoolId}/fees/${activeStudent.id}`),
        { totalPaid: increment(payAmount) },
        { merge: true }
      );
      logActivity(schoolId, user, "create", "Fee Payment", `${activeStudent.name} — ₹${payAmount} (${payMode})`);
      setPayOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  const loading = loadingStudents || loadingFees;
  const totalPending = rows.reduce((sum, r) => sum + Math.max(0, r.totalDue - r.totalPaid), 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Fees</h1>
        <span className="text-sm text-stone-600">
          Total pending: ₹{totalPending.toLocaleString()}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Loading...</p>
      ) : (
        <DataTable
          rows={rows}
          emptyMessage="No active students yet."
          columns={[
            { header: "Student", render: (r) => r.name },
            { header: "Total Due", render: (r) => `₹${r.totalDue.toLocaleString()}` },
            { header: "Total Paid", render: (r) => `₹${r.totalPaid.toLocaleString()}` },
            {
              header: "Pending",
              render: (r) => `₹${Math.max(0, r.totalDue - r.totalPaid).toLocaleString()}`,
            },
            {
              header: "",
              render: (r) => (
                <div className="flex gap-3">
                  <button onClick={() => openSetDue(r)} className="text-sm text-stone-700 hover:underline">
                    Set Fee
                  </button>
                  <button
                    onClick={() => openRecordPayment(r)}
                    className="text-sm text-blue-700 hover:underline"
                  >
                    Record Payment
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal open={dueOpen} title={`Set Fee — ${activeStudent?.name ?? ""}`} onClose={() => setDueOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Total Due (₹)</label>
            <input
              type="number"
              value={totalDue}
              onChange={(e) => setTotalDue(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setDueOpen(false)} className={secondaryButtonClass}>
              Cancel
            </button>
            <button onClick={handleSaveDue} disabled={submitting} className={primaryButtonClass}>
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={payOpen}
        title={`Record Payment — ${activeStudent?.name ?? ""}`}
        onClose={() => setPayOpen(false)}
      >
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Amount (₹)</label>
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Mode</label>
            <select
              value={payMode}
              onChange={(e) => setPayMode(e.target.value as typeof payMode)}
              className={inputClass}
            >
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setPayOpen(false)} className={secondaryButtonClass}>
              Cancel
            </button>
            <button onClick={handleRecordPayment} disabled={submitting} className={primaryButtonClass}>
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
