import type { Prisma } from "@/generated/prisma/client";

export const activeApplicationsWhere = {
  status: { not: "WITHDRAWN" },
} satisfies Prisma.ApplicationWhereInput;
