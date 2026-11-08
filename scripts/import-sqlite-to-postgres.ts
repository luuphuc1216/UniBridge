import "dotenv/config";
import Database from "better-sqlite3";
import { Client } from "pg";

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function main() {
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) throw new Error("Thiếu DIRECT_URL trong .env");

  const sqlite = new Database("prisma/dev.db", {
    readonly: true,
    fileMustExist: true,
  });

  const pg = new Client({ connectionString });

  try {
    await pg.connect();

    // Lấy danh sách bảng từ SQLite và PostgreSQL.
    const sourceTables = (
      sqlite.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
          AND name != '_prisma_migrations'
        ORDER BY name
      `).all() as Array<{ name: string }>
    ).map(x => x.name);

    const targetResult = await pg.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name != '_prisma_migrations'
      ORDER BY table_name
    `);

    const targetTables = targetResult.rows.map(x => x.table_name);

    const missing = sourceTables.filter(x => !targetTables.includes(x));
    const extra = targetTables.filter(x => !sourceTables.includes(x));

    if (missing.length || extra.length) {
      throw new Error(
        `Danh sách bảng không khớp.\nThiếu ở PostgreSQL: ${missing.join(", ")}\nBảng dư: ${extra.join(", ")}`
      );
    }

    // Không cho phép nhập nếu PostgreSQL đã có dữ liệu.
    for (const table of targetTables) {
      const result = await pg.query(
        `SELECT COUNT(*)::int AS count FROM ${quote(table)}`
      );

      if (result.rows[0].count !== 0) {
        throw new Error(
          `Bảng ${table} đã có ${result.rows[0].count} bản ghi. Dừng để tránh ghi trùng.`
        );
      }
    }

    // Lấy quan hệ khóa ngoại: bảng cha phải được nhập trước bảng con.
    const fkResult = await pg.query(`
      SELECT child.relname AS child_table,
             parent.relname AS parent_table
      FROM pg_constraint c
      JOIN pg_class child ON child.oid = c.conrelid
      JOIN pg_class parent ON parent.oid = c.confrelid
      JOIN pg_namespace n ON n.oid = child.relnamespace
      WHERE c.contype = 'f'
        AND n.nspname = 'public'
    `);

    const dependencies = new Map<string, Set<string>>();
    const indegree = new Map<string, number>();

    for (const table of targetTables) {
      dependencies.set(table, new Set());
      indegree.set(table, 0);
    }

    for (const fk of fkResult.rows) {
      const child = fk.child_table;
      const parent = fk.parent_table;

      if (child === parent) continue;

      if (!dependencies.get(parent)!.has(child)) {
        dependencies.get(parent)!.add(child);
        indegree.set(child, indegree.get(child)! + 1);
      }
    }

    const queue = targetTables.filter(t => indegree.get(t) === 0);
    const order: string[] = [];

    while (queue.length) {
      const table = queue.shift()!;
      order.push(table);

      for (const child of dependencies.get(table)!) {
        indegree.set(child, indegree.get(child)! - 1);
        if (indegree.get(child) === 0) queue.push(child);
      }
    }

    if (order.length !== targetTables.length) {
      throw new Error(
        "Phát hiện quan hệ khóa ngoại vòng giữa các bảng. Dừng trước khi nhập dữ liệu."
      );
    }

    console.log(`Đã đối chiếu ${sourceTables.length} bảng.`);
    console.log("Thứ tự nhập dữ liệu theo khóa ngoại đã được xác định.");

    // Lấy kiểu dữ liệu PostgreSQL.
    const columnsResult = await pg.query(`
      SELECT table_name, column_name, data_type, ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);

    const columnMap = new Map<string, Array<{
      column_name: string;
      data_type: string;
    }>>();

    for (const col of columnsResult.rows) {
      if (!columnMap.has(col.table_name)) {
        columnMap.set(col.table_name, []);
      }
      columnMap.get(col.table_name)!.push(col);
    }

    // Kiểm tra cột trước khi bắt đầu transaction.
    for (const table of order) {
      const sourceColumns = (
        sqlite.prepare(`PRAGMA table_info(${quote(table)})`).all() as
          Array<{ name: string }>
      ).map(x => x.name);

      const targetColumns = columnMap.get(table) ?? [];
      const missingColumns = targetColumns
        .filter(c => !sourceColumns.includes(c.column_name));

      if (missingColumns.length) {
        throw new Error(
          `Bảng ${table} thiếu cột trong SQLite: ${missingColumns.map(c => c.column_name).join(", ")}`
        );
      }
    }

    await pg.query("BEGIN");

    const counts: Array<{ table: string; count: number }> = [];

    for (const table of order) {
      const columns = columnMap.get(table)!;
      const sourceColumns = (
        sqlite.prepare(`PRAGMA table_info(${quote(table)})`).all() as
          Array<{ name: string }>
      ).map(x => x.name);

      const rows = sqlite.prepare(
        `SELECT * FROM ${quote(table)}`
      ).all() as Array<Record<string, unknown>>;

      if (rows.length) {
        const names = columns.map(c => c.column_name);
        const insertSql = `
          INSERT INTO ${quote(table)}
          (${names.map(quote).join(", ")})
          VALUES (${names.map((_, i) => `$${i + 1}`).join(", ")})
        `;

        for (const row of rows) {
          const values = columns.map(col => {
            let value = row[col.column_name];

            if (value === undefined) {
              throw new Error(
                `Thiếu giá trị cột ${table}.${col.column_name}`
              );
            }

            if (value !== null && col.data_type === "jsonb") {
              const parsed = typeof value === "string" ? JSON.parse(value) : value;
              value = JSON.stringify(parsed);
            }

            if (value !== null && col.data_type === "boolean") {
              value = Boolean(value);
            }

            if (
              value !== null &&
              (col.data_type === "timestamp without time zone" ||
               col.data_type === "timestamp with time zone") &&
              typeof value === "number"
            ) {
              value = new Date(value);
            }

            return value;
          });

          await pg.query(insertSql, values);
        }
      }

      counts.push({ table, count: rows.length });
      console.log(`${table}: ${rows.length} bản ghi`);
    }

    await pg.query("COMMIT");

    console.log("\nNHẬP DỮ LIỆU THÀNH CÔNG!");
    console.log(
      "Tổng số bản ghi:",
      counts.reduce((sum, x) => sum + x.count, 0)
    );
  } catch (error) {
    try {
      await pg.query("ROLLBACK");
    } catch {}

    console.error("\nNHẬP DỮ LIỆU THẤT BẠI:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    sqlite.close();
    await pg.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
