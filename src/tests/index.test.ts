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
const testResults: Array<{
  query: string;
  manualResult: string;
  workflowResult: string;
}> = [];

beforeAll(async () => {
  db = new Database(DB_PATH);
  log(`Connected to database`);
}, 10_000);

afterAll(async () => {
  if (db) db.close();
  logStream.end();
  console.table(testResults);
}, 10_000);

describe("Financial Agent Tests", () => {
  test("How much did I spend last week?", async () => {
    const workflowResult = await getWorkflowResult(
      "How much did I spend last week?"
    );
    log("WORKFLOW RESULT:\n");
    log(JSON.stringify(workflowResult ?? {}, null, 2));

    const manualResult: { query: string; params: any[]; message: string } =
      await new Promise((res) => {
        const [start, end] = relativeDates.lastWeek();
        const query = `
          SELECT SUM(ABS(amount)) AS total
          FROM transactions
          WHERE date >= ? AND date <= ? AND amount < 0
        `;
        const params = [start, end];

        const result = db.prepare(query).get(params) as {
          total: number | null;
        };

        const dollars = toFormattedDollarString(result.total ?? 0);
        res({
          query: query,
          params: params,
          message: `You spent ${dollars} last week.`,
        });
      });
    log("MANUAL RESULT:\n");
    log(JSON.stringify(manualResult ?? {}, null, 2));

    const { verdict } = await compareResults(
      manualResult.message,
      workflowResult?.result?.message
    );

    testResults.push({
      query: "How much did I spend last week?",
      manualResult: manualResult.message,
      workflowResult: workflowResult?.result?.message ?? "No result",
    });

    expect(verdict).toBe("pass");
  }, 30_000);

  test("How much did I spend last month?", async () => {
    const workflowResult = await getWorkflowResult(
      "How much did I spend last month?"
    );
    log("WORKFLOW RESULT:\n");
    log(JSON.stringify(workflowResult ?? {}, null, 2));

    const manualResult: { query: string; params: any[]; message: string } =
      await new Promise((res) => {
        const [start, end] = relativeDates.lastMonth();
        const query = `
          SELECT SUM(ABS(amount)) AS total
          FROM transactions
          WHERE date >= ? AND date <= ? AND amount < 0
        `;
        const params = [start, end];

        const result = db.prepare(query).get(params) as {
          total: number | null;
        };

        const dollars = toFormattedDollarString(result.total ?? 0);
        res({
          query: query,
          params: params,
          message: `You spent ${dollars} last week.`,
        });
      });
    log("MANUAL RESULT:\n");
    log(JSON.stringify(manualResult ?? {}, null, 2));

    const { verdict } = await compareResults(
      manualResult.message,
      workflowResult?.result?.message
    );

    testResults.push({
      query: "How much did I spend last month?",
      manualResult: manualResult.message,
      workflowResult: workflowResult?.result?.message ?? "No result",
    });

    expect(verdict).toBe("pass");
  }, 30_000);

  test("What was my biggest expense last month?", async () => {
    const workflowResult = await getWorkflowResult(
      "What was my biggest expense last month?"
    );
    log("WORKFLOW RESULT:\n");
    log(JSON.stringify(workflowResult ?? {}, null, 2));

    const manualResult: { query: string; params: any[]; message: string } =
      await new Promise((res) => {
        const [start, end] = relativeDates.lastMonth();
        const query = `
          SELECT amount, merchant, date, category
          FROM transactions
          WHERE date >= ? AND date <= ? AND amount < 0
          ORDER BY ABS(amount) DESC
          LIMIT 1
        `;
        const params = [start, end];

        const result = db.prepare(query).get(params) as {
          amount: number;
          merchant: string;
          date: string;
          category: string;
        };

        if (!result) {
          res({
            query: query,
            params: params,
            message: "You didn't have any expenses last month.",
          });
          return;
        }

        const dollars = toFormattedDollarString(Math.abs(result.amount));
        res({
          query: query,
          params: params,
          message: `Your biggest expense last month was ${dollars} at ${
            result.merchant
          } in the ${result.category} category on ${new Date(
            result.date
          ).toLocaleDateString()}.`,
        });
      });
    log("MANUAL RESULT:\n");
    log(JSON.stringify(manualResult ?? {}, null, 2));

    const { verdict } = await compareResults(
      manualResult.message,
      workflowResult?.result?.message
    );

    testResults.push({
      query: "What was my biggest expense last month?",
      manualResult: manualResult.message,
      workflowResult: workflowResult?.result?.message ?? "No result",
    });

    expect(verdict).toBe("pass");
  }, 30_000);

  test("What are my top 3 spending categories this month?", async () => {
    const workflowResult = await getWorkflowResult(
      "What are my top 3 spending categories this month?"
    );
    log("WORKFLOW RESULT:\n");
    log(JSON.stringify(workflowResult ?? {}, null, 2));

    const manualResult: { query: string; params: any[]; message: string } =
      await new Promise((res) => {
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

        const results = db.prepare(query).all(params) as Array<{
          category: string;
          total: number;
        }>;

        if (results.length === 0) {
          res({
            query: query,
            params: params,
            message: "You don't have any expenses this month yet.",
          });
          return;
        }

        let categoriesList = results
          .map((r) => `${r.category} (${toFormattedDollarString(r.total)})`)
          .join(", ");

        res({
          query: query,
          params: params,
          message: `Your top spending categories this month are: ${categoriesList}.`,
        });
      });
    log("MANUAL RESULT:\n");
    log(JSON.stringify(manualResult ?? {}, null, 2));

    const { verdict } = await compareResults(
      manualResult.message,
      workflowResult?.result?.message
    );

    testResults.push({
      query: "What are my top 3 spending categories this month?",
      manualResult: manualResult.message,
      workflowResult: workflowResult?.result?.message ?? "No result",
    });

    expect(verdict).toBe("pass");
  }, 30_000);

  test("What's my average monthly spend for Q1?", async () => {
    const workflowResult = await getWorkflowResult(
      "What's my average monthly spend for Q1?"
    );
    log("WORKFLOW RESULT:\n");
    log(JSON.stringify(workflowResult ?? {}, null, 2));

    const manualResult: { query: string; params: any[]; message: string } =
      await new Promise((res) => {
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

        const result = db.prepare(query).get(params) as {
          average_monthly: number | null;
        };

        const dollars = toFormattedDollarString(result.average_monthly ?? 0);

        res({
          query: query,
          params: params,
          message: `Your average monthly spending in Q1 was ${dollars}.`,
        });
      });
    log("MANUAL RESULT:\n");
    log(JSON.stringify(manualResult ?? {}, null, 2));

    const { verdict } = await compareResults(
      manualResult.message,
      workflowResult?.result?.message
    );

    testResults.push({
      query: "What's my average monthly spend for Q1?",
      manualResult: manualResult.message,
      workflowResult: workflowResult?.result?.message ?? "No result",
    });

    expect(verdict).toBe("pass");
  }, 30_000);

  test("Compare last month's spend to the month before that", async () => {
    const workflowResult = await getWorkflowResult(
      "Compare last month's spend to the month before that"
    );
    log("WORKFLOW RESULT:\n");
    log(JSON.stringify(workflowResult ?? {}, null, 2));

    const manualResult: { query: string; params: any[]; message: string } =
      await new Promise((res) => {
        const [monthBeforeLastMonthStart, monthBeforeLastMonthEnd] =
          relativeDates.monthBeforeLastMonth();
        const [lastMonthStart, lastMonthEnd] = relativeDates.lastMonth();

        const query = `
          SELECT
            SUM(CASE WHEN date >= ? AND date <= ? THEN ABS(amount) ELSE 0 END) AS prev_month,
            SUM(CASE WHEN date >= ? AND date <= ? THEN ABS(amount) ELSE 0 END) AS last_month
          FROM transactions
          WHERE amount < 0
        `;
        const params = [
          monthBeforeLastMonthStart,
          monthBeforeLastMonthEnd,
          lastMonthStart,
          lastMonthEnd,
        ];

        const result = db.prepare(query).get(params) as {
          prev_month: number;
          last_month: number;
        };

        const prevTotal = result.prev_month ?? 0;
        const lastTotal = result.last_month ?? 0;

        const prevDollars = toFormattedDollarString(prevTotal);
        const lastDollars = toFormattedDollarString(lastTotal);

        let comparison: string;
        let difference = Math.abs(lastTotal - prevTotal);
        let percentChange =
          prevTotal === 0 ? null : (difference / prevTotal) * 100;

        if (lastTotal > prevTotal) {
          comparison = percentChange
            ? `which is ${toFormattedDollarString(
                difference
              )} more (${percentChange.toFixed(1)}% increase)`
            : `which is more than the previous month`;
        } else if (lastTotal < prevTotal) {
          comparison = percentChange
            ? `which is ${toFormattedDollarString(
                difference
              )} less (${percentChange.toFixed(1)}% decrease)`
            : `which is less than the previous month`;
        } else {
          comparison = `which is the same as the previous month`;
        }

        res({
          query,
          params,
          message: `You spent ${lastDollars} last month, ${comparison} compared to ${prevDollars} the month before.`,
        });
      });

    log("MANUAL RESULT:\n");
    log(JSON.stringify(manualResult ?? {}, null, 2));

    const { verdict } = await compareResults(
      manualResult.message,
      workflowResult?.result?.message
    );

    testResults.push({
      query: "Compare last month's spend to the month before that",
      manualResult: manualResult.message,
      workflowResult: workflowResult?.result?.message ?? "No result",
    });

    expect(verdict).toBe("pass");
  }, 30_000);
});
