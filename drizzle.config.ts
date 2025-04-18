import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schemas/transactions.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "./src/db/finance.db",
  },
  verbose: true,
  strict: true,
} satisfies Config;
