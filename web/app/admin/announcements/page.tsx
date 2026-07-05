"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { Announcement } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/formStyles";
import { logActivity } from "@/lib/auditLog";

export default function AnnouncementsPage() {
  const schoolId = useSchoolId();
  const { user } = useAuth();
  const { data: announcements, loading } = useCollection<Announcement>(
    schoolId ? `schools/${schoolId}/announcements` : null,
    [orderBy("createdAt", "desc")],
    []
  );

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function openAdd() {
    setTitle("");
    setBody("");
    setOpen(true);
  }

  async function handleSubmit() {
    if (!schoolId || !user || !title || !body) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, `schools/${schoolId}/announcements`), {
        title,
        body,
        audience: "all",
        createdBy: user.uid,
        createdAt: Date.now(),
      });
      logActivity(schoolId, user, "create", "Announcement", title);
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(a: Announcement) {
    if (!schoolId) return;
    if (!confirm(`Delete announcement "${a.title}"?`)) return;
    await deleteDoc(doc(db, `schools/${schoolId}/announcements/${a.id}`));
    logActivity(schoolId, user, "delete", "Announcement", a.title);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Announcements</h1>
        <button onClick={openAdd} className={primaryButtonClass}>
          New Announcement
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Loading...</p>
      ) : (
        <DataTable
          rows={announcements}
          emptyMessage="No announcements yet."
          columns={[
            { header: "Title", render: (a) => a.title },
            { header: "Body", render: (a) => <span className="line-clamp-2">{a.body}</span> },
            {
              header: "Posted",
              render: (a) => new Date(a.createdAt).toLocaleString(),
            },
            {
              header: "",
              render: (a) => (
                <button onClick={() => handleDelete(a)} className="text-sm text-red-600 hover:underline">
                  Delete
                </button>
              ),
            },
          ]}
        />
      )}

      <Modal open={open} title="New Announcement" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Message</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} className={`${inputClass} h-28`} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpen(false)} className={secondaryButtonClass}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={submitting} className={primaryButtonClass}>
              {submitting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
