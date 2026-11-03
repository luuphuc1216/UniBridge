import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { PasswordResetEmail, EmailSender } from "@/lib/email-sender";
import { createTestDatabase } from "@/lib/test-database";
import { completePasswordReset, requestPasswordReset } from "@/lib/password-reset";
import { consumeRateLimit, getTrustedClientIp } from "@/lib/rate-limit";

describe("Password reset", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  const sent: PasswordResetEmail[] = [];
  const emailSender: EmailSender = {
    async sendPasswordReset(email) {
      sent.push(email);
    },
  };
  const now = new Date("2026-11-03T00:00:00.000Z");

  beforeEach(async () => {
    sent.length = 0;
    database = await createTestDatabase("unibridge-password-reset");
  });

  afterEach(async () => {
    await database.close();
  });

  it("uses hashed, expiring, single-use reset tokens and increments authVersion", async () => {
    await requestPasswordReset(database.prisma, {
      email: "BUYER@example.com",
      ip: "192.0.2.1",
      baseUrl: "https://unibridge.example",
      emailSender,
      now,
    });
    const rawToken = sent[0]?.token;
    assert.ok(rawToken);
    const stored = await database.prisma.passwordResetToken.findFirstOrThrow({
      where: { userId: "buyer" },
    });
    assert.notEqual(stored.tokenHash, rawToken);
    assert.equal(stored.expiresAt.getTime(), now.getTime() + 30 * 60 * 1000);

    assert.equal(
      await completePasswordReset(database.prisma, {
        token: rawToken,
        password: "A-new-password-123",
        now,
      }),
      true,
    );
    assert.equal(
      await completePasswordReset(database.prisma, {
        token: rawToken,
        password: "Another-password-123",
        now,
      }),
      false,
    );
    const updatedUser = await database.prisma.user.findUniqueOrThrow({
      where: { id: "buyer" },
    });
    assert.equal(updatedUser.authVersion, 1);
    assert.equal(
      await database.prisma.auditLog.count({
        where: { actorId: "buyer", action: "PASSWORD_RESET" },
      }),
      1,
    );
  });

  it("rejects expired tokens and invalidates previous tokens after a new request", async () => {
    await requestPasswordReset(database.prisma, {
      email: "buyer@example.com",
      ip: "192.0.2.2",
      baseUrl: "https://unibridge.example",
      emailSender,
      now,
    });
    const firstToken = sent[0].token;
    await requestPasswordReset(database.prisma, {
      email: "buyer@example.com",
      ip: "192.0.2.2",
      baseUrl: "https://unibridge.example",
      emailSender,
      now: new Date(now.getTime() + 1),
    });
    const secondToken = sent[1].token;

    assert.equal(
      await completePasswordReset(database.prisma, {
        token: firstToken,
        password: "A-new-password-123",
        now,
      }),
      false,
    );
    assert.equal(
      await completePasswordReset(database.prisma, {
        token: secondToken,
        password: "A-new-password-123",
        now: new Date(now.getTime() + 30 * 60 * 1000 + 1),
      }),
      false,
    );
  });

  it("does not send reset email for unknown accounts and applies per-email limits", async () => {
    await requestPasswordReset(database.prisma, {
      email: "missing@example.com",
      ip: "192.0.2.3",
      baseUrl: "https://unibridge.example",
      emailSender,
      now,
    });
    assert.equal(sent.length, 0);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await requestPasswordReset(database.prisma, {
        email: "buyer@example.com",
        ip: `192.0.2.${attempt + 4}`,
        baseUrl: "https://unibridge.example",
        emailSender,
        now: new Date(now.getTime() + attempt),
      });
    }
    assert.equal(sent.length, 3);
  });

  it("applies the per-IP limit and ignores forwarded headers unless the proxy is trusted", async () => {
    await database.prisma.user.createMany({
      data: Array.from({ length: 11 }, (_, index) => ({
        id: `ip-user-${index}`,
        email: `ip-user-${index}@example.com`,
        name: `IP User ${index}`,
        passwordHash: "test",
      })),
    });
    for (let index = 0; index < 11; index += 1) {
      await requestPasswordReset(database.prisma, {
        email: `ip-user-${index}@example.com`,
        ip: "198.51.100.10",
        baseUrl: "https://unibridge.example",
        emailSender,
        now: new Date(now.getTime() + index),
      });
    }
    assert.equal(sent.length, 10);

    const previousTrust = process.env.TRUST_PROXY;
    delete process.env.TRUST_PROXY;
    assert.equal(
      getTrustedClientIp(new Headers({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" })),
      null,
    );
    process.env.TRUST_PROXY = "true";
    assert.equal(
      getTrustedClientIp(new Headers({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" })),
      "203.0.113.1",
    );
    if (previousTrust === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previousTrust;
  });

  it("limits failed-login buckets to ten attempts per fifteen-minute window", async () => {
    const allowed = await database.prisma.$transaction(async (transaction) => {
      const results: boolean[] = [];
      for (let attempt = 0; attempt < 11; attempt += 1) {
        results.push(
          await consumeRateLimit(transaction, {
            scope: "login-failures",
            identifier: "target@example.com",
            limit: 10,
            windowMs: 15 * 60 * 1000,
            now: new Date(now.getTime() + attempt),
          }),
        );
      }
      return results;
    });
    assert.equal(allowed.filter(Boolean).length, 10);
    const resetAllowed = await database.prisma.$transaction((transaction) =>
      consumeRateLimit(transaction, {
        scope: "login-failures",
        identifier: "target@example.com",
        limit: 10,
        windowMs: 15 * 60 * 1000,
        now: new Date(now.getTime() + 15 * 60 * 1000 + 1),
      }),
    );
    assert.equal(resetAllowed, true);
  });
});
