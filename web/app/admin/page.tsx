"use client";

import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import { orderBy, limit as fsLimit, where } from "firebase/firestore";
import type { Student, Teacher, Announcement, FeeRecord, AttendanceRecord } from "@/types/models";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const schoolId = useSchoolId();

  const { data: students, loading: loadingStudents } = useCollection<Student>(
    schoolId ? `schools/${schoolId}/students` : null
  );
  const { data: teachers, loading: loadingTeachers } = useCollection<Teacher>(
    schoolId ? `schools/${schoolId}/teachers` : null
  );
  const { data: fees, loading: loadingFees } = useCollection<FeeRecord>(
    schoolId ? `schools/${schoolId}/fees` : null
  );
  const { data: announcements } = useCollection<Announcement>(
    schoolId ? `schools/${schoolId}/announcements` : null,
    [orderBy("createdAt", "desc"), fsLimit(5)],
    []
  );
  const { data: todayAttendance } = useCollection<AttendanceRecord>(
    schoolId ? `schools/${schoolId}/attendance` : null,
    [where("date", "==", todayIso())],
    [schoolId]
  );

  const activeStudents = students.filter((s) => s.status === "active");
  const pendingFees = fees.reduce((sum, f) => sum + Math.max(0, f.totalDue - f.totalPaid), 0);
  const presentToday = todayAttendance.filter((a) => a.status === "present" || a.status === "late").length;
  const attendancePct =
    todayAttendance.length > 0 ? Math.round((presentToday / todayAttendance.length) * 100) : null;
  const loading = loadingStudents || loadingTeachers || loadingFees;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Dashboard</h1>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Students" value={activeStudents.length} />
          <StatCard label="Total Teachers" value={teachers.length} />
          <StatCard
            label="Today's Attendance"
            value={attendancePct === null ? "—" : `${attendancePct}%`}
          />
          <StatCard label="Pending Fees" value={`₹${pendingFees.toLocaleString()}`} />
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Latest Announcements</h2>
        {announcements.length === 0 ? (
          <p className="text-sm text-gray-500">No announcements yet.</p>
        ) : (
          <ul className="space-y-3">
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
