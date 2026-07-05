"use client";

import { useAuth } from "@/contexts/AuthContext";
import type { Role } from "@/types/models";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";

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

  return <FullScreenLoader />;
}
