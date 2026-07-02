"use client";

import { orderBy } from "firebase/firestore";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { Announcement } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";

export default function ParentAnnouncementsPage() {
  const schoolId = useSchoolId();
  const { data: announcements, loading } = useCollection<Announcement>(
    schoolId ? `schools/${schoolId}/announcements` : null,
    [orderBy("createdAt", "desc")],
    []
  );

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Announcements</h1>
      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <DataTable
          rows={announcements}
          emptyMessage="No announcements yet."
          columns={[
            { header: "Title", render: (a) => a.title },
            { header: "Body", render: (a) => <span className="line-clamp-2">{a.body}</span> },
            { header: "Posted", render: (a) => new Date(a.createdAt).toLocaleString() },
          ]}
        />
      )}
    </div>
  );
}
