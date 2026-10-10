export interface AttachmentStorage {
  save(storageKey: string, content: Uint8Array): Promise<void>;
  read(storageKey: string): Promise<Uint8Array>;
  delete(storageKey: string): Promise<void>;
}
