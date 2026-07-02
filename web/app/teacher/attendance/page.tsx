"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, writeBatch, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useMyClassIds } from "@/hooks/useMyClassIds";
import { useCollection } from "@/hooks/useCollection";
import type { AttendanceStatus, Student, SchoolClass, AttendanceRecord } from "@/types/models";
import { inputClass, labelClass, primaryButtonClass, cardClass } from "@/components/ui/formStyles";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_OPTIONS: {
  value: AttendanceStatus;
  label: string;
  active: string;
  idle: string;
  dot: string;
}[] = [
  {
    value: "present",
    label: "Present",
    active: "bg-emerald-600 text-white shadow-sm",
    idle: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    dot: "bg-emerald-500",
  },
  {
    value: "absent",
    label: "Absent",
    active: "bg-rose-600 text-white shadow-sm",
    idle: "bg-rose-50 text-rose-700 hover:bg-rose-100",
    dot: "bg-rose-500",
  },
  {
    value: "late",
    label: "Late",
    active: "bg-amber-500 text-white shadow-sm",
    idle: "bg-amber-50 text-amber-700 hover:bg-amber-100",
    dot: "bg-amber-500",
  },
  {
    value: "halfDay",
    label: "Half Day",
    active: "bg-sky-600 text-white shadow-sm",
    idle: "bg-sky-50 text-sky-700 hover:bg-sky-100",
    dot: "bg-sky-500",
  },
  {
    value: "medicalLeave",
    label: "Medical",
    active: "bg-violet-600 text-white shadow-sm",
    idle: "bg-violet-50 text-violet-700 hover:bg-violet-100",
    dot: "bg-violet-500",
  },
];

export default function TeacherAttendancePage() {
  const schoolId = useSchoolId();
  const { user } = useAuth();
  const { classIds } = useMyClassIds();
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const myClasses = classes.filter((c) => classIds.includes(c.id));

  const [classId, setClassId] = useState("");
  const effectiveClassId = classId || myClasses[0]?.id || "";
  const [date, setDate] = useState(todayIso());
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: students, loading: loadingStudents } = useCollection<Student>(
    schoolId && effectiveClassId ? `schools/${schoolId}/students` : null,
    effectiveClassId ? [where("classId", "==", effectiveClassId)] : [],
    [effectiveClassId]
  );
  const activeStudents = useMemo(
    () => students.filter((s) => s.status === "active").sort((a, b) => a.rollNo.localeCompare(b.rollNo)),
    [students]
  );

  const { data: existingRecords, loading: loadingRecords } = useCollection<AttendanceRecord>(
    schoolId && effectiveClassId ? `schools/${schoolId}/attendance` : null,
    effectiveClassId ? [where("classId", "==", effectiveClassId), where("date", "==", date)] : [],
    [effectiveClassId, date]
  );

  useEffect(() => {
    const next: Record<string, AttendanceStatus> = {};
    for (const s of activeStudents) {
      const existing = existingRecords.find((r) => r.studentId === s.id);
      next[s.id] = existing?.status ?? "present";
    }
    // Syncing local editable state from freshly-fetched data when the
    // class/date changes is intentional, not a render loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatuses(next);
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveClassId, date, activeStudents.length, existingRecords.length]);

  async function handleSave() {
    if (!schoolId || !effectiveClassId || !user) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      for (const s of activeStudents) {
        const recordId = `${s.id}_${date}`;
        batch.set(doc(db, `schools/${schoolId}/attendance/${recordId}`), {
          studentId: s.id,
          classId: effectiveClassId,
          date,
          status: statuses[s.id] ?? "present",
          markedBy: user.uid,
          markedAt: Date.now(),
        });
      }
      await batch.commit();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, halfDay: 0, medicalLeave: 0 };
    for (const s of activeStudents) {
      const status = statuses[s.id] ?? "present";
      c[status] += 1;
    }
    return c;
  }, [activeStudents, statuses]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Mark Attendance</h1>

      <div className={`${cardClass} mb-6 flex flex-wrap items-end gap-4`}>
        <div>
          <label className={labelClass}>Class</label>
          <select value={effectiveClassId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
            {myClasses.length === 0 && <option value="">No classes assigned</option>}
            {myClasses.map((c) => (
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
        <button onClick={handleSave} disabled={saving || !effectiveClassId} className={primaryButtonClass}>
          {saving ? "Saving..." : "Save Attendance"}
        </button>
        {saved && <span className="text-sm font-medium text-emerald-700">Saved.</span>}

        {activeStudents.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-3">
            {STATUS_OPTIONS.map((o) => (
              <span key={o.value} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <span className={`h-2 w-2 rounded-full ${o.dot}`} />
                {counts[o.value]} {o.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {!effectiveClassId ? (
        <p className="text-sm text-slate-500">Select a class to mark attendance.</p>
      ) : loadingStudents || loadingRecords ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : activeStudents.length === 0 ? (
        <p className="text-sm text-slate-500">No active students in this class.</p>
      ) : (
        <div className="space-y-2">
          {activeStudents.map((s) => {
            const current = statuses[s.id] ?? "present";
            return (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">
                    {s.rollNo}
                  </span>
                  <span className="text-sm font-medium text-slate-900">{s.name}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setStatuses({ ...statuses, [s.id]: o.value })}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        current === o.value ? o.active : o.idle
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
