"use client";

import { RequireRole } from "@/components/RequireRole";
import { ChildSelector } from "@/components/parent/ChildSelector";
import { ParentNav } from "@/components/parent/ParentNav";
import { useAuth } from "@/contexts/AuthContext";
import { SelectedChildProvider } from "@/contexts/SelectedChildContext";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <RequireRole allow={["parent"]}>
      <SelectedChildProvider>
        <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,_#f8fbff,_#eef4ff_50%,_#f8fafc)]">
          <ParentNav />
          <div className="flex flex-1 flex-col">
            <header className="flex items-center justify-between border-b border-indigo-100 bg-white/80 px-6 py-3 backdrop-blur">
              <ChildSelector />
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-600">{user?.email}</span>
                <button
                  onClick={() => signOut()}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Sign out
                </button>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto bg-transparent p-6">{children}</main>
          </div>
        </div>
      </SelectedChildProvider>
    </RequireRole>
  );
}
