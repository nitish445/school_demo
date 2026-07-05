"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useEffectiveChildId } from "@/hooks/useEffectiveChildId";
import { useParentProfile } from "@/hooks/useParentProfile";
import { useDoc } from "@/hooks/useDoc";
import type { Student } from "@/types/models";
import { Hash, ScanLine, HeartPulse } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { ProfileHero } from "@/components/ui/ProfileHero";

export default function ParentProfilePage() {
  const { user, profile } = useAuth();
  const schoolId = useSchoolId();
  const { effectiveChildId, childStudentIds } = useEffectiveChildId();
  const { data: parent } = useParentProfile();
  const { data: student } = useDoc<Student>(
    schoolId && effectiveChildId ? `schools/${schoolId}/students/${effectiveChildId}` : null
  );

  if (!user) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <ProfileHero
        uid={user.uid}
        name={profile?.displayName ?? parent?.name ?? "Parent"}
        subtitle={user.email ?? undefined}
        photoUrl={profile?.photoUrl}
        extraDocPaths={schoolId ? [`schools/${schoolId}/parents/${user.uid}`] : []}
      />

      {childStudentIds.length === 0 ? (
        <p className="text-sm text-stone-500">No children are linked to your account yet.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Admission No." value={student?.admissionNo ?? "—"} icon={Hash} tint="sky" />
            <StatCard label="Roll No." value={student?.rollNo ?? "—"} icon={ScanLine} tint="amber" />
          </div>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-stone-900">Student Details</h2>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-medium text-stone-600">Name</dt>
                <dd className="text-stone-900">{student?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-stone-600">Date of Birth</dt>
                <dd className="text-stone-900">{student?.dob ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-stone-600">Address</dt>
                <dd className="text-stone-900">{student?.address ?? "—"}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
              <HeartPulse className="h-4 w-4 text-stone-400" strokeWidth={2} />
              Emergency &amp; Medical
            </h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="font-medium text-stone-600">Emergency Contact</dt>
                <dd className="text-stone-900">{student?.emergencyContact ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-stone-600">Medical Notes</dt>
                <dd className="text-stone-900">{student?.medicalNotes ?? "—"}</dd>
              </div>
            </dl>
          </Card>
        </>
      )}
    </div>
  );
}
