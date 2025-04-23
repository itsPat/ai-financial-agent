import dotenv from "dotenv";
dotenv.config();

import readline from "readline";
import { AgentState } from "./types/agent";
import { Message } from "./types/message";
import Workflows from "./workflows";
import { END, START } from "@langchain/langgraph";

// Main function
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const workflow = Workflows.financial();

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

      const stream = workflow.streamEvents(state, { version: "v2" });

      const nodeNames = new Set(
        Object.keys(workflow.nodes).filter((n) => n !== START && n !== END)
      );
      const graphName = "LangGraph";
      let totalSteps = "?";

      for await (const { event, name, data } of stream) {
        totalSteps = state.plan
          ? ((state.plan.length ?? 0) + 2).toString()
          : "?";
        const stepsCompleted =
          (state.plan?.reduce(
            (prev, curr) => prev + (curr.status === "completed" ? 1 : 0),
            0
          ) ?? 0) +
          (state.plan ? 1 : 0) +
          (state.textResponse ? 1 : 0);

        if (event === "on_chain_start") {
          if (name === graphName) {
            console.log(`✨ Graph START`);
          }
          if (nodeNames.has(name)) {
            console.log(
              `✨ ${name} START (${stepsCompleted}/${totalSteps})`,
              data.input
            );
          }
        }

        if (event === "on_chain_end") {
          if (name === graphName) {
            const fullState = data.output as AgentState;
            state = fullState;
            console.log(`✨ Graph END`, fullState);
          }
          if (nodeNames.has(name)) {
            const delta = data.output as Partial<AgentState>;
            state = { ...state, ...delta };
            console.log(
              `✨ ${name} END (${stepsCompleted}/${totalSteps})`,
              delta
            );
          }
        }

        if (event === "on_custom_event") {
          if (name === "TOOL_CALL") {
            console.log(`🛠️  TOOL CALL`, data);
          }
          if (name === "PIPE_CHUNK") {
            // Use this custom event to pipe the specific chunks we want back to client.
          }
        }

        if (event === "on_chat_model_stream") {
          // access streamed tokens from LLMs.
        }
      }

      if (state.error) {
        console.error("Error:", state.error);
      }

      if (state.textResponse) {
        messages.push({
          role: "assistant",
          content: state.textResponse.message,
          date: new Date().toISOString(),
        });
        console.log("🤖💬:", state.textResponse.message);
      }

      if (state.chartResponse) {
        console.log(state.chartResponse);
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
