"use client";

import { RequireRole } from "@/components/RequireRole";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminDashboardPage() {
  const { user, signOut } = useAuth();

  return (
    <RequireRole allow={["admin"]}>
      <div className="flex flex-1 flex-col p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
          <button
            onClick={() => signOut()}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Signed in as {user?.email}. Student/teacher/parent management, attendance,
          exams, fees and announcements modules are built out next.
        </p>
      </div>
    </RequireRole>
  );
}
