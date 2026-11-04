import assert from "node:assert/strict";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

const sqliteCheck = spawnSync("sh", ["-c", "command -v sqlite3"], {
  encoding: "utf8",
});
const sqlitePath = sqliteCheck.status === 0 ? sqliteCheck.stdout.trim() : "";
const scriptsDirectory = path.resolve(process.cwd(), "scripts");
let temporaryRoot: string;

async function createFixture(label: string) {
  const root = path.join(temporaryRoot, label);
  const uploads = path.join(root, "uploads");
  const database = path.join(root, "app.sqlite");
  const backups = path.join(root, "backups");
  await mkdir(uploads, { recursive: true });
  await mkdir(backups, { recursive: true });
  await writeFile(path.join(uploads, "attachment.txt"), "upload contents");
  execFileSync(sqlitePath, [
    database,
    "CREATE TABLE records (id INTEGER PRIMARY KEY, value TEXT); INSERT INTO records(value) VALUES ('test');",
  ]);
  return { root, uploads, database, backups };
}

function backupEnvironment(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  extra: Record<string, string> = {},
) {
  return {
    ...process.env,
    DB_PATH: fixture.database,
    UPLOADS_DIR: fixture.uploads,
    BACKUP_DIR: fixture.backups,
    KEEP: "14",
    ...extra,
  };
}

function runBackup(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  extra: Record<string, string> = {},
) {
  return spawnSync("sh", [path.join(scriptsDirectory, "backup.sh")], {
    encoding: "utf8",
    env: backupEnvironment(fixture, extra),
  });
}

function getSha256(filePath: string): string {
  const command = spawnSync("shasum", ["-a", "256", filePath], {
    encoding: "utf8",
  });
  if (command.status === 0) return command.stdout.split(/\s+/)[0] ?? "";
  return execFileSync("sha256sum", [filePath]).toString().split(/\s+/)[0] ?? "";
}

async function getBackupDirectories(directory: string) {
  return (await readdir(directory))
    .filter((name) => name.startsWith("backup-"))
    .sort();
}

async function waitForPath(targetPath: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await readdir(targetPath);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  throw new Error("Timed out waiting for the backup lock");
}

