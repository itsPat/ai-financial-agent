import zodToJsonSchema from "zod-to-json-schema";
import { AgentState } from "../types/agent";
import { planSchema } from "../types/plan";
import { AIMessage, SystemMessage } from "@langchain/core/messages";
import BaseNode from "./base";
import { ALL_TOOLS } from "../tools";

export class Planner extends BaseNode {
  async run(state: AgentState): Promise<Partial<AgentState>> {
    await super.run(state);
    // TODO: - We need to give the planner a sense of what it has access to.
    // - Tools
    // - Database Tables
    try {
      const prefill = `[{`;
      const response = await this.llm.invoke([
        new SystemMessage(
          `<context>
          You are part of a financial agent system. This system acts on human queries. You are the Planner.

          The system has access to the following tools:
          ${JSON.stringify(
            ALL_TOOLS.map((tool) => ({
              name: tool.name,
              description: tool.description,
              schema: tool.schema,
            }))
          )}
          </context>

          <task>
          Create a plan of steps to perform in order to fulfill the goal.
          
          Each step should be a discrete action that we should perform next how that we've identified the goal.
          
          Return the plan as an ordered JSON array of objects matching the provided schema.
          </task>
          
          <goal>
          ${state.goal}
          </goal>
          
          <schema>
          ${zodToJsonSchema(planSchema)}
          </schema>
          
          Here is an example output for a goal of "What is the average value of all the purchases I made since June 15 last year."
          <example_output>
          [{ action: "Fetch all transactions from June 15, 2024 until now" }, { action: "Find the average of all transactions" }, { action: "Respond to the user" } ]
          </example_output>
          `
        ),
        // Guide the response to output JSON.
        new AIMessage(prefill),
      ]);

      const responseContent = response.content.toString().trim();

      const fullContent = responseContent.startsWith("[")
        ? responseContent
        : prefill + responseContent;
      if (!fullContent) throw new Error("Failed to get response");

      const json = JSON.parse(fullContent);
      const plan = await planSchema.parseAsync(json);
      return {
        plan: plan,
      };
    } catch (error) {
      return {
        response: { error: `Failed to generate plan: ${error}` },
      };
    }
  }
}
