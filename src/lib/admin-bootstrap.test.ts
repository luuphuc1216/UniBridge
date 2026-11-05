import assert from "node:assert/strict";
import { compare } from "bcryptjs";
import { describe, it } from "node:test";
import { createTestDatabase } from "@/lib/test-database";
import {
  AdminBootstrapError,
  createInitialAdmin,
} from "./admin-bootstrap";

const adminInput = {
  email: "  FIRST.ADMIN@EXAMPLE.COM ",
  name: "First Admin",
  password: "A-strong-password-123",
};

describe("production Admin bootstrap", () => {
  it("creates the first Admin and records an audit event", async () => {
    const database = await createTestDatabase("unibridge-admin-bootstrap-create");
    try {
      const created = await createInitialAdmin(database.prisma, adminInput);
      const admin = await database.prisma.user.findUniqueOrThrow({
        where: { id: created.id },
      });
      const audit = await database.prisma.auditLog.findFirstOrThrow({
        where: { action: "ADMIN_BOOTSTRAPPED" },
      });

      assert.equal(created.email, "first.admin@example.com");
      assert.equal(admin.role, "ADMIN");
      assert.equal(admin.accountStatus, "ACTIVE");
      assert.equal(admin.authVersion, 0);
      assert.equal(await compare(adminInput.password, admin.passwordHash), true);
      assert.equal(audit.actorId, admin.id);
      assert.equal(audit.targetId, admin.id);
      assert.deepEqual(JSON.parse(audit.metadata), {
        source: "production-bootstrap",
      });
      assert.equal(audit.metadata.includes(admin.email), false);
    } finally {
      await database.close();
    }
  });

  it("rejects a second Admin without changing users or audit logs", async () => {
    const database = await createTestDatabase("unibridge-admin-bootstrap-repeat");
    try {
      await createInitialAdmin(database.prisma, adminInput);
      const before = {
        users: await database.prisma.user.count(),
        auditLogs: await database.prisma.auditLog.count(),
      };

      await assert.rejects(
        createInitialAdmin(database.prisma, {
          ...adminInput,
          email: "second.admin@example.com",
        }),
        AdminBootstrapError,
      );

      assert.deepEqual(
        {
          users: await database.prisma.user.count(),
          auditLogs: await database.prisma.auditLog.count(),
        },
        before,
      );
    } finally {
      await database.close();
    }
  });

  it("rejects an existing email without changing that user's role", async () => {
    const database = await createTestDatabase("unibridge-admin-bootstrap-email");
    try {
      const existingUser = await database.prisma.user.findUniqueOrThrow({
        where: { email: "buyer@example.com" },
      });
      const before = {
        users: await database.prisma.user.count(),
        auditLogs: await database.prisma.auditLog.count(),
      };

      await assert.rejects(
        createInitialAdmin(database.prisma, {
          ...adminInput,
          email: " BUYER@EXAMPLE.COM ",
        }),
        AdminBootstrapError,
      );

      const unchangedUser = await database.prisma.user.findUniqueOrThrow({
        where: { id: existingUser.id },
      });
      assert.equal(unchangedUser.role, existingUser.role);
      assert.equal(unchangedUser.passwordHash, existingUser.passwordHash);
      assert.deepEqual(
        {
          users: await database.prisma.user.count(),
          auditLogs: await database.prisma.auditLog.count(),
        },
        before,
      );
    } finally {
      await database.close();
    }
  });

  it("rejects a short password without exposing it in the error", async () => {
    const database = await createTestDatabase("unibridge-admin-bootstrap-short");
    const password = "tiny-secret";
    try {
      await assert.rejects(
        createInitialAdmin(database.prisma, { ...adminInput, password }),
        (error: unknown) => {
          assert.ok(error instanceof AdminBootstrapError);
          assert.equal(error.message.includes(password), false);
          return true;
        },
      );
      assert.equal(await database.prisma.user.count(), 2);
      assert.equal(await database.prisma.auditLog.count(), 0);
    } finally {
      await database.close();
    }
  });
});
