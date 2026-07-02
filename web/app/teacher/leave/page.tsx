"use client";

import { doc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useMyClassIds } from "@/hooks/useMyClassIds";
import { useCollection } from "@/hooks/useCollection";
import type { Leave, Student } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";

export default function TeacherLeaveApprovalPage() {
  const schoolId = useSchoolId();
  const { user } = useAuth();
  const { teacher } = useMyClassIds();
  const classId = teacher?.classTeacherOf ?? "";

  const { data: students } = useCollection<Student>(
    schoolId && classId ? `schools/${schoolId}/students` : null,
    classId ? [where("classId", "==", classId)] : [],
    [classId]
  );

  const { data: leaves, loading } = useCollection<Leave>(
    schoolId && classId ? `schools/${schoolId}/leaves` : null,
    classId ? [where("classId", "==", classId)] : [],
    [classId]
  );

  async function setStatus(l: Leave, status: "approved" | "rejected") {
    if (!schoolId || !user) return;
    await updateDoc(doc(db, `schools/${schoolId}/leaves/${l.id}`), {
      status,
      approvedBy: user.uid,
    });
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Leave Approval</h1>

      {!classId ? (
        <p className="text-sm text-gray-500">You are not a class teacher of any class yet.</p>
      ) : loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <DataTable
          rows={leaves}
          emptyMessage="No leave requests yet."
          columns={[
            {
              header: "Student",
              render: (l) => students.find((s) => s.id === l.studentId)?.name ?? l.studentId,
            },
            { header: "From", render: (l) => l.fromDate },
            { header: "To", render: (l) => l.toDate },
            { header: "Reason", render: (l) => l.reason },
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
            {
              header: "",
              render: (l) =>
                l.status === "pending" && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStatus(l, "approved")}
                      className="text-sm text-green-700 hover:underline"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setStatus(l, "rejected")}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Reject
                    </button>
                  </div>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}
