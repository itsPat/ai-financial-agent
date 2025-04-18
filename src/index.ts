import dotenv from "dotenv";
dotenv.config();

import * as path from "path";
import Database from "better-sqlite3";
import { ChatOpenAI } from "@langchain/openai";
import readline from "readline";
import { StateGraph, START, END } from "@langchain/langgraph";

const DB_PATH = path.join(__dirname, "db", "finance.db");

const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
});

type AgentState = {
  userQuery: string;
  intent: {
    type: string;
    dateRange?: { startDate: string | null; endDate: string | null };
    category?: string | null;
    limit?: number;
    groupBy?: string;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
    merchant?: string | null;
    account?: string | null;
  };
  sqlQuery?: string;
  queryResults?: any;
  response?: string;
  error?: string;
};

async function analyzeIntent(state: AgentState): Promise<Partial<AgentState>> {
  try {
    const response = await llm.invoke(
      `Extract the intent from this financial query: "${state.userQuery}"
      
      Return a JSON object with these properties:
      - type: string (one of: "spending_summary", "transaction_list", "category_breakdown", "merchant_analysis", "income_summary", "account_balance", "trend_analysis", "custom_query")
      - dateRange: object with startDate and endDate (ISO strings or null if not specified)
      - category: string or null if not specified
      - limit: number or null if not specified (for limiting number of results)
      - groupBy: string or null (e.g., "category", "merchant", "account")
      - sortBy: string or null (e.g., "amount", "date")
      - sortDirection: "asc" or "desc" or null
      - merchant: string or null if not specified
      - account: string or null if not specified
      
      For relative terms like "last week", "last month", etc., calculate the actual dates.
      Today's date is ${new Date().toISOString()}.
      
      Return ONLY a valid JSON object with no additional text.`
    );

    const jsonStr = (response.content as string).trim();
    const match = jsonStr.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("Failed to extract intent");
    }

    return {
      intent: JSON.parse(match[0]),
    };
  } catch (error) {
    return {
      error: `Error analyzing intent: ${error}`,
    };
  }
}

async function generateSqlQuery(
  state: AgentState
): Promise<Partial<AgentState>> {
  if (state.error) return { error: state.error };

  try {
    const prompt = `Given the following information, your task it to generate a SQL query to respond to the user's query.

    Context: 
    ${JSON.stringify(state, null, 1)}

    Database schema:
    - Table: transactions 
    - Fields: 
      - id: INTEGER primary key
      - date: TEXT (ISO date string)
      - amount: INTEGER (in cents, negative for expenses, positive for income)
      - category: TEXT
      - merchant: TEXT
      - account: TEXT`;

    console.log(`✨ SYSTEM: ${prompt}`);

    const response = await llm.invoke([
      {
        role: "system",
        content: prompt,
      },
      {
        role: "assistant",
        content: "```sql\n",
      },
    ]);
    console.log(`✨ Got raw response:\n${response.content}`);

    // Extract just the SQL query, removing any markdown code blocks
    let generatedQuery = (response.content as string).trim();

    // Remove markdown code blocks if present
    generatedQuery = generatedQuery
      .replace(/```sql\n/g, "")
      .replace(/```/g, "");

    console.log(`✨ Cleaned query:\n${generatedQuery}`);

    return {
      sqlQuery: generatedQuery,
    };
  } catch (error) {
    return {
      error: `Error generating SQL query: ${error}`,
    };
  }
}

// 3. Execute the query
function executeQuery(state: AgentState): Partial<AgentState> {
  if (state.error) return { error: state.error };

  const sqlite = new Database(DB_PATH);
  try {
    // Ensure a generated query exists
    if (!state.sqlQuery) {
      throw new Error("No SQL query provided for execution");
    }

    // Validate the query
    if (
      state.sqlQuery.toUpperCase().includes("DELETE") ||
      state.sqlQuery.toUpperCase().includes("UPDATE") ||
      state.sqlQuery.toUpperCase().includes("INSERT") ||
      state.sqlQuery.toUpperCase().includes("DROP") ||
      state.sqlQuery.includes("${")
    )
      throw new Error("Invalid or unsafe SQL query.");

    console.log("Executing SQL Query:", state.sqlQuery);

    const prepared = sqlite.prepare(state.sqlQuery);
    const result = prepared.all();
    console.log("Did get result:", result);

    return {
      queryResults: result,
    };
  } catch (error) {
    return {
      error: `Error executing query: ${error}`,
    };
  } finally {
    sqlite.close();
  }
}

