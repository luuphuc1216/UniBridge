import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createTestDatabase } from "@/lib/test-database";
import { expireInvitationDuringResponse } from "@/lib/invitation-response";

describe("invitation response expiry", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  const now = new Date("2026-11-18T12:00:00.000Z");

  beforeEach(async () => {
    database = await createTestDatabase("unibridge-invitation-response");
    await database.prisma.studentTeam.create({
      data: {
        id: "expiry-response-team",
        ownerId: "buyer",
        name: "Expiry response team",
        slug: "expiry-response-team",
        university: "Test university",
        description: "Test team",
      },
    });
    await database.prisma.problem.create({
      data: {
        id: "expiry-response-problem",
        businessProfileId: "business",
        title: "Expiry response problem",
        slug: "expiry-response-problem",
        description: "Test problem",
        goal: "Test goal",
        field: "Công nghệ",
        requirements: "Test requirements",
        expectedDuration: "1 tuần",
        status: "APPROVED",
      },
    });
    await database.prisma.application.create({
      data: {
        id: "expiry-response-application",
        problemId: "expiry-response-problem",
        teamId: "expiry-response-team",
        approach: "Test approach",
        estimatedDuration: "1 tuần",
        status: "PENDING_CONFIRMATION",
      },
    });
    await database.prisma.applicationInvitation.create({
      data: {
        id: "expiry-response-invitation",
        applicationId: "expiry-response-application",
        problemId: "expiry-response-problem",
        teamId: "expiry-response-team",
        invitedByBusinessProfileId: "business",
        expiresAt: new Date(now.getTime() - 1),
        status: "PENDING_CONFIRMATION",
      },
    });
  });

  afterEach(async () => {
    await database.close();
  });

  it("persists expired invitation and application states when a response arrives late", async () => {
    const expired = await database.prisma.$transaction((transaction) =>
      expireInvitationDuringResponse(transaction, {
        invitationId: "expiry-response-invitation",
        applicationId: "expiry-response-application",
        problemId: "expiry-response-problem",
        businessUserId: "business-owner",
        problemTitle: "Expiry response problem",
        now,
      }),
    );

    assert.equal(expired, true);
    assert.equal(
      (await database.prisma.applicationInvitation.findUniqueOrThrow({
        where: { id: "expiry-response-invitation" },
      })).status,
      "EXPIRED",
    );
    assert.equal(
      (await database.prisma.application.findUniqueOrThrow({
        where: { id: "expiry-response-application" },
      })).status,
      "EXPIRED",
    );
    assert.equal(
      await database.prisma.notification.count({
        where: {
          userId: "business-owner",
          title: "Lời mời hợp tác đã hết hạn",
        },
      }),
      1,
    );
  });

  it("does not expire an invitation twice or send duplicate notifications", async () => {
    const input = {
      invitationId: "expiry-response-invitation",
      applicationId: "expiry-response-application",
      problemId: "expiry-response-problem",
      businessUserId: "business-owner",
      problemTitle: "Expiry response problem",
      now,
    };
    await database.prisma.$transaction((transaction) =>
      expireInvitationDuringResponse(transaction, input),
    );
    const expiredAgain = await database.prisma.$transaction((transaction) =>
      expireInvitationDuringResponse(transaction, input),
    );

    assert.equal(expiredAgain, false);
    assert.equal(await database.prisma.notification.count(), 1);
  });

  it("rolls back invitation expiry when the application is no longer awaiting a response", async () => {
    await database.prisma.application.update({
      where: { id: "expiry-response-application" },
      data: { status: "SUBMITTED" },
    });

    await assert.rejects(
      database.prisma.$transaction((transaction) =>
        expireInvitationDuringResponse(transaction, {
          invitationId: "expiry-response-invitation",
          applicationId: "expiry-response-application",
          problemId: "expiry-response-problem",
          businessUserId: "business-owner",
          problemTitle: "Expiry response problem",
          now,
        }),
      ),
      /Hồ sơ đã thay đổi/,
    );

    assert.equal(
      (await database.prisma.applicationInvitation.findUniqueOrThrow({
        where: { id: "expiry-response-invitation" },
      })).status,
      "PENDING_CONFIRMATION",
    );
    assert.equal(await database.prisma.notification.count(), 0);
  });
});
