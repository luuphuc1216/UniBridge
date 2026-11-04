import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

type JobOptions = {
  lockDirectory: string;
  run: () => Promise<number>;
  disconnect: () => Promise<unknown>;
  log?: (message: string) => void;
};

async function acquireLock(lockDirectory: string): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await mkdir(lockDirectory, { mode: 0o700 });
      await writeFile(path.join(lockDirectory, "owner"), `${process.pid}\n`, {
        flag: "wx",
        mode: 0o600,
      });
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;

      let owner: string;
      try {
        owner = await readFile(path.join(lockDirectory, "owner"), "utf8");
      } catch (readError) {
        if ((readError as NodeJS.ErrnoException).code !== "ENOENT") throw readError;
        await new Promise((resolve) => setTimeout(resolve, 50));
        try {
          owner = await readFile(path.join(lockDirectory, "owner"), "utf8");
        } catch (retryError) {
          if ((retryError as NodeJS.ErrnoException).code !== "ENOENT") throw retryError;
          owner = "";
        }
      }

      const ownerPid = Number(owner.trim());
      if (Number.isSafeInteger(ownerPid) && ownerPid > 0) {
        try {
          process.kill(ownerPid, 0);
          return false;
        } catch (processError) {
          if ((processError as NodeJS.ErrnoException).code !== "ESRCH") {
            return false;
          }
        }
      }

      const staleDirectory = `${lockDirectory}.stale-${process.pid}`;
      try {
        await rm(staleDirectory, { recursive: true, force: true });
        await rename(lockDirectory, staleDirectory);
        await rm(staleDirectory, { recursive: true, force: true });
      } catch (cleanupError) {
        if ((cleanupError as NodeJS.ErrnoException).code !== "ENOENT") throw cleanupError;
      }
    }
  }
  return false;
}

async function releaseLock(lockDirectory: string) {
  try {
    const owner = await readFile(path.join(lockDirectory, "owner"), "utf8");
    if (owner.trim() === String(process.pid)) {
      await rm(lockDirectory, { recursive: true });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function runExpireInvitationsJob({
  lockDirectory,
  run,
  disconnect,
  log = console.log,
}: JobOptions): Promise<number> {
  let acquired = false;
  try {
    acquired = await acquireLock(lockDirectory);
    if (!acquired) {
      log("expire-invitations skipped: another run is active.");
      return 0;
    }

    const count = await run();
    log(`Đã xử lý ${count} lời mời hết hạn.`);
    return count;
  } finally {
    try {
      if (acquired) await releaseLock(lockDirectory);
    } finally {
      await disconnect();
    }
  }
}
