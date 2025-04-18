import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  amount: integer("amount").notNull(),
  category: text("category").notNull(),
  merchant: text("merchant").notNull(),
  account: text("account").notNull(),
});
