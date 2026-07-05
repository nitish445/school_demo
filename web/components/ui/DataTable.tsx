"use client";

import type { ReactNode } from "react";

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  emptyMessage = "No records yet.",
}: {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-200 bg-white/60 py-10 text-center text-sm text-stone-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200/80 bg-white shadow-[0_2px_10px_-2px_rgba(41,27,10,0.06)]">
      <table className="min-w-full divide-y divide-stone-200 text-sm">
        <thead className="bg-stone-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.header}
                className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-stone-500"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 bg-white">
          {rows.map((row) => (
            <tr key={row.id} className="transition hover:bg-stone-50">
              {columns.map((col) => (
                <td key={col.header} className="px-4 py-2.5 text-stone-700">
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
