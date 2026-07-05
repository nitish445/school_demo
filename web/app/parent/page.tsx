"use client";

import { orderBy, limit as fsLimit, where } from "firebase/firestore";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useEffectiveChildId } from "@/hooks/useEffectiveChildId";
import { useCollection } from "@/hooks/useCollection";
import { useDoc } from "@/hooks/useDoc";
import type { Student, Homework, Announcement, FeeRecord, AttendanceRecord, Exam } from "@/types/models";
import { CalendarCheck, NotebookPen, ClipboardList, Wallet, Megaphone, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const ATTENDANCE_LABEL: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  halfDay: "Half Day",
  medicalLeave: "Medical Leave",
};

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
      <EmptyState
        icon={Users}
        title="No children are linked to your account yet"
        description="Contact the school admin to get your child linked."
      />
    );
  }

  const pendingFees = fee ? Math.max(0, fee.totalDue - fee.totalPaid) : 0;
  const todayStatus = todayAttendance[0]?.status;

  return (
    <div>
      <PageHeader title={student?.name ?? "Dashboard"} />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Present Today"
          value={todayStatus ? ATTENDANCE_LABEL[todayStatus] ?? todayStatus : "Unmarked"}
          icon={CalendarCheck}
          tint="emerald"
        />
        <StatCard label="Pending Homework" value={pendingHomework.length} icon={NotebookPen} tint="gold" />
        <StatCard label="Upcoming Exams" value={exams.length} icon={ClipboardList} tint="sky" />
        <StatCard label="Fees Due" value={`₹${pendingFees.toLocaleString()}`} icon={Wallet} tint="amber" />
      </div>

      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
          <Megaphone className="h-4 w-4 text-stone-400" strokeWidth={2} />
          Latest Notices
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
