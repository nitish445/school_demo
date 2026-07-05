"use client";

import { RequireRole } from "@/components/RequireRole";
import { TeacherNav } from "@/components/teacher/TeacherNav";
import { PortalShell } from "@/components/ui/PortalShell";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allow={["classTeacher", "subjectTeacher"]}>
      <PortalShell renderNav={(props) => <TeacherNav {...props} />}>{children}</PortalShell>
    </RequireRole>
  );
}
