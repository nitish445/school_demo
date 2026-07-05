"use client";

import { RequireRole } from "@/components/RequireRole";
import { ChildSelector } from "@/components/parent/ChildSelector";
import { ParentNav } from "@/components/parent/ParentNav";
import { PortalShell } from "@/components/ui/PortalShell";
import { SelectedChildProvider } from "@/contexts/SelectedChildContext";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allow={["parent"]}>
      <SelectedChildProvider>
        <PortalShell renderNav={(props) => <ParentNav {...props} />} topbarLeftSlot={<ChildSelector />}>
          {children}
        </PortalShell>
      </SelectedChildProvider>
    </RequireRole>
  );
}
