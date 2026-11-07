import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createTestDatabase } from "@/lib/test-database";
import { submitReport, updateReport } from "@/lib/reports";
import { findAuthorizedWorkspace } from "@/lib/workspace-access";

describe("Violation reports", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeEach(async () => {
    database = await createTestDatabase("unibridge-reports");
    const { prisma } = database;
    await prisma.user.create({
      data: {
        id: "outsider",
        email: "outsider@example.com",
        name: "Outsider",
        passwordHash: "test",
      },
    });
    await prisma.user.update({
      where: { id: "business-owner" },
      data: { role: "ADMIN" },
    });
    const team = await prisma.studentTeam.create({
      data: {
        id: "reported-team",
        ownerId: "buyer",
        name: "Reported Team",
        slug: "reported-team",
        university: "Đại học",
        description: "Hồ sơ nhóm ban đầu",
      },
    });
    const problem = await prisma.problem.create({
      data: {
        id: "reported-problem",
        businessProfileId: "business",
        title: "Reported Problem",
        slug: "reported-problem",
        description: "Problem snapshot ban đầu",
        goal: "Mục tiêu",
        field: "Công nghệ",
        requirements: "Yêu cầu",
        expectedDuration: "4 tuần",
        status: "TEAM_SELECTED",
      },
    });
    const application = await prisma.application.create({
      data: {
        id: "reported-application",
        problemId: problem.id,
        teamId: team.id,
        approach: "Hướng tiếp cận",
        estimatedDuration: "4 tuần",
        status: "SELECTED",
      },
    });
    const project = await prisma.project.create({
      data: {
        id: "reported-project",
        applicationId: application.id,
        teamId: team.id,
        title: "Reported Project",
        agreedScope: "Phạm vi",
        totalAmount: 1000,
      },
    });
    await prisma.workspaceMessage.create({
      data: {
        id: "reported-message",
        problemId: problem.id,
        applicationId: application.id,
        senderId: "business-owner",
        content: "Tin nhắn cần xem xét",
      },
    });
    await prisma.review.create({
      data: {
        id: "reported-review",
        projectId: project.id,
        reviewerId: "business-owner",
        direction: "BUSINESS_TO_TEAM",
        reviewedTeamId: team.id,
        rating: 4.5,
        content: "Đánh giá cần xem xét",
      },
    });
  });

  afterEach(async () => {
    await database.close();
  });

  it("requires a non-empty resolution reason of at most 500 characters", async () => {
    await submitReport(database.prisma, {
      reporterId: "buyer",
      reporterRole: "STUDENT",
      targetType: "PROBLEM",
      targetId: "reported-problem",
      reason: "Problem có nội dung cần kiểm tra.",
    });
    const report = await database.prisma.report.findFirstOrThrow({
      where: { targetId: "reported-problem" },
    });
    const input = {
      actorId: "business-owner",
      reportId: report.id,
      nextStatus: "IN_PROGRESS" as const,
      hideContent: false,
    };

    assert.equal(
      await updateReport(database.prisma, { ...input, reason: "" }),
      "invalid",
    );
    assert.equal(
      await updateReport(database.prisma, { ...input, reason: "   " }),
      "invalid",
    );
    assert.equal(
      await updateReport(database.prisma, { ...input, reason: "a".repeat(501) }),
      "invalid",
    );
    assert.equal(
      await database.prisma.notification.count({ where: { userId: "buyer" } }),
      0,
    );
    assert.equal(
      await updateReport(database.prisma, { ...input, reason: "a".repeat(500) }),
      "updated",
    );
    const notification = await database.prisma.notification.findFirstOrThrow({
      where: { userId: "buyer" },
    });
    assert.equal(notification.title, "Báo cáo của bạn đã được cập nhật");
    assert.equal(
      notification.message,
      "Trạng thái báo cáo hiện tại: Đang xử lý.",
    );
    assert.equal(notification.href, "/student");
    assert.ok(notification.dedupeKey?.startsWith(`report-update:${report.id}:`));
    assert.equal(
      (await database.prisma.report.findUniqueOrThrow({ where: { id: report.id } }))
        .resolutionReason,
      "a".repeat(500),
    );
  });

  it("rejects a forged transition back to the initial NEW status", async () => {
    await submitReport(database.prisma, {
      reporterId: "buyer",
      reporterRole: "STUDENT",
      targetType: "PROBLEM",
      targetId: "reported-problem",
      reason: "Bài toán cần được xem xét.",
    });
    const report = await database.prisma.report.findFirstOrThrow({
      where: { targetId: "reported-problem" },
    });

    assert.equal(
      await updateReport(database.prisma, {
        actorId: "business-owner",
        reportId: report.id,
        nextStatus: "NEW",
        reason: "Đưa báo cáo về trạng thái khởi tạo.",
        hideContent: false,
      }),
      "invalid",
    );
    const unchanged = await database.prisma.report.findUniqueOrThrow({
      where: { id: report.id },
    });
    assert.equal(unchanged.status, "NEW");
    assert.equal(unchanged.handlerId, null);
    assert.equal(unchanged.resolutionReason, null);
    assert.equal(await database.prisma.auditLog.count({ where: { action: "REPORT_UPDATED" } }), 0);
    assert.equal(await database.prisma.notification.count(), 0);
  });

  it("snapshots supported targets, rejects duplicate open reports, and limits private message access", async () => {
    const base = {
      reporterId: "buyer",
      reporterRole: "STUDENT",
      reason: "Nội dung có dấu hiệu vi phạm chính sách.",
    };
    for (const [targetType, targetId] of [
      ["PROBLEM", "reported-problem"],
      ["TEAM", "reported-team"],
      ["MESSAGE", "reported-message"],
      ["REVIEW", "reported-review"],
    ] as const) {
      assert.equal(
        await submitReport(database.prisma, { ...base, targetType, targetId }),
        "created",
      );
      assert.equal(
        await submitReport(database.prisma, { ...base, targetType, targetId }),
        "duplicate",
      );
    }

    assert.equal(
      await submitReport(database.prisma, {
        ...base,
        reporterId: "outsider",
        targetType: "MESSAGE",
        targetId: "reported-message",
      }),
      "target_unavailable",
    );
    assert.equal(
      await submitReport(database.prisma, {
        ...base,
        reporterId: "outsider",
        targetType: "REVIEW",
        targetId: "reported-review",
      }),
      "target_unavailable",
    );
    await database.prisma.project.update({
      where: { id: "reported-project" },
      data: {
        status: "COMPLETED",
        completedAt: new Date(Date.now() - 15 * 86_400_000),
      },
    });
    assert.equal(
      await submitReport(database.prisma, {
        ...base,
        reporterId: "outsider",
        targetType: "REVIEW",
        targetId: "reported-review",
      }),
      "created",
    );
    const snapshot = await database.prisma.report.findFirstOrThrow({
      where: { targetType: "PROBLEM" },
    });
    await database.prisma.problem.update({
      where: { id: "reported-problem" },
      data: { description: "Nội dung đã thay đổi" },
    });
    assert.match(snapshot.snapshot, /Problem snapshot ban đầu/);
  });

  it("processes reports idempotently and hides review text without changing its rating", async () => {
    await submitReport(database.prisma, {
      reporterId: "buyer",
      reporterRole: "STUDENT",
      targetType: "REVIEW",
      targetId: "reported-review",
      reason: "Đánh giá có nội dung vi phạm.",
    });
    const report = await database.prisma.report.findFirstOrThrow({
      where: { targetId: "reported-review" },
    });
    const adminInput = {
      actorId: "business-owner",
      reportId: report.id,
      nextStatus: "IN_PROGRESS" as const,
      reason: "Đang kiểm tra căn cứ báo cáo.",
      hideContent: false,
    };
    assert.equal(await updateReport(database.prisma, adminInput), "updated");
    assert.equal(await updateReport(database.prisma, adminInput), "unchanged");
    assert.equal(await database.prisma.notification.count(), 1);
    assert.equal(
      await submitReport(database.prisma, {
        reporterId: "buyer",
        reporterRole: "STUDENT",
        targetType: "REVIEW",
        targetId: "reported-review",
        reason: "Báo cáo trùng khi đang xử lý.",
      }),
      "duplicate",
    );
    assert.equal(
      await updateReport(database.prisma, {
        ...adminInput,
        nextStatus: "RESOLVED",
        reason: "Đã xác nhận nội dung vi phạm theo chính sách.",
        hideContent: true,
      }),
      "updated",
    );
    assert.equal(await database.prisma.notification.count(), 2);
    const review = await database.prisma.review.findUniqueOrThrow({
      where: { id: "reported-review" },
    });
    assert.equal(review.hiddenByAdmin, true);
    assert.equal(review.rating, 4.5);
    assert.equal(
      await database.prisma.report.findUniqueOrThrow({ where: { id: report.id } }).then(({ openKey }) => openKey),
      null,
    );
    assert.equal(
      await database.prisma.auditLog.count({ where: { action: "REPORT_UPDATED" } }),
      2,
    );
  });

  it("hides reported messages from workspace participants and permits a new report after closure", async () => {
    await submitReport(database.prisma, {
      reporterId: "buyer",
      reporterRole: "STUDENT",
      targetType: "MESSAGE",
      targetId: "reported-message",
      reason: "Tin nhắn có nội dung vi phạm.",
    });
    const report = await database.prisma.report.findFirstOrThrow({
      where: { targetId: "reported-message" },
    });
    assert.equal(
      await updateReport(database.prisma, {
        actorId: "business-owner",
        reportId: report.id,
        nextStatus: "RESOLVED",
        reason: "Đã xác nhận vi phạm chính sách.",
        hideContent: true,
      }),
      "updated",
    );

    const workspace = await findAuthorizedWorkspace(
      "reported-problem",
      "buyer",
      "STUDENT",
      "reported-application",
      database.prisma,
    );
    assert.ok(workspace);
    assert.deepEqual(workspace.workspaceMessages, []);
    assert.equal(
      await submitReport(database.prisma, {
        reporterId: "buyer",
        reporterRole: "STUDENT",
        targetType: "MESSAGE",
        targetId: "reported-message",
        reason: "Báo cáo lại sau khi đã đóng.",
      }),
      "target_unavailable",
    );
  });
});
