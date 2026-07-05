"use client";

import { RequireRole } from "@/components/RequireRole";
import { AdminNav } from "@/components/admin/AdminNav";
import { PortalShell } from "@/components/ui/PortalShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allow={["admin"]}>
      <PortalShell renderNav={(props) => <AdminNav {...props} />}>{children}</PortalShell>
    </RequireRole>
  );
}
