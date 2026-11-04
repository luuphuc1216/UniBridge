import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AttachmentStorage } from "./attachment-storage";

export function getUploadsDirectory(
  env: Record<string, string | undefined> = process.env,
  cwd = process.cwd(),
): string {
  return path.resolve(
    /*turbopackIgnore: true*/ env.UPLOADS_DIR || path.join(cwd, "uploads"),
  );
}

function getAttachmentDirectory(): string {
  return path.resolve(getUploadsDirectory(), "problem-attachments");
}

function getSafePath(storageKey: string, directory = getAttachmentDirectory()): string {
  if (!/^[0-9a-f-]{36}$/i.test(storageKey)) {
    throw new Error("Khóa lưu trữ tệp không hợp lệ.");
  }

  const resolvedPath = path.resolve(directory, storageKey);
  const relativePath = path.relative(directory, resolvedPath);
  if (
    !relativePath ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error("Đường dẫn lưu trữ tệp không hợp lệ.");
  }
  return resolvedPath;
}

export const localAttachmentStorage: AttachmentStorage = {
  async save(storageKey, content) {
    const directory = getAttachmentDirectory();
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(getSafePath(storageKey, directory), content, {
      flag: "wx",
      mode: 0o600,
    });
  },
  async read(storageKey) {
    return new Uint8Array(await readFile(getSafePath(storageKey)));
  },
  async delete(storageKey) {
    await rm(getSafePath(storageKey), { force: true });
  },
};
