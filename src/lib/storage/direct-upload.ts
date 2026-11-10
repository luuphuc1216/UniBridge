"use client";

import type { UploadScope } from "./upload-grants";

type UploadGrant = {
  token: string;
  url: string;
  contentType: string;
  local: boolean;
};

function responseError(payload: unknown): string {
  return payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
    ? payload.error
    : "Không thể tải tệp lên. Vui lòng thử lại.";
}

export async function uploadFilesDirectly(
  files: File[],
  scope: UploadScope,
): Promise<string[]> {
  const response = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scope,
      files: files.map(({ name, type, size }) => ({ name, type, size })),
    }),
  });
  const result = (await response.json().catch(() => null)) as
    | { error?: string; uploads?: UploadGrant[] }
    | null;
  if (!response.ok || !Array.isArray(result?.uploads)) {
    throw new Error(responseError(result));
  }
  const grants = result.uploads;
  if (grants.length !== files.length) {
    throw new Error("Máy chủ trả về số quyền tải lên không hợp lệ.");
  }

  try {
    await Promise.all(
      grants.map(async (grant, index) => {
        const file = files[index];
        if (!file) throw new Error("Không tìm thấy tệp tải lên.");
        let uploadResponse: Response;
        if (grant.local) {
          const formData = new FormData();
          formData.set("token", grant.token);
          formData.set("file", file);
          uploadResponse = await fetch(grant.url, {
            method: "POST",
            body: formData,
          });
        } else {
          uploadResponse = await fetch(grant.url, {
            method: "PUT",
            headers: { "Content-Type": grant.contentType },
            body: file,
          });
        }
        if (!uploadResponse.ok) {
          const uploadResult = await uploadResponse.json().catch(() => null);
          throw new Error(responseError(uploadResult));
        }
      }),
    );
    return grants.map(({ token }) => token);
  } catch (error) {
    await Promise.allSettled(
      grants.map(({ token }) =>
        fetch("/api/uploads/pending", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        }),
      ),
    );
    throw error;
  }
}

export async function discardPendingUploads(tokens: string[]): Promise<void> {
  await Promise.allSettled(
    tokens.map((token) =>
      fetch("/api/uploads/pending", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    ),
  );
}
