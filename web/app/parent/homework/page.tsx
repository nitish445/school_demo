"use client";

import { doc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useEffectiveChildId } from "@/hooks/useEffectiveChildId";
import { useCollection } from "@/hooks/useCollection";
import type { Homework, Subject } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { primaryButtonClass } from "@/components/ui/formStyles";

export default function ParentHomeworkPage() {
  const schoolId = useSchoolId();
  const { effectiveChildId, childStudentIds } = useEffectiveChildId();
  const { data: subjects } = useCollection<Subject>(schoolId ? `schools/${schoolId}/subjects` : null);

  const { data: homework, loading } = useCollection<Homework>(
    schoolId && effectiveChildId ? `schools/${schoolId}/homework` : null,
    effectiveChildId ? [where("studentIds", "array-contains", effectiveChildId)] : [],
    [effectiveChildId]
  );

  async function markCompleted(h: Homework) {
    if (!schoolId) return;
    await updateDoc(doc(db, `schools/${schoolId}/homework/${h.id}`), {
      [`submissions.${effectiveChildId}`]: "completed",
    });
  }

  if (childStudentIds.length === 0) {
    return <p className="text-sm text-stone-500">No children are linked to your account yet.</p>;
  }

  const sorted = [...homework].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">Homework</h1>

      {loading ? (
        <p className="text-sm text-stone-500">Loading...</p>
      ) : (
        <DataTable
          rows={sorted}
          emptyMessage="No homework assigned yet."
          columns={[
            { header: "Title", render: (h) => h.title },
            { header: "Subject", render: (h) => subjects.find((s) => s.id === h.subjectId)?.name ?? "—" },
            { header: "Due Date", render: (h) => h.dueDate },
            { header: "Description", render: (h) => <span className="line-clamp-2">{h.description}</span> },
            {
              header: "Status",
              render: (h) =>
                h.submissions?.[effectiveChildId] === "completed" ? (
                  <span className="text-green-700">Completed</span>
                ) : (
                  <button onClick={() => markCompleted(h)} className={primaryButtonClass}>
                    Mark Completed
                  </button>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}
