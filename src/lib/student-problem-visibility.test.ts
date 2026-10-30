import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  getStudentDiscoverableProblemWhere,
  getStudentRecommendationProblemWhere,
} from "@/lib/problem-workflow";
import { getPrototypeProblemStatusLabel } from "@/lib/prototype-status";
import { createTestDatabase } from "@/lib/test-database";

describe("student Problem visibility", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;

  before(async () => {
    database = await createTestDatabase("unibridge-student-problem-visibility");
    await database.prisma.user.create({
      data: {
        id: "visibility-team-owner",
        email: "visibility-team@example.com",
        name: "Team owner",
        passwordHash: "test",
        updatedAt: new Date(),
      },
    });
    await database.prisma.studentTeam.create({
      data: {
        id: "visibility-team",
        ownerId: "visibility-team-owner",
        name: "Visibility team",
        slug: "visibility-team",
        university: "University",
        description: "Test team",
      },
    });
    await database.prisma.problem.createMany({
      data: [
        {
          id: "visibility-open",
          businessProfileId: "business",
          title: "Open problem",
          slug: "visibility-open",
          description: "Description",
          goal: "Goal",
          field: "Technology",
          requirements: "Requirements",
          expectedDuration: "1 week",
          status: "PUBLISHED",
        },
        {
          id: "visibility-selected",
          businessProfileId: "business",
          title: "Selected problem",
          slug: "visibility-selected",
          description: "Description",
          goal: "Goal",
          field: "Technology",
          requirements: "Requirements",
          expectedDuration: "1 week",
          status: "PUBLISHED",
        },
        {
          id: "visibility-closed",
          businessProfileId: "business",
          title: "Closed problem",
          slug: "visibility-closed",
          description: "Description",
          goal: "Goal",
          field: "Technology",
          requirements: "Requirements",
          expectedDuration: "1 week",
          status: "CLOSED",
        },
        {
          id: "visibility-prototyping",
          businessProfileId: "business",
          title: "Prototyping problem",
          slug: "visibility-prototyping",
          description: "Description",
          goal: "Goal",
          field: "Technology",
          requirements: "Requirements",
          expectedDuration: "1 week",
          status: "PROTOTYPING",
        },
      ],
    });
    await database.prisma.application.create({
      data: {
        id: "visibility-selected-application",
        problemId: "visibility-selected",
        teamId: "visibility-team",
        approach: "Selected",
        estimatedDuration: "1 week",
        status: "SELECTED",
      },
    });
  });

  after(async () => {
    await database.close();
  });

  it("excludes CLOSED and selected Problems from discovery and recommendation, but preserves business-owned rows/counts", async () => {
    const discovered = await database.prisma.problem.findMany({
      where: getStudentDiscoverableProblemWhere(),
      select: { id: true },
      orderBy: { id: "asc" },
    });
    assert.deepEqual(
      discovered.map(({ id }) => id),
      ["visibility-open", "visibility-prototyping"],
    );

    const recommendations = await database.prisma.problem.findMany({
      where: getStudentRecommendationProblemWhere("visibility-team"),
      select: { id: true },
    });
    assert.deepEqual(recommendations.map(({ id }) => id), ["visibility-open"]);

    const businessProblems = await database.prisma.problem.findMany({
      where: { businessProfileId: "business" },
      select: { id: true, applications: { where: { status: "SELECTED" }, select: { id: true } } },
      orderBy: { id: "asc" },
    });
    assert.equal(businessProblems.length, 4);
    assert.equal(
      businessProblems.find(({ id }) => id === "visibility-selected")?.applications.length,
      1,
    );
    assert.ok(businessProblems.some(({ id }) => id === "visibility-closed"));
  });

  it("uses distinct Prototype labels for accepted, ended, implemented, and stopped outcomes", () => {
    const accepted = {
      prototypeLegacy: false,
      evaluationResult: "ACCEPTED",
    };
    assert.match(
      getPrototypeProblemStatusLabel({
        ...accepted,
        status: "EVALUATING",
        implementationDecision: "PENDING",
      }),
      /chờ quyết định triển khai/,
    );
    assert.match(
      getPrototypeProblemStatusLabel({
        ...accepted,
        status: "CLOSED",
        implementationDecision: "ENDED",
      }),
      /kết thúc sau khi chấp nhận/,
    );
    assert.match(
      getPrototypeProblemStatusLabel({
        ...accepted,
        status: "READY_FOR_IMPLEMENTATION",
        implementationDecision: "IMPLEMENT",
      }),
      /chờ thỏa thuận/,
    );
    assert.equal(
      getPrototypeProblemStatusLabel({
        prototypeLegacy: false,
        status: "CLOSED",
        evaluationResult: "STOPPED",
        implementationDecision: null,
      }),
      "Không tiếp tục Prototype",
    );
  });
});
