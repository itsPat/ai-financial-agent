import dotenv from "dotenv";
dotenv.config();

import { ChatOpenAI } from "@langchain/openai";
import readline from "readline";
import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentState } from "./types/agent";
import { Message } from "./types/message";
import { Analyzer } from "./nodes/analyzer";
import { Planner } from "./nodes/planner";
import { Executor } from "./nodes/executor";
import { Responder } from "./nodes/responder";

const models = {
  // Cheap model for easy tasks.
  default: new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
  }),
  // Powerful reasoning but expensive
  reasoning: new ChatOpenAI({
    // modelName: "o4-mini",
    modelName: "gpt-4.1",
    temperature: 0,
  }),
  // Intelligent model for complex tasks
  execution: new ChatOpenAI({
    modelName: "gpt-4.1",
    temperature: 0,
  }),
};

// Initialize StateGraph
const graph = new StateGraph<AgentState>({
  channels: {
    messages: null,
    goal: null,
    plan: null,
    response: null,
  },
})
  // Create the nodes
  .addNode("Analyzer", new Analyzer(models.default).run)
  .addNode("Planner", new Planner(models.reasoning).run)
  .addNode("Executor", new Executor(models.execution).run)
  .addNode("Responder", new Responder(models.default).run)
  // Create edges.
  .addEdge(START, "Analyzer")
  .addEdge("Analyzer", "Planner")
  .addConditionalEdges("Planner", (state) => {
    if (state.response && "error" in state.response) return END;
    return "Executor";
  })
  .addConditionalEdges("Executor", (state) => {
    if (state.response && "error" in state.response) return END;
    if (state.plan?.some((step) => step.status === "pending"))
      return "Executor";
    return "Responder";
  })
  .addEdge("Responder", END);

// Compile the workflow
const workflow = graph.compile();

// Main function
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const messages: Message[] = [];

  const processQuestion = async (content: string) => {
    try {
      messages.push({
        role: "user",
        content: content,
        date: new Date().toISOString(),
      });

      let state: AgentState = {
        messages,
      };

      const stream = await workflow.stream(state, { debug: true });

      for await (const chunk of stream) {
        for (const [nodeName, delta] of Object.entries(
          chunk as Record<string, Partial<AgentState>>
        )) {
          // console.log(`\n======================================`);
          // console.log(`[${nodeName.toUpperCase()}] Finished`);
          // console.log(`--------------------------------------`);
          // console.log({ ...state, ...delta });
          // console.log(`======================================`);

          console.log(`|  ${nodeName} Finished`);
          state = { ...state, ...delta };
        }
      }

      if (state.response && "error" in state.response) {
        console.error("Error:", state.response.error);
      }

      if (state.response && "data" in state.response) {
        messages.push({
          role: "assistant",
          content: state.response.data,
          date: new Date().toISOString(),
        });
        console.log("🤖:", state.response.data);
      }

      // Prompt for the next question
      rl.question("\n> ", processQuestion);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // Start the conversation loop
  setTimeout(() => rl.question("\n> ", processQuestion), 0);

  rl.on("SIGINT", () => {
    console.log("\nExiting agent. Goodbye!");
    rl.close();
    process.exit(0);
  });
}

// Run the application
main().catch(console.error);
