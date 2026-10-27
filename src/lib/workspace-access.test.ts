import assert from "node:assert/strict";
import { beforeEach, afterEach, describe, it } from "node:test";
import { createTestDatabase } from "@/lib/test-database";
import { canRespondForTeam } from "@/lib/team-permissions";
import { respondToTrialBrief, createTrialBriefVersion } from "@/lib/trial-brief";

const futureDeadline = new Date("2030-01-01T00:00:00.000Z");

async function fixture() {
  const database = await createTestDatabase("unibridge-workspace-access");
  const { prisma } = database;
  await prisma.user.createMany({
    data: [
      { id: "team-a-owner", email: "team-a@example.com", name: "Team A", passwordHash: "test", updatedAt: new Date() },
      { id: "team-b-owner", email: "team-b@example.com", name: "Team B", passwordHash: "test", updatedAt: new Date() },
      { id: "team-b-member", email: "team-b-member@example.com", name: "Team B member", passwordHash: "test", updatedAt: new Date() },
      { id: "other-business", email: "other-business@example.com", name: "Other business", passwordHash: "test", updatedAt: new Date() },
    ],
  });
  const profileA = await prisma.studentProfile.create({
    data: { id: "profile-a", userId: "team-a-owner", major: "CNTT", university: "Đại học" },
  });
  const profileB = await prisma.studentProfile.create({
    data: { id: "profile-b", userId: "team-b-owner", major: "CNTT", university: "Đại học" },
  });
  const memberProfileB = await prisma.studentProfile.create({
    data: { id: "profile-b-member", userId: "team-b-member", major: "CNTT", university: "Đại học" },
  });
  const teamA = await prisma.studentTeam.create({
    data: {
      id: "team-a",
      ownerId: "team-a-owner",
      name: "Team A",
      slug: "team-a",
      university: "Đại học",
      description: "Team A",
      memberships: {
        create: [{ id: "membership-a", studentProfileId: profileA.id, name: "Team A", title: "Chủ nhóm", isLead: true }],
      },
    },
  });
  const teamB = await prisma.studentTeam.create({
    data: {
      id: "team-b",
      ownerId: "team-b-owner",
      name: "Team B",
      slug: "team-b",
      university: "Đại học",
      description: "Team B",
      memberships: {
        create: [
          { id: "membership-b", studentProfileId: profileB.id, name: "Team B", title: "Chủ nhóm", isLead: true },
          { id: "membership-b-member", studentProfileId: memberProfileB.id, name: "Member", title: "Thành viên", isLead: false },
        ],
      },
    },
  });
  const problem = await prisma.problem.create({
    data: {
      id: "workspace-problem",
      businessProfileId: "business",
      title: "Workspace problem",
      slug: "workspace-problem",
      description: "Mô tả",
      goal: "Mục tiêu",
      field: "CNTT",
      requirements: "Yêu cầu",
      expectedDuration: "4 tuần",
      status: "TEAM_SELECTED",
      applications: {
        create: [
          {
            id: "application-a",
            teamId: teamA.id,
            approach: "Hướng A",
            estimatedDuration: "4 tuần",
            status: "SELECTED",
          },
          {
            id: "application-b",
            teamId: teamB.id,
            approach: "Hướng B",
            estimatedDuration: "4 tuần",
            status: "PENDING_CONFIRMATION",
          },
        ],
      },
    },
  });
  const otherProblem = await prisma.problem.create({
    data: {
      id: "other-problem",
      businessProfileId: "business",
      title: "Other problem",
      slug: "other-problem",
      description: "Mô tả",
      goal: "Mục tiêu",
      field: "CNTT",
      requirements: "Yêu cầu",
      expectedDuration: "4 tuần",
      status: "TEAM_SELECTED",
      applications: {
        create: {
          id: "application-other",
          teamId: teamB.id,
          approach: "Hướng khác",
          estimatedDuration: "4 tuần",
          status: "SELECTED",
        },
      },
    },
  });
  await prisma.workspaceMessage.createMany({
    data: [
      { id: "message-a", problemId: problem.id, applicationId: "application-a", senderId: "team-a-owner", content: "Tin A" },
      { id: "message-b", problemId: problem.id, applicationId: "application-b", senderId: "team-b-owner", content: "Tin B" },
      { id: "message-legacy", problemId: problem.id, applicationId: null, senderId: "team-a-owner", content: "Tin cũ" },
    ],
  });
  return { database, problemId: problem.id, otherProblemId: otherProblem.id };
}

