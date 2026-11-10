import "dotenv/config";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getUploadsDirectory } from "@/lib/storage/local-attachment-storage";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Thiếu biến môi trường ${name}.`);
  return value;
}

async function main() {
  const directory = path.join(getUploadsDirectory(), "problem-attachments");
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries.filter(
    (entry) => entry.isFile() && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.name),
  );
  const invalidFiles = entries.filter(
    (entry) => entry.isFile() && !files.some((file) => file.name === entry.name),
  );
  if (invalidFiles.length > 0) {
    throw new Error(
      `Có tên tệp không phải UUID trong ${directory}; không tự động di chuyển các tệp này.`,
    );
  }
  const apply = process.argv.includes("--apply");
  console.log(
    `${apply ? "Đang sao chép" : "Chế độ xem trước:"} ${files.length} tệp từ ${directory} tới bucket ${process.env.STORAGE_BUCKET ?? "(chưa cấu hình)"}.`,
  );
  if (!apply) {
    console.log("Chạy lại với --apply để sao chép. Tệp nguồn sẽ được giữ nguyên.");
    return;
  }

  if (!["r2", "s3"].includes(process.env.STORAGE_PROVIDER?.trim().toLowerCase() ?? "")) {
    throw new Error("Đặt STORAGE_PROVIDER=r2 hoặc s3 để chạy với --apply.");
  }
  const bucket = required("STORAGE_BUCKET");
  const endpoint = required("STORAGE_ENDPOINT");
  const region = required("STORAGE_REGION");
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: process.env.STORAGE_PROVIDER?.trim().toLowerCase() !== "r2",
    credentials: {
      accessKeyId: required("STORAGE_ACCESS_KEY_ID"),
      secretAccessKey: required("STORAGE_SECRET_ACCESS_KEY"),
    },
  });
  let copied = 0;
  let skipped = 0;
  try {
    for (const entry of files) {
      try {
        await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: entry.name }),
        );
        skipped += 1;
        continue;
      } catch (error) {
        const status =
          typeof error === "object" && error !== null && "$metadata" in error
            ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
            : undefined;
        const code =
          typeof error === "object" && error !== null && "name" in error
            ? String(error.name)
            : "";
        if (status !== 404 && code !== "NotFound" && code !== "NoSuchKey") {
          throw error;
        }
      }
      const content = await readFile(path.join(directory, entry.name));
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: entry.name,
          Body: content,
        }),
      );
      copied += 1;
    }
  } finally {
    client.destroy();
  }
  console.log(`Hoàn tất: ${copied} đã sao chép, ${skipped} đã tồn tại và được giữ nguyên.`);
}

main().catch((error: unknown) => {
  console.error("Di chuyển tệp local thất bại:", error);
  process.exitCode = 1;
});
