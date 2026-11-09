import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const migrationsDirectory = path.resolve(
  process.cwd(),
  "prisma/migrations-postgres",
);


function getDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;

  if (!url) {
    throw new Error("Thiếu TEST_DATABASE_URL để chạy test PostgreSQL.");
  }

  const parsed = new URL(url);

  if (
    parsed.protocol !== "postgres:" &&
    parsed.protocol !== "postgresql:"
  ) {
    throw new Error("TEST_DATABASE_URL phải là PostgreSQL URL.");
  }

  if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    throw new Error(
      "Test chỉ được phép chạy trên PostgreSQL local.",
    );
  }

  return url;
}


async function dropSchema(
  databaseUrl: string,
  schemaName: string,
): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  } finally {
    await client.end();
  }
}


async function cleanupFailedTestDatabase(
  error: unknown,
  databaseUrl: string,
  schemaName: string,
  prisma?: PrismaClient,
): Promise<never> {
  const cleanupErrors: unknown[] = [error];

  if (prisma) {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      cleanupErrors.push(disconnectError);
    }
  }

  try {
    await dropSchema(databaseUrl, schemaName);
  } catch (cleanupError) {
    cleanupErrors.push(cleanupError);
  }

  if (cleanupErrors.length > 1) {
    throw new AggregateError(
      cleanupErrors,
      "Không thể hoàn tất dọn dẹp database test sau khi khởi tạo thất bại.",
    );
  }

  throw error;
}


async function executeMigration(
  databaseUrl: string,
  schemaName: string,
): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  let schemaCreated = false;

  try {
    await client.connect();
    await client.query(`CREATE SCHEMA "${schemaName}"`);
    schemaCreated = true;
    await client.query(`SET search_path TO "${schemaName}"`);

    const entries = await readdir(migrationsDirectory, {
      withFileTypes: true,
    });
    const migrationDirectories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const migrationDirectory of migrationDirectories) {
      const migrationPath = path.join(
        migrationsDirectory,
        migrationDirectory,
        "migration.sql",
      );
      const migration = await readFile(migrationPath, "utf8");
      await client.query(migration);
    }
  } catch (error) {
    if (schemaCreated) {
      return cleanupFailedTestDatabase(error, databaseUrl, schemaName);
    }

    throw error;
  } finally {
    await client.end();
  }
}

export async function createTestDatabase(
  _prefix: string,
  options: { seedBusinessContext?: boolean } = {},
) {
  const databaseUrl = getDatabaseUrl();
  const schemaName = `test_${randomUUID().replaceAll("-", "")}`;

  await executeMigration(databaseUrl, schemaName);

  let prisma: PrismaClient;
  try {
    prisma = new PrismaClient({
      adapter: new PrismaPg(
        {
          connectionString: databaseUrl,
          options: `-c search_path=${schemaName}`,
        },
        {
          schema: schemaName,
        },
      ),
    });
  } catch (error) {
    return cleanupFailedTestDatabase(error, databaseUrl, schemaName);
  }

  try {
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
  } catch (error) {
    return cleanupFailedTestDatabase(error, databaseUrl, schemaName, prisma);
  }

  return {
    prisma,
    async close() {
      try {
        await prisma.$disconnect();
      } finally {
        await dropSchema(databaseUrl, schemaName);
      }
    },
  };
}
