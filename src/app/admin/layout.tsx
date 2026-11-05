import type { ReactNode } from "react";
import { AdminNavigation } from "@/components/navigation/admin-navigation";
import { requireAdmin } from "@/lib/admin-access";

export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <div className="dashboard-shell min-h-screen bg-muted/30">
      <AdminNavigation />
      {children}
    </div>
  );
}
