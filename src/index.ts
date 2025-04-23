import dotenv from "dotenv";
dotenv.config();

import readline from "readline";
import { AgentState } from "./types/agent";
import { Message } from "./types/message";
import Workflows from "./workflows";

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

      const stream = await workflow.stream(state);
      let totalSteps = 0;

      for await (const chunk of stream) {
        for (const [nodeName, delta] of Object.entries(
          chunk as Record<string, Partial<AgentState>>
        )) {
          state = { ...state, ...delta };

          totalSteps = (state.plan?.length ?? 0) + 2;
          const stepsCompleted =
            (state.plan?.reduce(
              (prev, curr) => prev + (curr.status === "completed" ? 1 : 0),
              0
            ) ?? 0) +
            (state.plan ? 1 : 0) +
            (state.textResponse ? 1 : 0);
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
