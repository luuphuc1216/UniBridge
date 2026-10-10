import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
} from "./config";

type AllowedExtension = keyof typeof ALLOWED_ATTACHMENT_TYPES;

const acceptedMimeTypes: Record<AllowedExtension, string[]> = {
  ".pdf": ["application/pdf"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
  ],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
  ],
  ".pptx": [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
  ],
  ".csv": ["text/csv", "application/csv", "text/plain"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
};

export type ValidatedAttachment = {
  originalName: string;
  contentType: string;
  sizeBytes: number;
  content: Uint8Array;
};

function getExtension(name: string): AllowedExtension | null {
  const extension = name.toLowerCase().slice(name.lastIndexOf("."));
  return Object.hasOwn(ALLOWED_ATTACHMENT_TYPES, extension)
    ? (extension as AllowedExtension)
    : null;
}

function startsWithBytes(content: Uint8Array, expected: number[]): boolean {
  return expected.every((byte, index) => content[index] === byte);
}

function hasValidFileSignature(
  extension: AllowedExtension,
  content: Uint8Array,
): boolean {
  switch (extension) {
    case ".pdf":
      return startsWithBytes(content, [0x25, 0x50, 0x44, 0x46, 0x2d]);
    case ".png":
      return startsWithBytes(content, [
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
    case ".jpg":
      return startsWithBytes(content, [0xff, 0xd8, 0xff]);
    case ".docx":
    case ".xlsx":
    case ".pptx":
      return startsWithBytes(content, [0x50, 0x4b, 0x03, 0x04]);
    case ".csv":
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(content);
        return !content.includes(0);
      } catch {
        return false;
      }
  }
}

export async function validateAttachment(
  file: File,
): Promise<ValidatedAttachment> {
  if (!file.name || file.size === 0) {
    throw new Error("Tệp đính kèm không được để trống.");
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error(`Mỗi tệp không được vượt quá ${MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024} MB.`);
  }

  const extension = getExtension(file.name);
  if (!extension) {
    throw new Error("Chỉ chấp nhận PDF, DOCX, XLSX, PPTX, CSV, PNG và JPG.");
  }

  const allowed = ALLOWED_ATTACHMENT_TYPES[extension];
  if (
    file.type &&
    !acceptedMimeTypes[extension].includes(file.type.toLowerCase())
  ) {
    throw new Error(`Loại nội dung của tệp ${file.name} không hợp lệ.`);
  }

  const content = new Uint8Array(await file.arrayBuffer());
  if (!hasValidFileSignature(extension, content)) {
    throw new Error(`Nội dung tệp ${file.name} không khớp với định dạng khai báo.`);
  }

  return {
    originalName: file.name.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255),
    contentType: allowed.contentType,
    sizeBytes: content.byteLength,
    content,
  };
}
