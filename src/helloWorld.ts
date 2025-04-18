import dotenv from "dotenv";
dotenv.config();

import { END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import readline from "readline";

interface GraphState {
  message: string;
}

const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
});

// #region Nodes
async function greetNode(state: GraphState): Promise<Partial<GraphState>> {
  console.log("Greet Node received:", state.message);
  const response = await llm.invoke(`Say hello to ${state.message}`);
  return { message: response.content as string };
}

async function farewellNode(state: GraphState): Promise<Partial<GraphState>> {
  console.log("Farewell Node received:", state.message);
  const response = await llm.invoke(`Say goodbye to ${state.message}`);
  return { message: response.content as string };
}

// #region Graph Setup
// START → greet → farewell → END
const graph = new StateGraph<GraphState>({ channels: { message: null } })
  .addNode("greet", greetNode)
  .addNode("farewell", farewellNode)
  .addEdge(START, "greet")
  .addEdge("greet", "farewell")
  .addEdge("farewell", END);

const app = graph.compile();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function runGraph() {
  setTimeout(
    () =>
      rl.question("Please enter your name: ", async (name) => {
        console.log(`\nRunning graph with name: ${name}`);

        try {
          const initialState: GraphState = { message: name };
          const result = await app.invoke(initialState);
          console.log("\nGraph execution completed!");
          console.log("Final result:", result);
        } catch (error) {
          console.error("Error running the graph:", error);
        } finally {
          rl.close();
        }
      }),
    0
  );
}

runGraph().catch(console.error);
