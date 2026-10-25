import type { Prisma } from "@/generated/prisma/client";
import { getEffectiveApplicationStatuses } from "@/lib/problem-workflow";

export const displayApplicationsWhere = {
  status: { not: "WITHDRAWN" },
} satisfies Prisma.ApplicationWhereInput;

export const effectiveApplicationsWhere = {
  status: { in: getEffectiveApplicationStatuses() },
} satisfies Prisma.ApplicationWhereInput;
