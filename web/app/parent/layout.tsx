"use client";

import { RequireRole } from "@/components/RequireRole";
import { ParentNav } from "@/components/parent/ParentNav";
import { ChildSelector } from "@/components/parent/ChildSelector";
import { SelectedChildProvider } from "@/contexts/SelectedChildContext";
import { useAuth } from "@/contexts/AuthContext";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <RequireRole allow={["parent"]}>
      <SelectedChildProvider>
        <div className="flex flex-1">
          <ParentNav />
          <div className="flex flex-1 flex-col">
            <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
              <ChildSelector />
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">{user?.email}</span>
                <button
                  onClick={() => signOut()}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Sign out
                </button>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        </div>
      </SelectedChildProvider>
    </RequireRole>
  );
}
