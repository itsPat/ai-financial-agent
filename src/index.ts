import dotenv from "dotenv";
dotenv.config();

import { ChatOpenAI } from "@langchain/openai";
import readline from "readline";
import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentState } from "./types/agent";
import { Message } from "./types/message";
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
    intent: null,
    plan: null,
    error: null,
    result: null,
  },
})
  // Create the nodes
  .addNode("Planner", new Planner(models.reasoning).run)
  .addNode("Executor", new Executor(models.execution).run)
  .addNode("Responder", new Responder(models.default).run)
  // Create edges.
  .addEdge(START, "Planner")
  // Hand off plan to executor if no errors.
  .addConditionalEdges("Planner", (state) => {
    if (state.error) return "Responder";
    return "Executor";
  })
  // Continue handing off to executor until plan completed unless error.
  .addConditionalEdges("Executor", (state) => {
    if (state.error) return "Responder";
    if (state.plan?.some((s) => s.status === "pending")) return "Executor";
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
      let totalSteps = 0;

      for await (const chunk of stream) {
        for (const [nodeName, delta] of Object.entries(
          chunk as Record<string, Partial<AgentState>>
        )) {
          // console.log(`|  ${nodeName} Finished`);
          state = { ...state, ...delta };

          totalSteps = (state.plan?.length ?? 0) + 2;
          const stepsCompleted =
            (state.plan?.reduce(
              (prev, curr) => prev + (curr.status === "completed" ? 1 : 0),
              0
            ) ?? 0) +
            (state.plan ? 1 : 0) +
            (state.result ? 1 : 0);
          const progress = stepsCompleted / totalSteps;

          console.log(`\n======================================`);
          console.log(
            `[${nodeName.toUpperCase()}] Finished (${Math.floor(
              progress * 100
            )}%)`
          );
          console.log(`--------------------------------------`);
          console.log({ ...state, ...delta });
          console.log(`======================================`);
        }
      }

      if (state.error) {
        console.error("Error:", state.error);
      }

      if (state.result) {
        messages.push({
          role: "assistant",
          content: state.result.message,
          date: new Date().toISOString(),
        });
        console.log("🤖💬:", state.result.message);
        if (state.result.methodology) {
          messages.push({
            role: "assistant",
            content: state.result.methodology,
            date: new Date().toISOString(),
          });
          console.log("🤖💭:", state.result.methodology);
        }
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
