import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { createTestDatabase } from "@/lib/test-database";
import { updateBusinessProfileCore } from "@/lib/business-profile-core";
import { closeProblemCore } from "@/lib/close-problem-core";
import { canViewBusinessPrivateContact } from "@/lib/business-contact-access";
import { canViewPortfolioFile } from "@/lib/portfolio-access";
import { detectImageMime } from "@/lib/image-signature";
import { validateWorkspaceMessageContent } from "@/lib/workspace-message-validation";
import { getUnreadMessageCount } from "@/lib/workspace-message-scope";
import { getBusinessProblemStatusFilter } from "@/lib/business-dashboard";
import { getStudentDiscoverableProblemWhere } from "@/lib/problem-workflow";

describe("Đợt 5D business profile core", () => {
  it("rejects another business and leaves the target unchanged", async () => {
    const database = await createTestDatabase("dot5d-profile");
    try {
      await database.prisma.user.create({ data: { id: "other-owner", email: "other@example.com", name: "Other", passwordHash: "x", role: "BUSINESS", updatedAt: new Date() } });
      const other = await database.prisma.businessProfile.create({ data: { id: "other-business", userId: "other-owner", companyName: "Original", industry: "IT", description: "" } });
      await assert.rejects(() => updateBusinessProfileCore("business-owner", other.id, {
        companyName: "Changed", industry: "IT", industries: "", logo: null, website: null, description: "", address: "", contactEmail: null, phone: null, representative: "",
      }, database.prisma), /không có quyền/);
      assert.equal((await database.prisma.businessProfile.findUniqueOrThrow({ where: { id: other.id } })).companyName, "Original");
    } finally { await database.close(); }
  });

  it("rejects invalid email, phone, website, and logo", async () => {
    const database = await createTestDatabase("dot5d-validation");
    const base = { companyName: "Valid", industry: "IT", industries: "", logo: null, website: null, description: "", address: "", contactEmail: null, phone: null, representative: "" };
    try {
      for (const [field, value, message] of [
        ["contactEmail", "bad", "Email"],
        ["phone", "abc", "Số điện thoại"],
        ["website", "ftp://example.com", "Website"],
        ["logo", "http://example.com/logo.png", "Logo"],
      ] as const) {
        await assert.rejects(() => updateBusinessProfileCore("business-owner", "business", { ...base, [field]: value }, database.prisma), new RegExp(message));
      }
    } finally { await database.close(); }
  });
});

describe("Đợt 5D close problem core", () => {
  it("blocks pending invitations, selected applications, and running projects", async () => {
    const database = await createTestDatabase("dot5d-blocks");
    try {
      await database.prisma.studentTeam.create({ data: { id: "block-team", name: "Team", slug: "block-team", university: "U", description: "" } });
      for (const [index, blocker] of (["PENDING_CONFIRMATION", "SELECTED", "AGREEING"] as const).entries()) {
        const problemId = `blocked-${index}`;
        await database.prisma.problem.create({ data: { id: problemId, businessProfileId: "business", title: problemId, slug: problemId, description: "", goal: "", field: "IT", requirements: "", expectedDuration: "1", status: "APPROVED" } });
        const applicationId = `blocked-app-${index}`;
        await database.prisma.application.create({ data: { id: applicationId, problemId, teamId: "block-team", approach: "A", estimatedDuration: "1", status: blocker === "SELECTED" ? "SELECTED" : "SUBMITTED" } });
        if (blocker === "PENDING_CONFIRMATION") {
          await database.prisma.applicationInvitation.create({ data: { applicationId, problemId, teamId: "block-team", invitedByBusinessProfileId: "business", expiresAt: new Date("2027-01-01") } });
        }
        if (blocker === "AGREEING") {
          await database.prisma.project.create({ data: { applicationId, teamId: "block-team", title: "P", agreedScope: "S", totalAmount: 1, duration: "1" } });
        }
        await assert.rejects(() => closeProblemCore("business-owner", "business", problemId, database.prisma), /Không thể đóng/);
      }
    } finally { await database.close(); }
  });

  it("blocks a non-owner and closes a problem atomically", async () => {
    const database = await createTestDatabase("dot5d-close");
    try {
      await assert.rejects(() => closeProblemCore("buyer", "business", "missing", database.prisma), /đóng bài toán/);
      const problem = await database.prisma.problem.create({ data: { id: "close-problem", businessProfileId: "business", title: "Close", slug: "close", description: "", goal: "", field: "IT", requirements: "", expectedDuration: "1", status: "APPROVED" } });
      await assert.rejects(() => closeProblemCore("buyer", "business", problem.id, database.prisma), /đóng bài toán/);
      await closeProblemCore("business-owner", "business", problem.id, database.prisma);
      const closed = await database.prisma.problem.findUniqueOrThrow({ where: { id: problem.id } });
      assert.equal(closed.status, "CLOSED");
      assert.equal(closed.closedReason, "BUSINESS_CLOSED");
      assert.ok(closed.closedAt);
      await assert.rejects(() => closeProblemCore("business-owner", "business", problem.id, database.prisma), /đóng bài toán/);
    } finally { await database.close(); }
  });

  it("keeps drafts, rejects submitted applications, and records one notification per team", async () => {
    const database = await createTestDatabase("dot5d-close-applications");
    try {
      await database.prisma.problem.create({ data: { id: "close-app-problem", businessProfileId: "business", title: "Close", slug: "close-app", description: "", goal: "", field: "IT", requirements: "", expectedDuration: "1", status: "APPROVED" } });
      for (const [index, [id, status]] of [["draft-app", "DRAFT"], ["submitted-app", "SUBMITTED"], ["review-app", "UNDER_REVIEW"] as const].entries()) {
        const userId = `student-owner-${index}`;
        const teamId = `close-team-${index}`;
        await database.prisma.user.create({ data: { id: userId, email: `${userId}@example.com`, name: "Student", passwordHash: "x", updatedAt: new Date() } });
        await database.prisma.studentProfile.create({ data: { id: `student-profile-${index}`, userId, major: "IT", university: "U" } });
        await database.prisma.studentTeam.create({ data: { id: teamId, ownerId: userId, name: "Team", slug: teamId, university: "U", description: "" } });
        await database.prisma.application.create({ data: { id, problemId: "close-app-problem", teamId, approach: "A", estimatedDuration: "1", status } });
      }
      await closeProblemCore("business-owner", "business", "close-app-problem", database.prisma);
      const applications = await database.prisma.application.findMany({ where: { problemId: "close-app-problem" }, orderBy: { id: "asc" } });
      assert.deepEqual(applications.map((application) => [application.id, application.status]), [["draft-app", "DRAFT"], ["review-app", "NOT_SELECTED"], ["submitted-app", "NOT_SELECTED"]]);
      assert.equal(await database.prisma.notification.count({ where: { title: "Bài toán đã đóng" } }), 2);
      assert.equal(await database.prisma.auditLog.count({ where: { targetId: "close-app-problem" } }), 1);
    } finally { await database.close(); }
  });

  it("keeps closed problems out of student discovery", () => {
    assert.deepEqual(getStudentDiscoverableProblemWhere().status, { in: ["APPROVED", "PUBLISHED", "TEAM_SELECTED", "PROTOTYPING", "EVALUATING"] });
  });
});

