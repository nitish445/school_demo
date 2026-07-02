"use client";

import { orderBy, limit as fsLimit, where } from "firebase/firestore";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useEffectiveChildId } from "@/hooks/useEffectiveChildId";
import { useCollection } from "@/hooks/useCollection";
import { useDoc } from "@/hooks/useDoc";
import type { Student, Homework, Announcement, FeeRecord, AttendanceRecord, Exam } from "@/types/models";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function ParentDashboardPage() {
  const schoolId = useSchoolId();
  const { effectiveChildId, childStudentIds } = useEffectiveChildId();

  const { data: student } = useDoc<Student>(
    schoolId && effectiveChildId ? `schools/${schoolId}/students/${effectiveChildId}` : null
  );

  const { data: todayAttendance } = useCollection<AttendanceRecord>(
    schoolId && effectiveChildId ? `schools/${schoolId}/attendance` : null,
    effectiveChildId ? [where("studentId", "==", effectiveChildId), where("date", "==", todayIso())] : [],
    [effectiveChildId]
  );

  const { data: homework } = useCollection<Homework>(
    schoolId && effectiveChildId ? `schools/${schoolId}/homework` : null,
    effectiveChildId ? [where("studentIds", "array-contains", effectiveChildId)] : [],
    [effectiveChildId]
  );
  const pendingHomework = homework.filter((h) => h.submissions?.[effectiveChildId] !== "completed");

  const { data: exams } = useCollection<Exam>(
    schoolId ? `schools/${schoolId}/exams` : null,
    [where("published", "==", true)],
    []
  );

  const { data: fee } = useDoc<FeeRecord>(
    schoolId && effectiveChildId ? `schools/${schoolId}/fees/${effectiveChildId}` : null
  );

  const { data: announcements } = useCollection<Announcement>(
    schoolId ? `schools/${schoolId}/announcements` : null,
    [orderBy("createdAt", "desc"), fsLimit(3)],
    []
  );

  if (childStudentIds.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No children are linked to your account yet. Contact the school admin.
      </p>
    );
  }

  const pendingFees = fee ? Math.max(0, fee.totalDue - fee.totalPaid) : 0;
  const todayStatus = todayAttendance[0]?.status;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">{student?.name ?? "Dashboard"}</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Present Today</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {todayStatus ? todayStatus : "Not marked yet"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Pending Homework</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{pendingHomework.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Upcoming Exams</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{exams.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Fees Due</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">₹{pendingFees.toLocaleString()}</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Latest Notices</h2>
        {announcements.length === 0 ? (
          <p className="text-sm text-gray-500">No announcements yet.</p>
        ) : (
          <ul className="space-y-2">
            {announcements.map((a) => (
              <li key={a.id} className="border-b border-gray-100 pb-2 last:border-0">
                <p className="text-sm font-medium text-gray-900">{a.title}</p>
                <p className="text-sm text-gray-500">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
