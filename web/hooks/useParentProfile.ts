"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useDoc } from "@/hooks/useDoc";
import type { Parent } from "@/types/models";

/** The signed-in parent's own profile doc (childStudentIds, ...). */
export function useParentProfile() {
  const { user } = useAuth();
  const schoolId = useSchoolId();
  return useDoc<Parent>(schoolId && user ? `schools/${schoolId}/parents/${user.uid}` : null);
}
