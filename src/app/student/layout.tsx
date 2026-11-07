import type { ReactNode } from "react";
import { StudentNavigation } from "@/components/navigation/student-navigation";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="group min-h-screen bg-muted/30">
      <StudentNavigation />
      <div className="lg:ml-64 group-has-[[data-sidebar-collapsed=true]]:lg:ml-20">
        {children}
      </div>
    </div>
  );
}
