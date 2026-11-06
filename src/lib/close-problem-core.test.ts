import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closeProblemCore } from "@/lib/close-problem-core";
import { createTestDatabase } from "@/lib/test-database";
import {
  getStudentDiscoverableProblemWhere,
  isProblemAcceptingApplications,
} from "@/lib/problem-workflow";

async function createProblem(
  database: Awaited<ReturnType<typeof createTestDatabase>>,
  id: string,
  status = "APPROVED",
) {
  return database.prisma.problem.create({
    data: {
      id,
      businessProfileId: "business",
      title: id,
      slug: id,
      description: "",
      goal: "",
      field: "IT",
      requirements: "",
      expectedDuration: "1",
      status,
    },
  });
}

async function createTeam(
  database: Awaited<ReturnType<typeof createTestDatabase>>,
  index: number,
) {
  const userId = `close-student-${index}`;
  const teamId = `close-team-${index}`;
  await database.prisma.user.create({
    data: {
      id: userId,
      email: `${userId}@example.com`,
      name: `Student ${index}`,
      passwordHash: "test",
      updatedAt: new Date(),
    },
  });
  await database.prisma.studentTeam.create({
    data: {
      id: teamId,
      ownerId: userId,
      name: `Team ${index}`,
      slug: teamId,
      university: "U",
      description: "",
    },
  });
  return { userId, teamId };
}

async function createApplication(
  database: Awaited<ReturnType<typeof createTestDatabase>>,
  problemId: string,
  teamId: string,
  id: string,
  status: string,
) {
  return database.prisma.application.create({
    data: {
      id,
      problemId,
      teamId,
      approach: "Approach",
      estimatedDuration: "1 tuần",
      status,
    },
  });
}

