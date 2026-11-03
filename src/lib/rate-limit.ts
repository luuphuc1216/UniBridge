import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { Prisma as PrismaTypes } from "@/generated/prisma/client";

type Transaction = PrismaTypes.TransactionClient;

export async function consumeRateLimit(
  transaction: Transaction,
  {
    scope,
    identifier,
    limit,
    windowMs,
    now = new Date(),
  }: {
    scope: string;
    identifier: string;
    limit: number;
    windowMs: number;
    now?: Date;
  },
): Promise<boolean> {
  const key = createHash("sha256")
    .update(`${scope}\u0000${identifier}`)
    .digest("hex");
  const cutoff = new Date(now.getTime() - windowMs);
  const rows = await transaction.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStartedAt", "updatedAt")
    VALUES (${key}, 1, ${now}, ${now})
    ON CONFLICT("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."windowStartedAt" <= ${cutoff} THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "RateLimitBucket"."windowStartedAt" <= ${cutoff} THEN ${now}
        ELSE "RateLimitBucket"."windowStartedAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count"
  `);
  return rows[0]?.count <= limit;
}

export async function isRateLimitReached(
  transaction: Transaction,
  {
    scope,
    identifier,
    limit,
    windowMs,
    now = new Date(),
  }: {
    scope: string;
    identifier: string;
    limit: number;
    windowMs: number;
    now?: Date;
  },
): Promise<boolean> {
  const key = createHash("sha256")
    .update(`${scope}\u0000${identifier}`)
    .digest("hex");
  const rows = await transaction.$queryRaw<Array<{ count: number; windowStartedAt: Date }>>(
    Prisma.sql`SELECT "count", "windowStartedAt" FROM "RateLimitBucket" WHERE "key" = ${key}`,
  );
  const bucket = rows[0];
  return Boolean(
    bucket &&
      bucket.windowStartedAt.getTime() > now.getTime() - windowMs &&
      bucket.count >= limit,
  );
}

export function getTrustedClientIp(headers: Headers): string | null {
  if (process.env.TRUST_PROXY !== "true") return null;
  const forwardedFor = headers.get("x-forwarded-for");
  const firstAddress = forwardedFor?.split(",")[0]?.trim();
  return firstAddress || null;
}
