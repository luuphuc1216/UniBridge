export interface AttachmentStorage {
  save(storageKey: string, content: Uint8Array): Promise<void>;
  savePending?(storageKey: string, content: Uint8Array): Promise<void>;
  read(storageKey: string): Promise<Uint8Array>;
  delete(storageKey: string): Promise<void>;
  promote?(
    pendingKey: string,
    storageKey: string,
    contentType?: string,
  ): Promise<void>;
  createUploadUrl?(
    pendingKey: string,
    contentType: string,
    sizeBytes: number,
  ): Promise<string | null>;
  createDownloadUrl?(
    storageKey: string,
    contentType: string,
    fileName: string,
    inline: boolean,
  ): Promise<string | null>;
}
