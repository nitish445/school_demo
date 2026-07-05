"use client";

import { useMemo, useState } from "react";
import { collection, doc, writeBatch, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import { useCsvUpload } from "@/hooks/useCsvUpload";
import type { Student, SchoolClass, Parent } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  cardClass,
  pageHeadingClass,
} from "@/components/ui/formStyles";
import { Spinner } from "@/components/ui/Spinner";
import { ReportCard } from "@/components/ReportCard";
import { createAuthUser, writeAccountProfile, describeAuthError } from "@/lib/createAccount";
import { logActivity } from "@/lib/auditLog";
import { downloadMarksheetsPdf } from "@/lib/marksheetPdf";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const BATCH_CHUNK_SIZE = 450;

interface StudentCsvRow {
  rowNum: number;
  name: string;
  admissionNo: string;
  rollNo: string;
  classId: string;
  sectionId: string;
  dob: string;
  gender: string;
  address: string;
  emergencyContact: string;
  medicalNotes: string;
  parentName: string;
  parentEmail: string;
  parentPassword: string;
  parentPhone: string;
  matchedParentId: string | null;
  error?: string;
}

interface StudentImportResult {
  rowNum: number;
  name: string;
  admissionNo: string;
  status: string;
  ok: boolean;
}

const emptyForm = {
  name: "",
  admissionNo: "",
  rollNo: "",
  classId: "",
  dob: "",
  gender: "" as "" | "male" | "female" | "other",
  parentIds: [] as string[],
  address: "",
  emergencyContact: "",
  medicalNotes: "",
};

