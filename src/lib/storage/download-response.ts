import { attachmentStorage } from "./index";

export async function createAttachmentDownloadResponse({
  storageKey,
  contentType,
  fileName,
  inline = false,
}: {
  storageKey: string;
  contentType: string;
  fileName: string;
  inline?: boolean;
}): Promise<Response> {
  const signedUrl = await attachmentStorage.createDownloadUrl?.(
    storageKey,
    contentType,
    fileName,
    inline,
  );
  if (signedUrl) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: signedUrl,
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }
  const content = await attachmentStorage.read(storageKey);
  const body = new ArrayBuffer(content.byteLength);
  new Uint8Array(body).set(content);
  const safeName = fileName.replace(/[\r\n"]/g, "_");
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(content.byteLength),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
