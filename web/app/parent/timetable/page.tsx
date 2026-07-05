"use client";

import { useSchoolId } from "@/hooks/useSchoolId";
import { useSchool } from "@/hooks/useSchool";
import { useEffectiveChildId } from "@/hooks/useEffectiveChildId";
import { useCollection } from "@/hooks/useCollection";
import { useDoc } from "@/hooks/useDoc";
import type { Student, Subject, Teacher, Timetable } from "@/types/models";
import { TimetableGrid } from "@/components/timetable/TimetableGrid";

const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5, 6];

export default function ParentTimetablePage() {
  const schoolId = useSchoolId();
  const { data: school } = useSchool();
  const { effectiveChildId, childStudentIds } = useEffectiveChildId();
  const { data: student } = useDoc<Student>(
    schoolId && effectiveChildId ? `schools/${schoolId}/students/${effectiveChildId}` : null
  );
  const { data: subjects } = useCollection<Subject>(schoolId ? `schools/${schoolId}/subjects` : null);
  const { data: teachers } = useCollection<Teacher>(schoolId ? `schools/${schoolId}/teachers` : null);
  const { data: timetable, loading } = useDoc<Timetable>(
    schoolId && student?.classId ? `schools/${schoolId}/timetables/${student.classId}` : null
  );

  const workingDays = school?.workingDays ?? DEFAULT_WORKING_DAYS;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">Timetable</h1>

      {childStudentIds.length === 0 ? (
        <p className="text-sm text-stone-500">No children are linked to your account yet.</p>
      ) : loading ? (
        <p className="text-sm text-stone-500">Loading...</p>
      ) : (
        <TimetableGrid
          periods={timetable?.periods ?? []}
          workingDays={workingDays}
          subjects={subjects}
          classId={student?.classId}
          teachers={teachers}
        />
      )}
    </div>
  );
}
