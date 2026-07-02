"use client";

import { useParentProfile } from "@/hooks/useParentProfile";
import { useSelectedChild } from "@/contexts/SelectedChildContext";

/** The child currently in view: the parent's explicit selection, or their first linked child. */
export function useEffectiveChildId() {
  const { data: parent, loading } = useParentProfile();
  const { selectedChildId } = useSelectedChild();
  const childStudentIds = parent?.childStudentIds ?? [];
  const effectiveChildId = selectedChildId || childStudentIds[0] || "";
  return { effectiveChildId, childStudentIds, loading };
}
