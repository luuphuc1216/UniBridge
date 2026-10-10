import type { ReactNode } from "react";
import { AdminNavigation } from "@/components/navigation/admin-navigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <AdminNavigation />
      {children}
    </div>
  );
}
