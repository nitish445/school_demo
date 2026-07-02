"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useEffectiveChildId } from "@/hooks/useEffectiveChildId";
import { useParentProfile } from "@/hooks/useParentProfile";
import { useDoc } from "@/hooks/useDoc";
import type { Student } from "@/types/models";

export default function ParentProfilePage() {
  const { user } = useAuth();
  const schoolId = useSchoolId();
  const { effectiveChildId, childStudentIds } = useEffectiveChildId();
  const { data: parent } = useParentProfile();
  const { data: student } = useDoc<Student>(
    schoolId && effectiveChildId ? `schools/${schoolId}/students/${effectiveChildId}` : null
  );

  if (childStudentIds.length === 0) {
    return <p className="text-sm text-gray-500">No children are linked to your account yet.</p>;
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Profile</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Student Details</h2>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="font-medium text-gray-600">Name</dt>
            <dd className="text-gray-900">{student?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-600">Admission No.</dt>
            <dd className="text-gray-900">{student?.admissionNo ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-600">Roll No.</dt>
            <dd className="text-gray-900">{student?.rollNo ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-600">Date of Birth</dt>
            <dd className="text-gray-900">{student?.dob ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Emergency &amp; Medical</h2>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="font-medium text-gray-600">Emergency Contact</dt>
            <dd className="text-gray-900">{student?.emergencyContact ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-600">Medical Notes</dt>
            <dd className="text-gray-900">{student?.medicalNotes ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Parent Details</h2>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="font-medium text-gray-600">Name</dt>
            <dd className="text-gray-900">{parent?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-600">Email</dt>
            <dd className="text-gray-900">{user?.email}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
