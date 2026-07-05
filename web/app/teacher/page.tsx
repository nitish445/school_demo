"use client";

import { where } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useMyClassIds } from "@/hooks/useMyClassIds";
import { useCollection } from "@/hooks/useCollection";
import type { SchoolClass, Homework, Announcement, Leave, Student } from "@/types/models";
import { School, NotebookPen, Megaphone, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { approveLeave, rejectLeave } from "@/lib/leave";

export default function TeacherDashboardPage() {
  const schoolId = useSchoolId();
  const { user } = useAuth();
  const { classIds, teacher, loading: loadingProfile } = useMyClassIds();
  const homeClassId = teacher?.classTeacherOf ?? "";
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

  const { data: pendingLeaves } = useCollection<Leave>(
    schoolId && homeClassId ? `schools/${schoolId}/leaves` : null,
    homeClassId ? [where("classId", "==", homeClassId), where("status", "==", "pending")] : [],
    [homeClassId]
  );
  const { data: homeClassStudents } = useCollection<Student>(
    schoolId && homeClassId ? `schools/${schoolId}/students` : null,
    homeClassId ? [where("classId", "==", homeClassId)] : [],
    [homeClassId]
  );

  async function handleApprove(l: Leave) {
    if (!schoolId || !user) return;
    await approveLeave(schoolId, l, user.uid);
  }

  async function handleReject(l: Leave) {
    if (!schoolId || !user) return;
    await rejectLeave(schoolId, l.id, user.uid);
  }

  if (loadingProfile) {
    return <Spinner />;
  }

  return (
    <div>
      <PageHeader title={teacher?.classTeacherOf ? "Class Teacher Dashboard" : "Teacher Dashboard"} />

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
            <School className="h-4 w-4 text-stone-400" strokeWidth={2} />
            Your Classes
          </h2>
          {myClasses.length === 0 ? (
            <EmptyState
              icon={School}
              title="No classes assigned yet"
              description="Ask your admin to assign you to a class."
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {myClasses.map((c) => (
                <span
                  key={c.id}
                  className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800"
                >
                  {c.grade}-{c.section}
                </span>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
            <NotebookPen className="h-4 w-4 text-stone-400" strokeWidth={2} />
            Homework Due Soon
          </h2>
          {homework.length === 0 ? (
            <EmptyState icon={NotebookPen} title="No homework assigned yet" />
          ) : (
            <ul className="space-y-2">
              {homework.slice(0, 5).map((h) => (
                <li key={h.id} className="flex items-center justify-between text-sm">
                  <span className="text-stone-900">{h.title}</span>
                  <span className="text-stone-500">due {h.dueDate}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {homeClassId && (
        <Card className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
            <CalendarClock className="h-4 w-4 text-stone-400" strokeWidth={2} />
            Pending Leave Requests
          </h2>
          {pendingLeaves.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No pending leave requests" />
          ) : (
            <ul className="space-y-3">
              {pendingLeaves.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-stone-900">
                      {homeClassStudents.find((s) => s.id === l.studentId)?.name ?? l.studentId}
                    </p>
                    <p className="text-sm text-stone-500">
                      {l.fromDate} → {l.toDate} — {l.reason}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => handleApprove(l)} className="text-sm text-emerald-700 hover:underline">
                      Approve
                    </button>
                    <button onClick={() => handleReject(l)} className="text-sm text-rose-600 hover:underline">
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
          <Megaphone className="h-4 w-4 text-stone-400" strokeWidth={2} />
          Latest Announcements
        </h2>
        {announcements.length === 0 ? (
          <EmptyState icon={Megaphone} title="No announcements yet" />
        ) : (
          <ul className="space-y-2">
            {announcements.slice(0, 5).map((a) => (
              <li key={a.id} className="text-sm text-stone-900">
                {a.title}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
