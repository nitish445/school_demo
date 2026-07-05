"use client";

import { documentId, where } from "firebase/firestore";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import { useEffectiveChildId } from "@/hooks/useEffectiveChildId";
import { useSelectedChild } from "@/contexts/SelectedChildContext";
import type { Student } from "@/types/models";
import { inputClass } from "@/components/ui/formStyles";

export function ChildSelector() {
  const schoolId = useSchoolId();
  const { childStudentIds, effectiveChildId } = useEffectiveChildId();
  const { setSelectedChildId } = useSelectedChild();
  // Scoped to just this parent's own children -- a parent can't list the
  // whole school's students collection (rules only grant per-child reads
  // via isMyChild), so an unconstrained query silently returned nothing and
  // the dropdown fell back to showing raw document IDs.
  const { data: students } = useCollection<Student>(
    schoolId && childStudentIds.length > 0 ? `schools/${schoolId}/students` : null,
    childStudentIds.length > 0 ? [where(documentId(), "in", childStudentIds.slice(0, 10))] : [],
    [childStudentIds.join(",")]
  );

  if (childStudentIds.length <= 1) return null;

  return (
    <select
      value={effectiveChildId}
      onChange={(e) => setSelectedChildId(e.target.value)}
      className={`${inputClass} w-auto`}
    >
      {childStudentIds.map((id) => (
        <option key={id} value={id}>
          {students.find((s) => s.id === id)?.name ?? id}
        </option>
      ))}
    </select>
  );
}
