import type { Subject, Teacher, TimetablePeriod } from "@/types/models";
import { findTeacherName } from "@/lib/timetable";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function TimetableGrid({
  periods,
  workingDays,
  subjects,
  classId,
  teachers,
}: {
  periods: TimetablePeriod[];
  workingDays: number[];
  subjects: Subject[];
  /** Needed together with `teachers` to show who teaches each period; omit for merged/personal views. */
  classId?: string;
  teachers?: Teacher[];
}) {
  if (periods.length === 0) {
    return <p className="text-sm text-stone-500">No timetable has been set up for this class yet.</p>;
  }

  const days = [...workingDays].sort((a, b) => a - b);
  const periodNumbers = Array.from(
    { length: Math.max(6, ...periods.map((p) => p.period)) },
    (_, i) => i + 1
  );

  function cellFor(day: number, period: number) {
    return periods.find((p) => p.day === day && p.period === period);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200/80 bg-white shadow-[0_2px_10px_-2px_rgba(41,27,10,0.06)]">
      <table className="min-w-full divide-y divide-stone-200 text-sm">
        <thead className="bg-stone-50">
          <tr>
            <th className="px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-stone-500 uppercase">
              Period
            </th>
            {days.map((d) => (
              <th
                key={d}
                className="px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-stone-500 uppercase"
              >
                {DAY_NAMES[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 bg-white">
          {periodNumbers.map((period) => (
            <tr key={period}>
              <td className="px-4 py-2.5 font-medium text-stone-700">{period}</td>
              {days.map((day) => {
                const cell = cellFor(day, period);
                const subject = cell?.subjectId ? subjects.find((s) => s.id === cell.subjectId) : undefined;
                const teacherName =
                  cell && classId && teachers ? findTeacherName(teachers, classId, cell.subjectId) : undefined;
                return (
                  <td key={day} className="px-4 py-2.5 text-stone-700">
                    {cell ? (
                      <div>
                        <p className="font-medium text-stone-900">{subject?.name ?? cell.label ?? "—"}</p>
                        {teacherName && <p className="text-xs text-stone-500">{teacherName}</p>}
                        {(cell.startTime || cell.endTime) && (
                          <p className="text-xs text-stone-500">
                            {cell.startTime ?? ""}
                            {cell.startTime && cell.endTime ? "–" : ""}
                            {cell.endTime ?? ""}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
