import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AttachmentStorage } from "./attachment-storage";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Thiếu biến môi trường ${name} cho Cloud Storage.`);
  return value;
}

function getClient(): S3Client {
  const provider = process.env.STORAGE_PROVIDER?.trim().toLowerCase();
  const region =
    process.env.STORAGE_REGION?.trim() ||
    (provider === "r2" ? "auto" : requiredEnv("STORAGE_REGION"));
  const endpoint = process.env.STORAGE_ENDPOINT?.trim();
  if (!endpoint) throw new Error("Thiếu biến môi trường STORAGE_ENDPOINT cho Cloud Storage.");
  return new S3Client({
    region,
    endpoint,
    forcePathStyle: provider !== "r2",
    credentials: {
      accessKeyId: requiredEnv("STORAGE_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("STORAGE_SECRET_ACCESS_KEY"),
    },
  });
}

function bucketName(): string {
  return requiredEnv("STORAGE_BUCKET");
}

function safeKey(key: string): string {
  if (
    !/^(?:pending\/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      key,
    )
  ) {
    throw new Error("Khóa lưu trữ tệp không hợp lệ.");
  }
  return key;
}

function encodeFileName(fileName: string): string {
  return encodeURIComponent(fileName.replace(/[\r\n"]/g, "_"));
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; $metadata?: { httpStatusCode?: unknown } };
  return (
    candidate.$metadata?.httpStatusCode === 404 ||
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey"
  );
}

async function readObjectBody(
  body: NonNullable<GetObjectCommandOutput["Body"]>,
): Promise<Uint8Array> {
  try {
    return new Uint8Array(await body.transformToByteArray());
  } finally {
    if ("destroy" in body && typeof body.destroy === "function" && !body.destroyed) {
      body.destroy();
    }
  }
}

export function createS3AttachmentStorage(
  clientFactory: () => S3Client = getClient,
  getBucket: () => string = bucketName,
): AttachmentStorage {
  return {
    async save(storageKey, content) {
      await clientFactory().send(
        new PutObjectCommand({
          Bucket: getBucket(),
          Key: safeKey(storageKey),
          Body: content,
        }),
      );
    },
    async savePending(storageKey, content) {
      await clientFactory().send(
        new PutObjectCommand({
          Bucket: getBucket(),
          Key: safeKey(storageKey),
          Body: content,
        }),
      );
    },
    async read(storageKey) {
      const response = await clientFactory().send(
        new GetObjectCommand({
          Bucket: getBucket(),
          Key: safeKey(storageKey),
        }),
      );
      if (!response.Body) throw new Error("Không tìm thấy tệp trên Cloud Storage.");
      return readObjectBody(response.Body);
    },
    async delete(storageKey) {
      await clientFactory().send(
        new DeleteObjectCommand({
          Bucket: getBucket(),
          Key: safeKey(storageKey),
        }),
      );
    },
    async promote(pendingKey, storageKey, contentType) {
      const source = safeKey(pendingKey);
      const destination = safeKey(storageKey);
      if (!source.startsWith("pending/") || destination.startsWith("pending/")) {
        throw new Error("Không thể hoàn tất khóa lưu trữ tệp.");
      }
      const client = clientFactory();
      const bucket = getBucket();
      const existing = await client
        .send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: destination,
          }),
        )
        .then(() => true)
        .catch((error: unknown) => {
          if (isNotFound(error)) return false;
          throw error;
        });
      if (existing) {
        throw new Error("Khóa đích đã tồn tại; không ghi đè tệp đang được lưu trữ.");
      }

      const response = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: source }),
      );
      if (!response.Body) throw new Error("Không tìm thấy tệp chờ hoàn tất trên Cloud Storage.");
      const content = await readObjectBody(response.Body);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: destination,
          Body: content,
          ...(contentType ? { ContentType: contentType } : {}),
        }),
      );
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: source }),
        );
      } catch (error) {
        console.error(
          "Đã hoàn tất upload nhưng không thể dọn object pending trên Cloud Storage:",
          error,
        );
      }
    },
    async createUploadUrl(pendingKey, contentType, sizeBytes) {
      const key = safeKey(pendingKey);
      if (!key.startsWith("pending/")) {
        throw new Error("Khóa tải lên tạm thời không hợp lệ.");
      }
      if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
        throw new Error("Dung lượng tệp tải lên không hợp lệ.");
      }
      return getSignedUrl(
        clientFactory(),
        new PutObjectCommand({
          Bucket: getBucket(),
          Key: key,
          ContentType: contentType,
          ContentLength: sizeBytes,
        }),
        {
          expiresIn: 300,
          signableHeaders: new Set(["content-type"]),
        },
      );
    },
    async createDownloadUrl(storageKey, contentType, fileName, inline) {
      return getSignedUrl(
        clientFactory(),
        new GetObjectCommand({
          Bucket: getBucket(),
          Key: safeKey(storageKey),
          ResponseContentType: contentType,
          ResponseContentDisposition: `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeFileName(fileName)}`,
          ResponseCacheControl: "private, no-store",
        }),
        { expiresIn: 60 },
      );
    },
  };
}

export const s3AttachmentStorage = createS3AttachmentStorage();
