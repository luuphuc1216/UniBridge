import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import {
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENT_TOTAL_BYTES,
} from "@/lib/business-attachments/config";
import { validateUploadBatch } from "./upload-validation";
import {
  createS3AttachmentStorage,
  s3AttachmentStorage,
} from "./s3-attachment-storage";

describe("direct-upload validation", () => {
  it("accepts supported document and image files up to the configured limits", () => {
    assert.doesNotThrow(() =>
      validateUploadBatch([
        { name: "brief.pdf", type: "application/pdf", size: MAX_ATTACHMENT_SIZE_BYTES },
        { name: "diagram.png", type: "image/png", size: MAX_ATTACHMENT_SIZE_BYTES },
        { name: "data.csv", type: "text/plain", size: MAX_ATTACHMENT_SIZE_BYTES },
      ]),
    );
    assert.equal(MAX_ATTACHMENT_TOTAL_BYTES, MAX_ATTACHMENT_SIZE_BYTES * 3);
  });

  it("rejects files larger than 20 MB, too many files, unsupported types and MIME mismatches", () => {
    assert.throws(
      () =>
        validateUploadBatch([
          { name: "large.pdf", type: "application/pdf", size: MAX_ATTACHMENT_SIZE_BYTES + 1 },
        ]),
      /20 MB/,
    );
    assert.throws(
      () =>
        validateUploadBatch(
          Array.from({ length: 4 }, (_, index) => ({
            name: `file-${index}.pdf`,
            type: "application/pdf",
            size: 1,
          })),
        ),
      /tối đa 3/,
    );
    assert.throws(
      () => validateUploadBatch([{ name: "script.exe", type: "application/octet-stream", size: 12 }]),
      /Chỉ chấp nhận PDF/,
    );
    assert.throws(
      () => validateUploadBatch([{ name: "image.png", type: "image/jpeg", size: 12 }]),
      /Loại nội dung/,
    );
  });
});

