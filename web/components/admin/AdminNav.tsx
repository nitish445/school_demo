"use client";

import {
  LayoutDashboard,
  GraduationCap,
  Users,
  Contact,
  ShieldCheck,
  School,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  NotebookPen,
  Megaphone,
  Wallet,
  History,
  UserRound,
} from "lucide-react";
import { Sidebar, type SidebarSection } from "@/components/ui/Sidebar";

const SECTIONS: SidebarSection[] = [
  { items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "People",
    items: [
      { href: "/admin/students", label: "Students", icon: GraduationCap },
      { href: "/admin/teachers", label: "Teachers", icon: Users },
      { href: "/admin/parents", label: "Parents", icon: Contact },
      { href: "/admin/admins", label: "Admins", icon: ShieldCheck },
    ],
  },
  {
    label: "Academics",
    items: [
      { href: "/admin/classes", label: "Classes", icon: School },
      { href: "/admin/subjects", label: "Subjects", icon: BookOpen },
      { href: "/admin/attendance", label: "Attendance", icon: CalendarCheck },
      { href: "/admin/exams", label: "Exams", icon: ClipboardList },
      { href: "/admin/homework", label: "Homework", icon: NotebookPen },
      { href: "/admin/timetable", label: "Timetable", icon: CalendarDays },
    ],
  },
  {
    label: "School",
    items: [
      { href: "/admin/calendar", label: "Calendar", icon: CalendarRange },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { href: "/admin/fees", label: "Fees", icon: Wallet },
      { href: "/admin/activity", label: "Activity Log", icon: History },
    ],
  },
  { label: "Account", items: [{ href: "/admin/profile", label: "Profile", icon: UserRound }] },
];

export function AdminNav({ onNavigate, onCloseClick }: { onNavigate?: () => void; onCloseClick?: () => void }) {
  return <Sidebar sections={SECTIONS} portalName="Admin" onNavigate={onNavigate} onCloseClick={onCloseClick} />;
}
