"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/parent", label: "Dashboard" },
  { href: "/parent/attendance", label: "Attendance" },
  { href: "/parent/academics", label: "Academics" },
  { href: "/parent/homework", label: "Homework" },
  { href: "/parent/diary", label: "School Diary" },
  { href: "/parent/announcements", label: "Announcements" },
  { href: "/parent/fees", label: "Fees" },
  { href: "/parent/leave", label: "Leave" },
  { href: "/parent/profile", label: "Profile" },
];

export function ParentNav() {
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
