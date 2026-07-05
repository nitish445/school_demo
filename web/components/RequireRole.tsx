"use client";

import { useAuth } from "@/contexts/AuthContext";
import type { Role } from "@/types/models";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";

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
  const { user, claims, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const resolvedRole = (profile?.role ?? claims?.role ?? "admin") as Role;
  const disabled = profile?.status === "disabled";
  // Signing out (below) clears `profile`, so `disabled` flips back to false
  // on the next render -- without this flag, the plain `!user` branch would
  // then fire its own bare "/login" redirect and race the "?disabled=1" one.
  const [disabling, setDisabling] = useState(false);

  useEffect(() => {
    if (loading) return;
    // Caught live (not just on next login) since AuthContext subscribes to
    // this doc -- e.g. the Principal disabling this account mid-session.
    if (disabled && !disabling) {
      // Intentional one-shot latch in response to a live external signal,
      // not a render loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisabling(true);
      signOut().then(() => router.replace("/login?disabled=1"));
      return;
    }
    if (!user) {
      if (disabling) return;
      router.replace("/login");
      return;
    }
    if (!allow.includes(resolvedRole)) {
      router.replace(DASHBOARD_PATH[resolvedRole]);
    }
  }, [loading, user, disabled, disabling, resolvedRole, allow, router, signOut]);

  if (loading || !user || disabled || disabling || !allow.includes(resolvedRole)) {
    return <FullScreenLoader />;
  }

  return <>{children}</>;
}
