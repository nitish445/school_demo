"use client";

import { useState, type ReactNode } from "react";
import { Topbar } from "@/components/ui/Topbar";

export interface NavRenderProps {
  onNavigate?: () => void;
  onCloseClick?: () => void;
}

/**
 * Shared frame for the three portals (admin/teacher/parent): a fixed sidebar
 * on large screens, collapsing into a slide-in drawer (behind an overlay)
 * below the `lg` breakpoint, plus the Topbar with a hamburger to open it.
 * `renderNav` builds the same Nav twice (desktop + drawer) since it's cheap
 * and stateless besides the current-route highlight.
 */
export function PortalShell({
  renderNav,
  topbarLeftSlot,
  children,
}: {
  renderNav: (props: NavRenderProps) => ReactNode;
  topbarLeftSlot?: ReactNode;
  children: ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f2ecdd]">
      <div className="hidden lg:flex">{renderNav({})}</div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-stone-950/50" onClick={() => setMobileNavOpen(false)} />
          <div className="relative z-10 shadow-xl">
            {renderNav({ onNavigate: () => setMobileNavOpen(false), onCloseClick: () => setMobileNavOpen(false) })}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar leftSlot={topbarLeftSlot} onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
