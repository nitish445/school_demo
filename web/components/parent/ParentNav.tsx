"use client";

import {
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  GraduationCap,
  NotebookPen,
  BookOpen,
  Megaphone,
  Wallet,
  CalendarClock,
  UserRound,
  Users,
} from "lucide-react";
import { Sidebar, type SidebarSection } from "@/components/ui/Sidebar";

const SECTIONS: SidebarSection[] = [
  { items: [{ href: "/parent", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "My Child",
    items: [
      { href: "/parent/attendance", label: "Attendance", icon: CalendarCheck },
      { href: "/parent/academics", label: "Academics", icon: GraduationCap },
      { href: "/parent/homework", label: "Homework", icon: NotebookPen },
      { href: "/parent/diary", label: "School Diary", icon: BookOpen },
      { href: "/parent/timetable", label: "Timetable", icon: CalendarDays },
    ],
  },
  {
    label: "School",
    items: [
      { href: "/parent/teachers", label: "Teachers", icon: Users },
      { href: "/parent/calendar", label: "Calendar", icon: CalendarRange },
      { href: "/parent/announcements", label: "Announcements", icon: Megaphone },
      { href: "/parent/fees", label: "Fees", icon: Wallet },
      { href: "/parent/leave", label: "Leave", icon: CalendarClock },
    ],
  },
  { label: "Account", items: [{ href: "/parent/profile", label: "Profile", icon: UserRound }] },
];

export function ParentNav({ onNavigate, onCloseClick }: { onNavigate?: () => void; onCloseClick?: () => void }) {
  return <Sidebar sections={SECTIONS} portalName="Parent" onNavigate={onNavigate} onCloseClick={onCloseClick} />;
}
