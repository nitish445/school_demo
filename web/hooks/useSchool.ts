"use client";

import { useSchoolId } from "@/hooks/useSchoolId";
import { useDoc } from "@/hooks/useDoc";
import type { School } from "@/types/models";

/** The signed-in user's School document (name, working days, holidays, etc.). */
export function useSchool() {
  const schoolId = useSchoolId();
  return useDoc<School>(schoolId ? `schools/${schoolId}` : null);
}
