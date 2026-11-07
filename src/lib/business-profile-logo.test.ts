import assert from "node:assert/strict";
import { it } from "node:test";
import {
  saveBusinessProfileWithLogo,
  type BusinessProfileLogoSaveDependencies,
} from "@/lib/business-profile-core";
import { validateAttachment } from "@/lib/business-attachments/validation";

const oldLogoKey = "11111111-1111-4111-8111-111111111111";
const newLogoKey = "22222222-2222-4222-8222-222222222222";
const fields = {
  companyName: "Doanh nghiệp cập nhật",
  industry: "Công nghệ",
  industries: "",
  website: null,
  description: "Mô tả",
  address: "",
  contactEmail: null,
  phone: null,
  representative: "",
};

type HarnessOptions = {
  failSave?: boolean;
  failDelete?: boolean;
  failPersist?: "before" | "after";
  failCurrentLogoRead?: boolean;
  failRevalidate?: boolean;
  sharedLogoReferences?: Set<string>;
};

function createHarness(
  initialLogo: string | null,
  initialMimeType: string | null,
  options: HarnessOptions = {},
) {
  const profile = { logo: initialLogo, logoMimeType: initialMimeType };
  const files = new Map<string, Uint8Array>();
  const deletedKeys: string[] = [];
  const events: string[] = [];
  const errors: unknown[] = [];
  const savedFields: Array<Parameters<typeof saveBusinessProfileWithLogo>[1]> =
    [];
  const dependencies: BusinessProfileLogoSaveDependencies = {
    storage: {
      async save(key, content) {
        events.push(`save:${key}`);
        if (options.failSave) throw new Error("storage save failed");
        files.set(key, content);
      },
      async read(key) {
        const content = files.get(key);
        if (!content) throw new Error("file not found");
        return content;
      },
      async delete(key) {
        events.push(`delete:${key}`);
        if (options.failDelete) throw new Error("storage delete failed");
        deletedKeys.push(key);
        files.delete(key);
      },
    },
    validateFile: validateAttachment,
    createStorageKey: () => newLogoKey,
    async persist(nextFields, logo, logoMimeType) {
      events.push("persist");
      savedFields.push(nextFields);
      if (options.failPersist === "before") throw new Error("database failed");
      profile.logo = logo;
      profile.logoMimeType = logoMimeType;
      if (options.failPersist === "after") throw new Error("response failed after commit");
    },
    async readCurrentLogo() {
      if (options.failCurrentLogoRead) throw new Error("database read failed");
      return profile.logo;
    },
    async countLogoReferences(logo) {
      events.push(`count:${logo}`);
      const currentProfileReference = profile.logo === logo ? 1 : 0;
      return (
        currentProfileReference +
        (options.sharedLogoReferences?.has(logo) ? 1 : 0)
      );
    },
    revalidate(path) {
      events.push(`revalidate:${path}`);
      if (options.failRevalidate) throw new Error("revalidation failed");
    },
    logError(_message, error) {
      errors.push(error);
    },
  };

  return {
    profile,
    files,
    deletedKeys,
    events,
    errors,
    savedFields,
    dependencies,
  };
}

