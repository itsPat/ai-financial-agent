// financial.test.js or financial.test.ts
import fs from "fs";
import path from "path";
import Database, { type Database as DB } from "better-sqlite3";

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

beforeAll(async () => {
  db = new Database(DB_PATH);
  log(`Connected to database`);
}, 10_000);

afterAll(async () => {
  if (db) db.close();
  logStream.end();
}, 10_000);

describe("Financial Agent Tests", () => {
  test("Test I: How much did I spend last week?", async () => {
    const aiVerdict = false;

    expect(aiVerdict).toBeTruthy();
  }, 30_000);
});
