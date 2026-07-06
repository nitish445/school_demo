"use client";

import { useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { Exam, ExamComponentSet, ExamScheduleEntry, SchoolClass, Subject } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { downloadCsv } from "@/lib/csv";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/formStyles";
import { logActivity } from "@/lib/auditLog";

const emptyForm = { name: "", term: "", schedule: [] as ExamScheduleEntry[] };

export default function ExamsPage() {
  const schoolId = useSchoolId();
  const { user } = useAuth();
  const { data: exams, loading } = useCollection<Exam>(schoolId ? `schools/${schoolId}/exams` : null);
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const { data: subjects } = useCollection<Subject>(schoolId ? `schools/${schoolId}/subjects` : null);
  const { data: componentSets } = useCollection<ExamComponentSet>(
    schoolId ? `schools/${schoolId}/examComponents` : null
  );
  const grades = [...new Set(classes.map((c) => c.grade))].sort();
  const pendingApprovals = componentSets.filter((cs) => !cs.approved && cs.components.length > 0);

  async function approveComponentSet(cs: ExamComponentSet) {
    if (!schoolId) return;
    await updateDoc(doc(db, `schools/${schoolId}/examComponents/${cs.id}`), {
      approved: true,
      approvedBy: user?.email ?? "admin",
      approvedAt: Date.now(),
    });
  }

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [scheduleMonth, setScheduleMonth] = useState(() => new Date().toISOString().slice(0, 7));

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(e: Exam) {
    setEditing(e);
    setForm({ name: e.name, term: e.term, schedule: e.schedule });
    setOpen(true);
  }

  function addScheduleRow() {
    setForm({ ...form, schedule: [...form.schedule, { grade: "", subjectId: "", date: "" }] });
  }

  function updateScheduleRow(i: number, patch: Partial<ExamScheduleEntry>) {
    setForm({
      ...form,
      schedule: form.schedule.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    });
  }

  function removeScheduleRow(i: number) {
    setForm({ ...form, schedule: form.schedule.filter((_, idx) => idx !== i) });
  }

  async function handleSubmit() {
    if (!schoolId || !form.name || !form.term) return;
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        term: form.term,
        schedule: form.schedule.filter((s) => s.grade && s.subjectId),
        published: editing?.published ?? false,
      };
      if (editing) {
        await updateDoc(doc(db, `schools/${schoolId}/exams/${editing.id}`), payload);
        logActivity(schoolId, user, "update", "Exam", form.name);
      } else {
        await addDoc(collection(db, `schools/${schoolId}/exams`), payload);
        logActivity(schoolId, user, "create", "Exam", form.name);
      }
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePublish(e: Exam) {
    if (!schoolId) return;
    await updateDoc(doc(db, `schools/${schoolId}/exams/${e.id}`), { published: !e.published });
    logActivity(schoolId, user, "update", "Exam", `${e.name} (${e.published ? "unpublished" : "published"})`);
  }

  async function handleDelete(e: Exam) {
    if (!schoolId) return;
    if (!confirm(`Delete exam "${e.name}"?`)) return;
    await deleteDoc(doc(db, `schools/${schoolId}/exams/${e.id}`));
    logActivity(schoolId, user, "delete", "Exam", e.name);
  }

  function subjectName(subjectId: string) {
    return subjects.find((s) => s.id === subjectId)?.name ?? subjectId;
  }

  const scheduleEntries = useMemo(
    () =>
      exams
        .flatMap((e) =>
          e.schedule.map((s) => ({
            id: `${e.id}_${s.grade}_${s.subjectId}_${s.date}`,
            examName: e.name,
            term: e.term,
            grade: s.grade,
            subjectId: s.subjectId,
            date: s.date,
          }))
        )
        .sort((a, b) => a.date.localeCompare(b.date)),
    [exams]
  );

  const monthSchedule = useMemo(
    () => scheduleEntries.filter((s) => s.date.slice(0, 7) === scheduleMonth),
    [scheduleEntries, scheduleMonth]
  );

  function exportMonthSchedule() {
    downloadCsv(
      `exam-schedule-${scheduleMonth}.csv`,
      ["Exam", "Term", "Grade", "Subject", "Date"],
      monthSchedule.map((s) => [s.examName, s.term, `Grade ${s.grade}`, subjectName(s.subjectId), s.date])
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Exams</h1>
        <button onClick={openAdd} className={primaryButtonClass}>
          Create Exam
        </button>
      </div>

      <p className="mb-4 text-sm text-stone-500">
        Admin sets the exam name, term, and which grade + subject is scheduled on which date -- this applies
        to every section in that grade (5-A, 5-B, ...), not one row per section. Each subject teacher then
        defines their own assessment components (max marks, weightage) and enters marks from{" "}
        <span className="font-medium text-stone-700">Marks</span> in their own portal.
      </p>

      <div className="mb-8 rounded-lg border border-stone-200 p-4">
        <div className="mb-3 flex flex-wrap items-end gap-4">
          <div>
            <label className={labelClass}>Exam schedule for month</label>
            <input
              type="month"
              value={scheduleMonth}
              onChange={(e) => setScheduleMonth(e.target.value)}
              className={inputClass}
            />
          </div>
          {monthSchedule.length > 0 && (
            <button onClick={exportMonthSchedule} className={secondaryButtonClass}>
              Export CSV
            </button>
          )}
        </div>
        <DataTable
          rows={monthSchedule}
          emptyMessage="No exams scheduled in this month."
          columns={[
            { header: "Exam", render: (s) => s.examName },
            { header: "Term", render: (s) => s.term },
            { header: "Grade", render: (s) => `Grade ${s.grade}` },
            { header: "Subject", render: (s) => subjectName(s.subjectId) },
            { header: "Date", render: (s) => s.date },
          ]}
        />
      </div>

      {pendingApprovals.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-stone-900">
            Marks Awaiting Approval ({pendingApprovals.length})
          </h2>
          <p className="mb-3 text-xs text-stone-600">
            A class's own class teacher can also approve these -- this list is everything still pending
            school-wide.
          </p>
          <ul className="divide-y divide-amber-100 text-sm">
            {pendingApprovals.map((cs) => {
              const exam = exams.find((e) => e.id === cs.examId);
              const cls = classes.find((c) => c.id === cs.classId);
              const subject = subjects.find((s) => s.id === cs.subjectId);
              return (
                <li key={cs.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-stone-800">
                    <span className="font-medium">{subject?.name ?? cs.subjectId}</span> —{" "}
                    {cls ? `${cls.grade}-${cls.section}` : cs.classId} —{" "}
                    {exam ? `${exam.name} (${exam.term})` : cs.examId}
                  </span>
                  <button
                    onClick={() => approveComponentSet(cs)}
                    className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    Approve
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-stone-500">Loading...</p>
      ) : (
        <DataTable
          rows={exams}
          emptyMessage="No exams yet."
          columns={[
            { header: "Name", render: (e) => e.name },
            { header: "Term", render: (e) => e.term },
            { header: "Scheduled", render: (e) => e.schedule.length },
            {
              header: "Status",
              render: (e) => (e.published ? "Published" : "Draft"),
            },
            {
              header: "",
              render: (e) => (
                <div className="flex gap-3">
                  <button onClick={() => openEdit(e)} className="text-sm text-stone-700 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => togglePublish(e)} className="text-sm text-blue-700 hover:underline">
                    {e.published ? "Unpublish" : "Publish"}
                  </button>
                  <button onClick={() => handleDelete(e)} className="text-sm text-red-600 hover:underline">
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal open={open} title={editing ? "Edit Exam" : "Create Exam"} onClose={() => setOpen(false)}>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <label className={labelClass}>Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Midterm Exam"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Term</label>
            <input
              value={form.term}
              onChange={(e) => setForm({ ...form, term: e.target.value })}
              placeholder="e.g. Term 1"
              className={inputClass}
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className={labelClass}>Grade-wise Schedule</label>
              <button onClick={addScheduleRow} className="text-sm text-stone-700 hover:underline">
                + Add row
              </button>
            </div>
            <div className="space-y-2">
              {form.schedule.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    value={s.grade}
                    onChange={(e) => updateScheduleRow(i, { grade: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Grade</option>
                    {grades.map((g) => (
                      <option key={g} value={g}>
                        Grade {g}
                      </option>
                    ))}
                  </select>
                  <select
                    value={s.subjectId}
                    onChange={(e) => updateScheduleRow(i, { subjectId: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Subject</option>
                    {subjects
                      .filter((sub) => sub.status !== "disabled" || sub.id === s.subjectId)
                      .map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                          {sub.status === "disabled" ? " (disabled)" : ""}
                        </option>
                      ))}
                  </select>
                  <input
                    type="date"
                    value={s.date}
                    onChange={(e) => updateScheduleRow(i, { date: e.target.value })}
                    className={inputClass}
                  />
                  <button onClick={() => removeScheduleRow(i)} className="text-red-600">
                    ✕
                  </button>
                </div>
              ))}
            </div>
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
    </div>
  );
}
