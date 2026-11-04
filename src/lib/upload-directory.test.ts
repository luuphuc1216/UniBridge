import assert from "node:assert/strict";
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
});