function withStorageEnvironment<T>(provider: "s3" | "r2", action: () => Promise<T>) {
  const savedEnv = {
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
    STORAGE_BUCKET: process.env.STORAGE_BUCKET,
    STORAGE_REGION: process.env.STORAGE_REGION,
    STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
    STORAGE_ACCESS_KEY_ID: process.env.STORAGE_ACCESS_KEY_ID,
    STORAGE_SECRET_ACCESS_KEY: process.env.STORAGE_SECRET_ACCESS_KEY,
  };
  Object.assign(process.env, {
    STORAGE_PROVIDER: provider,
    STORAGE_BUCKET: "unibridge-storage",
    STORAGE_REGION: provider === "s3" ? "ap-southeast-1" : "auto",
    STORAGE_ENDPOINT:
      provider === "s3"
        ? "https://project-ref.storage.supabase.co/storage/v1/s3"
        : "https://account-id.r2.cloudflarestorage.com",
    STORAGE_ACCESS_KEY_ID: "test-access-key",
    STORAGE_SECRET_ACCESS_KEY: "test-secret-key",
  });
  return action().finally(() => {
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

function createMockStorage(send: (command: unknown) => Promise<unknown>) {
  const client = new S3Client({
    region: "ap-southeast-1",
    endpoint: "https://project-ref.storage.supabase.co/storage/v1/s3",
    forcePathStyle: true,
    credentials: {
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
    },
  });
  Object.defineProperty(client, "send", { value: send });
  return createS3AttachmentStorage(() => client, () => "unibridge-storage");
}

function mockBody(bytes: Uint8Array) {
  const stream = Readable.from([Buffer.from(bytes)]);
  return Object.assign(stream, {
    transformToByteArray: async () => bytes,
    transformToString: async () => Buffer.from(bytes).toString("utf8"),
    transformToWebStream: () => new ReadableStream(),
  });
}

describe("S3-compatible signed upload and download", () => {
  it("creates a Supabase path-style presigned PUT with the configured region and content type", async () => {
    await withStorageEnvironment("s3", async () => {
      const createUploadUrl = s3AttachmentStorage.createUploadUrl;
      assert.ok(createUploadUrl);
      const signedUrl = await createUploadUrl(
        "pending/123e4567-e89b-12d3-a456-426614174000",
        "application/pdf",
        1234,
      );
      assert.ok(signedUrl);
      const url = new URL(signedUrl);
      assert.equal(
        url.origin,
        "https://project-ref.storage.supabase.co",
      );
      assert.ok(
        url.pathname.startsWith(
          "/storage/v1/s3/unibridge-storage/pending/123e4567-e89b-12d3-a456-426614174000",
        ),
      );
      assert.match(url.searchParams.get("X-Amz-Credential") ?? "", /ap-southeast-1/);
      assert.equal(url.searchParams.get("X-Amz-Expires"), "300");
      assert.match(
        url.searchParams.get("X-Amz-SignedHeaders") ?? "",
        /content-length;content-type/,
      );
    });
  });

  it("retains Cloudflare R2 endpoint addressing and auto region", async () => {
    await withStorageEnvironment("r2", async () => {
      const createUploadUrl = s3AttachmentStorage.createUploadUrl;
      assert.ok(createUploadUrl);
      const signedUrl = await createUploadUrl(
        "pending/123e4567-e89b-12d3-a456-426614174000",
        "application/pdf",
        1234,
      );
      assert.ok(signedUrl);
      const url = new URL(signedUrl);
      assert.equal(
        url.hostname,
        "unibridge-storage.account-id.r2.cloudflarestorage.com",
      );
      assert.ok(url.pathname.startsWith("/pending/"));
      assert.match(url.searchParams.get("X-Amz-Credential") ?? "", /\/auto\/s3\//);
    });
  });

  it("uploads pending content and promotes it before deleting the pending object", async () => {
    const calls: unknown[] = [];
    const content = new Uint8Array([1, 2, 3]);
    let responseBody: ReturnType<typeof mockBody> | undefined;
    const storage = createMockStorage(async (command) => {
      calls.push(command);
      if (command instanceof HeadObjectCommand) {
        throw Object.assign(new Error("not found"), {
          name: "NotFound",
          $metadata: { httpStatusCode: 404 },
        });
      }
      if (command instanceof GetObjectCommand) {
        responseBody = mockBody(content);
        return { Body: responseBody };
      }
      return {};
    });
    await storage.savePending?.(
      "pending/123e4567-e89b-12d3-a456-426614174000",
      content,
    );
    assert.ok(calls[0] instanceof PutObjectCommand);
    assert.equal(calls[0].input.Key, "pending/123e4567-e89b-12d3-a456-426614174000");
    calls.length = 0;
    await storage.promote?.(
      "pending/123e4567-e89b-12d3-a456-426614174000",
      "123e4567-e89b-12d3-a456-426614174001",
      "application/pdf",
    );
    assert.deepEqual(
      calls.map((command) =>
        command instanceof Object ? command.constructor.name : "unknown",
      ),
      ["HeadObjectCommand", "GetObjectCommand", "PutObjectCommand", "DeleteObjectCommand"],
    );
    const put = calls.find((command) => command instanceof PutObjectCommand);
    assert.ok(put instanceof PutObjectCommand);
    assert.equal(put.input.ContentType, "application/pdf");
    assert.deepEqual(put.input.Body, content);
    assert.equal(responseBody?.destroyed, true);
  });

  it("keeps the pending object and does not delete it when promotion fails", async () => {
    const calls: unknown[] = [];
    const storage = createMockStorage(async (command) => {
      calls.push(command);
      if (command instanceof HeadObjectCommand) {
        throw Object.assign(new Error("not found"), {
          name: "NotFound",
          $metadata: { httpStatusCode: 404 },
        });
      }
      if (command instanceof GetObjectCommand) {
        return { Body: mockBody(new Uint8Array([1, 2, 3])) };
      }
      if (command instanceof PutObjectCommand) {
        throw new Error("put failed");
      }
      return {};
    });
    const promote = storage.promote;
    assert.ok(promote);
    await assert.rejects(
      promote(
        "pending/123e4567-e89b-12d3-a456-426614174000",
        "123e4567-e89b-12d3-a456-426614174001",
        "application/pdf",
      ),
      /put failed/,
    );
    assert.equal(calls.some((command) => command instanceof DeleteObjectCommand), false);
  });

  it("keeps the permanent object if pending cleanup fails after a successful promotion", async () => {
    const calls: unknown[] = [];
    const loggedErrors: unknown[][] = [];
    const originalConsoleError = console.error;
    const storage = createMockStorage(async (command) => {
      calls.push(command);
      if (command instanceof HeadObjectCommand) {
        throw Object.assign(new Error("not found"), {
          name: "NotFound",
          $metadata: { httpStatusCode: 404 },
        });
      }
      if (command instanceof GetObjectCommand) {
        return { Body: mockBody(new Uint8Array([1, 2, 3])) };
      }
      if (command instanceof DeleteObjectCommand) {
        throw new Error("delete failed");
      }
      return {};
    });
    const promote = storage.promote;
    assert.ok(promote);
    console.error = (...args) => loggedErrors.push(args);
    try {
      await assert.doesNotReject(
        promote(
          "pending/123e4567-e89b-12d3-a456-426614174000",
          "123e4567-e89b-12d3-a456-426614174001",
          "application/pdf",
        ),
      );
    } finally {
      console.error = originalConsoleError;
    }
    assert.ok(calls.some((command) => command instanceof PutObjectCommand));
    assert.ok(calls.some((command) => command instanceof DeleteObjectCommand));
    assert.equal(loggedErrors.length, 1);
  });

  it("does not overwrite an existing destination object", async () => {
    const calls: unknown[] = [];
    const storage = createMockStorage(async (command) => {
      calls.push(command);
      if (command instanceof HeadObjectCommand) return {};
      return {};
    });
    const promote = storage.promote;
    assert.ok(promote);
    await assert.rejects(
      promote(
        "pending/123e4567-e89b-12d3-a456-426614174000",
        "123e4567-e89b-12d3-a456-426614174001",
        "application/pdf",
      ),
      /không ghi đè/,
    );
    assert.equal(calls.some((command) => command instanceof PutObjectCommand), false);
    assert.equal(calls.some((command) => command instanceof DeleteObjectCommand), false);
  });

  it("creates a short-lived signed GET URL for a private bucket object", async () => {
    await withStorageEnvironment("s3", async () => {
      const createDownloadUrl = s3AttachmentStorage.createDownloadUrl;
      assert.ok(createDownloadUrl);
      const signedUrl = await createDownloadUrl(
        "123e4567-e89b-12d3-a456-426614174001",
        "application/pdf",
        "brief.pdf",
        false,
      );
      assert.ok(signedUrl);
      const url = new URL(signedUrl);
      assert.ok(
        url.pathname.includes("/unibridge-storage/123e4567-e89b-12d3-a456-426614174001"),
      );
      assert.equal(url.searchParams.get("X-Amz-Expires"), "60");
      assert.equal(
        url.searchParams.get("response-cache-control"),
        "private, no-store",
      );
      assert.equal(
        url.searchParams.get("response-content-type"),
        "application/pdf",
      );
    });
  });
});
