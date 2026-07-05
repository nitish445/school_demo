"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import { orderBy, limit as fsLimit, where } from "firebase/firestore";
import type { Student, Teacher, Announcement, FeeRecord, AttendanceRecord, Leave, SchoolClass } from "@/types/models";
import { GraduationCap, Users, CalendarCheck, Wallet, Megaphone, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { approveLeave, rejectLeave } from "@/lib/leave";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminDashboardPage() {
  const schoolId = useSchoolId();
  const { user } = useAuth();

  const { data: students, loading: loadingStudents } = useCollection<Student>(
    schoolId ? `schools/${schoolId}/students` : null
  );
  const { data: teachers, loading: loadingTeachers } = useCollection<Teacher>(
    schoolId ? `schools/${schoolId}/teachers` : null
  );
  const { data: fees, loading: loadingFees } = useCollection<FeeRecord>(
    schoolId ? `schools/${schoolId}/fees` : null
  );
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
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
  const { data: pendingLeaves } = useCollection<Leave>(
    schoolId ? `schools/${schoolId}/leaves` : null,
    [where("status", "==", "pending")],
    [schoolId]
  );

  const activeStudents = students.filter((s) => s.status === "active");
  const pendingFees = fees.reduce((sum, f) => sum + Math.max(0, f.totalDue - f.totalPaid), 0);
  const presentToday = todayAttendance.filter((a) => a.status === "present" || a.status === "late").length;
  const attendancePct =
    todayAttendance.length > 0 ? Math.round((presentToday / todayAttendance.length) * 100) : null;
  const loading = loadingStudents || loadingTeachers || loadingFees;

  async function handleApprove(l: Leave) {
    if (!schoolId || !user) return;
    await approveLeave(schoolId, l, user.uid);
  }

  async function handleReject(l: Leave) {
    if (!schoolId || !user) return;
    await rejectLeave(schoolId, l.id, user.uid);
  }

  return (
    <div>
      <PageHeader title="Dashboard" description="A quick look at how your school is doing today." />

      {loading ? (
        <Spinner className="mb-8 py-10" />
      ) : (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Students" value={activeStudents.length} icon={GraduationCap} tint="gold" />
          <StatCard label="Total Teachers" value={teachers.length} icon={Users} tint="sky" />
          <StatCard
            label="Today's Attendance"
            value={attendancePct === null ? "—" : `${attendancePct}%`}
            icon={CalendarCheck}
            tint="emerald"
          />
          <StatCard label="Pending Fees" value={`₹${pendingFees.toLocaleString()}`} icon={Wallet} tint="amber" />
        </div>
      )}

      <Card className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
          <CalendarClock className="h-4 w-4 text-stone-400" strokeWidth={2} />
          Pending Leave Requests
        </h2>
        {pendingLeaves.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No pending leave requests" />
        ) : (
          <ul className="space-y-3">
            {pendingLeaves.map((l) => {
              const student = students.find((s) => s.id === l.studentId);
              const cls = classes.find((c) => c.id === l.classId);
              return (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-stone-900">
                      {student?.name ?? l.studentId}
                      {cls && <span className="ml-2 text-stone-400">{cls.grade}-{cls.section}</span>}
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
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
          <Megaphone className="h-4 w-4 text-stone-400" strokeWidth={2} />
          Latest Announcements
        </h2>
        {announcements.length === 0 ? (
          <EmptyState icon={Megaphone} title="No announcements yet" />
        ) : (
          <ul className="space-y-3">
            {announcements.map((a) => (
              <li key={a.id} className="border-b border-stone-100 pb-3 last:border-0 last:pb-0">
                <p className="text-sm font-medium text-stone-900">{a.title}</p>
                <p className="mt-0.5 text-sm text-stone-500">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
