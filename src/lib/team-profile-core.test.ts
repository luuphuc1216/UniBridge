import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { createTestDatabase } from "@/lib/test-database";
import { canViewPortfolioFile } from "@/lib/portfolio-access";
import { findAccessibleProject, getProjectTeamUserIds } from "@/lib/project-access";
import { saveTeamProfileCore, type TeamProfileInput } from "@/lib/team-profile-core";
import { findAuthorizedWorkspace } from "@/lib/workspace-access";

const importDatabasePath = `/tmp/team-profile-core-import-${randomUUID()}.db`;
let findAuthorizedProposalFile: typeof import("@/lib/proposal-handoff-access")["findAuthorizedProposalFile"];

before(async () => {
  process.env.DATABASE_URL = `file:${importDatabasePath}`;
  ({ findAuthorizedProposalFile } = await import("@/lib/proposal-handoff-access"));
});

after(async () => {
  const { prisma } = await import("@/lib/prisma");
  await prisma.$disconnect();
  if (existsSync(importDatabasePath)) await unlink(importDatabasePath);
});

const linkedMembershipSnapshots = [
  {
    id: "membership-owner",
    studentProfileId: "profile-owner",
    name: "Chủ nhóm",
    major: "Công nghệ thông tin",
    title: "Vai trò chủ sở hữu",
    isLead: false,
    joinedAt: new Date("2025-01-01T00:00:00.000Z"),
  },
  {
    id: "membership-member-a",
    studentProfileId: "profile-member-a",
    name: "Thành viên A",
    major: "Khoa học dữ liệu",
    title: "Trưởng nhóm được ghi nhận",
    isLead: true,
    joinedAt: new Date("2025-02-01T00:00:00.000Z"),
  },
  {
    id: "membership-member-b",
    studentProfileId: "profile-member-b",
    name: "Thành viên B",
    major: "Thiết kế",
    title: "Thành viên chuyên môn",
    isLead: false,
    joinedAt: new Date("2025-03-01T00:00:00.000Z"),
  },
];

const profileInput = (
  members: TeamProfileInput["members"] = [
    { name: "Khách hiển thị A", major: "Marketing" },
    { name: "Khách hiển thị B", major: "Quản trị" },
  ],
): TeamProfileInput => ({
  name: "Nhóm đã cập nhật",
  university: "Đại học UniBridge",
  description: "Hồ sơ sau cập nhật",
  experience: "Kinh nghiệm mới",
  relevantProducts: "Sản phẩm mới",
  achievements: "Thành tích mới",
  interests: "Lĩnh vực mới",
  members,
  skills: ["Phân tích dữ liệu"],
});

