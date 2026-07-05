"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-stone-200/80 bg-white shadow-[0_20px_60px_-15px_rgba(41,27,10,0.35)]">
        <div className="flex shrink-0 items-center justify-between p-6 pb-4">
          <h2 className="font-serif text-lg font-semibold tracking-tight text-stone-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}
