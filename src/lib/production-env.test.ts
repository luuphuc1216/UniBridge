import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateProductionEnvironment } from "../../scripts/validate-production-env.mjs";

const validEnvironment = {
  DATABASE_URL: "file:/srv/unibridge/data/unibridge.sqlite",
  AUTH_SECRET: "a-production-secret-that-is-at-least-32-characters",
  AUTH_URL: "https://unibridge.id.vn",
  AUTH_TRUST_HOST: "true",
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "test-key",
  EMAIL_FROM: "UniBridge <no-reply@unibridge.id.vn>",
  UPLOADS_DIR: "/srv/unibridge/uploads",
};

describe("production environment validation", () => {
  it("accepts a complete production environment", () => {
    assert.deepEqual(validateProductionEnvironment(validEnvironment), {
      errors: [],
      warnings: [],
    });
  });

  it("requires each production variable", () => {
    for (const name of [
      "DATABASE_URL",
      "AUTH_SECRET",
      "AUTH_URL",
      "AUTH_TRUST_HOST",
      "EMAIL_PROVIDER",
      "UPLOADS_DIR",
    ] as const) {
      const environment = { ...validEnvironment };
      delete environment[name];
      assert.ok(validateProductionEnvironment(environment).errors.includes(name));
    }
  });

  it("accepts private S3-compatible storage on Vercel without a filesystem directory", () => {
    const result = validateProductionEnvironment({
      ...validEnvironment,
      VERCEL: "1",
      STORAGE_PROVIDER: "r2",
      STORAGE_BUCKET: "unibridge",
      STORAGE_REGION: "auto",
      STORAGE_ENDPOINT: "https://account-id.r2.cloudflarestorage.com",
      STORAGE_ACCESS_KEY_ID: "test-access-key",
      STORAGE_SECRET_ACCESS_KEY: "test-secret-key",
      UPLOADS_DIR: undefined,
    });
    assert.deepEqual(result, { errors: [], warnings: [] });
  });

  it("accepts Supabase S3 settings with an explicitly configured project region", () => {
    const result = validateProductionEnvironment({
      ...validEnvironment,
      VERCEL: "1",
      STORAGE_PROVIDER: "s3",
      STORAGE_BUCKET: "unibridge-storage",
      STORAGE_REGION: "ap-southeast-1",
      STORAGE_ENDPOINT: "https://project-ref.storage.supabase.co/storage/v1/s3",
      STORAGE_ACCESS_KEY_ID: "test-access-key",
      STORAGE_SECRET_ACCESS_KEY: "test-secret-key",
      UPLOADS_DIR: undefined,
    });
    assert.deepEqual(result, { errors: [], warnings: [] });
  });

  it("rejects a blank Supabase S3 region", () => {
    const result = validateProductionEnvironment({
      ...validEnvironment,
      VERCEL: "1",
      STORAGE_PROVIDER: "s3",
      STORAGE_BUCKET: "unibridge-storage",
      STORAGE_REGION: "   ",
      STORAGE_ENDPOINT: "https://project-ref.storage.supabase.co/storage/v1/s3",
      STORAGE_ACCESS_KEY_ID: "test-access-key",
      STORAGE_SECRET_ACCESS_KEY: "test-secret-key",
      UPLOADS_DIR: undefined,
    });
    assert.ok(result.errors.includes("STORAGE_REGION"));
  });

  it("rejects filesystem uploads on Vercel and requires all cloud credentials", () => {
    assert.ok(
      validateProductionEnvironment({
        ...validEnvironment,
        VERCEL: "1",
      }).errors.includes("STORAGE_PROVIDER"),
    );
    const result = validateProductionEnvironment({
      ...validEnvironment,
      VERCEL: "1",
      STORAGE_PROVIDER: "r2",
      STORAGE_BUCKET: "unibridge",
      STORAGE_REGION: "auto",
      STORAGE_ENDPOINT: "https://account-id.r2.cloudflarestorage.com",
    });
    assert.ok(result.errors.includes("STORAGE_ACCESS_KEY_ID"));
    assert.ok(result.errors.includes("STORAGE_SECRET_ACCESS_KEY"));
    assert.ok(!result.errors.includes("UPLOADS_DIR"));
  });

  it("rejects relative and non-file database URLs", () => {
    for (const DATABASE_URL of ["file:./dev.db", "postgresql://localhost/app"]) {
      assert.ok(
        validateProductionEnvironment({ ...validEnvironment, DATABASE_URL }).errors.includes(
          "DATABASE_URL",
        ),
      );
    }
  });

  it("rejects a relative uploads directory", () => {
    assert.ok(
      validateProductionEnvironment({
        ...validEnvironment,
        UPLOADS_DIR: "uploads",
      }).errors.includes("UPLOADS_DIR"),
    );
  });

  it("rejects a short or sample authentication secret", () => {
    for (const AUTH_SECRET of ["short", "replace-with-a-long-random-value"]) {
      assert.ok(
        validateProductionEnvironment({ ...validEnvironment, AUTH_SECRET }).errors.includes(
          "AUTH_SECRET",
        ),
      );
    }
  });

  it("requires HTTPS and trusted-host configuration", () => {
    assert.ok(
      validateProductionEnvironment({
        ...validEnvironment,
        AUTH_URL: "http://unibridge.id.vn",
      }).errors.includes("AUTH_URL"),
    );
    assert.ok(
      validateProductionEnvironment({
        ...validEnvironment,
        AUTH_TRUST_HOST: "false",
      }).errors.includes("AUTH_TRUST_HOST"),
    );
  });

  it("requires both Resend settings", () => {
    for (const name of ["RESEND_API_KEY", "EMAIL_FROM"] as const) {
      const environment = { ...validEnvironment };
      delete environment[name];
      assert.ok(validateProductionEnvironment(environment).errors.includes(name));
    }
  });

  it("rejects the demo seed password and warns for console mail and trusted proxies", () => {
    const result = validateProductionEnvironment({
      ...validEnvironment,
      EMAIL_PROVIDER: "console",
      TRUST_PROXY: "true",
      SEED_USER_PASSWORD: "",
    });
    assert.deepEqual(result.errors, ["SEED_USER_PASSWORD"]);
    assert.deepEqual(result.warnings, ["EMAIL_PROVIDER", "TRUST_PROXY"]);
  });
});
