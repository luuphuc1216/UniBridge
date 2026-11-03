import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createTestDatabase } from "@/lib/test-database";
import { changeAccountStatus } from "./account-lock";

describe("Account status changes", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeEach(async () => {
    database = await createTestDatabase("unibridge-account-lock");
    await database.prisma.user.update({
      where: { id: "buyer" },
      data: { role: "ADMIN" },
    });
    await database.prisma.user.create({
      data: {
        id: "second-admin",
        email: "second-admin@example.com",
        name: "Second admin",
        passwordHash: "test",
        role: "ADMIN",
      },
    });
    await database.prisma.user.create({
      data: {
        id: "lock-target",
        email: "target@example.com",
        name: "Target",
        passwordHash: "test",
      },
    });
  });

  afterEach(async () => {
    await database.close();
  });

  it("locks and unlocks idempotently while incrementing authVersion and auditing changes", async () => {
    assert.equal(
      await changeAccountStatus(database.prisma, {
        actorId: "buyer",
        targetId: "lock-target",
        desiredStatus: "LOCKED",
        reason: "Vi phạm chính sách",
      }),
      "updated",
    );
    assert.equal(
      await changeAccountStatus(database.prisma, {
        actorId: "buyer",
        targetId: "lock-target",
        desiredStatus: "LOCKED",
        reason: "Vi phạm chính sách",
      }),
      "unchanged",
    );
    assert.equal(
      await changeAccountStatus(database.prisma, {
        actorId: "buyer",
        targetId: "lock-target",
        desiredStatus: "ACTIVE",
        reason: "Đã xác minh lại",
      }),
      "updated",
    );
    const target = await database.prisma.user.findUniqueOrThrow({
      where: { id: "lock-target" },
    });
    assert.equal(target.accountStatus, "ACTIVE");
    assert.equal(target.authVersion, 2);
    assert.equal(target.lockReason, null);
    assert.equal(
      await database.prisma.auditLog.count({
        where: { targetId: "lock-target" },
      }),
      2,
    );
  });

  it("prevents self-lock and locking the final active administrator", async () => {
    assert.equal(
      await changeAccountStatus(database.prisma, {
        actorId: "buyer",
        targetId: "buyer",
        desiredStatus: "LOCKED",
        reason: "Không tự khóa",
      }),
      "self",
    );
    await changeAccountStatus(database.prisma, {
      actorId: "second-admin",
      targetId: "buyer",
      desiredStatus: "LOCKED",
      reason: "Đã có quản trị viên khác",
    });
    assert.equal(
      await changeAccountStatus(database.prisma, {
        actorId: "second-admin",
        targetId: "second-admin",
        desiredStatus: "LOCKED",
        reason: "Không tự khóa",
      }),
      "self",
    );
    assert.equal(
      await changeAccountStatus(database.prisma, {
        actorId: "lock-target",
        targetId: "second-admin",
        desiredStatus: "LOCKED",
        reason: "Quản trị viên cuối cùng",
      }),
      "last-admin",
    );
  });

  it("does not change project or transaction state when locking a project participant", async () => {
    const team = await database.prisma.studentTeam.create({
      data: {
        id: "lock-target-team",
        ownerId: "lock-target",
        name: "Lock Target Team",
        slug: "lock-target-team",
        university: "Đại học",
        description: "Nhóm",
      },
    });
    const problem = await database.prisma.problem.create({
      data: {
        id: "lock-target-problem",
        businessProfileId: "business",
        title: "Active problem",
        slug: "lock-target-problem",
        description: "Mô tả",
        goal: "Mục tiêu",
        field: "Công nghệ",
        requirements: "Yêu cầu",
        expectedDuration: "4 tuần",
        status: "TEAM_SELECTED",
      },
    });
    const application = await database.prisma.application.create({
      data: {
        id: "lock-target-application",
        problemId: problem.id,
        teamId: team.id,
        approach: "Hướng tiếp cận",
        estimatedDuration: "4 tuần",
        status: "SELECTED",
      },
    });
    await database.prisma.project.create({
      data: {
        id: "lock-target-project",
        applicationId: application.id,
        teamId: team.id,
        title: "Active project",
        agreedScope: "Phạm vi",
        totalAmount: 1000,
        status: "IN_PROGRESS",
      },
    });
    await database.prisma.projectTransaction.create({
      data: {
        projectId: "lock-target-project",
        idempotencyKey: "lock-target-deposit",
        type: "DEPOSIT",
        amount: 1100,
        platformFee: 100,
        platformFeeBasisPoints: 1000,
        status: "ESCROW",
      },
    });

    await changeAccountStatus(database.prisma, {
      actorId: "buyer",
      targetId: "lock-target",
      desiredStatus: "LOCKED",
      reason: "Đang rà soát tài khoản",
    });
    const project = await database.prisma.project.findUniqueOrThrow({
      where: { id: "lock-target-project" },
    });
    const transaction = await database.prisma.projectTransaction.findUniqueOrThrow({
      where: { idempotencyKey: "lock-target-deposit" },
    });
    assert.equal(project.status, "IN_PROGRESS");
    assert.equal(transaction.amount, 1100);
    assert.equal(transaction.status, "ESCROW");
  });
});
