import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

async function main() {
  const connectionString = process.env.DIRECT_URL;

  if (!connectionString) {
    throw new Error("Thiếu DIRECT_URL trong file .env");
  }

  const sql = await readFile(
    "prisma/migrations-postgres/0_init/migration.sql",
    "utf8"
  );

  const client = new Client({ connectionString });

  await client.connect();

  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    await client.query(sql);

    await client.query("ROLLBACK");
    transactionStarted = false;

    console.log("KIỂM TRA THÀNH CÔNG!");
    console.log("Toàn bộ migration đã chạy thử trên PostgreSQL.");
    console.log("Đã ROLLBACK: không lưu lại bảng hoặc dữ liệu.");
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    console.error("KIỂM TRA MIGRATION THẤT BẠI:");
    console.error(error);

    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
