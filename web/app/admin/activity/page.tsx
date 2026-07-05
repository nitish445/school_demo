"use client";

import { useMemo, useState } from "react";
import { orderBy, limit as fsLimit } from "firebase/firestore";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { AuditLogEntry } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { inputClass, labelClass, pageHeadingClass } from "@/components/ui/formStyles";

const ACTION_VARIANT: Record<AuditLogEntry["action"], "success" | "info" | "danger"> = {
  create: "success",
  update: "info",
  delete: "danger",
};

export default function ActivityLogPage() {
  const schoolId = useSchoolId();
  const { data: entries, loading } = useCollection<AuditLogEntry>(
    schoolId ? `schools/${schoolId}/auditLog` : null,
    [orderBy("createdAt", "desc"), fsLimit(300)],
    []
  );

  const [entityFilter, setEntityFilter] = useState("");

  const entityOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.entity))).sort(),
    [entries]
  );

  const filtered = entityFilter ? entries.filter((e) => e.entity === entityFilter) : entries;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageHeadingClass}>Activity Log</h1>
        <div className="flex items-center gap-2">
          <label className={labelClass}>Filter</label>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className={`${inputClass} w-auto`}
          >
            <option value="">All types</option>
            {entityOptions.map((entity) => (
              <option key={entity} value={entity}>
                {entity}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <DataTable
          rows={filtered}
          emptyMessage="No activity recorded yet."
          columns={[
            {
              header: "When",
              render: (e) => (e.createdAt ? e.createdAt.toDate().toLocaleString() : "just now"),
            },
            { header: "Admin", render: (e) => e.actorEmail || e.actorUid },
            {
              header: "Action",
              render: (e) => <Badge variant={ACTION_VARIANT[e.action]}>{e.action}</Badge>,
            },
            { header: "Type", render: (e) => e.entity },
            { header: "Item", render: (e) => e.entityLabel },
          ]}
        />
      )}
    </div>
  );
}
