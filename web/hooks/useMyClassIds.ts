"use client";

import { useTeacherProfile } from "@/hooks/useTeacherProfile";

/** Class IDs the signed-in teacher can act on: their home-room class (if any) plus every class they're a subject teacher in. */
export function useMyClassIds() {
  const { data: teacher, loading } = useTeacherProfile();
  const classIds = new Set<string>();
  if (teacher?.classTeacherOf) classIds.add(teacher.classTeacherOf);
  for (const id of teacher?.assignedClassIds ?? []) classIds.add(id);
  return { classIds: Array.from(classIds), teacher, loading };
}
