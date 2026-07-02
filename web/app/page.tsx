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

export default function Home() {
  const { user, claims, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user && claims?.role) {
      router.replace(DASHBOARD_PATH[claims.role]);
    } else {
      router.replace("/login");
    }
  }, [loading, user, claims, router]);

  return (
    <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
      Loading...
    </div>
  );
}