describe("closeProblemCore", () => {
  it("blocked pending invitation leaves the Problem unchanged", async () => {
    const database = await createTestDatabase("close-pending-invitation");
    try {
      const problem = await createProblem(database, "pending-problem");
      const { teamId } = await createTeam(database, 1);
      const application = await createApplication(database, problem.id, teamId, "pending-app", "SUBMITTED");
      await database.prisma.applicationInvitation.create({
        data: {
          applicationId: application.id,
          problemId: problem.id,
          teamId,
          invitedByBusinessProfileId: "business",
          expiresAt: new Date("2027-01-01"),
        },
      });
      await assert.rejects(
        () => closeProblemCore("business-owner", "business", problem.id, database.prisma),
        /Không thể đóng/,
      );
      const unchanged = await database.prisma.problem.findUniqueOrThrow({ where: { id: problem.id } });
      assert.equal(unchanged.status, "APPROVED");
      assert.equal(unchanged.closedReason, null);
      assert.equal(unchanged.closedAt, null);
    } finally {
      await database.close();
    }
  });

  it("blocked selected team leaves the Problem unchanged", async () => {
    const database = await createTestDatabase("close-selected-team");
    try {
      const problem = await createProblem(database, "selected-problem");
      const { teamId } = await createTeam(database, 2);
      await createApplication(database, problem.id, teamId, "selected-app", "SELECTED");
      await assert.rejects(
        () => closeProblemCore("business-owner", "business", problem.id, database.prisma),
        /Không thể đóng/,
      );
      const unchanged = await database.prisma.problem.findUniqueOrThrow({ where: { id: problem.id } });
      assert.equal(unchanged.status, "APPROVED");
      assert.equal(unchanged.closedReason, null);
      assert.equal(unchanged.closedAt, null);
    } finally {
      await database.close();
    }
  });

  it("blocked active project rejects AGREEING, PROTOTYPING, and IN_PROGRESS", async () => {
    const database = await createTestDatabase("close-active-project");
    try {
      for (const [index, status] of ["AGREEING", "PROTOTYPING", "IN_PROGRESS"].entries()) {
        const problem = await createProblem(database, `active-problem-${index}`);
        const { teamId } = await createTeam(database, index + 10);
        const application = await createApplication(database, problem.id, teamId, `active-app-${index}`, "SUBMITTED");
        await database.prisma.project.create({
          data: {
            id: `active-project-${index}`,
            applicationId: application.id,
            teamId,
            title: "Active project",
            agreedScope: "Scope",
            totalAmount: 100,
            status,
          },
        });
        await assert.rejects(
          () => closeProblemCore("business-owner", "business", problem.id, database.prisma),
          /Không thể đóng/,
        );
        const unchanged = await database.prisma.problem.findUniqueOrThrow({ where: { id: problem.id } });
        assert.equal(unchanged.status, "APPROVED");
      }
    } finally {
      await database.close();
    }
  });

  it("wrong owner rejects without changing the Problem, notifications, or AuditLog", async () => {
    const database = await createTestDatabase("close-wrong-owner");
    try {
      const problem = await createProblem(database, "wrong-owner-problem");
      await assert.rejects(
        () => closeProblemCore("buyer", "business", problem.id, database.prisma),
        /đóng bài toán/,
      );
      const unchanged = await database.prisma.problem.findUniqueOrThrow({ where: { id: problem.id } });
      assert.equal(unchanged.status, "APPROVED");
      assert.equal(await database.prisma.notification.count(), 0);
      assert.equal(await database.prisma.auditLog.count(), 0);
    } finally {
      await database.close();
    }
  });

  it("success fields set CLOSED, BUSINESS_CLOSED, and closedAt", async () => {
    const database = await createTestDatabase("close-success-fields");
    try {
      await createProblem(database, "success-problem");
      await closeProblemCore("business-owner", "business", "success-problem", database.prisma);
      const closed = await database.prisma.problem.findUniqueOrThrow({ where: { id: "success-problem" } });
      assert.equal(closed.status, "CLOSED");
      assert.equal(closed.closedReason, "BUSINESS_CLOSED");
      assert.ok(closed.closedAt);
    } finally {
      await database.close();
    }
  });

  it("applications converts SUBMITTED and UNDER_REVIEW, preserves DRAFT and other statuses", async () => {
    const database = await createTestDatabase("close-applications");
    try {
      const problem = await createProblem(database, "applications-problem");
      for (const [index, status] of ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "REJECTED"].entries()) {
        const { teamId } = await createTeam(database, index + 20);
        await createApplication(database, problem.id, teamId, `application-${index}`, status);
      }
      await closeProblemCore("business-owner", "business", problem.id, database.prisma);
      const applications = await database.prisma.application.findMany({
        where: { problemId: problem.id },
        orderBy: { id: "asc" },
        select: { id: true, status: true },
      });
      assert.deepEqual(applications, [
        { id: "application-0", status: "DRAFT" },
        { id: "application-1", status: "NOT_SELECTED" },
        { id: "application-2", status: "NOT_SELECTED" },
        { id: "application-3", status: "REJECTED" },
      ]);
    } finally {
      await database.close();
    }
  });

  it("notifications sends exactly one notification to each related team and none to an unrelated team", async () => {
    const database = await createTestDatabase("close-notifications");
    try {
      const problem = await createProblem(database, "notifications-problem");
      const first = await createTeam(database, 30);
      const second = await createTeam(database, 31);
      const unrelated = await createTeam(database, 32);
      await createApplication(database, problem.id, first.teamId, "notification-app-1", "SUBMITTED");
      await createApplication(database, problem.id, second.teamId, "notification-app-2", "UNDER_REVIEW");
      await createApplication(database, "other-problem", unrelated.teamId, "unrelated-app", "SUBMITTED").catch(() => undefined);
      await closeProblemCore("business-owner", "business", problem.id, database.prisma);
      assert.equal(await database.prisma.notification.count({ where: { userId: first.userId } }), 1);
      assert.equal(await database.prisma.notification.count({ where: { userId: second.userId } }), 1);
      assert.equal(await database.prisma.notification.count({ where: { userId: unrelated.userId } }), 0);
    } finally {
      await database.close();
    }
  });

  it("audit log creates exactly one entry for the close operation", async () => {
    const database = await createTestDatabase("close-audit-log");
    try {
      await createProblem(database, "audit-problem");
      await closeProblemCore("business-owner", "business", "audit-problem", database.prisma);
      assert.equal(
        await database.prisma.auditLog.count({
          where: { action: "BUSINESS_CLOSED_PROBLEM", targetId: "audit-problem" },
        }),
        1,
      );
    } finally {
      await database.close();
    }
  });

  it("post credit remains unchanged and creates no PlatformCharge or money transaction", async () => {
    const database = await createTestDatabase("close-post-credit");
    try {
      await database.prisma.postCredit.create({
        data: { id: "post-credit", businessProfileId: "business", source: "SEED", remaining: 7 },
      });
      await createProblem(database, "credit-problem");
      const before = await database.prisma.postCredit.findUniqueOrThrow({ where: { id: "post-credit" } });
      const chargesBefore = await database.prisma.platformCharge.count();
      const transactionsBefore = await database.prisma.projectTransaction.count();
      await closeProblemCore("business-owner", "business", "credit-problem", database.prisma);
      const after = await database.prisma.postCredit.findUniqueOrThrow({ where: { id: "post-credit" } });
      assert.equal(after.remaining, before.remaining);
      assert.equal(await database.prisma.platformCharge.count(), chargesBefore);
      assert.equal(await database.prisma.projectTransaction.count(), transactionsBefore);
    } finally {
      await database.close();
    }
  });

  it("rollback leaves the Problem, applications, notifications, and AuditLog unchanged when a transaction step fails", async () => {
    const database = await createTestDatabase("close-rollback");
    try {
      const problem = await createProblem(database, "rollback-problem");
      const { teamId } = await createTeam(database, 40);
      await createApplication(database, problem.id, teamId, "rollback-app", "SUBMITTED");
      await assert.rejects(
        () => closeProblemCore("business-owner", "business", problem.id, database.prisma, {
          beforeNotifications: () => {
            throw new Error("forced notification failure");
          },
        }),
        /forced notification failure/,
      );
      const unchanged = await database.prisma.problem.findUniqueOrThrow({ where: { id: problem.id } });
      const application = await database.prisma.application.findUniqueOrThrow({ where: { id: "rollback-app" } });
      assert.equal(unchanged.status, "APPROVED");
      assert.equal(unchanged.closedReason, null);
      assert.equal(unchanged.closedAt, null);
      assert.equal(application.status, "SUBMITTED");
      assert.equal(await database.prisma.notification.count(), 0);
      assert.equal(await database.prisma.auditLog.count(), 0);
    } finally {
      await database.close();
    }
  });

  it("twice rejects the second close without duplicating notifications or AuditLog", async () => {
    const database = await createTestDatabase("close-twice");
    try {
      const problem = await createProblem(database, "twice-problem");
      const { teamId, userId } = await createTeam(database, 50);
      await createApplication(database, problem.id, teamId, "twice-app", "SUBMITTED");
      await closeProblemCore("business-owner", "business", problem.id, database.prisma);
      const notificationsAfterFirst = await database.prisma.notification.count({ where: { userId } });
      const auditsAfterFirst = await database.prisma.auditLog.count({ where: { targetId: problem.id } });
      await assert.rejects(
        () => closeProblemCore("business-owner", "business", problem.id, database.prisma),
        /đóng bài toán/,
      );
      assert.equal(await database.prisma.notification.count({ where: { userId } }), notificationsAfterFirst);
      assert.equal(await database.prisma.auditLog.count({ where: { targetId: problem.id } }), auditsAfterFirst);
    } finally {
      await database.close();
    }
  });

  it("concurrent conditional status transition updates an approved Problem exactly once", async () => {
    const database = await createTestDatabase("close-concurrent");
    try {
      await createProblem(database, "concurrent-problem");
      const results = await Promise.all([
        database.prisma.problem.updateMany({
          where: { id: "concurrent-problem", status: "APPROVED" },
          data: { status: "CLOSED", closedReason: "BUSINESS_CLOSED", closedAt: new Date() },
        }),
        database.prisma.problem.updateMany({
          where: { id: "concurrent-problem", status: "APPROVED" },
          data: { status: "CLOSED", closedReason: "BUSINESS_CLOSED", closedAt: new Date() },
        }),
      ]);
      assert.equal(results.filter((result) => result.count === 1).length, 1);
      assert.equal(results.filter((result) => result.count === 0).length, 1);
    } finally {
      await database.close();
    }
  });

  it("public search excludes the Problem after close", async () => {
    const database = await createTestDatabase("close-public-search");
    try {
      await createProblem(database, "public-search-problem");
      await closeProblemCore("business-owner", "business", "public-search-problem", database.prisma);
      const result = await database.prisma.problem.findMany({
        where: { id: "public-search-problem", ...getStudentDiscoverableProblemWhere() },
      });
      assert.equal(result.length, 0);
    } finally {
      await database.close();
    }
  });

  it("new application rejects a closed Problem", async () => {
    const database = await createTestDatabase("close-new-application");
    try {
      await createProblem(database, "new-application-problem");
      await closeProblemCore("business-owner", "business", "new-application-problem", database.prisma);
      assert.equal(isProblemAcceptingApplications("CLOSED"), false);
    } finally {
      await database.close();
    }
  });
});
