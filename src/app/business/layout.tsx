import type { ReactNode } from "react";
import { BusinessNavigation } from "@/components/navigation/business-navigation";

export const instant = false;

export default function BusinessLayout({ children }: { children: ReactNode }) {
  return (
    <div className="group min-h-screen bg-muted/30">
      <BusinessNavigation />
      <div className="min-w-0 lg:ml-64 group-has-[[data-sidebar-collapsed=true]]:lg:ml-20">
        {children}
      </div>
    </div>
  );
}
