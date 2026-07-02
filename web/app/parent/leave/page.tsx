"use client";

import { useState } from "react";
import { addDoc, collection, doc, updateDoc, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useEffectiveChildId } from "@/hooks/useEffectiveChildId";
import { useCollection } from "@/hooks/useCollection";
import { useDoc } from "@/hooks/useDoc";
import type { Leave, Student } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/formStyles";

export default function ParentLeavePage() {
  const schoolId = useSchoolId();
  const { effectiveChildId, childStudentIds } = useEffectiveChildId();

  const { data: student } = useDoc<Student>(
    schoolId && effectiveChildId ? `schools/${schoolId}/students/${effectiveChildId}` : null
  );

  const { data: leaves, loading } = useCollection<Leave>(
    schoolId && effectiveChildId ? `schools/${schoolId}/leaves` : null,
    effectiveChildId ? [where("studentId", "==", effectiveChildId)] : [],
    [effectiveChildId]
  );

  const [open, setOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function openAdd() {
    setFromDate("");
    setToDate("");
    setReason("");
    setFile(null);
    setOpen(true);
  }

  async function handleSubmit() {
    if (!schoolId || !effectiveChildId || !student || !fromDate || !toDate || !reason) return;
    setSubmitting(true);
    try {
      const leaveRef = await addDoc(collection(db, `schools/${schoolId}/leaves`), {
        studentId: effectiveChildId,
        classId: student.classId,
        fromDate,
        toDate,
        reason,
        status: "pending",
      });

      if (file) {
        const fileRef = ref(storage, `schools/${schoolId}/leaves/${leaveRef.id}/${file.name}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        await updateDoc(doc(db, `schools/${schoolId}/leaves/${leaveRef.id}`), { medicalCertUrl: url });
      }

      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (childStudentIds.length === 0) {
    return <p className="text-sm text-gray-500">No children are linked to your account yet.</p>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Leave</h1>
        <button onClick={openAdd} className={primaryButtonClass}>
          Apply for Leave
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <DataTable
          rows={leaves}
          emptyMessage="No leave requests yet."
          columns={[
            { header: "From", render: (l) => l.fromDate },
            { header: "To", render: (l) => l.toDate },
            { header: "Reason", render: (l) => l.reason },
            {
              header: "Certificate",
              render: (l) =>
                l.medicalCertUrl ? (
                  <a href={l.medicalCertUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                    View
                  </a>
                ) : (
                  "—"
                ),
            },
            {
              header: "Status",
              render: (l) => {
                const color =
                  l.status === "approved"
                    ? "text-green-700"
                    : l.status === "rejected"
                      ? "text-red-700"
                      : "text-amber-700";
                return <span className={color}>{l.status}</span>;
              },
            },
          ]}
        />
      )}

      <Modal open={open} title="Apply for Leave" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} h-20`} />
          </div>
          <div>
            <label className={labelClass}>Medical Certificate (optional)</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpen(false)} className={secondaryButtonClass}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={submitting} className={primaryButtonClass}>
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
