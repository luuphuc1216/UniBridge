import Database from "better-sqlite3";

const db = new Database("prisma/dev.db", { readonly: true });

const fields = [
  ["AiReview", "checklist"],
  ["Application", "profileSnapshot"],
  ["Application", "approachLinks"],
];

for (const [table, column] of fields) {
  console.log(`\n=== ${table}.${column} ===`);

  const rows = db.prepare(
    `SELECT rowid AS _rowid, "${column}" AS value
     FROM "${table}"
     WHERE "${column}" IS NOT NULL`
  ).all() as Array<{ _rowid: number; value: string }>;

  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.value);

      if (typeof parsed === "string") {
        try {
          JSON.parse(parsed);
          console.log(`DÒNG ${row._rowid}: JSON bị mã hóa hai lần`);
        } catch {
          console.log(`DÒNG ${row._rowid}: JSON bên trong không hợp lệ`);
          console.log("Giá trị:", parsed.slice(0, 300));
        }
      }
    } catch {
      console.log(`DÒNG ${row._rowid}: JSON không hợp lệ`);
      console.log("Giá trị:", row.value.slice(0, 300));
    }
  }
}

db.close();
console.log("\nĐã kiểm tra xong.");
