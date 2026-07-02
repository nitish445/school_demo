"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, writeBatch, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useMyClassIds } from "@/hooks/useMyClassIds";
import { useCollection } from "@/hooks/useCollection";
import type { AttendanceStatus, Student, SchoolClass, AttendanceRecord } from "@/types/models";
import { inputClass, labelClass, primaryButtonClass } from "@/components/ui/formStyles";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "halfDay", label: "Half Day" },
  { value: "medicalLeave", label: "Medical Leave" },
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

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Mark Attendance</h1>

      <div className="mb-6 flex flex-wrap items-end gap-4">
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
        {saved && <span className="text-sm text-green-700">Saved.</span>}
      </div>

      {!effectiveClassId ? (
        <p className="text-sm text-gray-500">Select a class to mark attendance.</p>
      ) : loadingStudents || loadingRecords ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : activeStudents.length === 0 ? (
        <p className="text-sm text-gray-500">No active students in this class.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Roll No.</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activeStudents.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 text-gray-800">{s.rollNo}</td>
                  <td className="px-4 py-2 text-gray-800">{s.name}</td>
                  <td className="px-4 py-2">
                    <select
                      value={statuses[s.id] ?? "present"}
                      onChange={(e) =>
                        setStatuses({ ...statuses, [s.id]: e.target.value as AttendanceStatus })
                      }
                      className={inputClass}
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
