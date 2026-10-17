import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENT_COUNT,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENT_TOTAL_BYTES,
} from "./config";

export function validateSelectedAttachments(
  files: File[],
  existingCount = 0,
  existingBytes = 0,
  limits = {
    count: MAX_ATTACHMENT_COUNT,
    fileSizeBytes: MAX_ATTACHMENT_SIZE_BYTES,
    totalBytes: MAX_ATTACHMENT_TOTAL_BYTES,
  },
): string | null {
  if (files.length + existingCount > limits.count) {
    return `Mỗi lần tải lên được đính kèm tối đa ${limits.count} tệp.`;
  }

  const oversizedFile = files.find((file) => file.size > limits.fileSizeBytes);
  if (oversizedFile) {
    return `Tệp "${oversizedFile.name}" vượt quá giới hạn ${limits.fileSizeBytes / 1024 / 1024} MB.`;
  }

  const invalidFile = files.find((file) => {
    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    return !ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension);
  });
  if (invalidFile) {
    return `Tệp "${invalidFile.name}" không đúng định dạng. Chỉ nhận PDF, DOCX, XLSX, PPTX, CSV, PNG và JPG.`;
  }

  const totalBytes =
    files.reduce((total, file) => total + file.size, 0) + existingBytes;
  if (totalBytes > limits.totalBytes) {
    return `Tổng dung lượng tài liệu không được vượt quá ${limits.totalBytes / 1024 / 1024} MB.`;
  }

  return null;
}
