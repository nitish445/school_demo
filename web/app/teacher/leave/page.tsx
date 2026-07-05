"use client";

import { where } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useMyClassIds } from "@/hooks/useMyClassIds";
import { useCollection } from "@/hooks/useCollection";
import type { Leave, Student } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { pageHeadingClass } from "@/components/ui/formStyles";
import { approveLeave, rejectLeave } from "@/lib/leave";

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

  async function handleApprove(l: Leave) {
    if (!schoolId || !user) return;
    await approveLeave(schoolId, l, user.uid);
  }

  async function handleReject(l: Leave) {
    if (!schoolId || !user) return;
    await rejectLeave(schoolId, l.id, user.uid);
  }

  return (
    <div>
      <h1 className={`mb-6 ${pageHeadingClass}`}>Leave Approval</h1>

      {!classId ? (
        <p className="text-sm text-stone-500">You are not a class teacher of any class yet.</p>
      ) : loading ? (
        <Spinner />
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
              render: (l) => (
                <Badge variant={l.status === "approved" ? "success" : l.status === "rejected" ? "danger" : "warning"}>
                  {l.status}
                </Badge>
              ),
            },
            {
              header: "",
              render: (l) =>
                l.status === "pending" && (
                  <div className="flex gap-3">
                    <button onClick={() => handleApprove(l)} className="text-sm text-emerald-700 hover:underline">
                      Approve
                    </button>
                    <button onClick={() => handleReject(l)} className="text-sm text-rose-600 hover:underline">
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
