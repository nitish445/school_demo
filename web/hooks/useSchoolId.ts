"use client";

import { useAuth } from "@/contexts/AuthContext";

/** The signed-in user's school, from their custom claims. Empty string while loading. */
export function useSchoolId(): string {
  const { claims } = useAuth();
  return claims?.schoolId ?? "";
}