describe("Đợt 5D portfolio access", () => {
  const owner = { userId: "owner", role: "STUDENT" };
  const business = { userId: "business", role: "BUSINESS" };
  const item = { teamId: "team", isVisible: true };
  const hidden = { teamId: "team", isVisible: false };
  it("owner views visible item", () => assert.equal(canViewPortfolioFile({ viewer: owner, item, teamMembership: { isOwner: true, isLead: true } }), true));
  it("owner views hidden item", () => assert.equal(canViewPortfolioFile({ viewer: owner, item: hidden, teamMembership: { isOwner: true, isLead: true } }), true));
  it("business views visible item", () => assert.equal(canViewPortfolioFile({ viewer: business, item, teamMembership: null }), true));
  it("business cannot view hidden item", () => assert.equal(canViewPortfolioFile({ viewer: business, item: hidden, teamMembership: null }), false));
  it("anonymous cannot view visible item", () => assert.equal(canViewPortfolioFile({ viewer: null, item, teamMembership: null }), false));
  it("other student cannot view hidden item", () => assert.equal(canViewPortfolioFile({ viewer: { userId: "other", role: "STUDENT" }, item: hidden, teamMembership: { isOwner: false, isLead: false } }), false));
  it("admin views hidden item", () => assert.equal(canViewPortfolioFile({ viewer: { userId: "admin", role: "ADMIN" }, item: hidden, teamMembership: null }), true));
});

describe("Đợt 5D contact, logo, message and route checks", () => {
  it("allows private contact only for owner, admin, or selected team", () => {
    assert.equal(canViewBusinessPrivateContact({ viewer: { userId: "owner", role: "BUSINESS" }, businessOwnerId: "owner", hasSelectedApplication: false }), true);
    assert.equal(canViewBusinessPrivateContact({ viewer: { userId: "admin", role: "ADMIN" }, businessOwnerId: "owner", hasSelectedApplication: false }), true);
    assert.equal(canViewBusinessPrivateContact({ viewer: { userId: "student", role: "STUDENT" }, businessOwnerId: "owner", hasSelectedApplication: true }), true);
    assert.equal(canViewBusinessPrivateContact({ viewer: { userId: "student", role: "STUDENT" }, businessOwnerId: "owner", hasSelectedApplication: false }), false);
    assert.equal(canViewBusinessPrivateContact({ viewer: null, businessOwnerId: "owner", hasSelectedApplication: true }), false);
  });
  it("detects legacy PNG/JPEG and rejects unknown signatures", () => {
    assert.equal(detectImageMime(Uint8Array.from([137,80,78,71,13,10,26,10])), "image/png");
    assert.equal(detectImageMime(Uint8Array.from([255,216,255,1])), "image/jpeg");
    assert.equal(detectImageMime(Uint8Array.from([1,2,3])), null);
  });
  it("rejects blank workspace messages and counts unread correctly", () => {
    assert.ok(validateWorkspaceMessageContent("   "));
    assert.equal(validateWorkspaceMessageContent("Xin chào"), null);
    assert.equal(getUnreadMessageCount([{ senderId: "other", createdAt: new Date("2026-01-02") }, { senderId: "me", createdAt: new Date("2026-01-03") }], "me", new Date("2026-01-01")), 1);
  });
  it("uses grouped status filters and existing dashboard routes", () => {
    assert.deepEqual(getBusinessProblemStatusFilter("APPROVED_OPEN"), { in: ["APPROVED", "PUBLISHED"] });
    for (const route of ["src/app/business/problems", "src/app/business/projects", "src/app/business/messages", "src/app/student/applications", "src/app/student/projects", "src/app/student/messages"]) assert.equal(existsSync(route), true, route);
  });
});
