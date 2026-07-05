"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, X, type LucideIcon } from "lucide-react";

export interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface SidebarSection {
  label?: string;
  items: SidebarItem[];
}

export function Sidebar({
  sections,
  portalName,
  onNavigate,
  onCloseClick,
}: {
  sections: SidebarSection[];
  portalName: string;
  /** Called when a nav link is clicked -- lets the mobile drawer close itself. */
  onNavigate?: () => void;
  /** Renders a close (X) button in the header; only passed when shown as a mobile drawer. */
  onCloseClick?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex h-full w-64 shrink-0 flex-col bg-linear-to-b from-stone-900 to-stone-950">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-amber-300 to-amber-600 text-stone-900 shadow-sm shadow-amber-900/40">
          <GraduationCap className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <span className="font-serif text-base font-semibold tracking-tight text-white">
          {portalName} Portal
        </span>
        {onCloseClick && (
          <button
            onClick={onCloseClick}
            aria-label="Close menu"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
        {sections.map((section, sectionIndex) => (
          <div key={section.label ?? sectionIndex} className="flex flex-col gap-0.5">
            {section.label && (
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-stone-500 uppercase">
                {section.label}
              </p>
            )}
            {section.items.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`group flex items-center gap-2.5 rounded-lg border-l-2 px-3 py-2 text-sm transition ${
                    active
                      ? "border-amber-400 bg-linear-to-r from-amber-400/10 to-transparent font-medium text-amber-300"
                      : "border-transparent text-stone-400 hover:bg-white/5 hover:text-stone-100"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${active ? "text-amber-400" : "text-stone-500 group-hover:text-stone-300"}`}
                    strokeWidth={2}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
