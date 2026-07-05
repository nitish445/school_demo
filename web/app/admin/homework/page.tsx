"use client";

import { orderBy } from "firebase/firestore";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { Homework, SchoolClass, Subject } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";

export default function HomeworkMonitorPage() {
  const schoolId = useSchoolId();
  const { data: homework, loading } = useCollection<Homework>(
    schoolId ? `schools/${schoolId}/homework` : null,
    [orderBy("dueDate", "desc")],
    []
  );
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const { data: subjects } = useCollection<Subject>(schoolId ? `schools/${schoolId}/subjects` : null);

  function completionRate(hw: Homework) {
    const total = hw.studentIds?.length ?? 0;
    if (total === 0) return "—";
    const done = Object.values(hw.submissions ?? {}).filter((s) => s === "completed").length;
    return `${Math.round((done / total) * 100)}% (${done}/${total})`;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">Homework</h1>
      <p className="mb-4 text-sm text-stone-500">
        Read-only view across the school — homework is created by class/subject teachers.
      </p>

      {loading ? (
        <p className="text-sm text-stone-500">Loading...</p>
      ) : (
        <DataTable
          rows={homework}
          emptyMessage="No homework has been assigned yet."
          columns={[
            { header: "Title", render: (h) => h.title },
            {
              header: "Class",
              render: (h) => {
                const c = classes.find((c) => c.id === h.classId);
                return c ? `${c.grade}-${c.section}` : "—";
              },
            },
            {
              header: "Subject",
              render: (h) => subjects.find((s) => s.id === h.subjectId)?.name ?? "—",
            },
            { header: "Due Date", render: (h) => h.dueDate },
            { header: "Completion", render: (h) => completionRate(h) },
          ]}
        />
      )}
    </div>
  );
}
