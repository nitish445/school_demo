"use client";

import type { ReactNode } from "react";
import { LogOut, Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar } from "@/components/ui/Avatar";

export function Topbar({ leftSlot, onMenuClick }: { leftSlot?: ReactNode; onMenuClick?: () => void }) {
  const { user, profile, signOut } = useAuth();

  return (
    <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-stone-900 px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            aria-label="Open menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-300 transition hover:bg-white/5 lg:hidden"
          >
            <Menu className="h-5 w-5" strokeWidth={2} />
          </button>
        )}
        <div className="min-w-0">{leftSlot}</div>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <Avatar name={profile?.displayName ?? user?.email ?? "?"} photoUrl={profile?.photoUrl} size="sm" />
          <span className="hidden text-sm font-medium text-stone-300 sm:inline">{user?.email}</span>
        </div>
        <button
          onClick={() => signOut()}
          aria-label="Sign out"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-800 px-2.5 py-1.5 text-sm font-medium text-stone-200 transition hover:bg-stone-700 sm:px-3"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
