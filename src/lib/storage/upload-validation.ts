import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_COUNT,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENT_TOTAL_BYTES,
} from "@/lib/business-attachments/config";

export type UploadFileDescription = {
  name: string;
  type: string;
  size: number;
};

export function safeOriginalName(name: string): string {
  const sanitized = name.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255);
  if (!sanitized || sanitized.includes("/") || sanitized.includes("\\")) {
    throw new Error("Tên tệp không hợp lệ.");
  }
  return sanitized;
}

export function getAllowedContentType(file: UploadFileDescription): string {
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  const allowedType = Object.hasOwn(ALLOWED_ATTACHMENT_TYPES, extension)
    ? ALLOWED_ATTACHMENT_TYPES[extension as keyof typeof ALLOWED_ATTACHMENT_TYPES]
    : null;
  if (!allowedType) {
    throw new Error("Chỉ chấp nhận PDF, DOCX, XLSX, PPTX, CSV, PNG và JPG.");
  }
  const allowedMimeTypes =
    extension === ".csv"
      ? ["text/csv", "application/csv", "text/plain"]
      : [".docx", ".xlsx", ".pptx"].includes(extension)
        ? [allowedType.contentType, "application/zip"]
        : [allowedType.contentType];
  if (file.type && !allowedMimeTypes.includes(file.type.toLowerCase())) {
    throw new Error(`Loại nội dung của tệp ${file.name} không hợp lệ.`);
  }
  return allowedType.contentType;
}

export function validateUploadBatch(files: UploadFileDescription[]): void {
  if (!Array.isArray(files) || files.length < 1 || files.length > MAX_ATTACHMENT_COUNT) {
    throw new Error(`Chỉ được tải lên tối đa ${MAX_ATTACHMENT_COUNT} tệp mỗi lần.`);
  }
  let total = 0;
  for (const file of files) {
    if (
      !file ||
      typeof file.name !== "string" ||
      typeof file.type !== "string" ||
      !Number.isSafeInteger(file.size) ||
      file.size <= 0 ||
      file.size > MAX_ATTACHMENT_SIZE_BYTES
    ) {
      throw new Error(`Mỗi tệp phải có dung lượng từ 1 byte đến ${MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024} MB.`);
    }
    safeOriginalName(file.name);
    getAllowedContentType(file);
    total += file.size;
  }
  if (total > MAX_ATTACHMENT_TOTAL_BYTES) {
    throw new Error("Tổng dung lượng tệp không được vượt quá 60 MB.");
  }
}
