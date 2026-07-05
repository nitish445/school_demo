"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSchool } from "@/hooks/useSchool";
import { useCollection } from "@/hooks/useCollection";
import type { CalendarEvent, CalendarEventType } from "@/types/models";
import { MonthCalendar, eventTouchesDate } from "@/components/calendar/MonthCalendar";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/formStyles";
import { logActivity } from "@/lib/auditLog";

const TYPE_LABEL: Record<CalendarEventType, string> = {
  holiday: "Holiday",
  exam: "Exam",
  ptm: "PTM",
  event: "Event",
  other: "Other",
};

const TYPE_BADGE_VARIANT: Record<CalendarEventType, "danger" | "warning" | "info" | "success" | "neutral"> = {
  holiday: "danger",
  exam: "warning",
  ptm: "info",
  event: "success",
  other: "neutral",
};

const emptyForm = {
  title: "",
  description: "",
  date: "",
  endDate: "",
  multiDay: false,
  type: "event" as CalendarEventType,
};

export default function AdminCalendarPage() {
  const schoolId = useSchoolId();
  const { user } = useAuth();
  const { data: school } = useSchool();
  const { data: events } = useCollection<CalendarEvent>(schoolId ? `schools/${schoolId}/events` : null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const dayEvents = selectedDate ? events.filter((e) => eventTouchesDate(e, selectedDate)) : [];

  function openAddForDate(dateIso: string) {
    setEditing(null);
    setForm({ ...emptyForm, date: dateIso });
    setFormOpen(true);
  }

  function openEdit(e: CalendarEvent) {
    setEditing(e);
    setForm({
      title: e.title,
      description: e.description ?? "",
      date: e.date,
      endDate: e.endDate ?? "",
      multiDay: !!e.endDate,
      type: e.type,
    });
    setFormOpen(true);
  }

  async function handleSubmit() {
    if (!schoolId || !user || !form.title || !form.date) return;
    setSubmitting(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        date: form.date,
        endDate: form.multiDay && form.endDate ? form.endDate : null,
        type: form.type,
        createdBy: user.uid,
      };
      if (editing) {
        await updateDoc(doc(db, `schools/${schoolId}/events/${editing.id}`), payload);
        logActivity(schoolId, user, "update", "CalendarEvent", form.title);
      } else {
        await addDoc(collection(db, `schools/${schoolId}/events`), payload);
        logActivity(schoolId, user, "create", "CalendarEvent", form.title);
      }
      setFormOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(e: CalendarEvent) {
    if (!schoolId) return;
    if (!confirm(`Delete "${e.title}"?`)) return;
    await deleteDoc(doc(db, `schools/${schoolId}/events/${e.id}`));
    logActivity(schoolId, user, "delete", "CalendarEvent", e.title);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Calendar</h1>
        <button onClick={() => openAddForDate(new Date().toISOString().slice(0, 10))} className={primaryButtonClass}>
          Add Event
        </button>
      </div>

      <MonthCalendar events={events} holidays={school?.holidays ?? []} onDayClick={setSelectedDate} />

      <Modal open={!!selectedDate} title={selectedDate ?? ""} onClose={() => setSelectedDate(null)}>
        <div className="space-y-3">
          {dayEvents.length === 0 ? (
            <p className="text-sm text-stone-500">No events on this day.</p>
          ) : (
            dayEvents.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3 last:border-0">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-stone-900">{e.title}</p>
                    <Badge variant={TYPE_BADGE_VARIANT[e.type]}>{TYPE_LABEL[e.type]}</Badge>
                  </div>
                  {e.description && <p className="mt-0.5 text-sm text-stone-500">{e.description}</p>}
                </div>
                <div className="flex shrink-0 gap-3">
                  <button onClick={() => openEdit(e)} className="text-sm text-stone-700 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(e)} className="text-sm text-red-600 hover:underline">
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
          <button
            onClick={() => openAddForDate(selectedDate ?? "")}
            className="text-sm text-stone-700 hover:underline"
          >
            + Add event on this day
          </button>
        </div>
      </Modal>

      <Modal open={formOpen} title={editing ? "Edit Event" : "Add Event"} onClose={() => setFormOpen(false)}>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <label className={labelClass}>Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={`${inputClass} h-20`}
            />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as CalendarEventType })}
              className={inputClass}
            >
              {(Object.keys(TYPE_LABEL) as CalendarEventType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className={inputClass}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input
              type="checkbox"
              checked={form.multiDay}
              onChange={(e) => setForm({ ...form, multiDay: e.target.checked })}
            />
            Ends on a different day
          </label>
          {form.multiDay && (
            <div>
              <label className={labelClass}>End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className={inputClass}
              />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setFormOpen(false)} className={secondaryButtonClass}>
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
