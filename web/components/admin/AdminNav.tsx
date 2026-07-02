"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/teachers", label: "Teachers" },
  { href: "/admin/parents", label: "Parents" },
  { href: "/admin/classes", label: "Classes" },
  { href: "/admin/subjects", label: "Subjects" },
  { href: "/admin/attendance", label: "Attendance" },
  { href: "/admin/exams", label: "Exams" },
  { href: "/admin/homework", label: "Homework" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/fees", label: "Fees" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex w-60 shrink-0 flex-col gap-1 border-r border-indigo-100 bg-[linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_100%)] p-4">
      <div className="mb-4 rounded-xl bg-indigo-600 px-3 py-3 text-sm font-semibold text-white shadow-sm">
        School Portal
      </div>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
