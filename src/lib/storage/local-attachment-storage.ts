import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AttachmentStorage } from "./attachment-storage";

const uploadsDirectory = path.join(process.cwd(), "uploads", "problem-attachments");

function getSafePath(storageKey: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(storageKey)) {
    throw new Error("Khóa lưu trữ tệp không hợp lệ.");
  }
  return path.join(uploadsDirectory, storageKey);
}

export const localAttachmentStorage: AttachmentStorage = {
  async save(storageKey, content) {
    await mkdir(uploadsDirectory, { recursive: true });
    await writeFile(getSafePath(storageKey), content, { flag: "wx", mode: 0o600 });
  },
  async read(storageKey) {
    return new Uint8Array(await readFile(getSafePath(storageKey)));
  },
  async delete(storageKey) {
    await rm(getSafePath(storageKey), { force: true });
  },
};
