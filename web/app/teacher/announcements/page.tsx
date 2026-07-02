"use client";

import { useState } from "react";
import { addDoc, collection, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useMyClassIds } from "@/hooks/useMyClassIds";
import { useCollection } from "@/hooks/useCollection";
import type { Announcement, SchoolClass } from "@/types/models";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/formStyles";

export default function TeacherAnnouncementsPage() {
  const schoolId = useSchoolId();
  const { user } = useAuth();
  const { classIds } = useMyClassIds();
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const myClasses = classes.filter((c) => classIds.includes(c.id));

  const { data: announcements, loading } = useCollection<Announcement>(
    schoolId ? `schools/${schoolId}/announcements` : null,
    [orderBy("createdAt", "desc")],
    []
  );

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [classId, setClassId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function openAdd() {
    setTitle("");
    setBody("");
    setClassId(myClasses[0]?.id ?? "");
    setOpen(true);
  }

  async function handleSubmit() {
    if (!schoolId || !user || !title || !body || !classId) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, `schools/${schoolId}/announcements`), {
        title,
        body,
        audience: "class",
        classId,
        createdBy: user.uid,
        createdAt: Date.now(),
      });
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Announcements</h1>
        <button onClick={openAdd} disabled={myClasses.length === 0} className={primaryButtonClass}>
          New Announcement
        </button>
      </div>

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

      <Modal open={open} title="New Announcement" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Class</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
              {myClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.grade}-{c.section}
                </option>
              ))}
            </select>
          </div>
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
