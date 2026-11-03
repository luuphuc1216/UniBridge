import assert from "node:assert/strict";
import test from "node:test";
import { createTestDatabase } from "@/lib/test-database";
import { serializeAuditMetadata, writeAuditLog } from "./audit-log";

test("serializes safe audit metadata as JSON", () => {
  assert.equal(
    serializeAuditMetadata({ status: "APPROVED", count: 2, changed: true }),
    '{"status":"APPROVED","count":2,"changed":true}',
  );
});

test("rejects sensitive fields from audit metadata", () => {
  assert.throws(
    () => serializeAuditMetadata({ resetToken: "secret" }),
    /Sensitive audit metadata/,
  );
});

test("writes audit events transactionally and rejects updates or deletion", async () => {
  const database = await createTestDatabase("unibridge-audit-log");
  try {
    await database.prisma.$transaction((transaction) =>
      writeAuditLog(transaction, {
        actorId: "buyer",
        action: "TEST_ACTION",
        targetType: "User",
        targetId: "buyer",
        metadata: { safe: true },
      }),
    );
    const log = await database.prisma.auditLog.findFirstOrThrow({
      where: { action: "TEST_ACTION" },
    });
    await assert.rejects(
      database.prisma.auditLog.update({
        where: { id: log.id },
        data: { action: "CHANGED" },
      }),
    );
    await assert.rejects(database.prisma.auditLog.delete({ where: { id: log.id } }));
    assert.equal(
      await database.prisma.auditLog.findUniqueOrThrow({ where: { id: log.id } }).then(({ action }) => action),
      "TEST_ACTION",
    );
  } finally {
    await database.close();
  }
});
