import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { createTestDatabase } from "@/lib/test-database";

describe("workspace unread message count", () => {
  const importDatabasePath = `/tmp/unibridge-workspace-messages-import-${randomUUID()}.db`;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let getUnreadWorkspaceMessageCount: typeof import("@/lib/workspace-messages")["getUnreadWorkspaceMessageCount"];

  before(async () => {
    process.env.DATABASE_URL = `file:${importDatabasePath}`;
    ({ getUnreadWorkspaceMessageCount } = await import("@/lib/workspace-messages"));
  });

  after(async () => {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$disconnect();
    if (existsSync(importDatabasePath)) await unlink(importDatabasePath);
  });

  beforeEach(async () => {
    database = await createTestDatabase("unibridge-workspace-unread");
    const team = await database.prisma.studentTeam.create({
      data: {
        id: "unread-team",
        ownerId: "buyer",
        name: "Unread team",
        slug: "unread-team",
        university: "Test university",
        description: "Test team",
      },
    });
    const activeProblem = await database.prisma.problem.create({
      data: {
        id: "unread-active-problem",
        businessProfileId: "business",
        title: "Active problem",
        slug: "unread-active-problem",
        description: "Test problem",
        goal: "Test goal",
        field: "Công nghệ",
        requirements: "Test requirements",
        expectedDuration: "1 tuần",
        status: "TEAM_SELECTED",
      },
    });
    const inactiveProblem = await database.prisma.problem.create({
      data: {
        id: "unread-inactive-problem",
        businessProfileId: "business",
        title: "Inactive problem",
        slug: "unread-inactive-problem",
        description: "Test problem",
        goal: "Test goal",
        field: "Công nghệ",
        requirements: "Test requirements",
        expectedDuration: "1 tuần",
        status: "APPROVED",
      },
    });
    await database.prisma.application.createMany({
      data: [
        {
          id: "unread-active-application",
          problemId: activeProblem.id,
          teamId: team.id,
          approach: "Test approach",
          estimatedDuration: "1 tuần",
          status: "SELECTED",
        },
        {
          id: "unread-inactive-application",
          problemId: inactiveProblem.id,
          teamId: team.id,
          approach: "Test approach",
          estimatedDuration: "1 tuần",
          status: "DECLINED",
        },
      ],
    });
    await database.prisma.workspaceMessage.createMany({
      data: [
        {
          id: "unread-visible",
          problemId: activeProblem.id,
          applicationId: "unread-active-application",
          senderId: "business-owner",
          content: "Visible message",
        },
        {
          id: "unread-hidden",
          problemId: activeProblem.id,
          applicationId: "unread-active-application",
          senderId: "business-owner",
          content: "Hidden message",
          hiddenByAdmin: true,
        },
        {
          id: "unread-visible-from-team",
          problemId: activeProblem.id,
          applicationId: "unread-active-application",
          senderId: "buyer",
          content: "Visible team message",
        },
        {
          id: "unread-declined",
          problemId: inactiveProblem.id,
          applicationId: "unread-inactive-application",
          senderId: "business-owner",
          content: "Inaccessible conversation",
        },
      ],
    });
  });

  afterEach(async () => {
    await database.close();
  });

  it("counts only visible messages in applications that still have workspace access", async () => {
    assert.equal(
      await getUnreadWorkspaceMessageCount("buyer", "STUDENT", database.prisma),
      1,
    );
    assert.equal(
      await getUnreadWorkspaceMessageCount("business-owner", "BUSINESS", database.prisma),
      1,
    );
  });
});
