"use client";

import {
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  GraduationCap,
  NotebookPen,
  Award,
  Megaphone,
  Star,
  BookOpen,
  CalendarClock,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar, type SidebarItem, type SidebarSection } from "@/components/ui/Sidebar";

const ACADEMICS_ITEMS: SidebarItem[] = [
  { href: "/teacher/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/teacher/students", label: "Students", icon: GraduationCap },
  { href: "/teacher/homework", label: "Homework", icon: NotebookPen },
  { href: "/teacher/marks", label: "Marks", icon: Award },
  { href: "/teacher/timetable", label: "Timetable", icon: CalendarDays },
];

// Only the class (home-room) teacher gets these -- behaviour notes, diary,
// and leave approval are scoped to the class teacher by the Firestore rules.
const CLASS_TEACHER_ITEMS: SidebarItem[] = [
  { href: "/teacher/behaviour", label: "Behaviour", icon: Star },
  { href: "/teacher/diary", label: "Daily Diary", icon: BookOpen },
  { href: "/teacher/leave", label: "Leave Approval", icon: CalendarClock },
];

export function TeacherNav({ onNavigate, onCloseClick }: { onNavigate?: () => void; onCloseClick?: () => void }) {
  const { claims } = useAuth();
  const isClassTeacher = claims?.role === "classTeacher";

  const sections: SidebarSection[] = [
    { items: [{ href: "/teacher", label: "Dashboard", icon: LayoutDashboard }] },
    { label: "Academics", items: ACADEMICS_ITEMS },
    ...(isClassTeacher ? [{ label: "Class Teacher", items: CLASS_TEACHER_ITEMS }] : []),
    {
      label: "School",
      items: [
        { href: "/teacher/calendar", label: "Calendar", icon: CalendarRange },
        { href: "/teacher/announcements", label: "Announcements", icon: Megaphone },
      ],
    },
    { label: "Account", items: [{ href: "/teacher/profile", label: "Profile", icon: UserRound }] },
  ];

  return <Sidebar sections={sections} portalName="Teacher" onNavigate={onNavigate} onCloseClick={onCloseClick} />;
}
