"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useTeacherProfile } from "@/hooks/useTeacherProfile";
import { useCollection } from "@/hooks/useCollection";
import type { SchoolClass, Subject } from "@/types/models";
import { IdCard, School, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { ProfileHero } from "@/components/ui/ProfileHero";

export default function TeacherProfilePage() {
  const { user, profile } = useAuth();
  const schoolId = useSchoolId();
  const { data: teacher } = useTeacherProfile();
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const { data: subjects } = useCollection<Subject>(schoolId ? `schools/${schoolId}/subjects` : null);

  const homeRoom = classes.find((c) => c.id === teacher?.classTeacherOf);
  const taught = (teacher?.assignments ?? [])
    .map((a) => {
      const c = classes.find((c) => c.id === a.classId);
      const s = subjects.find((s) => s.id === a.subjectId);
      return c && s ? `${s.name} (${c.grade}-${c.section})` : null;
    })
    .filter(Boolean);

  if (!user) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <ProfileHero
        uid={user.uid}
        name={profile?.displayName ?? teacher?.name ?? "Teacher"}
        subtitle={user.email ?? undefined}
        photoUrl={profile?.photoUrl}
        extraDocPaths={schoolId ? [`schools/${schoolId}/teachers/${user.uid}`] : []}
        badges={
          <>
            <Badge variant="neutral">{profile?.role === "classTeacher" ? "Class Teacher" : "Subject Teacher"}</Badge>
            {profile?.status === "disabled" ? (
              <Badge variant="warning">Disabled</Badge>
            ) : (
              <Badge variant="success">Active</Badge>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Employee ID" value={teacher?.employeeId || "—"} icon={IdCard} tint="sky" />
        <StatCard
          label="Class Teacher Of"
          value={homeRoom ? `${homeRoom.grade}-${homeRoom.section}` : "—"}
          icon={School}
          tint="emerald"
        />
      </div>

      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
          <BookOpen className="h-4 w-4 text-stone-400" strokeWidth={2} />
          Subjects Taught
        </h2>
        {taught.length === 0 ? (
          <p className="text-sm text-stone-500">No subjects assigned yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {taught.map((t) => (
              <span key={t} className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                {t}
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