describe("workspace access integration", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let problemId: string;
  let otherProblemId: string;
  let findAuthorizedWorkspace: typeof import("@/lib/workspace-access")["findAuthorizedWorkspace"];

  beforeEach(async () => {
    process.env.DATABASE_URL ??= "file:/tmp/unibridge-workspace-access-import.db";
    ({ findAuthorizedWorkspace } = await import("@/lib/workspace-access"));
    ({ database, problemId, otherProblemId } = await fixture());
  });

  afterEach(async () => {
    await database.close();
  });

  it("uses the selected application and legacy messages without leaking another application's messages", async () => {
    const workspace = await findAuthorizedWorkspace(problemId, "team-a-owner", "STUDENT", undefined, database.prisma);
    assert.ok(workspace);
    assert.deepEqual(workspace.workspaceMessages.map((message) => message.id), ["message-a", "message-legacy"]);
  });

  it("uses a valid application id and includes legacy messages only", async () => {
    const workspace = await findAuthorizedWorkspace(problemId, "team-a-owner", "STUDENT", "application-a", database.prisma);
    assert.ok(workspace);
    assert.deepEqual(workspace.workspaceMessages.map((message) => message.id), ["message-a", "message-legacy"]);
  });

  it("isolates team B for implicit and explicit application URLs", async () => {
    const implicit = await findAuthorizedWorkspace(problemId, "team-b-owner", "STUDENT", undefined, database.prisma);
    const explicit = await findAuthorizedWorkspace(problemId, "team-b-owner", "STUDENT", "application-a", database.prisma);
    assert.ok(implicit);
    assert.equal(implicit.applications[0]?.id, "application-b");
    assert.deepEqual(implicit.workspaceMessages.map((message) => message.id), ["message-b", "message-legacy"]);
    assert.equal(explicit, null);
  });

  it("rejects an application outside the problem or outside the user's workspace", async () => {
    assert.equal(
      await findAuthorizedWorkspace(problemId, "team-a-owner", "STUDENT", "application-other", database.prisma),
      null,
    );
    assert.equal(
      await findAuthorizedWorkspace(problemId, "team-b-owner", "STUDENT", "application-a", database.prisma),
      null,
    );
  });

  it("allows only the problem owner business and resolves the same selected messages with either URL", async () => {
    const implicit = await findAuthorizedWorkspace(problemId, "business-owner", "BUSINESS", undefined, database.prisma);
    const explicit = await findAuthorizedWorkspace(problemId, "business-owner", "BUSINESS", "application-a", database.prisma);
    const otherBusiness = await findAuthorizedWorkspace(problemId, "other-business", "BUSINESS", undefined, database.prisma);
    assert.ok(implicit);
    assert.ok(explicit);
    assert.equal(otherBusiness, null);
    assert.deepEqual(implicit.workspaceMessages.map((message) => message.id), explicit.workspaceMessages.map((message) => message.id));
  });

  it("keeps owner-only Trial Brief permission and rejects a member response", async () => {
    assert.equal(canRespondForTeam("team-a-owner", "team-a-owner"), true);
    assert.equal(canRespondForTeam("team-a-owner", "team-b-member"), false);
    await database.prisma.$transaction((transaction) =>
      createTrialBriefVersion(transaction, {
        problemId,
        businessUserId: "business-owner",
        input: {
          objective: "Mục tiêu",
          scope: "Phạm vi",
          deliverables: "Đầu ra",
          deadline: futureDeadline,
          evaluationCriteria: "Tiêu chí",
          maxRevisionRequests: 0,
          businessProvidedData: "",
          confidentialityTerms: "Bảo mật",
          ownershipTerms: "Quyền sử dụng",
          compensationTerms: "",
        },
      }),
    );
    await assert.rejects(
      database.prisma.$transaction((transaction) =>
        respondToTrialBrief(transaction, {
          problemId,
          version: 1,
          studentUserId: "team-b-member",
          decision: "CONFIRMED",
        }),
      ),
      /chủ nhóm/i,
    );
  });

  it("always chooses SELECTED when another application is pending", async () => {
    const workspace = await findAuthorizedWorkspace(problemId, "team-a-owner", "STUDENT", undefined, database.prisma);
    assert.ok(workspace);
    assert.equal(workspace.applications[0]?.id, "application-a");
    assert.equal(otherProblemId, "other-problem");
  });
});
