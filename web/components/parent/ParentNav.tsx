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
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-gray-200 bg-white p-4">
      <div className="mb-4 px-2 text-lg font-semibold text-gray-900">School Portal</div>
      {NAV_ITEMS.map((item) => {
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
