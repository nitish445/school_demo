"use client";

import { RequireRole } from "@/components/RequireRole";
import { TeacherNav } from "@/components/teacher/TeacherNav";
import { useAuth } from "@/contexts/AuthContext";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <RequireRole allow={["classTeacher", "subjectTeacher"]}>
      <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,_#f8fbff,_#eef4ff_50%,_#f8fafc)]">
        <TeacherNav />
        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-indigo-100 bg-white/80 px-6 py-3 backdrop-blur">
            <span className="text-sm font-medium text-slate-600">{user?.email}</span>
            <button
              onClick={() => signOut()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Sign out
            </button>
          </header>
          <main className="flex-1 overflow-y-auto bg-transparent p-6">{children}</main>
        </div>
      </div>
    </RequireRole>
  );
}
