"use client";

import { useMemo, useState } from "react";
import { where } from "firebase/firestore";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { AttendanceRecord, SchoolClass, Student } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { inputClass, labelClass, secondaryButtonClass } from "@/components/ui/formStyles";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_LABEL: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  halfDay: "Half Day",
  medicalLeave: "Medical Leave",
};

export default function AttendanceMonitorPage() {
  const schoolId = useSchoolId();
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const { data: students } = useCollection<Student>(schoolId ? `schools/${schoolId}/students` : null);

  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(todayIso());

  const { data: records, loading } = useCollection<AttendanceRecord>(
    schoolId && classId ? `schools/${schoolId}/attendance` : null,
    [where("classId", "==", classId), where("date", "==", date)],
    [schoolId, classId, date]
  );

  const rows = useMemo(
    () =>
      records
        .map((r) => ({ ...r, studentName: students.find((s) => s.id === r.studentId)?.name ?? r.studentId }))
        .sort((a, b) => a.studentName.localeCompare(b.studentName)),
    [records, students]
  );

  const presentCount = rows.filter((r) => r.status === "present" || r.status === "late").length;
  const pct = rows.length > 0 ? Math.round((presentCount / rows.length) * 100) : null;

  function exportCsv() {
    const header = "Student,Status\n";
    const body = rows.map((r) => `${r.studentName},${STATUS_LABEL[r.status] ?? r.status}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${classId}-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">Attendance</h1>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className={labelClass}>Class</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
            <option value="">Select a class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.grade}-{c.section}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        {rows.length > 0 && (
          <button onClick={exportCsv} className={secondaryButtonClass}>
            Export CSV
          </button>
        )}
        {pct !== null && (
          <span className="text-sm text-stone-600">
            {pct}% present ({presentCount}/{rows.length})
          </span>
        )}
      </div>

      {!classId ? (
        <p className="text-sm text-stone-500">Choose a class to view its attendance.</p>
      ) : loading ? (
        <p className="text-sm text-stone-500">Loading...</p>
      ) : (
        <DataTable
          rows={rows}
          emptyMessage="No attendance marked for this class/date yet."
          columns={[
            { header: "Student", render: (r) => r.studentName },
            { header: "Status", render: (r) => STATUS_LABEL[r.status] ?? r.status },
          ]}
        />
      )}
    </div>
  );
}
