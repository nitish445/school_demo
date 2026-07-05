"use client";

import { useState } from "react";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSchool } from "@/hooks/useSchool";
import { useCollection } from "@/hooks/useCollection";
import type { CalendarEvent, CalendarEventType } from "@/types/models";
import { MonthCalendar, eventTouchesDate } from "@/components/calendar/MonthCalendar";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";

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

export default function ParentCalendarPage() {
  const schoolId = useSchoolId();
  const { data: school } = useSchool();
  const { data: events } = useCollection<CalendarEvent>(schoolId ? `schools/${schoolId}/events` : null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const dayEvents = selectedDate ? events.filter((e) => eventTouchesDate(e, selectedDate)) : [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">Calendar</h1>

      <MonthCalendar events={events} holidays={school?.holidays ?? []} onDayClick={setSelectedDate} />

      <Modal open={!!selectedDate} title={selectedDate ?? ""} onClose={() => setSelectedDate(null)}>
        <div className="space-y-3">
          {dayEvents.length === 0 ? (
            <p className="text-sm text-stone-500">No events on this day.</p>
          ) : (
            dayEvents.map((e) => (
              <div key={e.id} className="border-b border-stone-100 pb-3 last:border-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-stone-900">{e.title}</p>
                  <Badge variant={TYPE_BADGE_VARIANT[e.type]}>{TYPE_LABEL[e.type]}</Badge>
                </div>
                {e.description && <p className="mt-0.5 text-sm text-stone-500">{e.description}</p>}
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
