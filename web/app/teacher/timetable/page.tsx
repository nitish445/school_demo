"use client";

import { documentId, where } from "firebase/firestore";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSchool } from "@/hooks/useSchool";
import { useMyClassIds } from "@/hooks/useMyClassIds";
import { useCollection } from "@/hooks/useCollection";
import type { SchoolClass, Subject, Teacher, Timetable } from "@/types/models";
import { Card } from "@/components/ui/Card";
import { TimetableGrid } from "@/components/timetable/TimetableGrid";
import { TimetableEditor } from "@/components/timetable/TimetableEditor";
import { buildMyPeriods } from "@/lib/timetable";

const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5, 6];

export default function TeacherTimetablePage() {
  const schoolId = useSchoolId();
  const { data: school } = useSchool();
  const { classIds, teacher, loading: loadingProfile } = useMyClassIds();
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const { data: subjects } = useCollection<Subject>(schoolId ? `schools/${schoolId}/subjects` : null);
  const { data: teachers } = useCollection<Teacher>(schoolId ? `schools/${schoolId}/teachers` : null);

  const { data: timetables, loading } = useCollection<Timetable>(
    schoolId && classIds.length > 0 ? `schools/${schoolId}/timetables` : null,
    classIds.length > 0 ? [where(documentId(), "in", classIds.slice(0, 10))] : [],
    [classIds.join(",")]
  );

  const workingDays = school?.workingDays ?? DEFAULT_WORKING_DAYS;
  const myClasses = classes.filter((c) => classIds.includes(c.id));
  const homeRoomClass = classes.find((c) => c.id === teacher?.classTeacherOf);

  const myPeriods = buildMyPeriods({ myClasses, teacher, timetables, subjects });

  if (loading || loadingProfile) {
    return <p className="text-sm text-stone-500">Loading...</p>;
  }

  if (myClasses.length === 0) {
    return <p className="text-sm text-stone-500">You're not assigned to any classes yet.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-stone-900">My Timetable</h1>
        <p className="mb-4 text-sm text-stone-500">Every period you personally teach, across all your classes.</p>
        <Card>
          <TimetableGrid periods={myPeriods} workingDays={workingDays} subjects={subjects} />
        </Card>
      </div>

      {homeRoomClass && (
        <div>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight text-stone-900">
            Class Teacher Timetable — {homeRoomClass.grade}-{homeRoomClass.section}
          </h1>
          <p className="mb-4 text-sm text-stone-500">
            The full schedule for your home-room class, including periods other teachers take.
          </p>
          <Card>
            <TimetableEditor
              schoolId={schoolId}
              classId={homeRoomClass.id}
              classLabel={`${homeRoomClass.grade}-${homeRoomClass.section}`}
              workingDays={workingDays}
              subjects={subjects}
              teachers={teachers}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
