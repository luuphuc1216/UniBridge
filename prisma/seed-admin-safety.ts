import { createHash } from "node:crypto";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Thiếu DATABASE_URL. Hãy cấu hình môi trường trước khi seed.");
}

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: databaseUrl }),
});

async function main() {
  const [admin, reporter, problem, team, message, review] = await Promise.all([
    prisma.user.findUnique({ where: { email: "admin@unibridge.local" } }),
    prisma.user.findFirst({ where: { role: "STUDENT" }, orderBy: { createdAt: "asc" } }),
    prisma.problem.findFirst({ where: { hiddenByAdmin: false }, orderBy: { createdAt: "asc" } }),
    prisma.studentTeam.findFirst({ where: { hiddenByAdmin: false }, orderBy: { createdAt: "asc" } }),
    prisma.workspaceMessage.findFirst({ where: { hiddenByAdmin: false }, orderBy: { createdAt: "asc" } }),
    prisma.review.findFirst({ where: { hiddenByAdmin: false }, orderBy: { createdAt: "asc" } }),
  ]);
  if (!admin || !reporter) {
    throw new Error("Hãy chạy seed chính trước khi seed dữ liệu Admin safety.");
  }

  const targets = [
    ...(problem ? [{ type: "PROBLEM", id: problem.id, snapshot: { title: problem.title, description: problem.description } }] : []),
    ...(team ? [{ type: "TEAM", id: team.id, snapshot: { name: team.name, description: team.description } }] : []),
    ...(message ? [{ type: "MESSAGE", id: message.id, snapshot: { content: message.content } }] : []),
    ...(review ? [{ type: "REVIEW", id: review.id, snapshot: { rating: review.rating, content: review.content } }] : []),
  ];

  for (const [index, target] of targets.entries()) {
    const openKey = createHash("sha256")
      .update(`${reporter.id}\u0000${target.type}\u0000${target.id}`)
      .digest("hex");
    const existing = await prisma.report.findUnique({ where: { openKey } });
    if (!existing) {
      await prisma.report.create({
        data: {
          id: `seed-admin-safety-report-${index}`,
          reporterId: reporter.id,
          targetType: target.type,
          targetId: target.id,
          snapshot: JSON.stringify(target.snapshot),
          reason: "Dữ liệu minh họa để kiểm tra quy trình tiếp nhận báo cáo.",
          openKey,
        },
      });
    }
  }

  const auditId = "seed-admin-safety-audit-log";
  if (!(await prisma.auditLog.findUnique({ where: { id: auditId } }))) {
    await prisma.auditLog.create({
      data: {
        id: auditId,
        actorId: admin.id,
        action: "SEED_ADMIN_SAFETY",
        targetType: "System",
        targetId: "admin-safety-wave4",
        metadata: JSON.stringify({ seeded: true }),
      },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error("Seed Admin safety thất bại:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
