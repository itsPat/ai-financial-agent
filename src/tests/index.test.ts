import fs from "fs";
import path from "path";
import Database, { type Database as DB } from "better-sqlite3";
import { relativeDates } from "./utils/dates";
import { toFormattedDollarString } from "./utils/number";
import { compareResults, getWorkflowResult } from "./utils/ai";

const DB_PATH = path.resolve(process.cwd(), "src/db/finance.db");
const LOGS_PATH = path.resolve(process.cwd(), "src/tests/logs");

if (!fs.existsSync(LOGS_PATH)) {
  fs.mkdirSync(LOGS_PATH, { recursive: true });
}

const logFile = path.join(
  LOGS_PATH,
  `test-${new Date().toISOString().replace(/:/g, "-")}.log`
);
const logStream = fs.createWriteStream(logFile, { flags: "a" });

function log(message: string) {
  console.log(message);
  logStream.write(message + "\n");
}

let db: DB;
const testResults: Record<string, { manual: string; workflow: string }> = {};

beforeAll(async () => {
  db = new Database(DB_PATH);
  log("Connected to database");
}, 10_000);

afterAll(async () => {
  if (db) db.close();
  logStream.end();
  console.table(testResults);
}, 10_000);

const tests: Array<{
  prompt: string;
  manualFn: () => Promise<{ query: string; params: any[]; message: string }>;
}> = [
  {
    prompt: "How much did I spend last week?",
    manualFn: async () => {
      const [start, end] = relativeDates.lastWeek();
      const query = `
        SELECT SUM(ABS(amount)) AS total
        FROM transactions
        WHERE date >= ? AND date <= ? AND amount < 0
      `;
      const params = [start, end];
      const result = db.prepare(query).get(params) as any;
      const dollars = toFormattedDollarString(result?.total ?? 0);
      return { query, params, message: `You spent ${dollars} last week.` };
    },
  },
  {
    prompt: "How much did I spend last month?",
    manualFn: async () => {
      const [start, end] = relativeDates.lastMonth();
      const query = `
        SELECT SUM(ABS(amount)) AS total
        FROM transactions
        WHERE date >= ? AND date <= ? AND amount < 0
      `;
      const params = [start, end];
      const result = db.prepare(query).get(params) as any;
      const dollars = toFormattedDollarString(result?.total ?? 0);
      return { query, params, message: `You spent ${dollars} last month.` };
    },
  },
  {
    prompt: "What was my biggest expense last month?",
    manualFn: async () => {
      const [start, end] = relativeDates.lastMonth();
      const query = `
        SELECT amount, merchant, date, category
        FROM transactions
        WHERE date >= ? AND date <= ? AND amount < 0
        ORDER BY ABS(amount) DESC
        LIMIT 1
      `;
      const params = [start, end];
      const result = db.prepare(query).get(params) as any;
      if (!result) {
        return {
          query,
          params,
          message: "You didn't have any expenses last month.",
        };
      }
      const dollars = toFormattedDollarString(Math.abs(result.amount));
      return {
        query,
        params,
        message: `Your biggest expense last month was ${dollars} at ${
          result.merchant
        } in the ${result.category} category on ${new Date(
          result.date
        ).toLocaleDateString()}.`,
      };
    },
  },
  {
    prompt: "What are my top 3 spending categories this month?",
    manualFn: async () => {
      const [start, end] = [
        new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          .toISOString()
          .split("T")[0],
        new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
          .toISOString()
          .split("T")[0],
      ];
      const query = `
        SELECT category, SUM(ABS(amount)) AS total
        FROM transactions
        WHERE date >= ? AND date <= ? AND amount < 0
        GROUP BY category
        ORDER BY total DESC
        LIMIT 3
      `;
      const params = [start, end];
      const results = db.prepare(query).all(params);
      if (results.length === 0) {
        return {
          query,
          params,
          message: "You don't have any expenses this month yet.",
        };
      }
      const categoriesList = results
        .map((r: any) => `${r.category} (${toFormattedDollarString(r.total)})`)
        .join(", ");
      return {
        query,
        params,
        message: `Your top spending categories this month are: ${categoriesList}.`,
      };
    },
  },
  {
    prompt: "What's my average monthly spend for Q1?",
    manualFn: async () => {
      const [start, end] = relativeDates.q1();
      const query = `
        SELECT AVG(monthly_total) as average_monthly
        FROM (
          SELECT strftime('%Y-%m', date) as month, SUM(ABS(amount)) as monthly_total
          FROM transactions
          WHERE date >= ? AND date <= ? AND amount < 0
          GROUP BY month
        )
      `;
      const params = [start, end];
      const result = db.prepare(query).get(params) as any;
      const dollars = toFormattedDollarString(result?.average_monthly ?? 0);
      return {
        query,
        params,
        message: `Your average monthly spending in Q1 was ${dollars}.`,
      };
    },
  },
  {
    prompt: "Compare last month's spend to the month before that",
    manualFn: async () => {
      const [prevStart, prevEnd] = relativeDates.monthBeforeLastMonth();
      const [lastStart, lastEnd] = relativeDates.lastMonth();
      const query = `
        SELECT
          SUM(CASE WHEN date >= ? AND date <= ? THEN ABS(amount) ELSE 0 END) AS prev_month,
          SUM(CASE WHEN date >= ? AND date <= ? THEN ABS(amount) ELSE 0 END) AS last_month
        FROM transactions
        WHERE amount < 0
      `;
      const params = [prevStart, prevEnd, lastStart, lastEnd];
      const result = db.prepare(query).get(params) as any;
      const prevTotal = result?.prev_month ?? 0;
      const lastTotal = result?.last_month ?? 0;
      const prevDollars = toFormattedDollarString(prevTotal);
      const lastDollars = toFormattedDollarString(lastTotal);
      const difference = Math.abs(lastTotal - prevTotal);
      const percentChange =
        prevTotal === 0 ? null : (difference / prevTotal) * 100;
      let comparison =
        lastTotal > prevTotal
          ? percentChange
            ? `which is ${toFormattedDollarString(
                difference
              )} more (${percentChange.toFixed(1)}% increase)`
            : `which is more than the previous month`
          : lastTotal < prevTotal
          ? percentChange
            ? `which is ${toFormattedDollarString(
                difference
              )} less (${percentChange.toFixed(1)}% decrease)`
            : `which is less than the previous month`
          : `which is the same as the previous month`;
      return {
        query,
        params,
        message: `You spent ${lastDollars} last month, ${comparison} compared to ${prevDollars} the month before.`,
      };
    },
  },
];

describe("Financial Agent Tests", () => {
  tests.forEach(({ prompt, manualFn }) => {
    test(
      prompt,
      async () => {
        const workflowResult = await getWorkflowResult(prompt);
        log("WORKFLOW RESULT:\n");
        log(JSON.stringify(workflowResult ?? {}, null, 2));

        const manualResult = await manualFn();
        log("MANUAL RESULT:\n");
        log(JSON.stringify(manualResult ?? {}, null, 2));

        const { verdict } = await compareResults(
          manualResult.message,
          workflowResult?.result?.message
        );

        testResults[prompt] = {
          manual: manualResult.message,
          workflow: workflowResult?.result?.message ?? "No result",
        };

        expect(verdict).toBe("pass");
      },
      30_000
    );
  });
});
