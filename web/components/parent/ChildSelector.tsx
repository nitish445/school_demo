"use client";

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
  const { data: students } = useCollection<Student>(schoolId ? `schools/${schoolId}/students` : null);

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
