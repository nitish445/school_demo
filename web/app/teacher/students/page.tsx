"use client";

import { useState } from "react";
import { where } from "firebase/firestore";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useMyClassIds } from "@/hooks/useMyClassIds";
import { useCollection } from "@/hooks/useCollection";
import type { SchoolClass, Student } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { ReportCard } from "@/components/ReportCard";
import { inputClass, labelClass } from "@/components/ui/formStyles";
import { downloadMarksheetsPdf } from "@/lib/marksheetPdf";

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
  const activeStudents = students.filter((s) => s.status === "active");

  const [viewing, setViewing] = useState<Student | null>(null);
  const [reportCardStudent, setReportCardStudent] = useState<Student | null>(null);
  const [downloadingSingle, setDownloadingSingle] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  async function downloadSinglePdf(student: Student) {
    if (!schoolId) return;
    setDownloadingSingle(true);
    try {
      await downloadMarksheetsPdf(schoolId, [student], `${student.name} - Report Card.pdf`);
    } finally {
      setDownloadingSingle(false);
    }
  }

  async function downloadAllPdf() {
    if (!schoolId || activeStudents.length === 0) return;
    setDownloadingAll(true);
    try {
      const cls = classes.find((c) => c.id === effectiveClassId);
      const label = cls ? `${cls.grade}-${cls.section}` : "Class";
      await downloadMarksheetsPdf(schoolId, activeStudents, `${label} - Marksheets.pdf`);
    } finally {
      setDownloadingAll(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Students</h1>
        <button
          onClick={downloadAllPdf}
          disabled={downloadingAll || activeStudents.length === 0}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {downloadingAll ? "Preparing..." : "Download All Marksheets (PDF)"}
        </button>
      </div>

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
        <p className="text-sm text-stone-500">Loading...</p>
      ) : (
        <DataTable
          rows={activeStudents}
          emptyMessage="No students in this class."
          columns={[
            { header: "Roll No.", render: (s) => s.rollNo },
            { header: "Name", render: (s) => s.name },
            {
              header: "",
              render: (s) => (
                <div className="flex gap-3">
                  <button onClick={() => setViewing(s)} className="text-sm text-stone-700 hover:underline">
                    View
                  </button>
                  <button onClick={() => setReportCardStudent(s)} className="text-sm text-blue-700 hover:underline">
                    Report Card
                  </button>
                  <button
                    onClick={() => downloadSinglePdf(s)}
                    disabled={downloadingSingle}
                    className="text-sm text-blue-700 hover:underline disabled:opacity-50"
                  >
                    Download PDF
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal open={!!viewing} title={viewing?.name ?? ""} onClose={() => setViewing(null)}>
        {viewing && (
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="font-medium text-stone-600">Admission No.</dt>
              <dd className="text-stone-900">{viewing.admissionNo}</dd>
            </div>
            <div>
              <dt className="font-medium text-stone-600">Date of Birth</dt>
              <dd className="text-stone-900">{viewing.dob ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-stone-600">Emergency Contact</dt>
              <dd className="text-stone-900">{viewing.emergencyContact ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-stone-600">Medical Notes</dt>
              <dd className="text-stone-900">{viewing.medicalNotes ?? "—"}</dd>
            </div>
          </dl>
        )}
      </Modal>

      <Modal
        open={!!reportCardStudent}
        title={reportCardStudent ? `${reportCardStudent.name} — Report Card` : ""}
        onClose={() => setReportCardStudent(null)}
      >
        {reportCardStudent && schoolId && (
          <>
            <button
              onClick={() => downloadSinglePdf(reportCardStudent)}
              disabled={downloadingSingle}
              className="mb-4 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {downloadingSingle ? "Preparing PDF..." : "Download PDF"}
            </button>
            <ReportCard schoolId={schoolId} studentId={reportCardStudent.id} />
          </>
        )}
      </Modal>
    </div>
  );
}
