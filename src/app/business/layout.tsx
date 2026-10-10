import type { ReactNode } from "react";
import { BusinessNavigation } from "@/components/navigation/business-navigation";

export default function BusinessLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <BusinessNavigation />
      {children}
    </div>
  );
}
