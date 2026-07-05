"use client";

import { useState } from "react";
import { where } from "firebase/firestore";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useEffectiveChildId } from "@/hooks/useEffectiveChildId";
import { useCollection } from "@/hooks/useCollection";
import type { AttendanceRecord, Leave } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { inputClass, labelClass } from "@/components/ui/formStyles";

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export default function ParentAttendancePage() {
  const schoolId = useSchoolId();
  const { effectiveChildId, childStudentIds } = useEffectiveChildId();
  const [month, setMonth] = useState(currentMonth());

  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`;

  const { data: records, loading } = useCollection<AttendanceRecord>(
    schoolId && effectiveChildId ? `schools/${schoolId}/attendance` : null,
    effectiveChildId
      ? [where("studentId", "==", effectiveChildId), where("date", ">=", monthStart), where("date", "<=", monthEnd)]
      : [],
    [effectiveChildId, month]
  );

  const { data: leaves } = useCollection<Leave>(
    schoolId && effectiveChildId ? `schools/${schoolId}/leaves` : null,
    effectiveChildId ? [where("studentId", "==", effectiveChildId)] : [],
    [effectiveChildId]
  );

  if (childStudentIds.length === 0) {
    return <p className="text-sm text-stone-500">No children are linked to your account yet.</p>;
  }

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const presentCount = sorted.filter((r) => r.status === "present" || r.status === "late").length;
  const pct = sorted.length > 0 ? Math.round((presentCount / sorted.length) * 100) : null;
  const lateRecords = sorted.filter((r) => r.status === "late");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">Attendance</h1>

      <div className="mb-6 flex items-end gap-4">
        <div>
          <label className={labelClass}>Month</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} />
        </div>
        {pct !== null && (
          <span className="text-sm text-stone-600">
            {pct}% present ({presentCount}/{sorted.length} days)
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Loading...</p>
      ) : (
        <>
          <h2 className="mb-2 text-sm font-semibold text-stone-900">Daily Record</h2>
          <div className="mb-8">
            <DataTable
              rows={sorted}
              emptyMessage="No attendance marked this month."
              columns={[
                { header: "Date", render: (r) => r.date },
                { header: "Status", render: (r) => r.status },
              ]}
            />
          </div>

          <h2 className="mb-2 text-sm font-semibold text-stone-900">Late Records</h2>
          <div className="mb-8">
            <DataTable
              rows={lateRecords}
              emptyMessage="No late marks this month."
              columns={[{ header: "Date", render: (r) => r.date }]}
            />
          </div>

          <h2 className="mb-2 text-sm font-semibold text-stone-900">Leave History</h2>
          <DataTable
            rows={leaves}
            emptyMessage="No leave requests yet."
            columns={[
              { header: "From", render: (l) => l.fromDate },
              { header: "To", render: (l) => l.toDate },
              { header: "Reason", render: (l) => l.reason },
              { header: "Status", render: (l) => l.status },
            ]}
          />
        </>
      )}
    </div>
  );
}
