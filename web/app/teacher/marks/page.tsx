"use client";

import { useEffect, useState } from "react";
import { doc, getDocs, query, collection, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useMyClassIds } from "@/hooks/useMyClassIds";
import { useCollection } from "@/hooks/useCollection";
import { useDoc } from "@/hooks/useDoc";
import type { SchoolClass, Subject, Exam, ExamComponent, ExamComponentSet, Student, Marks } from "@/types/models";
import { Card } from "@/components/ui/Card";
import { inputClass, labelClass, primaryButtonClass } from "@/components/ui/formStyles";

// studentId -> componentId -> raw input string
type MarksInput = Record<string, Record<string, string>>;

function newComponentId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `c${Date.now()}${Math.random()}`;
}

function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-900">
      {n}
    </span>
  );
}

export default function TeacherMarksPage() {
  const schoolId = useSchoolId();
  const { classIds, teacher } = useMyClassIds();
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const { data: subjects } = useCollection<Subject>(schoolId ? `schools/${schoolId}/subjects` : null);
  const { data: exams } = useCollection<Exam>(schoolId ? `schools/${schoolId}/exams` : null);
  const myClasses = classes.filter((c) => classIds.includes(c.id));

  const [classId, setClassId] = useState("");
  const effectiveClassId = classId || myClasses[0]?.id || "";
  const effectiveGrade = classes.find((c) => c.id === effectiveClassId)?.grade;
  const [subjectId, setSubjectId] = useState("");
  const [examId, setExamId] = useState("");
  const [marksInput, setMarksInput] = useState<MarksInput>({});
  const [remarksInput, setRemarksInput] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [components, setComponents] = useState<ExamComponent[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);

  const availableSubjects = !effectiveClassId
    ? []
    : teacher?.classTeacherOf === effectiveClassId
      ? subjects
      : subjects.filter((s) =>
          (teacher?.assignments ?? []).some(
            (a) => a.classId === effectiveClassId && a.subjectId === s.id
          )
        );

  // Only exams actually scheduled for this class's grade + subject -- the
  // admin schedules by grade, applying to every section within it.
  const availableExams = exams.filter((e) =>
    e.schedule.some((s) => s.grade === effectiveGrade && s.subjectId === subjectId)
  );

  const componentSetId = examId && effectiveClassId && subjectId ? `${examId}_${effectiveClassId}_${subjectId}` : null;
  const { data: componentSet, loading: loadingComponentSet } = useDoc<ExamComponentSet>(
    schoolId && componentSetId ? `schools/${schoolId}/examComponents/${componentSetId}` : null
  );

  // Re-sync the editable components list whenever the selected exam+class+subject changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setComponents(componentSet?.components ?? []);
  }, [componentSet, componentSetId]);

  const { data: students, loading: loadingStudents } = useCollection<Student>(
    schoolId && effectiveClassId ? `schools/${schoolId}/students` : null,
    effectiveClassId ? [where("classId", "==", effectiveClassId), where("status", "==", "active")] : [],
    [effectiveClassId]
  );

  const { data: existingMarks, loading: loadingMarks } = useCollection<Marks>(
    schoolId && examId ? `schools/${schoolId}/marks` : null,
    examId ? [where("examId", "==", examId)] : [],
    [examId]
  );

  useEffect(() => {
    const next: MarksInput = {};
    const nextRemarks: Record<string, string> = {};
    for (const s of students) {
      const m = existingMarks.find((m) => m.studentId === s.id);
      const values: Record<string, string> = {};
      for (const c of components) {
        const value = m?.componentMarks?.[subjectId]?.[c.id];
        values[c.id] = value !== undefined ? String(value) : "";
      }
      next[s.id] = values;
      nextRemarks[s.id] = m?.remarks?.[subjectId] ?? "";
    }
    // Syncing local editable state from freshly-fetched data when the
    // class/subject/exam changes is intentional, not a render loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMarksInput(next);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemarksInput(nextRemarks);
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students.length, existingMarks.length, subjectId, examId, components.length]);

  function addComponentRow() {
    setComponents([...components, { id: newComponentId(), title: "", maxMark: 100, weightage: 0 }]);
  }

  function updateComponentRow(i: number, patch: Partial<ExamComponent>) {
    setComponents(components.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function removeComponentRow(i: number) {
    setComponents(components.filter((_, idx) => idx !== i));
  }

  // The class teacher of this class already has approval authority, so
  // their own entry doesn't need a separate rubber-stamp; anyone else's
  // entry (a subject-only teacher) starts pending and needs the class
  // teacher or an admin to approve it before a parent can see it.
  const isApprover = teacher?.classTeacherOf === effectiveClassId;

  // A single save does both, in order: persist the component definitions
  // first, then the marks that reference them. Previously these were two
  // separate buttons, which meant a teacher could enter marks against
  // components that were never actually written to `examComponents` --
  // the marks would save "successfully" but a parent's Report Card could
  // never resolve them (it reads components from that collection, not from
  // whatever the teacher currently has on screen), silently showing
  // "Marks not entered yet" forever.
  async function handleSave() {
    if (!schoolId || !componentSetId || !examId || !subjectId) return;
    setSaving(true);
    try {
      await setDoc(doc(db, `schools/${schoolId}/examComponents/${componentSetId}`), {
        examId,
        classId: effectiveClassId,
        subjectId,
        components: components.filter((c) => c.title),
        approved: isApprover,
        approvedBy: isApprover ? teacher?.name ?? "" : "",
        approvedAt: isApprover ? Date.now() : null,
      });

      const batch = writeBatch(db);
      for (const s of students) {
        const values = marksInput[s.id] ?? {};
        const enteredComponentMarks: Record<string, number> = {};
        for (const c of components) {
          const raw = values[c.id];
          if (raw === "" || raw === undefined) continue;
          enteredComponentMarks[c.id] = Number(raw);
        }
        const remark = (remarksInput[s.id] ?? "").trim();
        if (Object.keys(enteredComponentMarks).length === 0 && !remark) continue;

        const markId = `${examId}_${s.id}`;
        const existingDoc = existingMarks.find((m) => m.id === markId);
        // Re-read to merge componentMarks/remarks safely rather than clobbering other subjects.
        let existingComponentMarks: Record<string, Record<string, number>> = existingDoc?.componentMarks ?? {};
        let existingRemarks: Record<string, string> = existingDoc?.remarks ?? {};
        if (!existingDoc) {
          const snap = await getDocs(
            query(collection(db, `schools/${schoolId}/marks`), where("examId", "==", examId), where("studentId", "==", s.id))
          );
          existingComponentMarks = snap.docs[0]?.data().componentMarks ?? {};
          existingRemarks = snap.docs[0]?.data().remarks ?? {};
        }
        batch.set(
          doc(db, `schools/${schoolId}/marks/${markId}`),
          {
            studentId: s.id,
            examId,
            componentMarks: {
              ...existingComponentMarks,
              [subjectId]: { ...existingComponentMarks[subjectId], ...enteredComponentMarks },
            },
            remarks: {
              ...existingRemarks,
              [subjectId]: remark,
            },
          },
          { merge: true }
        );
      }
      await batch.commit();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function updateMark(studentId: string, componentId: string, value: string) {
    setMarksInput({
      ...marksInput,
      [studentId]: { ...marksInput[studentId], [componentId]: value },
    });
  }

  function updateRemark(studentId: string, value: string) {
    setRemarksInput({ ...remarksInput, [studentId]: value });
  }

  const weightageTotal = components.reduce((sum, c) => sum + c.weightage, 0);

  // Every exam date relevant to this teacher: their home-room class gets
  // every scheduled subject for its grade, a subject-only class only the
  // subjects they're actually assigned to teach there.
  function teachesEntryInClass(entry: (typeof exams)[number]["schedule"][number], c: SchoolClass) {
    return (
      c.grade === entry.grade &&
      (teacher?.classTeacherOf === c.id ||
        (teacher?.assignments ?? []).some((a) => a.classId === c.id && a.subjectId === entry.subjectId))
    );
  }
  const mySchedule = exams
    .flatMap((exam) => exam.schedule.map((entry) => ({ exam, entry })))
    .flatMap(({ exam, entry }) =>
      myClasses.filter((c) => teachesEntryInClass(entry, c)).map((c) => ({ exam, entry, class: c }))
    )
    .sort((a, b) => a.entry.date.localeCompare(b.entry.date));

  // Marks a subject teacher has submitted for this class teacher's own home
  // room, still waiting on a class-teacher/admin approval before parents
  // can see them.
  const { data: myClassComponentSets } = useCollection<ExamComponentSet>(
    schoolId && teacher?.classTeacherOf ? `schools/${schoolId}/examComponents` : null,
    teacher?.classTeacherOf ? [where("classId", "==", teacher.classTeacherOf)] : [],
    [teacher?.classTeacherOf]
  );
  const pendingApprovals = myClassComponentSets.filter(
    (cs) => !cs.approved && cs.components.length > 0
  );

  async function approveComponentSet(cs: ExamComponentSet) {
    if (!schoolId) return;
    await updateDoc(doc(db, `schools/${schoolId}/examComponents/${cs.id}`), {
      approved: true,
      approvedBy: teacher?.name ?? "",
      approvedAt: Date.now(),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Marks</h1>
        <p className="mt-1 text-sm text-stone-500">
          Pick a class, subject and exam, define how it's graded, then enter each student's score.
        </p>
      </div>

      <button
        onClick={() => setShowSchedule(!showSchedule)}
        className="text-sm font-medium text-stone-600 hover:text-stone-900"
      >
        {showSchedule ? "Hide" : "Show"} your exam schedule ({mySchedule.length})
      </button>
      {showSchedule && (
        <Card>
          {mySchedule.length === 0 ? (
            <p className="text-sm text-stone-500">No exams scheduled for your classes yet.</p>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {mySchedule.map(({ exam, entry, class: c }, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-stone-800">
                    <span className="font-medium">{exam.name}</span> ({exam.term}) —{" "}
                    {subjects.find((s) => s.id === entry.subjectId)?.name ?? entry.subjectId} — {c.grade}-
                    {c.section}
                  </span>
                  <span className="text-stone-500">{entry.date || "Date TBD"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {pendingApprovals.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <h2 className="mb-2 text-sm font-semibold text-stone-900">
            Marks Awaiting Your Approval ({pendingApprovals.length})
          </h2>
          <p className="mb-3 text-xs text-stone-600">
            A subject teacher has submitted these for your home room -- approve them so parents can see them.
          </p>
          <ul className="divide-y divide-amber-100 text-sm">
            {pendingApprovals.map((cs) => {
              const exam = exams.find((e) => e.id === cs.examId);
              const subject = subjects.find((s) => s.id === cs.subjectId);
              return (
                <li key={cs.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-stone-800">
                    <span className="font-medium">{subject?.name ?? cs.subjectId}</span> —{" "}
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
        </Card>
      )}

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <StepBadge n={1} />
          <h2 className="text-sm font-semibold text-stone-900">Choose class, subject &amp; exam</h2>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className={labelClass}>Class</label>
            <select
              value={effectiveClassId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSubjectId("");
                setExamId("");
              }}
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
          <div>
            <label className={labelClass}>Subject</label>
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setExamId("");
              }}
              className={inputClass}
            >
              <option value="">Select a subject</option>
              {availableSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Exam</label>
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className={inputClass}
              disabled={!subjectId}
            >
              <option value="">Select an exam</option>
              {availableExams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.term})
                </option>
              ))}
            </select>
          </div>
        </div>
        {subjectId && availableExams.length === 0 && (
          <p className="mt-3 text-sm text-stone-500">
            No exam is scheduled for this class + subject yet -- ask an admin to add it under Exams.
          </p>
        )}
      </Card>

      {effectiveClassId && subjectId && examId && (
        <>
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StepBadge n={2} />
                <h2 className="text-sm font-semibold text-stone-900">Assessment components</h2>
                {components.length > 0 && (
                  <span
                    className={`text-xs font-medium ${weightageTotal === 100 ? "text-emerald-600" : "text-amber-600"}`}
                  >
                    {weightageTotal}% weightage
                  </span>
                )}
                {componentSet && (
                  <span
                    className={`text-xs font-medium ${componentSet.approved ? "text-emerald-600" : "text-amber-600"}`}
                  >
                    {componentSet.approved
                      ? `Approved by ${componentSet.approvedBy || "class teacher"}`
                      : "Pending approval"}
                  </span>
                )}
              </div>
              <button onClick={addComponentRow} className="text-sm text-stone-700 hover:underline">
                + Add component
              </button>
            </div>

            {loadingComponentSet ? (
              <p className="text-sm text-stone-500">Loading...</p>
            ) : components.length === 0 ? (
              <p className="text-sm text-stone-500">
                No components yet, e.g. "Test 1", "Quiz", "Final Exam" -- add one to start entering marks.
              </p>
            ) : (
              <div className="space-y-1.5">
                <div className="grid grid-cols-[1fr_88px_104px_28px] gap-2 px-1 text-xs font-medium text-stone-400 uppercase">
                  <span>Title</span>
                  <span>Max mark</span>
                  <span>Weightage %</span>
                  <span />
                </div>
                {components.map((c, i) => (
                  <div key={c.id} className="grid grid-cols-[1fr_88px_104px_28px] items-center gap-2">
                    <input
                      value={c.title}
                      onChange={(e) => updateComponentRow(i, { title: e.target.value })}
                      placeholder="e.g. Test 1"
                      className={inputClass}
                    />
                    <input
                      type="number"
                      value={c.maxMark}
                      onChange={(e) => updateComponentRow(i, { maxMark: Number(e.target.value) })}
                      className={inputClass}
                    />
                    <input
                      type="number"
                      value={c.weightage}
                      onChange={(e) => updateComponentRow(i, { weightage: Number(e.target.value) })}
                      className={inputClass}
                    />
                    <button
                      onClick={() => removeComponentRow(i)}
                      aria-label="Remove component"
                      className="text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {components.length > 0 && (
            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StepBadge n={3} />
                  <h2 className="text-sm font-semibold text-stone-900">Enter marks</h2>
                </div>
                <div className="flex items-center gap-3">
                  {saved && <span className="text-sm text-green-700">Saved.</span>}
                  <button onClick={handleSave} disabled={saving} className={primaryButtonClass}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>

              {loadingStudents || loadingMarks ? (
                <p className="text-sm text-stone-500">Loading...</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-stone-200">
                  <table className="min-w-full divide-y divide-stone-200 text-sm">
                    <thead className="bg-stone-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-stone-600">Roll No.</th>
                        <th className="px-4 py-2 text-left font-medium text-stone-600">Name</th>
                        {components.map((c) => (
                          <th key={c.id} className="px-4 py-2 text-left font-medium text-stone-600">
                            {c.title || "Untitled"}
                            <span className="block text-xs font-normal text-stone-400">
                              Max {c.maxMark} · {c.weightage}%
                            </span>
                          </th>
                        ))}
                        <th className="px-4 py-2 text-left font-medium text-stone-600">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {students.map((s) => (
                        <tr key={s.id}>
                          <td className="px-4 py-2 text-stone-800">{s.rollNo}</td>
                          <td className="px-4 py-2 text-stone-800">{s.name}</td>
                          {components.map((c) => (
                            <td key={c.id} className="px-4 py-2">
                              <input
                                type="number"
                                value={marksInput[s.id]?.[c.id] ?? ""}
                                onChange={(e) => updateMark(s.id, c.id, e.target.value)}
                                className={`${inputClass} w-20`}
                              />
                            </td>
                          ))}
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={remarksInput[s.id] ?? ""}
                              onChange={(e) => updateRemark(s.id, e.target.value)}
                              placeholder="Optional remark"
                              className={`${inputClass} w-40`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
