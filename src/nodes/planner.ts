import zodToJsonSchema from "zod-to-json-schema";
import { AgentState } from "../types/agent";
import { planSchema } from "../types/plan";
import { AIMessage, SystemMessage } from "@langchain/core/messages";
import BaseNode from "./base";
import { ALL_TOOLS } from "../tools";
import { z } from "zod";
import formatMessages from "../utils/formatMessages";

const plannerResultSchema = z.object({
  goal: z.string().describe("The user's current goal"),
  plan: planSchema,
});

export class Planner extends BaseNode {
  async run(state: AgentState): Promise<Partial<AgentState>> {
    await super.run(state);
    try {
      const prefill = `{`;
      const response = await this.llm.invoke([
        new SystemMessage(
          `<context>
          You are part of a financial agent system which answers user queries. You are the Planner.

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
          First you will identify the current goal of the user based on the messages. Then you will create a plan of steps required to achieve the goal.
          
          Each step should be a discrete action. Remember to make use of the tools provided.
          
          Return an JSON object that matches the included schema including both the goal and the plan.
          </task>

          <messages>
          ${formatMessages(state.messages, 20)}
          </messages>

          <notes>
          - Use built-in SQLite aggregations over math tools. (SUM, AVG, COUNT, etc.)
          - Only select the columns you need - avoid SELECT *
          - Filter data at the database level, not after retrieval
          - Minimize the amount of data you fetch from the database.
          - Database stores values in cents. Assume users want values in dollars unless specified otherwise.
          </notes>

          <schema>
          ${zodToJsonSchema(plannerResultSchema)}
          </schema>

          <example_output>
          {"goal":"Compare the user's cash flow for this month, compared to previous month.","plan":[{"action":"Convert \"previous month\" into a date range.","status":"pending"},{"action":"Convert \"this month\" into a date range.","status":"pending"},{"action":"Fetch the sum of spending (negative amounts) for the previous month","status":"pending"},{"action":"Fetch the sum of income (postive amounts) for the previous month","status":"pending"},{"action":"Fetch the sum of spending (negative amounts) for the current month","status":"pending"},{"action":"Fetch the sum of income (postive amounts) for the current month","status":"pending"},{"action":"Convert the sum of spending (negative amounts) for the previous month from cents to dollars.","status":"pending"},{"action":"Convert the sum of income (postive amounts) for the previous month from cents to dollars.","status":"pending"},{"action":"Convert the sum of spending (negative amounts) for the current month from cents to dollars.","status":"pending"},{"action":"Convert the sum of income (postive amounts) for the current month from cents to dollars.","status":"pending"}]}
          </example_output>
          `
        ),
        // Guide the response to output JSON.
        new AIMessage(prefill),
      ]);

      const responseContent = response.content.toString().trim();

      const fullContent = responseContent.startsWith(prefill)
        ? responseContent
        : prefill + responseContent;
      if (!fullContent) throw new Error("Failed to get response");

      const json = JSON.parse(fullContent);
      const { goal, plan } = await plannerResultSchema.parseAsync(json);
      return {
        goal,
        plan,
      };
    } catch (error) {
      return { error: `Failed to generate plan: ${error}` };
    }
  }
}
