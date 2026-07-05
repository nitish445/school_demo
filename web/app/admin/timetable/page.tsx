"use client";

import { useState } from "react";
import { doc, documentId, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSchool } from "@/hooks/useSchool";
import { useMyClassIds } from "@/hooks/useMyClassIds";
import { useCollection } from "@/hooks/useCollection";
import type { SchoolClass, Subject, Teacher, Timetable } from "@/types/models";
import { TimetableEditor } from "@/components/timetable/TimetableEditor";
import { TimetableGrid } from "@/components/timetable/TimetableGrid";
import { Card } from "@/components/ui/Card";
import { buildMyPeriods } from "@/lib/timetable";
import { inputClass, labelClass } from "@/components/ui/formStyles";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5, 6];

export default function AdminTimetablePage() {
  const schoolId = useSchoolId();
  const { data: school } = useSchool();
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const { data: subjects } = useCollection<Subject>(schoolId ? `schools/${schoolId}/subjects` : null);
  const { data: teachers } = useCollection<Teacher>(schoolId ? `schools/${schoolId}/teachers` : null);

  // Some admins (e.g. a Principal who's also a class/subject teacher) have a
  // teachers/{uid} doc alongside their admin role -- if so, show their own
  // teaching schedule too, same as the Teacher portal's Timetable page.
  const { classIds: myClassIds, teacher: myTeacherProfile } = useMyClassIds();
  const myClasses = classes.filter((c) => myClassIds.includes(c.id));
  const homeRoomClass = classes.find((c) => c.id === myTeacherProfile?.classTeacherOf);
  const { data: myTimetables } = useCollection<Timetable>(
    schoolId && myClassIds.length > 0 ? `schools/${schoolId}/timetables` : null,
    myClassIds.length > 0 ? [where(documentId(), "in", myClassIds.slice(0, 10))] : [],
    [myClassIds.join(",")]
  );

  const [classId, setClassId] = useState("");
  const effectiveClassId = classId || classes[0]?.id || "";
  const effectiveClass = classes.find((c) => c.id === effectiveClassId);

  const workingDays = school?.workingDays ?? DEFAULT_WORKING_DAYS;
  const myPeriods = buildMyPeriods({ myClasses, teacher: myTeacherProfile, timetables: myTimetables, subjects });

  async function toggleWorkingDay(day: number) {
    if (!schoolId) return;
    const next = workingDays.includes(day)
      ? workingDays.filter((d) => d !== day)
      : [...workingDays, day].sort((a, b) => a - b);
    await updateDoc(doc(db, `schools/${schoolId}`), { workingDays: next });
  }

  return (
    <div className="space-y-8">
      {myClassIds.length > 0 && (
        <div className="space-y-6">
          <div>
            <h1 className="mb-1 text-2xl font-semibold tracking-tight text-stone-900">My Timetable</h1>
            <p className="mb-4 text-sm text-stone-500">
              Every period you personally teach, across all your classes.
            </p>
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
      )}

      <div>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">School Timetable</h1>

        <div className="mb-6 flex flex-wrap items-end gap-6">
          <div>
            <label className={labelClass}>Class</label>
            <select value={effectiveClassId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
              {classes.length === 0 && <option value="">No classes yet</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.grade}-{c.section}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>School Days</label>
            <div className="flex gap-2">
              {DAY_NAMES.map((name, day) => (
                <label
                  key={day}
                  className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border text-xs font-medium transition ${
                    workingDays.includes(day)
                      ? "border-amber-300 bg-amber-100 text-amber-900"
                      : "border-stone-200 bg-white text-stone-400"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={workingDays.includes(day)}
                    onChange={() => toggleWorkingDay(day)}
                    className="hidden"
                  />
                  {name[0]}
                </label>
              ))}
            </div>
          </div>
        </div>

        {effectiveClassId && (
          <TimetableEditor
            schoolId={schoolId}
            classId={effectiveClassId}
            classLabel={effectiveClass ? `${effectiveClass.grade}-${effectiveClass.section}` : effectiveClassId}
            workingDays={workingDays}
            subjects={subjects}
            teachers={teachers}
          />
        )}
      </div>
    </div>
  );
}
