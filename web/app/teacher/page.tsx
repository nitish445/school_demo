"use client";

import { RequireRole } from "@/components/RequireRole";
import { useAuth } from "@/contexts/AuthContext";

export default function TeacherDashboardPage() {
  const { user, signOut } = useAuth();

  return (
    <RequireRole allow={["classTeacher", "subjectTeacher"]}>
      <div className="flex flex-1 flex-col p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Teacher Dashboard</h1>
          <button
            onClick={() => signOut()}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Signed in as {user?.email}. Attendance, homework, marks, behaviour notes
          and diary modules are built out next.
        </p>
      </div>
    </RequireRole>
  );
}
