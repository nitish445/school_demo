"use client";

import { useMemo, useState } from "react";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useCollection } from "@/hooks/useCollection";
import type { Teacher, SchoolClass, Subject } from "@/types/models";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { inputClass, labelClass, pageHeadingClass } from "@/components/ui/formStyles";

export default function ParentTeacherDirectoryPage() {
  const schoolId = useSchoolId();
  const { data: teachers, loading } = useCollection<Teacher>(schoolId ? `schools/${schoolId}/teachers` : null);
  const { data: classes } = useCollection<SchoolClass>(schoolId ? `schools/${schoolId}/classes` : null);
  const { data: subjects } = useCollection<Subject>(schoolId ? `schools/${schoolId}/subjects` : null);

  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const filtered = teachers
    .filter((t) => t.status === "active")
    .filter((t) => !search || t.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((t) => {
      if (!classFilter) return true;
      if (t.classTeacherOf === classFilter) return true;
      return (t.assignments ?? []).some((a) => a.classId === classFilter);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <h1 className={`${pageHeadingClass} mb-6`}>Teachers</h1>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className={labelClass}>Search by name</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. Priya"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Class</label>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className={inputClass}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.grade}-{c.section}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState title="No teachers match." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const homeRoom = classById.get(t.classTeacherOf ?? "");
            const taught = (t.assignments ?? [])
              .map((a) => {
                const c = classById.get(a.classId);
                const s = subjectById.get(a.subjectId);
                return c && s ? `${s.name} (${c.grade}-${c.section})` : null;
              })
              .filter(Boolean);

            return (
              <Card key={t.id} className="flex gap-3">
                <Avatar name={t.name} photoUrl={t.photoUrl} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-900">{t.name}</p>
                  <p className="truncate text-xs text-stone-500">{t.email ?? "—"}</p>
                  <p className="mt-2 text-xs text-stone-600">
                    <span className="font-medium text-stone-700">Class Teacher of: </span>
                    {homeRoom ? `${homeRoom.grade}-${homeRoom.section}` : "—"}
                  </p>
                  <p className="mt-1 text-xs text-stone-600">
                    <span className="font-medium text-stone-700">Teaches: </span>
                    {taught.length > 0 ? taught.join(", ") : "—"}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