describe(
  "SQLite backup and restore scripts",
  { skip: sqlitePath ? false : "sqlite3 CLI is unavailable; backup/restore shell tests skipped" },
  () => {
    before(async () => {
      temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "unibridge-backup-tests-"));
    });

    after(async () => {
      await rm(temporaryRoot, { recursive: true, force: true });
    });

    it("creates a complete backup with valid manifest checksums", async () => {
      const fixture = await createFixture("complete");
      const result = runBackup(fixture);
      assert.equal(result.status, 0, result.stderr);
      const [backupName] = await getBackupDirectories(fixture.backups);
      assert.ok(backupName);

      const backupDirectory = path.join(fixture.backups, backupName);
      const names = (await readdir(backupDirectory)).sort();
      assert.deepEqual(names, ["MANIFEST", "db", "uploads.tar.gz"]);
      const manifest = await readFile(path.join(backupDirectory, "MANIFEST"), "utf8");
      const databaseHash = getSha256(path.join(backupDirectory, "db"));
      const uploadsHash = getSha256(path.join(backupDirectory, "uploads.tar.gz"));
      assert.match(manifest, new RegExp(`^database_sha256=${databaseHash}$`, "m"));
      assert.match(manifest, new RegExp(`^uploads_archive_sha256=${uploadsHash}$`, "m"));
      assert.equal(
        execFileSync(sqlitePath, [path.join(backupDirectory, "db"), "PRAGMA integrity_check;"])
          .toString()
          .trim(),
        "ok",
      );
    });

    it("keeps only the configured newest backups", async () => {
      const fixture = await createFixture("rotation");
      const outputNames: string[] = [];
      for (let index = 0; index < 3; index += 1) {
        const result = runBackup(fixture, { KEEP: "2" });
        assert.equal(result.status, 0, result.stderr);
        const match = result.stdout.match(/Backup completed: (backup-\S+)/);
        assert.ok(match?.[1]);
        outputNames.push(match[1]);
      }

      assert.deepEqual(
        (await getBackupDirectories(fixture.backups)).sort(),
        outputNames.slice(-2).sort(),
      );
    });

    it("rejects a corrupt database and removes incomplete temporary files", async () => {
      const fixture = await createFixture("corrupt");
      await writeFile(fixture.database, "not a SQLite database");

      const result = runBackup(fixture);
      assert.notEqual(result.status, 0);
      assert.deepEqual(await getBackupDirectories(fixture.backups), []);
      assert.deepEqual(
        (await readdir(fixture.backups)).filter((name) => name.startsWith(".backup-tmp-")),
        [],
      );
    });

    it("skips a concurrent backup while the mkdir lock is held", async () => {
      const fixture = await createFixture("locking");
      const wrapperDirectory = path.join(fixture.root, "bin");
      await mkdir(wrapperDirectory);
      const wrapperPath = path.join(wrapperDirectory, "sqlite3");
      await writeFile(
        wrapperPath,
        "#!/bin/sh\nsleep 1\nexec \"$REAL_SQLITE3\" \"$@\"\n",
        { mode: 0o700 },
      );
      const environment = backupEnvironment(fixture, {
        PATH: `${wrapperDirectory}:${process.env.PATH ?? ""}`,
        REAL_SQLITE3: sqlitePath,
      });
      const first = spawn("sh", [path.join(scriptsDirectory, "backup.sh")], {
        env: environment,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let firstStdout = "";
      let firstStderr = "";
      first.stdout.setEncoding("utf8").on("data", (chunk: string) => {
        firstStdout += chunk;
      });
      first.stderr.setEncoding("utf8").on("data", (chunk: string) => {
        firstStderr += chunk;
      });
      await waitForPath(path.join(fixture.backups, ".backup.lock"));

      const concurrent = spawnSync("sh", [path.join(scriptsDirectory, "backup.sh")], {
        encoding: "utf8",
        env: environment,
      });
      assert.notEqual(concurrent.status, 0);
      assert.match(concurrent.stdout, /Backup skipped: another backup is running/);
      assert.equal(
        await new Promise<number | null>((resolve) => first.once("close", resolve)),
        0,
        firstStderr,
      );
      assert.match(firstStdout, /Backup completed/);
    });

    it("restores to staging without touching the source and rejects unattended apply", async () => {
      const fixture = await createFixture("restore");
      const backupResult = runBackup(fixture);
      assert.equal(backupResult.status, 0, backupResult.stderr);
      const [backupName] = await getBackupDirectories(fixture.backups);
      assert.ok(backupName);
      const backupPath = path.join(fixture.backups, backupName);
      const originalDatabase = await readFile(fixture.database);
      const staging = path.join(fixture.root, "staging");
      const environment = {
        ...backupEnvironment(fixture),
        RESTORE_STAGING_DIR: staging,
      };

      const staged = spawnSync(
        "sh",
        [path.join(scriptsDirectory, "restore.sh"), backupPath],
        { encoding: "utf8", env: environment },
      );
      assert.equal(staged.status, 0, staged.stderr);
      assert.deepEqual(await readFile(fixture.database), originalDatabase);
      assert.equal(
        await readFile(path.join(staging, "uploads", "attachment.txt"), "utf8"),
        "upload contents",
      );

      const applyStaging = path.join(fixture.root, "apply-staging");
      const apply = spawnSync(
        "sh",
        [path.join(scriptsDirectory, "restore.sh"), backupPath, "--apply"],
        {
          encoding: "utf8",
          env: { ...environment, RESTORE_STAGING_DIR: applyStaging },
          input: "",
        },
      );
      assert.notEqual(apply.status, 0);
      assert.match(apply.stderr, /interactive terminal/);
      assert.deepEqual(await readFile(fixture.database), originalDatabase);
    });
  },
);
