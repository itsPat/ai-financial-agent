import dotenv from "dotenv";
dotenv.config();

import * as path from "path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { sql, eq, and, gte, lte } from "drizzle-orm";
import { ChatOpenAI } from "@langchain/openai";
import readline from "readline";
import { transactions } from "./db/schemas/transactions";

const DB_PATH = path.join(__dirname, "db", "finance.db");

const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
});

async function extractDateRange(
  query: string
): Promise<{ startDate: string; endDate: string; category: string | null }> {
  const response = await llm.invoke(
    `Extract the date range from this query: "${query}"
    
    Return a JSON object with these properties:
    - startDate: ISO string or null if not specified
    - endDate: ISO string or null if not specified
    - category: string or null if not specified
    
    For relative terms like "last week", "last month", etc., calculate the actual dates.
    Today's date is ${new Date().toISOString()}.
    
    Return ONLY a valid JSON object with no additional text.`
  );

  const jsonStr = (response.content as string).trim();
  const match = jsonStr.match(/\{[\s\S]*\}/);

  if (!match) {
    throw new Error("Failed to extract date range");
  }

  return JSON.parse(match[0]);
}

function getTransactions(
  startDate: string | null,
  endDate: string | null,
  category: string | null
) {
  try {
    const sqlite = new Database(DB_PATH);
    const db = drizzle(sqlite);

    // Build the where conditions properly using the schema
    let conditions = [];

    // Only include expenses (negative amounts)
    conditions.push(sql`${transactions.amount} < 0`);

    if (startDate) {
      conditions.push(gte(transactions.date, startDate));
    }

    if (endDate) {
      conditions.push(lte(transactions.date, endDate));
    }

    if (category) {
      conditions.push(eq(transactions.category, category));
    }

    const result = db
      .select({ total: sql`SUM(${transactions.amount})` })
      .from(transactions)
      .where(and(...conditions))
      .get();

    console.log("Executing query using Drizzle ORM with schema");

    sqlite.close();

    const totalAmount = result?.total as number | null;
    return {
      total: totalAmount ? Math.abs(totalAmount) / 100 : 0,
    };
  } catch (err) {
    console.error("Database error:", err);
    throw err;
  }
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  setTimeout(() => {
    console.log("================================");
    console.log("🤖 Simple Finance CLI");
    console.log("================================");
    console.log("🤖: Ask me a question like 'How much did I spend last week?'");
    rl.question("> ", async (query) => {
      try {
        console.log("-------------------------------");
        console.log("Processing your question...");
        console.log("-------------------------------");

        // Extract date range and category
        const { startDate, endDate, category } = await extractDateRange(query);

        const dateRangeString =
          startDate && endDate
            ? ` between ${new Date(
                startDate
              ).toLocaleDateString()} and ${new Date(
                endDate
              ).toLocaleDateString()}`
            : startDate
            ? ` since ${new Date(startDate).toLocaleDateString()}`
            : endDate
            ? ` until ${new Date(endDate).toLocaleDateString()}`
            : "";

        console.log("-------------------------------");
        console.log(
          `Analyzing transactions${
            category ? ` in ${category}` : ""
          }${dateRangeString}`
        );
        console.log("-------------------------------");

        const result = getTransactions(startDate, endDate, category);

        console.log(
          `🤖: You spent $${result.total.toFixed(2)}${
            category ? ` on ${category}` : ""
          }${dateRangeString}.`
        );
      } catch (error) {
        console.error("Error:", error);
      } finally {
        console.log("================================");
        rl.close();
      }
    });
  }, 0);
}

// Run the application
main().catch(console.error);
