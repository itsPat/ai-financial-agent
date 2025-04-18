import { SQLiteTableWithColumns, TableConfig } from "drizzle-orm/sqlite-core";

export function schemaToString<T extends TableConfig>(
  table: SQLiteTableWithColumns<T>
): string {
  const tableName = table.name;

  const columns = Object.entries(table._.columns || {}).map(
    ([columnName, columnDef]: [string, any]) => {
      const type = columnDef.dataType?.toString() || "unknown";
      const constraints = [];

      if (columnDef.primaryKey) {
        constraints.push("PRIMARY KEY");
        if (columnDef.primaryKey.autoIncrement) {
          constraints.push("AUTO INCREMENT");
        }
      }

      if (columnDef.notNull) {
        constraints.push("NOT NULL");
      }

      return `  - ${columnName} (${type})${
        constraints.length > 0 ? " " + constraints.join(", ") : ""
      }`;
    }
  );

  // Build the description string
  return `Table: ${tableName}
  Columns:
  ${columns.join("\n")}`;
}
