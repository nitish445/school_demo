"use client";

import { useMemo, useState } from "react";
import { collection, doc, writeBatch, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import { useCsvUpload } from "@/hooks/useCsvUpload";
import type { Student, SchoolClass, Parent } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass, cardClass } from "@/components/ui/formStyles";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
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
  emergencyContact: string;
  medicalNotes: string;
  parentEmail: string;
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
  emergencyContact: "",
  medicalNotes: "",
};

export default function StudentsPage() {
  const schoolId = useSchoolId();
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

  // ---- CSV bulk import (students only; links to already-existing parents) ----

  const [csvOpen, setCsvOpen] = useState(false);
  const csv = useCsvUpload();
  const [csvSubmitting, setCsvSubmitting] = useState(false);
  const [csvResults, setCsvResults] = useState<StudentImportResult[] | null>(null);

  const classByKey = useMemo(() => {
    const map = new Map<string, SchoolClass>();
    for (const c of classes) map.set(`${c.grade}|${c.section}`.trim().toLowerCase(), c);
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
      const emergencyContact = r.emergencyContact ?? "";
      const medicalNotes = r.medicalNotes ?? "";
      const parentEmail = (r.parentEmail ?? "").trim().toLowerCase();

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
        emergencyContact,
        medicalNotes,
        parentEmail,
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
      const results: StudentImportResult[] = [];
      for (let start = 0; start < validCsvRows.length; start += BATCH_CHUNK_SIZE) {
        const chunk = validCsvRows.slice(start, start + BATCH_CHUNK_SIZE);
        const batch = writeBatch(db);
        for (const r of chunk) {
          const ref = doc(collection(db, `schools/${schoolId}/students`));
          batch.set(ref, {
            name: r.name,
            admissionNo: r.admissionNo,
            rollNo: r.rollNo,
            classId: r.classId,
            sectionId: r.sectionId,
            dob: r.dob || null,
            gender: r.gender || null,
            parentIds: r.matchedParentId ? [r.matchedParentId] : [],
            emergencyContact: r.emergencyContact || null,
            medicalNotes: r.medicalNotes || null,
            status: "active",
          });

          if (r.matchedParentId) {
            batch.set(
              doc(db, `schools/${schoolId}/parents/${r.matchedParentId}`),
              { childStudentIds: arrayUnion(ref.id) },
              { merge: true }
            );
          }

          results.push({
            rowNum: r.rowNum,
            name: r.name,
            admissionNo: r.admissionNo,
            status: r.matchedParentId
              ? "Created, parent linked"
              : r.parentEmail
                ? `Created, no parent found for ${r.parentEmail}`
                : "Created",
            ok: true,
          });
        }
        await batch.commit();
      }

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
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleArchive(s: Student) {
    if (!schoolId) return;
    await writeBatch(db)
      .set(
        doc(db, `schools/${schoolId}/students/${s.id}`),
        { status: s.status === "archived" ? "active" : "archived" },
        { merge: true }
      )
      .commit();
  }

  const visibleStudents = students.filter((s) =>
    showArchived ? s.status === "archived" : s.status !== "archived"
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Students</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600">
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

      <div className={`${cardClass} mb-6 text-sm text-slate-600`}>
        Uploading a CSV here links each row to a parent that <strong>already exists</strong> (matched by
        email) — it can&apos;t create new parent logins from the browser. To also auto-create any parents
        referenced in the file, run this from <code className="rounded bg-slate-100 px-1">firebase/functions</code>{" "}
        instead:
        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100">
          {`npm run import-students -- --schoolId ${schoolId || "<schoolId>"} --file /path/to/students.csv`}
        </pre>
        See <code className="rounded bg-slate-100 px-1">templates/students_template.csv</code> for the CSV
        format — grade/section must match an existing class.
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
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
                  .join(", ") || <span className="text-slate-400">None linked</span>,
            },
            {
              header: "",
              render: (s) => (
                <div className="flex gap-3">
                  <button onClick={() => openEdit(s)} className="text-sm text-slate-700 hover:underline">
                    Edit
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
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.grade}-{c.section}
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
            <p className="mt-1 text-xs text-slate-400">Ctrl/Cmd+click to select multiple.</p>
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
              <p className="text-sm text-slate-500">
                Columns:{" "}
                <code className="rounded bg-slate-100 px-1">
                  name, admissionNo, rollNo, grade, section, dob, gender, emergencyContact, medicalNotes,
                  parentEmail
                </code>
                . Grade/section must match an existing class. parentEmail is optional and only links to a
                parent who already has an account here — other parent columns in the file (if present) are
                ignored.
              </p>
              <input type="file" accept=".csv,text/csv" onChange={csv.onFileChange} className="text-sm" />
              {csv.error && <p className="text-sm text-red-600">{csv.error}</p>}

              {csvRows.length > 0 && (
                <>
                  <p className="text-sm text-slate-600">
                    {validCsvRows.length} of {csvRows.length} rows look valid.
                  </p>
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Row</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Name</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Admission No.</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {csvRows.map((r) => (
                          <tr key={r.rowNum}>
                            <td className="px-3 py-1.5 text-slate-500">{r.rowNum}</td>
                            <td className="px-3 py-1.5">{r.name}</td>
                            <td className="px-3 py-1.5">{r.admissionNo}</td>
                            <td className="px-3 py-1.5">
                              {r.error ? (
                                <span className="text-red-600">{r.error}</span>
                              ) : r.parentEmail && !r.matchedParentId ? (
                                <span className="text-amber-700">OK, no parent match for {r.parentEmail}</span>
                              ) : (
                                <span className="text-green-700">OK</span>
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
              <p className="text-sm text-slate-600">{csvResults.length} students created.</p>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">Name</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">Admission No.</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {csvResults.map((r) => (
                      <tr key={r.rowNum}>
                        <td className="px-3 py-1.5">{r.name}</td>
                        <td className="px-3 py-1.5">{r.admissionNo}</td>
                        <td className="px-3 py-1.5">
                          {r.status.startsWith("Created, no parent") ? (
                            <span className="text-amber-700">{r.status}</span>
                          ) : (
                            <span className="text-green-700">{r.status}</span>
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
    </div>
  );
}
