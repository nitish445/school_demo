"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

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
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-gray-200 bg-white p-4">
      <div className="mb-4 px-2 text-lg font-semibold text-gray-900">School Portal</div>
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-2 text-sm ${
              active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
