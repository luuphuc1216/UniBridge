import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ errors: string[]; warnings: string[] }}
 */
export function validateProductionEnvironment(env) {
  const errors = [];
  const warnings = [];
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl?.startsWith("file:/")) {
    errors.push("DATABASE_URL");
  } else {
    try {
      if (!isAbsolute(fileURLToPath(databaseUrl))) {
        errors.push("DATABASE_URL");
      }
    } catch {
      errors.push("DATABASE_URL");
    }
  }

  if (
    !env.AUTH_SECRET ||
    env.AUTH_SECRET.length < 32 ||
    env.AUTH_SECRET === "replace-with-a-long-random-value"
  ) {
    errors.push("AUTH_SECRET");
  }

  try {
    if (new URL(env.AUTH_URL ?? "").protocol !== "https:") {
      errors.push("AUTH_URL");
    }
  } catch {
    errors.push("AUTH_URL");
  }

  if (env.AUTH_TRUST_HOST !== "true") {
    errors.push("AUTH_TRUST_HOST");
  }

  const emailProvider = env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (!emailProvider || !["console", "resend"].includes(emailProvider)) {
    errors.push("EMAIL_PROVIDER");
  } else if (emailProvider === "console") {
    warnings.push("EMAIL_PROVIDER");
  } else {
    if (!env.RESEND_API_KEY) errors.push("RESEND_API_KEY");
    if (!env.EMAIL_FROM) errors.push("EMAIL_FROM");
  }

  if (env.SEED_USER_PASSWORD !== undefined) {
    errors.push("SEED_USER_PASSWORD");
  }

  if (env.TRUST_PROXY === "true") {
    warnings.push("TRUST_PROXY");
  }

  return { errors, warnings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const { errors, warnings } = validateProductionEnvironment(process.env);
  if (warnings.length > 0) {
    console.warn(`Production environment warnings: ${warnings.join(", ")}`);
  }
  if (errors.length > 0) {
    console.error(`Invalid production environment variables: ${errors.join(", ")}`);
    process.exitCode = 1;
  }
}
