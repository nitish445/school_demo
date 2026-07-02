"use client";

import { where } from "firebase/firestore";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useMyClassIds } from "@/hooks/useMyClassIds";
import { useCollection } from "@/hooks/useCollection";
import type { SchoolClass, Homework, Announcement } from "@/types/models";

export default function TeacherDashboardPage() {
  const schoolId = useSchoolId();
  const { classIds, teacher, loading: loadingProfile } = useMyClassIds();
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const { data: announcements } = useCollection<Announcement>(
    schoolId ? `schools/${schoolId}/announcements` : null
  );

  const myClasses = classes.filter((c) => classIds.includes(c.id));
  const homeworkPath = schoolId ? `schools/${schoolId}/homework` : null;
  const { data: homework } = useCollection<Homework>(
    homeworkPath,
    classIds.length > 0 ? [where("classId", "in", classIds.slice(0, 10))] : [],
    [classIds.join(",")]
  );

  if (loadingProfile) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">
        {teacher?.classTeacherOf ? "Class Teacher Dashboard" : "Teacher Dashboard"}
      </h1>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Your Classes</h2>
        {myClasses.length === 0 ? (
          <p className="text-sm text-gray-500">
            No classes assigned yet — ask your admin to assign you.
          </p>
        ) : (
          <p className="text-sm text-gray-700">
            {myClasses.map((c) => `${c.grade}-${c.section}`).join(", ")}
          </p>
        )}
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Homework Due Soon</h2>
        {homework.length === 0 ? (
          <p className="text-sm text-gray-500">No homework assigned yet.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {homework.slice(0, 5).map((h) => (
              <li key={h.id}>
                {h.title} — due {h.dueDate}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Latest Announcements</h2>
        {announcements.length === 0 ? (
          <p className="text-sm text-gray-500">No announcements yet.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {announcements.slice(0, 5).map((a) => (
              <li key={a.id}>{a.title}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
