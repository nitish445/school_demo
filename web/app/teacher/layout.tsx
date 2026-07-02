"use client";

import { RequireRole } from "@/components/RequireRole";
import { TeacherNav } from "@/components/teacher/TeacherNav";
import { useAuth } from "@/contexts/AuthContext";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <RequireRole allow={["classTeacher", "subjectTeacher"]}>
      <div className="flex flex-1">
        <TeacherNav />
        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
            <span className="text-sm text-gray-500">{user?.email}</span>
            <button
              onClick={() => signOut()}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Sign out
            </button>
          </header>
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </RequireRole>
  );
}
