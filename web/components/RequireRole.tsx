"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import type { Role } from "@/types/models";

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
  const { user, claims, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !claims?.role) {
      router.replace("/login");
      return;
    }
    if (!allow.includes(claims.role)) {
      router.replace(DASHBOARD_PATH[claims.role]);
    }
  }, [loading, user, claims, allow, router]);

  if (loading || !user || !claims?.role || !allow.includes(claims.role)) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-sm text-gray-500">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
