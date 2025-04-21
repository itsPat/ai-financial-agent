import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { z } from "zod";

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  amount: integer("amount").notNull(),
  category: text("category").notNull(),
  merchant: text("merchant").notNull(),
  account: text("account").notNull(),
});

export const transactionSchema = z.object({
  id: z.number().int().positive().optional(),
  date: z.string().describe("Date of transaction in ISO format"),
  amount: z
    .number()
    .int()
    .describe(
      "The amount in CENTS. NEGATIVE for expenses, POSITIVE for income"
    ),
  category: z.string(),
  merchant: z.string(),
  account: z.string(),
});
