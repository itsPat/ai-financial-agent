import { tool } from "@langchain/core/tools";
import Database from "better-sqlite3";
import path from "path";
import { z } from "zod";
import { transactionSchema } from "../db/schemas/transactions";
import zodToJsonSchema from "zod-to-json-schema";

const DB_PATH = path.resolve(process.cwd(), "src/db/finance.db");

const isSafeQuery = (query: string): boolean =>
  query.toUpperCase().trim().startsWith("SELECT") &&
  !["DELETE", "UPDATE", "INSERT", "DROP", "ALTER", "CREATE"].some((kw) =>
    query.toUpperCase().includes(`${kw}`)
  );

const throwIfUnsafeQuery = (query: string) => {
  if (!isSafeQuery(query)) throw new Error(`Unsafe query detected: ${query}`);
};

export default {
  query: {
    transactions: tool(
      async ({ query, parameters = [] }) => {
        console.log(`|  📀 DB QUERY: ${query} with params:`, parameters);
        throwIfUnsafeQuery(query);
        if (!query.toUpperCase().includes("FROM TRANSACTIONS")) {
          throw new Error(`Query must target the transactions table`);
        }
        const sqlite = new Database(DB_PATH);
        try {
          const result = sqlite.prepare(query).all(parameters);
          return JSON.stringify(result);
        } catch (err) {
          throw new Error(
            `Failed to execute query: ${query}, error: ${(err as any).message}`
          );
        } finally {
          sqlite.close();
        }
      },
      {
        name: "query_db_transactions",
        description: `Execute a SQLite query to retrieve data from the transactions table. <table_schema>${JSON.stringify(
          zodToJsonSchema(transactionSchema)
        )}</table_schema>`,
        schema: z.object({
          query: z
            .string()
            .describe(
              "SQL query to execute (must be a SELECT query). Use ? placeholders for any variables that should be parameterized."
            ),
          parameters: z
            .array(z.union([z.string(), z.number(), z.null()]))
            .optional()
            .describe(
              "Array of parameter values that will replace ? placeholders in the query in the same order."
            ),
        }),
      }
    ),
  },
};
