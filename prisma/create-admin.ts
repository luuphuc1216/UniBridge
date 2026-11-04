import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  AdminBootstrapError,
  createInitialAdmin,
} from "../src/lib/admin-bootstrap";

function readHiddenPassword(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    return Promise.reject(new AdminBootstrapError("Cần TTY để nhập mật khẩu ẩn."));
  }

  return new Promise((resolve, reject) => {
    let password = "";
    let settled = false;
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.setEncoding("utf8");
    process.stdin.resume();

    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.off("error", onError);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(password);
    };

    const onError = () => finish(new AdminBootstrapError("Không thể đọc mật khẩu."));
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u0003" || character === "\u0004") {
          finish(new AdminBootstrapError("Đã hủy thao tác."));
          return;
        }
        if (character === "\u007f" || character === "\b") {
          password = Array.from(password).slice(0, -1).join("");
        } else if (character >= " ") {
          password += character;
        }
      }
    };

    process.stdin.on("data", onData);
    process.stdin.once("error", onError);
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const email = process.env.ADMIN_EMAIL;
  const name = process.env.ADMIN_NAME;
  if (!databaseUrl) throw new AdminBootstrapError("Thiếu DATABASE_URL.");
  if (!email) throw new AdminBootstrapError("Thiếu ADMIN_EMAIL.");
  if (!name) throw new AdminBootstrapError("Thiếu ADMIN_NAME.");

  let password: string;
  if (process.stdin.isTTY) {
    const firstPassword = await readHiddenPassword("Mật khẩu Admin: ");
    const repeatedPassword = await readHiddenPassword("Nhập lại mật khẩu: ");
    if (firstPassword !== repeatedPassword) {
      throw new AdminBootstrapError("Hai mật khẩu không khớp.");
    }
    password = firstPassword;
  } else {
    password = process.env.ADMIN_PASSWORD ?? "";
    if (!password) {
      throw new AdminBootstrapError("Cần ADMIN_PASSWORD khi chạy không có TTY.");
    }
  }

  const database = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: databaseUrl }),
  });
  try {
    const admin = await createInitialAdmin(database, { email, name, password });
    console.log(`Đã tạo Admin: ${admin.email}`);
  } finally {
    await database.$disconnect();
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof AdminBootstrapError
        ? error.message
        : "Không thể tạo tài khoản Admin.",
    );
    process.exitCode = 1;
  });
}
