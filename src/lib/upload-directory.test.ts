import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  getUploadsDirectory,
  localAttachmentStorage,
} from "./storage/local-attachment-storage";

describe("local attachment uploads directory", () => {
  it("keeps the existing development default under the project directory", () => {
    assert.equal(getUploadsDirectory({}, "/srv/unibridge"), "/srv/unibridge/uploads");
  });

  it("resolves stored files inside the attachment directory", async () => {
    await assert.rejects(
      localAttachmentStorage.read("../outside"),
      /Khóa lưu trữ tệp không hợp lệ/,
    );
  });

  it("keeps local pending uploads private and promotes them to the legacy UUID path", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "unibridge-uploads-"));
    const previousDirectory = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = directory;
    const key = "123e4567-e89b-12d3-a456-426614174000";
    const content = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    try {
      const savePending = localAttachmentStorage.savePending;
      const promote = localAttachmentStorage.promote;
      assert.ok(savePending);
      assert.ok(promote);
      await savePending(`pending/${key}`, content);
      await promote(`pending/${key}`, key);
      assert.deepEqual(await localAttachmentStorage.read(key), content);
      assert.deepEqual(
        new Uint8Array(await readFile(path.join(directory, "problem-attachments", key))),
        content,
      );
      await localAttachmentStorage.delete(key);
      await assert.rejects(localAttachmentStorage.read(key));
    } finally {
      if (previousDirectory === undefined) delete process.env.UPLOADS_DIR;
      else process.env.UPLOADS_DIR = previousDirectory;
      await rm(directory, { recursive: true, force: true });
    }
  });
});