function pngFile(): File {
  return new File(
    [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    "logo.png",
    { type: "image/png" },
  );
}

async function save(
  harness: ReturnType<typeof createHarness>,
  request: { file?: File | null; logoUrl?: string; removeLogo?: boolean } = {},
) {
  return saveBusinessProfileWithLogo(
    {
      logo: harness.profile.logo,
      logoMimeType: harness.profile.logoMimeType,
    },
    fields,
    {
      file: request.file ?? null,
      logoUrl: request.logoUrl ?? "",
      removeLogo: request.removeLogo ?? false,
    },
    harness.dependencies,
  );
}

it("keeps a UUID logo and MIME type when no logo change is requested", async () => {
  const harness = createHarness(oldLogoKey, "image/png");

  const result = await save(harness);

  assert.equal(result.error, null);
  assert.equal(harness.profile.logo, oldLogoKey);
  assert.equal(harness.profile.logoMimeType, "image/png");
  assert.deepEqual(harness.deletedKeys, []);
  assert.deepEqual(
    harness.events.filter((event) => event.startsWith("revalidate:")),
    [
      "revalidate:/business/profile",
      "revalidate:/business",
      "revalidate:/business/problems",
    ],
  );
});

it("keeps an HTTPS logo and its MIME type when the URL is blank", async () => {
  const logoUrl = "https://cdn.example.com/business.png";
  const harness = createHarness(logoUrl, null);

  await save(harness);

  assert.equal(harness.profile.logo, logoUrl);
  assert.equal(harness.profile.logoMimeType, null);
});

it("updates business fields while retaining the current UUID logo", async () => {
  const harness = createHarness(oldLogoKey, "image/jpeg");

  await save(harness);

  assert.equal(harness.profile.logo, oldLogoKey);
  assert.equal(harness.profile.logoMimeType, "image/jpeg");
  assert.equal(harness.savedFields[0]?.companyName, fields.companyName);
});

it("replaces a current logo with a valid uploaded file and matching MIME type", async () => {
  const harness = createHarness(oldLogoKey, "image/jpeg");

  const result = await save(harness, { file: pngFile() });

  assert.equal(result.error, null);
  assert.equal(harness.profile.logo, newLogoKey);
  assert.equal(harness.profile.logoMimeType, "image/png");
  assert.ok(harness.files.has(newLogoKey));
  assert.deepEqual(harness.deletedKeys, [oldLogoKey]);
});

it("replaces a logo with a new HTTPS URL and clears its file MIME type", async () => {
  const harness = createHarness(oldLogoKey, "image/png");
  harness.files.set(oldLogoKey, new Uint8Array([1]));

  const result = await save(harness, {
    logoUrl: "https://cdn.example.com/new-logo.png",
  });

  assert.equal(result.error, null);
  assert.equal(harness.profile.logo, "https://cdn.example.com/new-logo.png");
  assert.equal(harness.profile.logoMimeType, null);
  assert.deepEqual(harness.deletedKeys, [oldLogoKey]);
});

it("clears both logo fields only when explicit removal is requested", async () => {
  const harness = createHarness(oldLogoKey, "image/png");
  harness.files.set(oldLogoKey, new Uint8Array([1]));

  const result = await save(harness, { removeLogo: true });

  assert.equal(result.error, null);
  assert.equal(harness.profile.logo, null);
  assert.equal(harness.profile.logoMimeType, null);
  assert.deepEqual(harness.deletedKeys, [oldLogoKey]);
});

it("does not interpret an empty URL as a removal request", async () => {
  const harness = createHarness(oldLogoKey, "image/png");

  await save(harness, { logoUrl: "   " });

  assert.equal(harness.profile.logo, oldLogoKey);
  assert.equal(harness.profile.logoMimeType, "image/png");
});

it("returns file validation errors without changing the existing logo", async () => {
  const harness = createHarness(oldLogoKey, "image/png");
  const invalidFile = new File(["not an image"], "logo.png", {
    type: "image/png",
  });

  const result = await save(harness, { file: invalidFile });

  assert.match(result.error ?? "", /không khớp với định dạng/);
  assert.equal(harness.profile.logo, oldLogoKey);
  assert.equal(harness.profile.logoMimeType, "image/png");
  assert.deepEqual(harness.deletedKeys, []);
});

it("returns upload storage failures and keeps the existing logo", async () => {
  const harness = createHarness(oldLogoKey, "image/jpeg", { failSave: true });

  const result = await save(harness, { file: pngFile() });

  assert.equal(result.error, "storage save failed");
  assert.equal(harness.profile.logo, oldLogoKey);
  assert.equal(harness.profile.logoMimeType, "image/jpeg");
  assert.deepEqual(harness.deletedKeys, [newLogoKey]);
});

it("cleans up a new upload when the database update fails", async () => {
  const harness = createHarness(oldLogoKey, "image/jpeg", {
    failPersist: "before",
  });

  const result = await save(harness, { file: pngFile() });

  assert.equal(result.error, "Không thể lưu hồ sơ doanh nghiệp. Vui lòng thử lại.");
  assert.equal(harness.profile.logo, oldLogoKey);
  assert.deepEqual(harness.deletedKeys, [newLogoKey]);
  assert.ok(!harness.deletedKeys.includes(oldLogoKey));
});

it("does not delete the old logo when a removal update fails", async () => {
  const harness = createHarness(oldLogoKey, "image/png", {
    failPersist: "before",
  });
  harness.files.set(oldLogoKey, new Uint8Array([1]));

  const result = await save(harness, { removeLogo: true });

  assert.notEqual(result.error, null);
  assert.equal(harness.profile.logo, oldLogoKey);
  assert.deepEqual(harness.deletedKeys, []);
  assert.ok(harness.files.has(oldLogoKey));
});

it("does not mask the database error when new-file cleanup fails", async () => {
  const harness = createHarness(oldLogoKey, "image/jpeg", {
    failPersist: "before",
    failDelete: true,
  });

  const result = await save(harness, { file: pngFile() });

  assert.equal(result.error, "Không thể lưu hồ sơ doanh nghiệp. Vui lòng thử lại.");
  assert.equal(harness.profile.logo, oldLogoKey);
  assert.equal(harness.errors.length, 2);
});

it("keeps the committed upload when the database reports an error after commit", async () => {
  const harness = createHarness(oldLogoKey, "image/jpeg", {
    failPersist: "after",
  });

  const result = await save(harness, { file: pngFile() });

  assert.equal(result.error, null);
  assert.equal(harness.profile.logo, newLogoKey);
  assert.ok(harness.files.has(newLogoKey));
  assert.ok(!harness.deletedKeys.includes(newLogoKey));
});

it("recognizes a committed URL replacement when the database call errors afterward", async () => {
  const harness = createHarness(oldLogoKey, "image/png", {
    failPersist: "after",
  });
  harness.files.set(oldLogoKey, new Uint8Array([1]));

  const result = await save(harness, {
    logoUrl: "https://cdn.example.com/new-logo.png",
  });

  assert.equal(result.error, null);
  assert.equal(harness.profile.logo, "https://cdn.example.com/new-logo.png");
  assert.deepEqual(harness.deletedKeys, [oldLogoKey]);
});

it("keeps a committed new logo when revalidation fails", async () => {
  const harness = createHarness(null, null, { failRevalidate: true });

  const result = await save(harness, { file: pngFile() });

  assert.equal(result.error, null);
  assert.match(result.success ?? "", /làm mới mọi nội dung/);
  assert.ok(harness.files.has(newLogoKey));
  assert.ok(!harness.deletedKeys.includes(newLogoKey));
  assert.equal(harness.errors.length, 3);
});

it("deletes the replaced internal file only after the database update", async () => {
  const harness = createHarness(oldLogoKey, "image/jpeg");
  harness.files.set(oldLogoKey, new Uint8Array([1]));

  await save(harness, { file: pngFile() });

  assert.ok(
    harness.events.indexOf("persist") <
      harness.events.indexOf(`delete:${oldLogoKey}`),
  );
  assert.deepEqual(harness.deletedKeys, [oldLogoKey]);
});

it("does not delete an internal logo referenced by another profile", async () => {
  const harness = createHarness(oldLogoKey, "image/png", {
    sharedLogoReferences: new Set([oldLogoKey]),
  });
  harness.files.set(oldLogoKey, new Uint8Array([1]));

  await save(harness, { removeLogo: true });

  assert.equal(harness.profile.logo, null);
  assert.deepEqual(harness.deletedKeys, []);
  assert.ok(harness.files.has(oldLogoKey));
});

it("never deletes an external URL when the logo is removed", async () => {
  const externalLogo = "https://cdn.example.com/business.png";
  const harness = createHarness(externalLogo, null);

  await save(harness, { removeLogo: true });

  assert.equal(harness.profile.logo, null);
  assert.deepEqual(harness.deletedKeys, []);
});

it("rejects simultaneous upload and URL replacement without changing the logo", async () => {
  const harness = createHarness(oldLogoKey, "image/jpeg");

  const result = await save(harness, {
    file: pngFile(),
    logoUrl: "https://cdn.example.com/new-logo.png",
  });

  assert.match(result.error ?? "", /không thể dùng cả hai cùng lúc/);
  assert.equal(harness.profile.logo, oldLogoKey);
  assert.equal(harness.profile.logoMimeType, "image/jpeg");
  assert.deepEqual(harness.events, []);
});

it("rejects removal combined with a replacement request", async () => {
  const harness = createHarness(oldLogoKey, "image/jpeg");

  const result = await save(harness, {
    logoUrl: "https://cdn.example.com/new-logo.png",
    removeLogo: true,
  });

  assert.match(result.error ?? "", /chọn xóa logo hoặc thay logo/);
  assert.equal(harness.profile.logo, oldLogoKey);
});

it("retains a newly stored file if the current database state cannot be checked", async () => {
  const harness = createHarness(oldLogoKey, "image/jpeg", {
    failPersist: "before",
    failCurrentLogoRead: true,
  });

  const result = await save(harness, { file: pngFile() });

  assert.equal(result.error, "Không thể lưu hồ sơ doanh nghiệp. Vui lòng thử lại.");
  assert.equal(harness.profile.logo, oldLogoKey);
  assert.ok(harness.files.has(newLogoKey));
  assert.deepEqual(harness.deletedKeys, []);
  assert.equal(harness.errors.length, 2);
});