export default function StudentsPage() {
  const schoolId = useSchoolId();
  const { user } = useAuth();
  const { data: students, loading } = useCollection<Student>(
    schoolId ? `schools/${schoolId}/students` : null
  );
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const { data: parents } = useCollection<Parent>(schoolId ? `schools/${schoolId}/parents` : null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [reportCardStudent, setReportCardStudent] = useState<Student | null>(null);
  const [classFilter, setClassFilter] = useState("");

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

  async function downloadAllPdf(activeInClass: Student[]) {
    if (!schoolId || activeInClass.length === 0) return;
    setDownloadingAll(true);
    try {
      const cls = classes.find((c) => c.id === classFilter);
      const label = cls ? `${cls.grade}-${cls.section}` : "Class";
      await downloadMarksheetsPdf(schoolId, activeInClass, `${label} - Marksheets.pdf`);
    } finally {
      setDownloadingAll(false);
    }
  }

  // ---- CSV bulk import (students only; links to already-existing parents) ----

  const [csvOpen, setCsvOpen] = useState(false);
  const csv = useCsvUpload();
  const [csvSubmitting, setCsvSubmitting] = useState(false);
  const [csvResults, setCsvResults] = useState<StudentImportResult[] | null>(null);

  const classByKey = useMemo(() => {
    const map = new Map<string, SchoolClass>();
    for (const c of classes) {
      if (c.status === "disabled") continue;
      map.set(`${c.grade}|${c.section}`.trim().toLowerCase(), c);
    }
    return map;
  }, [classes]);

  const parentByEmail = useMemo(() => {
    const map = new Map<string, Parent>();
    for (const p of parents) {
      if (p.email) map.set(p.email.trim().toLowerCase(), p);
    }
    return map;
  }, [parents]);

  const existingAdmissionNos = useMemo(
    () => new Set(students.map((s) => s.admissionNo.trim().toLowerCase())),
    [students]
  );

  const csvRows = useMemo<StudentCsvRow[]>(() => {
    if (!csv.parsed) return [];
    const seenAdmissionNos = new Set<string>();
    return csv.parsed.rows.map((r, i) => {
      const name = r.name ?? "";
      const admissionNo = r.admissionNo ?? "";
      const rollNo = r.rollNo ?? "";
      const grade = r.grade ?? "";
      const section = r.section ?? "";
      const dob = r.dob ?? "";
      const genderRaw = (r.gender ?? "").trim().toLowerCase();
      const address = r.address ?? "";
      const emergencyContact = r.emergencyContact ?? "";
      const medicalNotes = r.medicalNotes ?? "";
      const parentName = r.parentName ?? "";
      const parentEmail = (r.parentEmail ?? "").trim().toLowerCase();
      const parentPassword = r.parentPassword ?? "";
      const parentPhone = r.parentPhone ?? "";

      const admissionKey = admissionNo.trim().toLowerCase();
      const cls = classByKey.get(`${grade}|${section}`.trim().toLowerCase());
      const matchedParent = parentEmail ? parentByEmail.get(parentEmail) : undefined;

      let rowError: string | undefined;
      if (!name) rowError = "Missing name";
      else if (!admissionNo) rowError = "Missing admission number";
      else if (existingAdmissionNos.has(admissionKey)) rowError = "Admission number already exists";
      else if (seenAdmissionNos.has(admissionKey)) rowError = "Duplicate admission number in file";
      else if (!cls) rowError = `No class matches grade "${grade}" section "${section}"`;
      else if (dob && !DATE_RE.test(dob)) rowError = "Invalid date of birth (use YYYY-MM-DD)";
      else if (genderRaw && !["male", "female", "other"].includes(genderRaw)) rowError = "Gender must be male/female/other";
      else if (parentEmail && !EMAIL_RE.test(parentEmail)) rowError = "Invalid parent email";
      else if (parentEmail && !matchedParent && !parentName)
        rowError = "Parent name required to create a new parent account";
      else if (parentEmail && !matchedParent && (!parentPassword || parentPassword.length < 6))
        rowError = "Parent password must be at least 6 characters to create a new parent account";

      if (!rowError) seenAdmissionNos.add(admissionKey);

      return {
        rowNum: i + 2,
        name,
        admissionNo,
        rollNo,
        classId: cls?.id ?? "",
        sectionId: cls?.section ?? "",
        dob,
        gender: genderRaw,
        address,
        emergencyContact,
        medicalNotes,
        parentName,
        parentEmail,
        parentPassword,
        parentPhone,
        matchedParentId: matchedParent?.id ?? null,
        error: rowError,
      };
    });
  }, [csv.parsed, classByKey, parentByEmail, existingAdmissionNos]);

  const validCsvRows = csvRows.filter((r) => !r.error);

  function openCsv() {
    csv.reset();
    setCsvResults(null);
    setCsvOpen(true);
  }

  function closeCsv() {
    setCsvOpen(false);
    csv.reset();
    setCsvResults(null);
  }

  async function handleCsvImport() {
    if (!schoolId || validCsvRows.length === 0) return;
    setCsvSubmitting(true);
    try {
      // 1. Create any new parent accounts the file references (deduped by
      // email), reusing the same browser account-creation path as Add
      // Parent -- a secondary Firebase Auth app instance so this doesn't
      // touch the admin's own session.
      const newParentsByEmail = new Map<string, { name: string; password: string; phone: string }>();
      for (const r of validCsvRows) {
        if (r.parentEmail && !r.matchedParentId && !newParentsByEmail.has(r.parentEmail)) {
          newParentsByEmail.set(r.parentEmail, { name: r.parentName, password: r.parentPassword, phone: r.parentPhone });
        }
      }

      const emailToUid = new Map<string, string>();
      const emailToError = new Map<string, string>();
      for (const [parentEmail, info] of newParentsByEmail) {
        try {
          const uid = await createAuthUser(parentEmail, info.password);
          await writeAccountProfile(uid, {
            schoolId,
            email: parentEmail,
            displayName: info.name,
            phone: info.phone || undefined,
            kind: "parent",
          });
          emailToUid.set(parentEmail, uid);
        } catch (err) {
          emailToError.set(parentEmail, describeAuthError(err));
        }
      }

      // 2. Batch-create the student docs, chunked to stay under Firestore's
      // per-batch write limit.
      const results: StudentImportResult[] = [];
      for (let start = 0; start < validCsvRows.length; start += BATCH_CHUNK_SIZE) {
        const chunk = validCsvRows.slice(start, start + BATCH_CHUNK_SIZE);
        const batch = writeBatch(db);
        for (const r of chunk) {
          const ref = doc(collection(db, `schools/${schoolId}/students`));
          const parentUid = r.matchedParentId ?? (r.parentEmail ? emailToUid.get(r.parentEmail) : undefined);
          batch.set(ref, {
            name: r.name,
            admissionNo: r.admissionNo,
            rollNo: r.rollNo,
            classId: r.classId,
            sectionId: r.sectionId,
            dob: r.dob || null,
            gender: r.gender || null,
            parentIds: parentUid ? [parentUid] : [],
            address: r.address || null,
            emergencyContact: r.emergencyContact || null,
            medicalNotes: r.medicalNotes || null,
            status: "active",
          });

          if (parentUid) {
            batch.set(
              doc(db, `schools/${schoolId}/parents/${parentUid}`),
              { childStudentIds: arrayUnion(ref.id) },
              { merge: true }
            );
          }

          let status: string;
          let ok = true;
          if (!r.parentEmail) {
            status = "Created";
          } else if (r.matchedParentId) {
            status = "Created, parent linked";
          } else if (parentUid) {
            status = "Created, new parent account created & linked";
          } else {
            status = `Created, parent account failed: ${emailToError.get(r.parentEmail) ?? "unknown error"}`;
            ok = false;
          }

          results.push({ rowNum: r.rowNum, name: r.name, admissionNo: r.admissionNo, status, ok });
        }
        await batch.commit();
      }

      logActivity(schoolId, user, "create", "Student", `CSV import — ${results.length} students`);
      setCsvResults(results);
    } finally {
      setCsvSubmitting(false);
    }
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(s: Student) {
    setEditing(s);
    setForm({
      name: s.name,
      admissionNo: s.admissionNo,
      rollNo: s.rollNo,
      classId: s.classId,
      dob: s.dob ?? "",
      gender: s.gender ?? "",
      parentIds: s.parentIds ?? [],
      address: s.address ?? "",
      emergencyContact: s.emergencyContact ?? "",
      medicalNotes: s.medicalNotes ?? "",
    });
    setOpen(true);
  }

  async function handleSubmit() {
    if (!schoolId || !form.name || !form.admissionNo || !form.classId) return;
    setSubmitting(true);
    try {
      const cls = classes.find((c) => c.id === form.classId);
      const payload = {
        name: form.name,
        admissionNo: form.admissionNo,
        rollNo: form.rollNo,
        classId: form.classId,
        sectionId: cls?.section ?? "",
        dob: form.dob || null,
        gender: form.gender || null,
        parentIds: form.parentIds,
        address: form.address || null,
        emergencyContact: form.emergencyContact || null,
        medicalNotes: form.medicalNotes || null,
        status: editing?.status ?? "active",
      };

      const studentRef = editing
        ? doc(db, `schools/${schoolId}/students/${editing.id}`)
        : doc(collection(db, `schools/${schoolId}/students`));

      // No Cloud Function trigger to keep parents/{uid}.childStudentIds in
      // sync anymore, so do it in the same batch as the student write.
      const beforeParentIds = editing?.parentIds ?? [];
      const added = form.parentIds.filter((id) => !beforeParentIds.includes(id));
      const removed = beforeParentIds.filter((id) => !form.parentIds.includes(id));

      const batch = writeBatch(db);
      batch.set(studentRef, payload, { merge: true });
      for (const parentId of added) {
        batch.set(
          doc(db, `schools/${schoolId}/parents/${parentId}`),
          { childStudentIds: arrayUnion(studentRef.id) },
          { merge: true }
        );
      }
      for (const parentId of removed) {
        batch.set(
          doc(db, `schools/${schoolId}/parents/${parentId}`),
          { childStudentIds: arrayRemove(studentRef.id) },
          { merge: true }
        );
      }
      await batch.commit();
      logActivity(schoolId, user, editing ? "update" : "create", "Student", form.name);
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleArchive(s: Student) {
    if (!schoolId) return;
    const nextStatus = s.status === "archived" ? "active" : "archived";
    await writeBatch(db)
      .set(doc(db, `schools/${schoolId}/students/${s.id}`), { status: nextStatus }, { merge: true })
      .commit();
    logActivity(schoolId, user, "update", "Student", `${s.name} (${nextStatus})`);
  }

  const visibleStudents = students.filter((s) => {
    if (showArchived ? s.status !== "archived" : s.status === "archived") return false;
    if (classFilter && s.classId !== classFilter) return false;
    return true;
  });
  const activeInFilteredClass = classFilter
    ? students.filter((s) => s.classId === classFilter && s.status === "active")
    : [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageHeadingClass}>Students</h1>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          <button onClick={openCsv} className={secondaryButtonClass}>
            Upload CSV
          </button>
          <button onClick={openAdd} className={primaryButtonClass}>
            Add Student
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <label className={labelClass}>Class</label>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className={inputClass}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.grade}-{c.section}
              </option>
            ))}
          </select>
        </div>
        {classFilter && (
          <button
            onClick={() => downloadAllPdf(activeInFilteredClass)}
            disabled={downloadingAll || activeInFilteredClass.length === 0}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {downloadingAll ? "Preparing..." : "Download All Marksheets (PDF)"}
          </button>
        )}
      </div>

      <div className={`${cardClass} mb-6 text-sm text-stone-600`}>
        One CSV can carry both student and parent details — if a row&apos;s <code className="rounded bg-stone-100 px-1">parentEmail</code>{" "}
        doesn&apos;t match an existing parent, a new parent login is created and linked automatically (siblings
        sharing an email are only created once). Grade/section must match an existing class. See{" "}
        <code className="rounded bg-stone-100 px-1">templates/students_template.csv</code> for the format.
        Need to import many rows without watching the browser tab? Run this from{" "}
        <code className="rounded bg-stone-100 px-1">firebase/functions</code> instead:
        <pre className="mt-2 overflow-x-auto rounded-lg bg-stone-900 px-3 py-2 text-xs break-all whitespace-pre-wrap text-stone-100">
          {`npm run import-students -- --schoolId ${schoolId || "<schoolId>"} --file /path/to/students.csv`}
        </pre>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <DataTable
          rows={visibleStudents}
          emptyMessage="No students yet."
          columns={[
            { header: "Name", render: (s) => s.name },
            { header: "Admission No.", render: (s) => s.admissionNo },
            { header: "Roll No.", render: (s) => s.rollNo },
            {
              header: "Class",
              render: (s) => {
                const c = classes.find((c) => c.id === s.classId);
                return c ? `${c.grade}-${c.section}` : "—";
              },
            },
            {
              header: "Parents",
              render: (s) =>
                s.parentIds
                  .map((id) => parents.find((p) => p.id === id)?.name)
                  .filter(Boolean)
                  .join(", ") || <span className="text-stone-400">None linked</span>,
            },
            {
              header: "",
              render: (s) => (
                <div className="flex gap-3">
                  <button onClick={() => openEdit(s)} className="text-sm text-stone-700 hover:underline">
                    Edit
                  </button>
                  <button
                    onClick={() => setReportCardStudent(s)}
                    className="text-sm text-blue-700 hover:underline"
                  >
                    Report Card
                  </button>
                  <button
                    onClick={() => downloadSinglePdf(s)}
                    disabled={downloadingSingle}
                    className="text-sm text-blue-700 hover:underline disabled:opacity-50"
                  >
                    Download PDF
                  </button>
                  <button
                    onClick={() => toggleArchive(s)}
                    className="text-sm text-amber-700 hover:underline"
                  >
                    {s.status === "archived" ? "Restore" : "Archive"}
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal open={open} title={editing ? "Edit Student" : "Add Student"} onClose={() => setOpen(false)}>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <label className={labelClass}>Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Admission No.</label>
              <input
                value={form.admissionNo}
                onChange={(e) => setForm({ ...form, admissionNo: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Roll No.</label>
              <input
                value={form.rollNo}
                onChange={(e) => setForm({ ...form, rollNo: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Class</label>
            <select
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value })}
              className={inputClass}
            >
              <option value="">Select a class</option>
              {classes
                .filter((c) => c.status !== "disabled" || c.id === form.classId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.grade}-{c.section}
                    {c.status === "disabled" ? " (disabled)" : ""}
                  </option>
                ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Date of Birth</label>
              <input
                type="date"
                value={form.dob}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Gender</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value as typeof form.gender })}
                className={inputClass}
              >
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Address</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className={`${inputClass} h-16`}
            />
          </div>
          <div>
            <label className={labelClass}>Parents</label>
            <select
              multiple
              value={form.parentIds}
              onChange={(e) =>
                setForm({
                  ...form,
                  parentIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                })
              }
              className={`${inputClass} h-24`}
            >
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-stone-400">Ctrl/Cmd+click to select multiple.</p>
            {form.parentIds.length > 0 && (
              <div className="mt-2 space-y-1.5 rounded-lg border border-stone-200 bg-stone-50 p-3">
                {form.parentIds.map((id) => {
                  const p = parents.find((p) => p.id === id);
                  if (!p) return null;
                  return (
                    <div key={id} className="text-xs text-stone-600">
                      <span className="font-medium text-stone-800">{p.name}</span>
                      {p.email && <> — {p.email}</>}
                      {p.phone && <> — {p.phone}</>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <label className={labelClass}>Emergency Contact</label>
            <input
              value={form.emergencyContact}
              onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Medical Notes</label>
            <textarea
              value={form.medicalNotes}
              onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })}
              className={`${inputClass} h-20`}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpen(false)} className={secondaryButtonClass}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={submitting} className={primaryButtonClass}>
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={csvOpen} title="Upload Students CSV" onClose={closeCsv}>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {!csvResults && (
            <>
              <p className="text-sm text-stone-500">
                Columns:{" "}
                <code className="rounded bg-stone-100 px-1">
                  name, admissionNo, rollNo, grade, section, dob, gender, address, emergencyContact,
                  medicalNotes, parentName, parentEmail, parentPassword, parentPhone
                </code>
                . Grade/section must match an existing class. Parent columns are optional — leave
                parentEmail blank for no parent link; if it matches an existing parent, that account is
                reused; otherwise a new parent login is created using parentName/parentPassword.
              </p>
              <input type="file" accept=".csv,text/csv" onChange={csv.onFileChange} className="text-sm" />
              {csv.error && <p className="text-sm text-rose-600">{csv.error}</p>}

              {csvRows.length > 0 && (
                <>
                  <p className="text-sm text-stone-600">
                    {validCsvRows.length} of {csvRows.length} rows look valid.
                  </p>
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-stone-200">
                    <table className="min-w-full divide-y divide-stone-200 text-sm">
                      <thead className="bg-stone-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-stone-600">Row</th>
                          <th className="px-3 py-2 text-left font-medium text-stone-600">Name</th>
                          <th className="px-3 py-2 text-left font-medium text-stone-600">Admission No.</th>
                          <th className="px-3 py-2 text-left font-medium text-stone-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 bg-white">
                        {csvRows.map((r) => (
                          <tr key={r.rowNum}>
                            <td className="px-3 py-1.5 text-stone-500">{r.rowNum}</td>
                            <td className="px-3 py-1.5">{r.name}</td>
                            <td className="px-3 py-1.5">{r.admissionNo}</td>
                            <td className="px-3 py-1.5">
                              {r.error ? (
                                <span className="text-rose-600">{r.error}</span>
                              ) : r.parentEmail && !r.matchedParentId ? (
                                <span className="text-amber-700">OK, will create parent {r.parentEmail}</span>
                              ) : r.matchedParentId ? (
                                <span className="text-emerald-700">OK, will link existing parent</span>
                              ) : (
                                <span className="text-emerald-700">OK</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={closeCsv} className={secondaryButtonClass}>
                  Cancel
                </button>
                <button
                  onClick={handleCsvImport}
                  disabled={csvSubmitting || validCsvRows.length === 0}
                  className={primaryButtonClass}
                >
                  {csvSubmitting
                    ? "Importing..."
                    : `Import ${validCsvRows.length} Student${validCsvRows.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </>
          )}

          {csvResults && (
            <>
              <p className="text-sm text-stone-600">{csvResults.length} students created.</p>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-stone-200">
                <table className="min-w-full divide-y divide-stone-200 text-sm">
                  <thead className="bg-stone-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-stone-600">Name</th>
                      <th className="px-3 py-2 text-left font-medium text-stone-600">Admission No.</th>
                      <th className="px-3 py-2 text-left font-medium text-stone-600">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {csvResults.map((r) => (
                      <tr key={r.rowNum}>
                        <td className="px-3 py-1.5">{r.name}</td>
                        <td className="px-3 py-1.5">{r.admissionNo}</td>
                        <td className="px-3 py-1.5">
                          {r.ok ? (
                            <span className="text-emerald-700">{r.status}</span>
                          ) : (
                            <span className="text-amber-700">{r.status}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={closeCsv} className={primaryButtonClass}>
                  Done
                </button>
              </div>
            </>
          )}
        </div>
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
