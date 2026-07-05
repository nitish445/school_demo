"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEvent, CalendarEventType } from "@/types/models";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TYPE_DOT_CLASS: Record<CalendarEventType, string> = {
  holiday: "bg-rose-500",
  exam: "bg-amber-500",
  ptm: "bg-sky-500",
  event: "bg-emerald-500",
  other: "bg-stone-400",
};

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function eventTouchesDate(e: CalendarEvent, iso: string): boolean {
  if (!e.endDate) return e.date === iso;
  return e.date <= iso && iso <= e.endDate;
}

export function MonthCalendar({
  events,
  holidays = [],
  onDayClick,
}: {
  events: CalendarEvent[];
  holidays?: string[];
  onDayClick?: (dateIso: string) => void;
}) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const gridStart = new Date(year, month, 1 - startWeekday);
  // Built relative to gridStart's own year/month/date (which may already be
  // the previous month), not the visible month -- combining gridStart's
  // day-of-month with the visible month's year/month would silently produce
  // dates in the wrong month whenever the 1st isn't a Sunday.
  const cells = Array.from(
    { length: 42 },
    (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
  );

  const todayIso = isoDate(new Date());
  const holidaySet = new Set(holidays);

  return (
    <div className="rounded-xl border border-stone-200/80 bg-white shadow-[0_2px_10px_-2px_rgba(41,27,10,0.06)]">
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
        <h2 className="font-serif text-lg font-semibold tracking-tight text-stone-900">
          {MONTH_NAMES[month]} {year}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setVisibleMonth(new Date(year, month - 1, 1))}
            aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            onClick={() => setVisibleMonth(new Date(year, month, 1))}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-stone-600 transition hover:bg-stone-100"
          >
            Today
          </button>
          <button
            onClick={() => setVisibleMonth(new Date(year, month + 1, 1))}
            aria-label="Next month"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-stone-100">
        {DAY_NAMES.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs font-semibold tracking-wide text-stone-500 uppercase">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const iso = isoDate(d);
          const inMonth = d.getMonth() === month;
          const dayEvents = events.filter((e) => eventTouchesDate(e, iso));
          const isHoliday = holidaySet.has(iso);
          const isToday = iso === todayIso;
          const shownDots = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - shownDots.length;

          return (
            <button
              key={iso}
              onClick={() => onDayClick?.(iso)}
              className={`flex min-h-[64px] flex-col items-start gap-1 border-b border-r border-stone-100 p-1.5 text-left transition last:border-r-0 hover:bg-stone-50 sm:min-h-[88px] sm:p-2 ${
                inMonth ? "" : "bg-stone-50/50"
              } ${isHoliday ? "bg-rose-50/60" : ""}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday
                    ? "bg-stone-900 font-semibold text-white"
                    : inMonth
                      ? "text-stone-700"
                      : "text-stone-300"
                }`}
              >
                {d.getDate()}
              </span>
              {shownDots.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {shownDots.map((e) => (
                    <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT_CLASS[e.type]}`} title={e.title} />
                  ))}
                  {overflow > 0 && <span className="text-[10px] text-stone-400">+{overflow}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
