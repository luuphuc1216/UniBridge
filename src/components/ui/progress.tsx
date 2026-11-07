import * as React from "react";

import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, ...props }, ref) => {
    const normalizedMax = Number.isFinite(max) && max > 0 ? max : 100;
    const normalizedValue = Number.isFinite(value)
      ? Math.min(normalizedMax, Math.max(0, value))
      : 0;
    const percent = (normalizedValue / normalizedMax) * 100;

    return (
      <div
        {...props}
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={normalizedMax}
        aria-valuenow={normalizedValue}
        className={cn("relative h-2.5 w-full overflow-hidden rounded-full bg-secondary", className)}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };
