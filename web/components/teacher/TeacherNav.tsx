"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";

const COMMON_ITEMS = [
  { href: "/teacher", label: "Dashboard" },
  { href: "/teacher/attendance", label: "Attendance" },
  { href: "/teacher/students", label: "Students" },
  { href: "/teacher/homework", label: "Homework" },
  { href: "/teacher/marks", label: "Marks" },
  { href: "/teacher/announcements", label: "Announcements" },
];

// Only the class (home-room) teacher gets these -- behaviour notes, diary,
// and leave approval are scoped to the class teacher by the Firestore rules.
const CLASS_TEACHER_ITEMS = [
  { href: "/teacher/behaviour", label: "Behaviour" },
  { href: "/teacher/diary", label: "Daily Diary" },
  { href: "/teacher/leave", label: "Leave Approval" },
];

export function TeacherNav() {
  const pathname = usePathname();
  const { claims } = useAuth();
  const items =
    claims?.role === "classTeacher" ? [...COMMON_ITEMS, ...CLASS_TEACHER_ITEMS] : COMMON_ITEMS;

  return (
    <nav className="flex w-60 shrink-0 flex-col gap-1 border-r border-indigo-100 bg-[linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_100%)] p-4">
      <div className="mb-4 rounded-xl bg-indigo-600 px-3 py-3 text-sm font-semibold text-white shadow-sm">
        School Portal
      </div>
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              active ? "bg-indigo-600 text-white shadow-sm" : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