// 4. Generate response
async function generateResponse(
  state: AgentState
): Promise<Partial<AgentState>> {
  if (state.error) {
    return {
      response: `Sorry, I encountered an error: ${state.error}`,
    };
  }

  try {
    const response = await llm.invoke(
      `Given the user query and the results from our database, generate a helpful, conversational response.
      
      User query: "${state.userQuery}"
      
      Query results: ${JSON.stringify(state.queryResults, null, 2)}
      Intent: ${JSON.stringify(state.intent, null, 2)}
      
      Important notes:
      - Format currency values nicely (e.g., $1,234.56)
      - amount data in the database is stored in cents, remember to divide by 100 to get dollars before formatting it.
      - Keep the response conversational and helpful
      - Include relevant details but be concise
      - If appropriate, mention date ranges or categories analyzed
      - If the results are empty, explain that no transactions were found matching the criteria
      
      Return ONLY the response text with no additional formatting or code.`
    );

    return {
      response: (response.content as string).trim(),
    };
  } catch (error) {
    return {
      response: `Sorry, I encountered an error generating a response: ${error}`,
    };
  }
}

// Initialize StateGraph
const graph = new StateGraph<AgentState>({
  channels: {
    userQuery: null,
    intent: null,
    sqlQuery: null,
    queryResults: null,
    response: null,
    error: null,
  },
})
  // Create the nodes
  .addNode("analyzeIntent", analyzeIntent)
  .addNode("generateSqlQuery", generateSqlQuery)
  .addNode("executeQuery", executeQuery)
  .addNode("generateResponse", generateResponse)
  // Create the relationships
  .addEdge(START, "analyzeIntent")
  .addEdge("analyzeIntent", "generateSqlQuery")
  .addEdge("generateSqlQuery", "executeQuery")
  .addEdge("executeQuery", "generateResponse")
  .addEdge("generateResponse", END);

// Compile the workflow
const financeAgent = graph.compile();

// Main function
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Parse command line arguments
  const args = process.argv.slice(2);
  const debug = args.includes("--debug");

  console.log("================================");
  console.log("🤖 Advanced Finance Agent");
  console.log("================================");
  console.log("🤖: Ask me anything about your finances, like:");
  console.log("- How much did I spend last week?");
  console.log("- What were my top 5 spending categories last month?");
  console.log("--------------------------------");

  const askQuestion = () => {
    rl.question("> ", async (query) => {
      if (query.toLowerCase() === "exit" || query.toLowerCase() === "quit") {
        console.log("Goodbye! Thanks for using the Finance Agent.");
        rl.close();
        return;
      }

      try {
        console.log("-------------------------------");
        console.log("Processing your question...");
        console.log("-------------------------------");

        // Execute the workflow
        const result = await financeAgent.invoke({
          userQuery: query,
          intent: {
            type: "",
          },
        });

        // In debug mode, show the full workflow
        if (debug) {
          console.log("\n==== DEBUG INFO ====");
          console.log("Intent:", JSON.stringify(result.intent, null, 2));
          console.log("\nGenerated SQL Query:");
          console.log(result.sqlQuery);
          console.log(
            "\nQuery Results:",
            JSON.stringify(result.queryResults, null, 2)
          );
          console.log("==== END DEBUG ====\n");
        }

        console.log(`🤖: ${result.response}`);
        console.log("================================");

        // Ask for another question
        askQuestion();
      } catch (error) {
        console.error("Error:", error);
        console.log("================================");

        // Continue even after an error
        askQuestion();
      }
    });
  };

  // Start asking questions
  setTimeout(() => askQuestion(), 0);
}

// Run the application
main().catch(console.error);
