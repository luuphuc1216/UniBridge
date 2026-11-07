import type { ReactNode } from "react";
import { AdminNavigation } from "@/components/navigation/admin-navigation";
import { requireAdmin } from "@/lib/admin-access";

export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <div className="group min-h-screen bg-background">
      <AdminNavigation />
      <div className="lg:pl-64 group-has-[[data-sidebar-collapsed=true]]:lg:pl-20">
        {children}
      </div>
    </div>
  );
}
