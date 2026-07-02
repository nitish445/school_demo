"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useDoc } from "@/hooks/useDoc";
import type { Teacher } from "@/types/models";

/** The signed-in teacher's own profile doc (assignments, classTeacherOf, ...). */
export function useTeacherProfile() {
  const { user } = useAuth();
  const schoolId = useSchoolId();
  return useDoc<Teacher>(schoolId && user ? `schools/${schoolId}/teachers/${user.uid}` : null);
}
