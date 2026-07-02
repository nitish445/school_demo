"use client";

import { useState } from "react";
import { where } from "firebase/firestore";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useMyClassIds } from "@/hooks/useMyClassIds";
import { useCollection } from "@/hooks/useCollection";
import type { SchoolClass, Student } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { inputClass, labelClass } from "@/components/ui/formStyles";

export default function TeacherStudentsPage() {
  const schoolId = useSchoolId();
  const { classIds } = useMyClassIds();
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const myClasses = classes.filter((c) => classIds.includes(c.id));

  const [classId, setClassId] = useState("");
  const effectiveClassId = classId || myClasses[0]?.id || "";

  const { data: students, loading } = useCollection<Student>(
    schoolId && effectiveClassId ? `schools/${schoolId}/students` : null,
    effectiveClassId ? [where("classId", "==", effectiveClassId)] : [],
    [effectiveClassId]
  );

  const [viewing, setViewing] = useState<Student | null>(null);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Students</h1>

      <div className="mb-6">
        <label className={labelClass}>Class</label>
        <select
          value={effectiveClassId}
          onChange={(e) => setClassId(e.target.value)}
          className={inputClass}
        >
          {myClasses.length === 0 && <option value="">No classes assigned</option>}
          {myClasses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.grade}-{c.section}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <DataTable
          rows={students.filter((s) => s.status === "active")}
          emptyMessage="No students in this class."
          columns={[
            { header: "Roll No.", render: (s) => s.rollNo },
            { header: "Name", render: (s) => s.name },
            {
              header: "",
              render: (s) => (
                <button onClick={() => setViewing(s)} className="text-sm text-gray-700 hover:underline">
                  View
                </button>
              ),
            },
          ]}
        />
      )}

      <Modal open={!!viewing} title={viewing?.name ?? ""} onClose={() => setViewing(null)}>
        {viewing && (
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="font-medium text-gray-600">Admission No.</dt>
              <dd className="text-gray-900">{viewing.admissionNo}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-600">Date of Birth</dt>
              <dd className="text-gray-900">{viewing.dob ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-600">Emergency Contact</dt>
              <dd className="text-gray-900">{viewing.emergencyContact ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-600">Medical Notes</dt>
              <dd className="text-gray-900">{viewing.medicalNotes ?? "—"}</dd>
            </div>
          </dl>
        )}
      </Modal>
    </div>
  );
}
