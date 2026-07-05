import type { LucideIcon } from "lucide-react";

const TINTS = {
  gold: "bg-linear-to-br from-amber-200 to-amber-400 text-amber-900",
  emerald: "bg-linear-to-br from-emerald-100 to-emerald-200 text-emerald-700",
  amber: "bg-linear-to-br from-amber-100 to-amber-200 text-amber-700",
  sky: "bg-linear-to-br from-sky-100 to-sky-200 text-sky-700",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tint = "gold",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tint?: keyof typeof TINTS;
}) {
  return (
    <div className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-[0_2px_10px_-2px_rgba(41,27,10,0.06)]">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-inner ${TINTS[tint]}`}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-xs leading-snug font-medium tracking-wide text-stone-500 uppercase">{label}</p>
          <p className="mt-0.5 font-serif text-xl leading-tight font-semibold tracking-tight text-stone-900">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
