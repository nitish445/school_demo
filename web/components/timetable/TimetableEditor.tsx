"use client";

import { useEffect, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useDoc } from "@/hooks/useDoc";
import type { Subject, Teacher, Timetable, TimetablePeriod } from "@/types/models";
import { inputClass, primaryButtonClass } from "@/components/ui/formStyles";
import { logActivity } from "@/lib/auditLog";
import { findTeacherName } from "@/lib/timetable";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_PERIOD_COUNT = 8;

type Cell = { subjectId: string; label: string };
type CellMap = Record<string, Cell>;
type RowTime = { start: string; end: string };

function cellKey(day: number, period: number) {
  return `${day}_${period}`;
}

/**
 * Editable weekly grid for one class's timetable. Shared by the admin
 * Timetable page and the teacher's own home-room class (class teachers can
 * edit their own class's schedule; the Firestore rule for `timetables`
 * mirrors the same isMyClass()-or-admin check used for attendance/diary).
 */
export function TimetableEditor({
  schoolId,
  classId,
  classLabel,
  workingDays,
  subjects,
  teachers = [],
}: {
  schoolId: string;
  classId: string;
  classLabel: string;
  workingDays: number[];
  subjects: Subject[];
  /** Shown as read-only info under each subject slot; derived from Teacher.assignments, not editable here. */
  teachers?: Teacher[];
}) {
  const { user } = useAuth();
  const { data: timetable, loading } = useDoc<Timetable>(
    schoolId && classId ? `schools/${schoolId}/timetables/${classId}` : null
  );

  const [periodsCount, setPeriodsCount] = useState(DEFAULT_PERIOD_COUNT);
  const [cells, setCells] = useState<CellMap>({});
  const [rowTimes, setRowTimes] = useState<Record<number, RowTime>>({});
  const [saving, setSaving] = useState(false);

  // Re-sync the editable grid whenever the selected class's timetable
  // (re)loads -- this mirrors the existing marksInput-sync pattern in
  // teacher/marks/page.tsx, not a render loop.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    const periods = timetable?.periods ?? [];
    const nextCells: CellMap = {};
    const nextRowTimes: Record<number, RowTime> = {};
    for (const p of periods) {
      nextCells[cellKey(p.day, p.period)] = { subjectId: p.subjectId ?? "", label: p.label ?? "" };
      if (!nextRowTimes[p.period] && (p.startTime || p.endTime)) {
        nextRowTimes[p.period] = { start: p.startTime ?? "", end: p.endTime ?? "" };
      }
    }
    setCells(nextCells);
    setRowTimes(nextRowTimes);
    setPeriodsCount(Math.max(DEFAULT_PERIOD_COUNT, ...periods.map((p) => p.period), 0));
  }, [timetable, classId]);

  const periodNumbers = Array.from({ length: periodsCount }, (_, i) => i + 1);

  function updateCell(day: number, period: number, patch: Partial<Cell>) {
    const key = cellKey(day, period);
    setCells((prev) => {
      const current = prev[key] ?? { subjectId: "", label: "" };
      return { ...prev, [key]: { ...current, ...patch } };
    });
  }

  function updateRowTime(period: number, patch: Partial<RowTime>) {
    setRowTimes((prev) => {
      const current = prev[period] ?? { start: "", end: "" };
      return { ...prev, [period]: { ...current, ...patch } };
    });
  }

  async function handleSave() {
    if (!schoolId || !classId) return;
    setSaving(true);
    try {
      const periods: TimetablePeriod[] = [];
      for (const day of workingDays) {
        for (const period of periodNumbers) {
          const cell = cells[cellKey(day, period)];
          if (!cell || (!cell.subjectId && !cell.label)) continue;
          const time = rowTimes[period];
          periods.push({
            day,
            period,
            ...(cell.subjectId ? { subjectId: cell.subjectId } : cell.label ? { label: cell.label } : {}),
            ...(time?.start ? { startTime: time.start } : {}),
            ...(time?.end ? { endTime: time.end } : {}),
          });
        }
      }
      await setDoc(doc(db, `schools/${schoolId}/timetables/${classId}`), { classId, periods });
      logActivity(schoolId, user, timetable ? "update" : "create", "Timetable", classLabel);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-stone-600">
          Periods per day
          <input
            type="number"
            min={1}
            max={12}
            value={periodsCount}
            onChange={(e) => setPeriodsCount(Math.max(1, Number(e.target.value)))}
            className={`${inputClass} w-20`}
          />
        </label>
        <button onClick={handleSave} disabled={saving} className={primaryButtonClass}>
          {saving ? "Saving..." : "Save Timetable"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200/80 bg-white shadow-[0_2px_10px_-2px_rgba(41,27,10,0.06)]">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-stone-500 uppercase">
                  Period
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-stone-500 uppercase">
                  Time
                </th>
                {workingDays.map((d) => (
                  <th
                    key={d}
                    className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-stone-500 uppercase"
                  >
                    {DAY_NAMES[d]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {periodNumbers.map((period) => (
                <tr key={period}>
                  <td className="px-3 py-2.5 font-medium text-stone-700">{period}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <input
                        type="time"
                        value={rowTimes[period]?.start ?? ""}
                        onChange={(e) => updateRowTime(period, { start: e.target.value })}
                        className={`${inputClass} w-24 px-1.5 py-1.5 text-xs`}
                      />
                      <input
                        type="time"
                        value={rowTimes[period]?.end ?? ""}
                        onChange={(e) => updateRowTime(period, { end: e.target.value })}
                        className={`${inputClass} w-24 px-1.5 py-1.5 text-xs`}
                      />
                    </div>
                  </td>
                  {workingDays.map((day) => {
                    const key = cellKey(day, period);
                    const cell = cells[key] ?? { subjectId: "", label: "" };
                    return (
                      <td key={day} className="px-3 py-2.5">
                        <select
                          value={cell.subjectId}
                          onChange={(e) => updateCell(day, period, { subjectId: e.target.value })}
                          className={`${inputClass} mb-1 px-1.5 py-1.5 text-xs`}
                        >
                          <option value="">—</option>
                          {subjects
                            .filter((s) => s.status !== "disabled" || s.id === cell.subjectId)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                        </select>
                        {cell.subjectId ? (
                          findTeacherName(teachers, classId, cell.subjectId) && (
                            <p className="truncate text-[11px] text-stone-500">
                              {findTeacherName(teachers, classId, cell.subjectId)}
                            </p>
                          )
                        ) : (
                          <input
                            value={cell.label}
                            onChange={(e) => updateCell(day, period, { label: e.target.value })}
                            placeholder="Assembly, lunch..."
                            className={`${inputClass} px-1.5 py-1.5 text-xs`}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
