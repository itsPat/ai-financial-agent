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

// Define a type for chat history entries
type ChatHistoryEntry = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

type AgentState = {
  userQuery: string;
  chatHistory: ChatHistoryEntry[];
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
    // Prepare chat history context for the intent analysis
    const chatHistoryContext = state.chatHistory
      .slice(-3) // Only include last 3 exchanges for context
      .map((entry) => `${entry.role}: ${entry.content}`)
      .join("\n");

    const response = await llm.invoke(
      `Extract the intent from this financial query: "${state.userQuery}"
      
      Previous conversation context:
      ${chatHistoryContext}
      
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
      
      If the query is a follow-up to previous questions, use the conversation context to infer missing details.
      For example, if the user previously asked about "restaurants" and now asks "how about last month?", 
      infer that they're still asking about restaurants but for a different time period.
      
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
    // Include chat history for context
    const recentChatHistory = state.chatHistory
      .slice(-3)
      .map((entry) => `${entry.role}: ${entry.content}`)
      .join("\n");

    const prompt = `Given the following information, your task is to generate a SQL query to respond to the user's query.

    Conversation history:
    ${recentChatHistory}

    Current query: "${state.userQuery}"
    
    Intent analysis: 
    ${JSON.stringify(state.intent, null, 1)}

    Database schema:
    - Table: transactions 
    - Fields: 
      - id: INTEGER primary key
      - date: TEXT (ISO date string)
      - amount: INTEGER (in cents, negative for expenses/purchases, positive for deposits/income)
      - category: TEXT
      - merchant: TEXT
      - account: TEXT
      
    Use the conversation history to resolve ambiguities or references in the current query.`;

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

    // Extract just the SQL query, removing any markdown code blocks
    let generatedQuery = (response.content as string).trim();

    // Remove markdown code blocks if present
    generatedQuery = generatedQuery
      .replace(/```sql\n/g, "")
      .replace(/```/g, "");

    return {
      sqlQuery: generatedQuery,
    };
  } catch (error) {
    return {
      error: `Error generating SQL query: ${error}`,
    };
  }
}

// Execute the query
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

    const prepared = sqlite.prepare(state.sqlQuery);
    const result = prepared.all();

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

// Generate response
async function generateResponse(
  state: AgentState
): Promise<Partial<AgentState>> {
  if (state.error) {
    return {
      response: `Sorry, I encountered an error: ${state.error}`,
    };
  }

  try {
    // Include chat history for context
    const recentChatHistory = state.chatHistory
      .slice(-3)
      .map((entry) => `${entry.role}: ${entry.content}`)
      .join("\n");

    const response = await llm.invoke(
      `Given the user query, conversation history, and the results from our database, generate a helpful, conversational response.
      
      Conversation history:
      ${recentChatHistory}
      
      Current user query: "${state.userQuery}"
      
      Query results: ${JSON.stringify(state.queryResults, null, 2)}
      Intent: ${JSON.stringify(state.intent, null, 2)}
      
      Important notes:
      - Always divide amounts by 100 first to convert to dollars as they are stored in cents.
      - Keep the response conversational and helpful
      - Include relevant details but be concise
      - If appropriate, mention date ranges or categories analyzed
      - If the results are empty, explain that no transactions were found matching the criteria
      - Reference previous questions if this is a follow-up
      
      Return ONLY the response text with no additional formatting or code.`
    );

    const responseText = (response.content as string).trim();

    // Create a new chat history entry for the assistant's response
    const newChatHistory = [...state.chatHistory];
    newChatHistory.push({
      role: "assistant",
      content: responseText,
      timestamp: new Date().toISOString(),
    });

    return {
      response: responseText,
      chatHistory: newChatHistory,
    };
  } catch (error) {
    return {
      response: `Sorry, I encountered an error generating a response: ${error}`,
    };
  }
}

// Update chat history with user query
function updateChatHistory(state: AgentState): Partial<AgentState> {
  // Create a new chat history entry for the user query
  const newChatHistory = [...state.chatHistory];
  newChatHistory.push({
    role: "user",
    content: state.userQuery,
    timestamp: new Date().toISOString(),
  });

  return {
    chatHistory: newChatHistory,
  };
}

// Initialize StateGraph
const graph = new StateGraph<AgentState>({
  channels: {
    userQuery: null,
    chatHistory: null,
    intent: null,
    sqlQuery: null,
    queryResults: null,
    response: null,
    error: null,
  },
})
  // Create the nodes
  .addNode("updateChatHistory", updateChatHistory)
  .addNode("analyzeIntent", analyzeIntent)
  .addNode("generateSqlQuery", generateSqlQuery)
  .addNode("executeQuery", executeQuery)
  .addNode("generateResponse", generateResponse)
  // Create the relationships
  .addEdge(START, "updateChatHistory")
  .addEdge("updateChatHistory", "analyzeIntent")
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
  console.log("🤖 Advanced Finance Agent with Chat History");
  console.log("================================");
  console.log("🤖: Ask me anything about your finances, like:");
  console.log("- How much did I spend last week?");
  console.log("- What were my top 5 spending categories last month?");
  console.log("- And now you can ask follow-up questions!");
  console.log("--------------------------------");

  // Initialize chat history
  let chatHistory: ChatHistoryEntry[] = [];

  const askQuestion = () => {
    rl.question("\n> ", async (query) => {
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
          chatHistory: chatHistory,
          intent: {
            type: "",
          },
        });

        // Update the chat history for the next interaction
        chatHistory = result.chatHistory || chatHistory;

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
          console.log("\nChat History (last 3 entries):");
          console.log(JSON.stringify(chatHistory.slice(-3), null, 2));
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
