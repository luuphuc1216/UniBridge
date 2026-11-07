import { inflateRawSync } from "node:zlib";
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
  ".jpeg": ["image/jpeg"],
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

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

function readZipEntries(content: Uint8Array): ZipEntry[] | null {
  const view = new DataView(content.buffer, content.byteOffset, content.byteLength);
  const minimumOffset = Math.max(0, content.byteLength - 22 - 0xffff);
  let endOfCentralDirectory = -1;

  for (let offset = content.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (
      view.getUint32(offset, true) === 0x06054b50 &&
      offset + 22 + view.getUint16(offset + 20, true) === content.byteLength
    ) {
      endOfCentralDirectory = offset;
      break;
    }
  }
  if (endOfCentralDirectory < 0) return null;

  const entryCount = view.getUint16(endOfCentralDirectory + 10, true);
  const centralDirectorySize = view.getUint32(endOfCentralDirectory + 12, true);
  let offset = view.getUint32(endOfCentralDirectory + 16, true);
  if (offset + centralDirectorySize > endOfCentralDirectory) return null;

  const entries: ZipEntry[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + 46 > content.byteLength ||
      view.getUint32(offset, true) !== 0x02014b50
    ) {
      return null;
    }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const entryEnd = offset + 46 + nameLength + extraLength + commentLength;
    if (entryEnd > content.byteLength) return null;

    let name: string;
    try {
      name = new TextDecoder("utf-8", { fatal: true }).decode(
        content.subarray(offset + 46, offset + 46 + nameLength),
      );
    } catch {
      return null;
    }

    entries.push({
      name,
      compressionMethod: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      uncompressedSize: view.getUint32(offset + 24, true),
      localHeaderOffset: view.getUint32(offset + 42, true),
    });
    offset = entryEnd;
  }

  return entries;
}

function isOfficePackage(
  content: Uint8Array,
  extension: ".docx" | ".xlsx" | ".pptx",
): boolean {
  const entries = readZipEntries(content);
  if (!entries) return false;
  const documentPaths = {
    ".docx": "word/document.xml",
    ".xlsx": "xl/workbook.xml",
    ".pptx": "ppt/presentation.xml",
  } as const;
  if (
    !entries.some(({ name }) => name === "[Content_Types].xml") ||
    !entries.some(({ name }) => name === documentPaths[extension])
  ) {
    return false;
  }

  const contentTypes = entries.find(({ name }) => name === "[Content_Types].xml");
  if (
    !contentTypes ||
    contentTypes.uncompressedSize > 1024 * 1024 ||
    (contentTypes.compressionMethod !== 0 && contentTypes.compressionMethod !== 8)
  ) {
    return false;
  }
  const view = new DataView(content.buffer, content.byteOffset, content.byteLength);
  const localOffset = contentTypes.localHeaderOffset;
  if (
    localOffset + 30 > content.byteLength ||
    view.getUint32(localOffset, true) !== 0x04034b50
  ) {
    return false;
  }
  const dataOffset =
    localOffset +
    30 +
    view.getUint16(localOffset + 26, true) +
    view.getUint16(localOffset + 28, true);
  const dataEnd = dataOffset + contentTypes.compressedSize;
  if (dataEnd > content.byteLength) return false;

  try {
    const compressed = content.subarray(dataOffset, dataEnd);
    const xml =
      contentTypes.compressionMethod === 0
        ? compressed
        : inflateRawSync(compressed, { maxOutputLength: 1024 * 1024 });
    const text = new TextDecoder("utf-8", { fatal: true }).decode(xml);
    const expectedContentType = {
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
      ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
      ".pptx":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
    } as const;
    return text.includes(expectedContentType[extension]);
  } catch {
    return false;
  }
}

function hasValidFileContent(
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
    case ".jpeg":
      return startsWithBytes(content, [0xff, 0xd8, 0xff]);
    case ".docx":
    case ".xlsx":
    case ".pptx":
      return (
        startsWithBytes(content, [0x50, 0x4b, 0x03, 0x04]) &&
        isOfficePackage(content, extension)
      );
    case ".csv":
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(content);
        return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text);
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
  if (!hasValidFileContent(extension, content)) {
    throw new Error(`Nội dung tệp ${file.name} không khớp với định dạng khai báo.`);
  }

  return {
    originalName: file.name.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255),
    contentType: allowed.contentType,
    sizeBytes: content.byteLength,
    content,
  };
}
