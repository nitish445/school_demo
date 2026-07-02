"use client";

import { useAuth } from "@/contexts/AuthContext";
import type { Role } from "@/types/models";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const DASHBOARD_PATH: Record<Role, string> = {
  admin: "/admin",
  classTeacher: "/teacher",
  subjectTeacher: "/teacher",
  parent: "/parent",
};

export function RequireRole({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  const { user, claims, profile, loading } = useAuth();
  const router = useRouter();
  const resolvedRole = (profile?.role ?? claims?.role ?? "admin") as Role;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!allow.includes(resolvedRole)) {
      router.replace(DASHBOARD_PATH[resolvedRole]);
    }
  }, [loading, user, resolvedRole, allow, router]);

  if (loading || !user || !allow.includes(resolvedRole)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#eef4ff,_#f8fbff_55%,_#eef2ff)] p-10 text-sm font-medium text-slate-600">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
