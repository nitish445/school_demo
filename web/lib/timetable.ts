import type { SchoolClass, Subject, Teacher, Timetable, TimetablePeriod } from "@/types/models";

/**
 * Only the periods a teacher personally teaches, merged across every class
 * they're assigned a subject in (including their own home room, if they
 * teach a subject there too). Periods are stored per-class, so each merged
 * entry's label is rewritten to "Subject (Class)" to keep the class visible
 * once pooled into one weekly view. Shared by the teacher and admin
 * Timetable pages -- an admin who's also a teacher sees the same thing.
 */
/** The teacher assigned to teach `subjectId` in `classId`, if any. */
export function findTeacherName(
  teachers: Teacher[],
  classId: string,
  subjectId: string | undefined
): string | undefined {
  if (!subjectId) return undefined;
  return teachers.find((t) => t.assignments.some((a) => a.classId === classId && a.subjectId === subjectId))?.name;
}

export function buildMyPeriods({
  myClasses,
  teacher,
  timetables,
  subjects,
}: {
  myClasses: SchoolClass[];
  teacher: Teacher | null | undefined;
  timetables: Timetable[];
  subjects: Subject[];
}): TimetablePeriod[] {
  const periods: TimetablePeriod[] = [];
  for (const c of myClasses) {
    const mySubjectIds = new Set(
      (teacher?.assignments ?? []).filter((a) => a.classId === c.id).map((a) => a.subjectId)
    );
    const timetable = timetables.find((t) => t.id === c.id);
    for (const p of timetable?.periods ?? []) {
      if (!p.subjectId || !mySubjectIds.has(p.subjectId)) continue;
      const subjectName = subjects.find((s) => s.id === p.subjectId)?.name ?? p.subjectId;
      periods.push({
        day: p.day,
        period: p.period,
        label: `${subjectName} (${c.grade}-${c.section})`,
        startTime: p.startTime,
        endTime: p.endTime,
      });
    }
  }
  return periods;
}