describe("saveTeamProfileCore", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeEach(async () => {
    database = await createTestDatabase("team-profile-core");
    const { prisma } = database;
    await prisma.user.createMany({
      data: [
        { id: "team-owner", email: "team-owner@example.com", name: "Owner", passwordHash: "test", role: "STUDENT", updatedAt: new Date() },
        { id: "member-a", email: "member-a@example.com", name: "Member A", passwordHash: "test", role: "STUDENT", updatedAt: new Date() },
        { id: "member-b", email: "member-b@example.com", name: "Member B", passwordHash: "test", role: "STUDENT", updatedAt: new Date() },
        { id: "outsider", email: "outsider@example.com", name: "Outsider", passwordHash: "test", role: "STUDENT", updatedAt: new Date() },
      ],
    });
    await prisma.studentProfile.createMany({
      data: [
        { id: "profile-owner", userId: "team-owner", major: "Công nghệ thông tin", university: "Đại học" },
        { id: "profile-member-a", userId: "member-a", major: "Khoa học dữ liệu", university: "Đại học" },
        { id: "profile-member-b", userId: "member-b", major: "Thiết kế", university: "Đại học" },
        { id: "profile-outsider", userId: "outsider", major: "Kinh tế", university: "Đại học" },
      ],
    });
    await prisma.studentTeam.create({
      data: {
        id: "team",
        ownerId: "team-owner",
        name: "Nhóm ban đầu",
        slug: "team-profile-core",
        university: "Đại học cũ",
        description: "Mô tả cũ",
        memberships: {
          create: [
            ...linkedMembershipSnapshots,
            {
              id: "display-member-a",
              studentProfileId: null,
              name: "Tên hiển thị cũ",
              major: "Ngành cũ",
              title: "Trưởng nhóm",
              isLead: true,
              joinedAt: new Date("2025-04-01T00:00:00.000Z"),
            },
            {
              id: "display-member-b",
              studentProfileId: null,
              name: "Tên hiển thị cần xóa",
              major: "Ngành khác",
              title: "Thành viên",
              isLead: false,
              joinedAt: new Date("2025-05-01T00:00:00.000Z"),
            },
          ],
        },
        skills: {
          create: {
            skill: {
              create: { name: "Kỹ năng cũ" },
            },
          },
        },
      },
    });
  });

  afterEach(async () => {
    await database.close();
  });

  it("preserves all linked membership IDs, profiles, roles, and join dates across repeated saves", async () => {
    const { prisma } = database;
    await saveTeamProfileCore("team-owner", profileInput(), prisma);
    await saveTeamProfileCore("team-owner", profileInput(), prisma);

    const linkedAfterSave = await prisma.teamMembership.findMany({
      where: { teamId: "team", studentProfileId: { not: null } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        studentProfileId: true,
        name: true,
        major: true,
        title: true,
        isLead: true,
        joinedAt: true,
      },
    });
    assert.deepEqual(linkedAfterSave, [...linkedMembershipSnapshots].sort((a, b) => a.id.localeCompare(b.id)));
    assert.equal(await prisma.teamMembership.count({ where: { teamId: "team" } }), 5);
    assert.equal(
      await prisma.teamMembership.count({
        where: { teamId: "team", studentProfileId: { not: null } },
      }),
      3,
    );
  });

  it("updates and removes only display-only memberships without linking them to accounts", async () => {
    const { prisma } = database;
    await saveTeamProfileCore(
      "team-owner",
      profileInput([{ name: "Tên hiển thị mới", major: "Ngành mới" }]),
      prisma,
    );

    const displayMembers = await prisma.teamMembership.findMany({
      where: { teamId: "team", studentProfileId: null },
      select: { id: true, studentProfileId: true, name: true, major: true },
    });
    assert.deepEqual(displayMembers, [
      {
        id: "display-member-a",
        studentProfileId: null,
        name: "Tên hiển thị mới",
        major: "Ngành mới",
      },
    ]);
    assert.equal(
      await prisma.teamMembership.count({
        where: { id: "display-member-b", teamId: "team" },
      }),
      0,
    );
    assert.equal(await prisma.teamMembership.count({ where: { teamId: "team" } }), 4);
  });

  it("allows an all-linked roster while requiring at least one member for a new unlinked roster", async () => {
    const { prisma } = database;
    await saveTeamProfileCore("team-owner", profileInput([]), prisma);
    assert.equal(await prisma.teamMembership.count({ where: { teamId: "team" } }), 3);

    await assert.rejects(
      saveTeamProfileCore("outsider", profileInput([]), prisma),
      /Hãy thêm ít nhất một thành viên/,
    );
    assert.equal(await prisma.studentTeam.count({ where: { ownerId: "outsider" } }), 0);
  });

  it("rejects duplicate display rows before changing the team or its memberships", async () => {
    const { prisma } = database;
    const before = await prisma.teamMembership.findMany({
      where: { teamId: "team" },
      orderBy: { id: "asc" },
    });

    await assert.rejects(
      saveTeamProfileCore(
        "team-owner",
        profileInput([
          { name: "Tên trùng", major: "Ngành trùng" },
          { name: " TÊN TRÙNG ", major: "Ngành trùng" },
        ]),
        prisma,
      ),
      /không được có dòng trùng lặp/,
    );

    assert.equal(
      (await prisma.studentTeam.findUniqueOrThrow({ where: { id: "team" } })).name,
      "Nhóm ban đầu",
    );
    assert.deepEqual(
      await prisma.teamMembership.findMany({ where: { teamId: "team" }, orderBy: { id: "asc" } }),
      before,
    );
  });

  it("rolls back team, display membership, and skill changes when a database write fails", async () => {
    const { prisma } = database;
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER "fail_team_skill_insert"
       BEFORE INSERT ON "TeamSkill"
       BEGIN SELECT RAISE(ABORT, 'forced skill write failure'); END;`,
    );

    await assert.rejects(
      saveTeamProfileCore(
        "team-owner",
        { ...profileInput([{ name: "Tên sau lỗi", major: "Ngành sau lỗi" }]), skills: ["Kỹ năng mới"] },
        prisma,
      ),
    );

    const team = await prisma.studentTeam.findUniqueOrThrow({
      where: { id: "team" },
      include: { skills: { include: { skill: true } } },
    });
    assert.equal(team.name, "Nhóm ban đầu");
    assert.deepEqual(team.skills.map(({ skill }) => skill.name), ["Kỹ năng cũ"]);
    assert.equal(
      (await prisma.teamMembership.findUniqueOrThrow({ where: { id: "display-member-a" } })).name,
      "Tên hiển thị cũ",
    );
    assert.deepEqual(
      await prisma.teamMembership.findMany({
        where: { teamId: "team", studentProfileId: { not: null } },
        orderBy: { id: "asc" },
        select: { id: true, studentProfileId: true, title: true, isLead: true, joinedAt: true },
      }),
      [...linkedMembershipSnapshots]
        .map(({ id, studentProfileId, title, isLead, joinedAt }) => ({
          id,
          studentProfileId,
          title,
          isLead,
          joinedAt,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
  });

  it("keeps Student, Business, Admin, workspace, project, proposal, notification, and portfolio access intact", async () => {
    const { prisma } = database;
    await prisma.problem.create({
      data: {
        id: "problem",
        businessProfileId: "business",
        title: "Bài toán kiểm thử",
        slug: "team-profile-problem",
        description: "Mô tả",
        goal: "Mục tiêu",
        field: "Công nghệ",
        requirements: "Yêu cầu",
        expectedDuration: "4 tuần",
        status: "TEAM_SELECTED",
        prototypeLegacy: true,
      },
    });
    await prisma.application.create({
      data: {
        id: "application",
        problemId: "problem",
        teamId: "team",
        approach: "Giải pháp",
        estimatedDuration: "4 tuần",
        status: "SELECTED",
      },
    });
    await prisma.project.create({
      data: {
        id: "project",
        applicationId: "application",
        teamId: "team",
        title: "Dự án kiểm thử",
        agreedScope: "Phạm vi",
        totalAmount: 100,
        status: "IN_PROGRESS",
      },
    });
    await prisma.proposal.create({
      data: {
        id: "proposal",
        applicationId: "application",
        version: 1,
        type: "PROTOTYPE",
        description: "Đề xuất",
      },
    });
    await prisma.proposalFile.create({
      data: {
        id: "proposal-file",
        proposalId: "proposal",
        originalName: "proposal.pdf",
        contentType: "application/pdf",
        sizeBytes: 10,
        storageKey: "proposal-file-key",
      },
    });
    await prisma.applicationInvitation.create({
      data: {
        id: "application-invitation",
        applicationId: "application",
        problemId: "problem",
        teamId: "team",
        invitedByBusinessProfileId: "business",
        status: "ACCEPTED",
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      },
    });
    await prisma.portfolioItem.create({
      data: {
        id: "portfolio-item",
        teamId: "team",
        title: "Portfolio giữ nguyên",
        description: "Thông tin portfolio",
      },
    });

    await saveTeamProfileCore(
      "team-owner",
      profileInput([{ name: "Outsider", major: "Kinh tế" }]),
      prisma,
    );

    assert.ok(await findAuthorizedWorkspace("problem", "member-a", "STUDENT", undefined, prisma));
    assert.ok(await findAccessibleProject("project", "member-a", "STUDENT", prisma));
    assert.equal(await findAuthorizedWorkspace("problem", "outsider", "STUDENT", undefined, prisma), null);
    assert.equal(await findAccessibleProject("project", "outsider", "STUDENT", prisma), null);
    assert.ok(await findAccessibleProject("project", "outsider", "ADMIN", prisma));
    assert.ok(await findAuthorizedProposalFile("proposal-file", "member-a", "STUDENT", prisma));
    assert.equal(await findAuthorizedProposalFile("proposal-file", "outsider", "STUDENT", prisma), null);
    assert.equal(await prisma.application.count({ where: { id: "application" } }), 1);
    assert.equal(await prisma.project.count({ where: { id: "project" } }), 1);
    assert.equal(await prisma.applicationInvitation.count({ where: { id: "application-invitation" } }), 1);
    assert.equal(await prisma.portfolioItem.count({ where: { id: "portfolio-item" } }), 1);

    const team = await prisma.studentTeam.findUniqueOrThrow({
      where: { id: "team" },
      select: {
        ownerId: true,
        memberships: { select: { studentProfile: { select: { userId: true } } } },
      },
    });
    assert.deepEqual(
      getProjectTeamUserIds(team).sort(),
      ["member-a", "member-b", "team-owner"].sort(),
    );

    const businessTeam = await prisma.studentTeam.findUniqueOrThrow({
      where: { id: "team" },
      select: { memberships: { select: { name: true, major: true, studentProfileId: true } } },
    });
    assert.equal(businessTeam.memberships.length, 4);
    assert.ok(
      businessTeam.memberships.some(
        ({ name, studentProfileId }) => name === "Outsider" && studentProfileId === null,
      ),
    );

    const leadMembership = await prisma.teamMembership.findUniqueOrThrow({
      where: { id: "membership-member-a" },
      select: { isLead: true },
    });
    assert.equal(
      canViewPortfolioFile({
        viewer: { userId: "member-a", role: "STUDENT" },
        item: { teamId: "team", isVisible: false },
        teamMembership: { isOwner: false, isLead: leadMembership.isLead },
      }),
      true,
    );
    assert.equal(
      canViewPortfolioFile({
        viewer: { userId: "outsider", role: "STUDENT" },
        item: { teamId: "team", isVisible: false },
        teamMembership: null,
      }),
      false,
    );
  });

  it("allows only an owner to update an existing team and prevents linked members creating another team", async () => {
    const { prisma } = database;
    const before = await prisma.studentTeam.findUniqueOrThrow({ where: { id: "team" } });

    await assert.rejects(
      saveTeamProfileCore(
        "member-a",
        profileInput([{ name: "Nhóm riêng", major: "Ngành riêng" }]),
        prisma,
      ),
      /đã là thành viên của một nhóm/,
    );
    await saveTeamProfileCore("outsider", profileInput([{ name: "Nhóm riêng khác", major: "Ngành khác" }]), prisma);

    const unchangedTeam = await prisma.studentTeam.findUniqueOrThrow({ where: { id: "team" } });
    assert.equal(unchangedTeam.name, before.name);
    assert.equal(unchangedTeam.description, before.description);
    assert.equal(await prisma.studentTeam.count({ where: { ownerId: "member-a" } }), 0);
    assert.equal(await prisma.studentTeam.count({ where: { ownerId: "outsider" } }), 1);
  });
});
