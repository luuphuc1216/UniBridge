import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createTestDatabase } from "@/lib/test-database";
import { expireInvitations } from "@/jobs/expire-invitations";
import { runExpireInvitationsJob } from "./expire-invitations-runner";

async function waitForLockOwner(lockDirectory: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await access(path.join(lockDirectory, "owner"));
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw new Error("Timed out waiting for the job lock");
}

describe("expire invitation job runner", () => {
  it("does not expire an invitation twice across repeated runs", async () => {
    const database = await createTestDatabase("unibridge-expire-invitations");
    const now = new Date("2026-11-04T00:00:00.000Z");
    try {
      await database.prisma.studentTeam.create({
        data: {
          id: "expiry-team",
          ownerId: "buyer",
          name: "Expiry team",
          slug: "expiry-team",
          university: "Test university",
          description: "Test team",
        },
      });
      await database.prisma.problem.create({
        data: {
          id: "expiry-problem",
          businessProfileId: "business",
          title: "Expiry problem",
          slug: "expiry-problem",
          description: "Test problem",
          goal: "Test goal",
          field: "Công nghệ",
          requirements: "Test requirements",
          expectedDuration: "1 tuần",
          status: "APPROVED",
        },
      });
      await database.prisma.application.create({
        data: {
          id: "expiry-application",
          problemId: "expiry-problem",
          teamId: "expiry-team",
          approach: "Test approach",
          estimatedDuration: "1 tuần",
          status: "PENDING_CONFIRMATION",
        },
      });
      await database.prisma.applicationInvitation.create({
        data: {
          id: "expiry-invitation",
          applicationId: "expiry-application",
          problemId: "expiry-problem",
          teamId: "expiry-team",
          invitedByBusinessProfileId: "business",
          expiresAt: new Date(now.getTime() - 1),
          status: "PENDING_CONFIRMATION",
        },
      });

      assert.equal(await expireInvitations(now, database.prisma), 1);
      assert.equal(await expireInvitations(now, database.prisma), 0);
      assert.equal(
        await database.prisma.notification.count({
          where: { userId: "business-owner" },
        }),
        1,
      );
      assert.equal(
        await database.prisma.applicationInvitation.count({
          where: { status: "EXPIRED" },
        }),
        1,
      );
    } finally {
      await database.close();
    }
  });

  it("disconnects and releases its lock when the job fails", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "unibridge-expire-job-error-"));
    const lockDirectory = path.join(root, "job.lock");
    let disconnected = false;
    try {
      await assert.rejects(
        runExpireInvitationsJob({
          lockDirectory,
          run: async () => {
            throw new Error("job failed");
          },
          disconnect: async () => {
            disconnected = true;
          },
          log: () => undefined,
        }),
        /job failed/,
      );
      assert.equal(disconnected, true);
      await assert.rejects(access(lockDirectory));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("skips a second invocation while the first run holds the lock", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "unibridge-expire-job-lock-"));
    const lockDirectory = path.join(root, "job.lock");
    let releaseFirstRun!: () => void;
    let firstDisconnects = 0;
    let secondDisconnects = 0;
    let runCount = 0;
    const logLines: string[] = [];
    const firstRunGate = new Promise<void>((resolve) => {
      releaseFirstRun = resolve;
    });
    try {
      const first = runExpireInvitationsJob({
        lockDirectory,
        run: async () => {
          runCount += 1;
          await firstRunGate;
          return 1;
        },
        disconnect: async () => {
          firstDisconnects += 1;
        },
        log: (message) => logLines.push(message),
      });
      await waitForLockOwner(lockDirectory);

      const secondResult = await runExpireInvitationsJob({
        lockDirectory,
        run: async () => {
          runCount += 1;
          return 2;
        },
        disconnect: async () => {
          secondDisconnects += 1;
        },
        log: (message) => logLines.push(message),
      });
      assert.equal(secondResult, 0);
      assert.equal(runCount, 1);
      assert.equal(secondDisconnects, 1);
      assert.ok(logLines.some((message) => message.includes("skipped")));

      releaseFirstRun();
      assert.equal(await first, 1);
      assert.equal(firstDisconnects, 1);
    } finally {
      releaseFirstRun();
      await rm(root, { recursive: true, force: true });
    }
  });
});
