import type { ReactNode } from "react";
import { StudentNavigation } from "@/components/navigation/student-navigation";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dashboard-shell min-h-screen bg-muted/30">
      <StudentNavigation />
      {children}
    </div>
  );
}
