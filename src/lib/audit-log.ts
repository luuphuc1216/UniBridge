import type { Prisma } from "@/generated/prisma/client";

type AuditMetadataValue = string | number | boolean | null;

export type AuditMetadata = Record<string, AuditMetadataValue>;

const sensitiveMetadataKey = /(password|token|secret|credential|authorization)/i;

export function serializeAuditMetadata(metadata: AuditMetadata = {}): string {
  for (const key of Object.keys(metadata)) {
    if (sensitiveMetadataKey.test(key)) {
      throw new Error(`Sensitive audit metadata is not allowed: ${key}`);
    }
  }
  return JSON.stringify(metadata);
}

export async function writeAuditLog(
  transaction: Prisma.TransactionClient,
  input: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: AuditMetadata;
  },
): Promise<void> {
  await transaction.auditLog.create({
    data: {
      ...input,
      metadata: serializeAuditMetadata(input.metadata),
    },
  });
}
