import { localAttachmentStorage } from "./local-attachment-storage";
import { s3AttachmentStorage } from "./s3-attachment-storage";
import type { AttachmentStorage } from "./attachment-storage";

const provider = process.env.STORAGE_PROVIDER?.trim().toLowerCase();
const runningOnVercel = Boolean(process.env.VERCEL);

const unavailableStorage: AttachmentStorage = {
  async save() {
    throw new Error("Cần cấu hình STORAGE_PROVIDER trên Vercel trước khi dùng Cloud Storage.");
  },
  async savePending() {
    throw new Error("Cần cấu hình STORAGE_PROVIDER trên Vercel trước khi dùng Cloud Storage.");
  },
  async read() {
    throw new Error("Cần cấu hình STORAGE_PROVIDER trên Vercel trước khi dùng Cloud Storage.");
  },
  async delete() {
    throw new Error("Cần cấu hình STORAGE_PROVIDER trên Vercel trước khi dùng Cloud Storage.");
  },
  async promote() {
    throw new Error("Cần cấu hình STORAGE_PROVIDER trên Vercel trước khi dùng Cloud Storage.");
  },
  async createUploadUrl() {
    throw new Error("Cần cấu hình STORAGE_PROVIDER trên Vercel trước khi dùng Cloud Storage.");
  },
  async createDownloadUrl() {
    throw new Error("Cần cấu hình STORAGE_PROVIDER trên Vercel trước khi dùng Cloud Storage.");
  },
};

const isRemoteProvider = provider === "s3" || provider === "r2";
const isValidProvider = !provider || ["local", "s3", "r2"].includes(provider);

export const attachmentStorage =
  isRemoteProvider
    ? s3AttachmentStorage
    : isValidProvider && !runningOnVercel
      ? localAttachmentStorage
      : unavailableStorage;

export const isLocalAttachmentStorage =
  !runningOnVercel && isValidProvider && !isRemoteProvider;
