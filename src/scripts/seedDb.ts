import * as path from "path";
import * as fs from "fs";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { transactions } from "../db/schemas/transactions";
import { count } from "drizzle-orm";

const DB_PATH = path.join(__dirname, "..", "db", "finance.db");

function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

function randomNumber(lower: number, upper: number): number {
  return Math.floor(Math.random() * (upper - lower)) + lower;
}

const categoryWeights = {
  Groceries: 20,
  Dining: 15,
  Transportation: 12,
  Shopping: 10,
  Entertainment: 8,
  Healthcare: 5,
  Travel: 3,
  Education: 2,
};

const categoryMerchants = {
  Groceries: ["Whole Foods", "Trader Joe's", "Safeway", "Kroger", "Aldi"],
  Dining: [
    "Chipotle",
    "Starbucks",
    "McDonald's",
    "The Cheesecake Factory",
    "Local Bistro",
    "Sushi Place",
    "Pizza Hut",
  ],
  Transportation: [
    "Uber",
    "Lyft",
    "Metro Transit",
    "Shell",
    "Chevron",
    "BP",
    "EV Charging Station",
  ],
  Shopping: [
    "Amazon",
    "Target",
    "Walmart",
    "Best Buy",
    "Nike",
    "H&M",
    "Apple Store",
  ],
  Entertainment: [
    "Netflix",
    "Apple Music",
    "AMC Theatres",
    "Disney+",
    "Steam",
    "Concert Tickets",
  ],
  Healthcare: [
    "CVS Pharmacy",
    "Walgreens",
    "Medical Center",
    "Dental Clinic",
    "Vision Center",
  ],
  Housing: [
    "Rent Payment",
    "Electric Company",
    "Water Utility",
    "Internet Provider",
    "Gas Bill",
  ],
  Travel: [
    "Airbnb",
    "Expedia",
    "Southwest Airlines",
    "Marriott",
    "Hilton",
    "Delta Airlines",
  ],
  Education: [
    "University Bookstore",
    "Coursera",
    "Udemy",
    "Textbook Shop",
    "Student Loans",
  ],
  Income: ["Salary Deposit"],
};

const accounts = {
  checking: "Checking 0012",
  savings: "Savings 4019",
  credit: "Credit Card 4421",
};

function getPayDayDates(startDate: Date, endDate: Date) {
  const dates: Date[] = [];
  const currentDate = new Date(startDate);

  if (currentDate.getDate() > 1) {
    currentDate.setMonth(currentDate.getMonth() + 1);
    currentDate.setDate(1);
  }

  while (currentDate <= endDate) {
    if (currentDate <= endDate) {
      dates.push(new Date(currentDate));
    }

    currentDate.setDate(15);
    if (currentDate <= endDate) {
      dates.push(new Date(currentDate));
    }

    currentDate.setMonth(currentDate.getMonth() + 1);
    currentDate.setDate(1);
  }

  return dates;
}

function getFirstOfMonthDates(startDate: Date, endDate: Date) {
  const dates: Date[] = [];
  const currentDate = new Date(startDate);

  if (currentDate.getDate() > 1) {
    currentDate.setMonth(currentDate.getMonth() + 1);
    currentDate.setDate(1);
  }

  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return dates;
}

function getWeightedRandomCategory() {
  const categories = Object.keys(categoryWeights);
  const totalWeight = Object.values(categoryWeights).reduce(
    (sum, weight) => sum + weight,
    0
  );

  let random = Math.random() * totalWeight;
  for (const category of categories) {
    random -= categoryWeights[category as keyof typeof categoryWeights];
    if (random <= 0) {
      return category;
    }
  }

  return categories[0];
}

function mockTransactions(count: number) {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setFullYear(endDate.getFullYear() - 1);

  const transactions = [];

  // 1. Create income transactions (1st and 15th of each month)
  const payDayDates = getPayDayDates(startDate, endDate);
  for (const date of payDayDates) {
    transactions.push({
      date: date.toISOString(),
      amount: 5000_00, // $5,000 salary
      category: "Income",
      merchant: "Salary Deposit",
      account: accounts.checking,
    });
  }

  // 2. Create rent payments (1st of each month)
  const rentDates = getFirstOfMonthDates(startDate, endDate);
  for (const date of rentDates) {
    transactions.push({
      date: date.toISOString(),
      amount: -3000_00, // $3,000 rent
      category: "Housing",
      merchant: "Rent Payment",
      account: accounts.checking,
    });
  }

  // 3. Create monthly subscriptions (1st of each month)
  for (const date of rentDates) {
    // Netflix subscription
    transactions.push({
      date: date.toISOString(),
      amount: -1499, // $14.99
      category: "Entertainment",
      merchant: "Netflix",
      account: accounts.credit,
    });

    // Apple Music subscription
    transactions.push({
      date: date.toISOString(),
      amount: -999, // $9.99
      category: "Entertainment",
      merchant: "Apple Music",
      account: accounts.credit,
    });
  }

  // 4. Generate random transactions for credit card purchases
  for (let i = 0; i < count; i++) {
    const date = randomDate(startDate, endDate);
    const category = getWeightedRandomCategory();

    const merchants =
      categoryMerchants[category as keyof typeof categoryMerchants];
    const merchant = merchants[Math.floor(Math.random() * merchants.length)];

    // Skip if we got Netflix or Apple Music (we already have those as fixed subscriptions)
    if (merchant === "Netflix" || merchant === "Apple Music") {
      i--;
      continue;
    }

    let amount;
    if (category === "Travel") {
      amount = -randomNumber(200_00, 1400_00); // -$200 to -$1,400
    } else if (category === "Healthcare") {
      amount = -randomNumber(50_00, 550_00); // -$50 to -$550
    } else if (category === "Shopping") {
      amount = -randomNumber(10_00, 300_00); // -$10 to -$300
    } else if (category === "Groceries") {
      amount = -randomNumber(20_00, 150_00); // -$20 to -$150
    } else if (category === "Dining") {
      amount = -randomNumber(10_00, 100_00); // -$10 to -$100
    } else {
      amount = -randomNumber(5_00, 80_00); // -$5 to -$80
    }

    transactions.push({
      date: date.toISOString(),
      amount,
      category,
      merchant,
      account: accounts.credit,
    });
  }

  return transactions.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

async function seedDatabase() {
  console.log(`Seeding database at ${DB_PATH}...`);

  try {
    if (!fs.existsSync(DB_PATH)) {
      console.error(`Database file not found at ${DB_PATH}`);
      return;
    }

    const sqlite = new Database(DB_PATH);
    const db = drizzle(sqlite);

    const existingCount = await db
      .select({ value: count() })
      .from(transactions);

    console.log(`Found ${existingCount[0].value} existing records`);

    if (existingCount[0].value === 0) {
      const transactionData = mockTransactions(500);
      console.log(`Inserting ${transactionData.length} transactions...`);

      // Insert all transaction data
      await db.insert(transactions).values(transactionData);

      // Verify the insertion
      const newCount = await db.select({ value: count() }).from(transactions);
      console.log(`Database now has ${newCount[0].value} records`);
      console.log("Database seeding completed successfully");
    } else {
      console.log("Database already contains data, skipping seed operation");
    }

    // Close the database connection
    sqlite.close();
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seedDatabase();
