"use client";

import { useMemo, useState } from "react";
import { where } from "firebase/firestore";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { AttendanceRecord, SchoolClass, Student } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { downloadCsv } from "@/lib/csv";
import { inputClass, labelClass, secondaryButtonClass } from "@/components/ui/formStyles";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return todayIso().slice(0, 7); // YYYY-MM
}

function daysInMonth(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(year, mon, 0).getDate();
}

const STATUS_LABEL: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  halfDay: "Half Day",
  medicalLeave: "Medical Leave",
};

const STATUS_SHORT: Record<string, string> = {
  present: "P",
  absent: "A",
  late: "L",
  halfDay: "H",
  medicalLeave: "M",
};

const modeButtonClass = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    active ? "bg-stone-900 text-white" : "border border-stone-300 text-stone-700 hover:bg-stone-50"
  }`;

export default function AttendanceMonitorPage() {
  const schoolId = useSchoolId();
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const { data: students } = useCollection<Student>(schoolId ? `schools/${schoolId}/students` : null);

  const [mode, setMode] = useState<"day" | "month">("day");
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [month, setMonth] = useState(currentMonth());

  const studentName = (id: string) => students.find((s) => s.id === id)?.name ?? id;

  // ---- Day view ----
  const { data: dayRecords, loading: dayLoading } = useCollection<AttendanceRecord>(
    schoolId && classId && mode === "day" ? `schools/${schoolId}/attendance` : null,
    [where("classId", "==", classId), where("date", "==", date)],
    [schoolId, classId, date, mode]
  );

  const dayRows = useMemo(
    () =>
      dayRecords
        .map((r) => ({ ...r, studentName: studentName(r.studentId) }))
        .sort((a, b) => a.studentName.localeCompare(b.studentName)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayRecords, students]
  );

  const presentCount = dayRows.filter((r) => r.status === "present" || r.status === "late").length;
  const dayPct = dayRows.length > 0 ? Math.round((presentCount / dayRows.length) * 100) : null;

  function exportDayCsv() {
    downloadCsv(
      `attendance-${classId}-${date}.csv`,
      ["Student", "Status"],
      dayRows.map((r) => [r.studentName, STATUS_LABEL[r.status] ?? r.status])
    );
  }

  // ---- Month view ----
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;

  const { data: monthRecords, loading: monthLoading } = useCollection<AttendanceRecord>(
    schoolId && classId && mode === "month" ? `schools/${schoolId}/attendance` : null,
    [where("classId", "==", classId), where("date", ">=", monthStart), where("date", "<=", monthEnd)],
    [schoolId, classId, monthStart, monthEnd, mode]
  );

  const monthDates = useMemo(
    () => Array.from(new Set(monthRecords.map((r) => r.date))).sort(),
    [monthRecords]
  );

  const monthMatrix = useMemo(() => {
    const byStudent = new Map<string, Record<string, AttendanceRecord["status"]>>();
    for (const r of monthRecords) {
      if (!byStudent.has(r.studentId)) byStudent.set(r.studentId, {});
      byStudent.get(r.studentId)![r.date] = r.status;
    }
    return Array.from(byStudent.entries())
      .map(([studentId, byDate]) => {
        const marked = Object.values(byDate);
        const present = marked.filter((s) => s === "present" || s === "late").length;
        return {
          id: studentId,
          studentId,
          studentName: studentName(studentId),
          byDate,
          present,
          total: marked.length,
          pct: marked.length > 0 ? Math.round((present / marked.length) * 100) : null,
        };
      })
      .sort((a, b) => a.studentName.localeCompare(b.studentName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthRecords, students]);

  function exportMonthCsv() {
    downloadCsv(
      `attendance-${classId}-${month}.csv`,
      ["Student", ...monthDates, "Present", "Marked", "%"],
      monthMatrix.map((row) => [
        row.studentName,
        ...monthDates.map((d) => (row.byDate[d] ? STATUS_SHORT[row.byDate[d]] ?? row.byDate[d] : "")),
        row.present,
        row.total,
        row.pct ?? "",
      ])
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">Attendance</h1>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="flex gap-2">
          <button onClick={() => setMode("day")} className={modeButtonClass(mode === "day")}>
            By date
          </button>
          <button onClick={() => setMode("month")} className={modeButtonClass(mode === "month")}>
            By month
          </button>
        </div>
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

        {mode === "day" ? (
          <>
            <div>
              <label className={labelClass}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
            {dayRows.length > 0 && (
              <button onClick={exportDayCsv} className={secondaryButtonClass}>
                Export CSV
              </button>
            )}
            {dayPct !== null && (
              <span className="text-sm text-stone-600">
                {dayPct}% present ({presentCount}/{dayRows.length})
              </span>
            )}
          </>
        ) : (
          <>
            <div>
              <label className={labelClass}>Month</label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} />
            </div>
            {monthMatrix.length > 0 && (
              <button onClick={exportMonthCsv} className={secondaryButtonClass}>
                Export CSV
              </button>
            )}
          </>
        )}
      </div>

      {!classId ? (
        <p className="text-sm text-stone-500">Choose a class to view its attendance.</p>
      ) : mode === "day" ? (
        dayLoading ? (
          <p className="text-sm text-stone-500">Loading...</p>
        ) : (
          <DataTable
            rows={dayRows}
            emptyMessage="No attendance marked for this class/date yet."
            columns={[
              { header: "Student", render: (r) => r.studentName },
              { header: "Status", render: (r) => STATUS_LABEL[r.status] ?? r.status },
            ]}
          />
        )
      ) : monthLoading ? (
        <p className="text-sm text-stone-500">Loading...</p>
      ) : (
        <DataTable
          rows={monthMatrix}
          emptyMessage="No attendance marked for this class/month yet."
          columns={[
            { header: "Student", render: (r) => r.studentName },
            ...monthDates.map((d) => ({
              header: d.slice(8, 10),
              render: (r: (typeof monthMatrix)[number]) =>
                r.byDate[d] ? STATUS_SHORT[r.byDate[d]] ?? r.byDate[d] : "—",
            })),
            { header: "Present", render: (r) => `${r.present}/${r.total}` },
            { header: "%", render: (r) => (r.pct !== null ? `${r.pct}%` : "—") },
          ]}
        />
      )}
    </div>
  );
}
