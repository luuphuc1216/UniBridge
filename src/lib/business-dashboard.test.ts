import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestDatabase } from "@/lib/test-database";
import { getEffectiveApplicationCounts } from "@/lib/business-dashboard";

describe("Đợt 5C business dashboard metrics", () => {
  it("uses the same effective application definition as the business problem list", async () => {
    const database = await createTestDatabase("dot5c-dashboard");
    try {
      const problemA = await database.prisma.problem.create({
        data: {
          id: "problem-a",
          businessProfileId: "business",
          title: "A",
          slug: "problem-a",
          description: "A",
          goal: "A",
          field: "Công nghệ",
          requirements: "A",
          expectedDuration: "1 tháng",
          status: "APPROVED",
        },
      });
      const problemB = await database.prisma.problem.create({
        data: {
          id: "problem-b",
          businessProfileId: "business",
          title: "B",
          slug: "problem-b",
          description: "B",
          goal: "B",
          field: "Thiết kế",
          requirements: "B",
          expectedDuration: "1 tháng",
          status: "CLOSED",
        },
      });
      await database.prisma.studentTeam.createMany({
        data: [
          { id: "team-a", name: "Team A", slug: "team-a", university: "U", description: "" },
          { id: "team-b", name: "Team B", slug: "team-b", university: "U", description: "" },
          { id: "team-c", name: "Team C", slug: "team-c", university: "U", description: "" },
        ],
      });
      await database.prisma.application.createMany({
        data: [
          { id: "app-a", problemId: problemA.id, teamId: "team-a", approach: "A", estimatedDuration: "1" },
          { id: "app-b", problemId: problemA.id, teamId: "team-b", approach: "B", estimatedDuration: "1", status: "REJECTED" },
          { id: "app-c", problemId: problemB.id, teamId: "team-c", approach: "C", estimatedDuration: "1", status: "SELECTED" },
        ],
      });
      const counts = await getEffectiveApplicationCounts(
        [problemA.id, problemB.id],
        database.prisma,
      );
      const listRows = await database.prisma.application.groupBy({
        by: ["problemId"],
        where: {
          problemId: { in: [problemA.id, problemB.id] },
          status: { in: ["SUBMITTED", "PENDING_CONFIRMATION", "SELECTED"] },
        },
        _count: { _all: true },
      });
      assert.equal(counts.get(problemA.id), 1);
      assert.equal(counts.get(problemB.id), 1);
      assert.deepEqual(
        [...counts.entries()].sort(),
        listRows.map((row) => [row.problemId, row._count._all]).sort(),
      );
    } finally {
      await database.close();
    }
  });

  it("counts every owned Problem status independently of dashboard display labels", async () => {
    const database = await createTestDatabase("dot5c-statuses");
    try {
      await database.prisma.problem.createMany({
        data: [
          {
            id: "status-a",
            businessProfileId: "business",
            title: "A",
            slug: "status-a",
            description: "A",
            goal: "A",
            field: "Công nghệ",
            requirements: "A",
            expectedDuration: "1 tháng",
            status: "DRAFT",
          },
          {
            id: "status-b",
            businessProfileId: "business",
            title: "B",
            slug: "status-b",
            description: "B",
            goal: "B",
            field: "Công nghệ",
            requirements: "B",
            expectedDuration: "1 tháng",
            status: "PENDING_REVIEW",
          },
          {
            id: "status-c",
            businessProfileId: "business",
            title: "C",
            slug: "status-c",
            description: "C",
            goal: "C",
            field: "Công nghệ",
            requirements: "C",
            expectedDuration: "1 tháng",
            status: "CLOSED",
          },
        ],
      });
      const [total, grouped] = await Promise.all([
        database.prisma.problem.count({ where: { businessProfileId: "business" } }),
        database.prisma.problem.groupBy({
          by: ["status"],
          where: { businessProfileId: "business" },
          _count: { _all: true },
        }),
      ]);
      assert.equal(total, 3);
      assert.equal(
        grouped.reduce((sum, row) => sum + row._count._all, 0),
        total,
      );
      assert.deepEqual(
        new Map(grouped.map((row) => [row.status, row._count._all])),
        new Map([
          ["DRAFT", 1],
          ["PENDING_REVIEW", 1],
          ["CLOSED", 1],
        ]),
      );
    } finally {
      await database.close();
    }
  });
});
