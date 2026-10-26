import { randomUUID } from "node:crypto";
import { readdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const migrationsDirectory = path.resolve(process.cwd(), "prisma/migrations");

async function applyAllMigrations(databasePath: string): Promise<void> {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  const migrationDirectories = entries
    .filter((entry) => entry.isDirectory() && entry.name !== "migration_lock.toml")
    .map((entry) => entry.name)
    .sort();
  const database = new Database(databasePath);

  try {
    for (const migrationDirectory of migrationDirectories) {
      const migrationPath = path.join(
        migrationsDirectory,
        migrationDirectory,
        "migration.sql",
      );
      const migration = await readFile(migrationPath, "utf8");
      database.exec(migration);
    }
  } finally {
    database.close();
  }
}

export async function createTestDatabase(
  prefix: string,
  options: { seedBusinessContext?: boolean } = {},
) {
  const databasePath = `/tmp/${prefix}-${randomUUID()}.db`;
  await applyAllMigrations(databasePath);
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${databasePath}` }),
  });
  await prisma.user.create({
    data: {
      id: "business-owner",
      email: "business-owner@example.com",
      name: "Business owner",
      passwordHash: "test",
      updatedAt: new Date(),
    },
  });
  await prisma.user.create({
    data: {
      id: "buyer",
      email: "buyer@example.com",
      name: "Buyer",
      passwordHash: "test",
      updatedAt: new Date(),
    },
  });
  await prisma.businessProfile.create({
    data: {
      id: "business",
      userId: "business-owner",
      companyName: "Business",
      industry: "Công nghệ",
      description: "Test business",
    },
  });
  if (options.seedBusinessContext) {
    await prisma.user.create({
      data: {
        id: "user",
        email: "business@example.com",
        name: "Business",
        passwordHash: "test",
        updatedAt: new Date(),
      },
    });
  }

  return {
    prisma,
    async close() {
      await prisma.$disconnect();
      await unlink(databasePath);
    },
  };
}
