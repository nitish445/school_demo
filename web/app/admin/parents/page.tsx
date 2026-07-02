"use client";

import { doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { Parent, Student } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { cardClass } from "@/components/ui/formStyles";

export default function ParentsPage() {
  const schoolId = useSchoolId();
  const { data: parents, loading } = useCollection<Parent>(schoolId ? `schools/${schoolId}/parents` : null);
  const { data: students } = useCollection<Student>(schoolId ? `schools/${schoolId}/students` : null);

  async function toggleStatus(p: Parent) {
    if (!schoolId) return;
    const status = p.status === "disabled" ? "active" : "disabled";
    await writeBatch(db)
      .set(doc(db, `users/${p.id}`), { status }, { merge: true })
      .set(doc(db, `schools/${schoolId}/parents/${p.id}`), { status }, { merge: true })
      .commit();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Parents</h1>
      </div>

      <div className={`${cardClass} mb-6 text-sm text-slate-600`}>
        Adding a parent creates a login, which needs to run with admin (Admin SDK) privileges — there&apos;s no
        in-browser button for that on the free plan. From <code className="rounded bg-slate-100 px-1">firebase/functions</code>,
        run one of:
        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100">
          {`npm run create-account -- --schoolId ${schoolId || "<schoolId>"} --kind parent \\\n  --email jane@example.com --password TempPass123 --name "Jane Doe"\n\nnpm run import-parents -- --schoolId ${schoolId || "<schoolId>"} --file /path/to/parents.csv`}
        </pre>
        See <code className="rounded bg-slate-100 px-1">templates/parents_template.csv</code> for the CSV format.
        They&apos;ll show up here once created. Link children to a parent from the Students page (Edit Student →
        Parents).
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : (
        <DataTable
          rows={parents}
          emptyMessage="No parents yet."
          columns={[
            { header: "Name", render: (p) => p.name },
            {
              header: "Children",
              render: (p) =>
                (p.childStudentIds ?? [])
                  .map((id) => students.find((s) => s.id === id)?.name)
                  .filter(Boolean)
                  .join(", ") || <span className="text-slate-400">None linked</span>,
            },
            {
              header: "Status",
              render: (p) =>
                p.status === "disabled" ? (
                  <span className="text-amber-700">Disabled</span>
                ) : (
                  <span className="text-green-700">Active</span>
                ),
            },
            {
              header: "",
              render: (p) => (
                <button onClick={() => toggleStatus(p)} className="text-sm text-red-600 hover:underline">
                  {p.status === "disabled" ? "Enable" : "Disable"}
                </button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
