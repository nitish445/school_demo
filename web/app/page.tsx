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

export default function Home() {
  const { user, claims, profile, loading } = useAuth();
  const router = useRouter();
  const resolvedRole = (profile?.role ?? claims?.role ?? "admin") as Role;

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace(DASHBOARD_PATH[resolvedRole]);
    } else {
      router.replace("/login");
    }
  }, [loading, user, resolvedRole, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#eef4ff,_#f8fbff_55%,_#eef2ff)] text-sm font-medium text-slate-600">
      Loading...
    </div>
  );
}
