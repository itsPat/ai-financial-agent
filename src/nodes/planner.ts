import zodToJsonSchema from "zod-to-json-schema";
import { AgentState } from "../types/agent";
import { planSchema } from "../types/plan";
import { AIMessage, SystemMessage } from "@langchain/core/messages";
import BaseNode from "./base";
import { ALL_TOOLS } from "../tools";
import { z } from "zod";
import formatMessages from "../utils/formatMessages";

const plannerResultSchema = z.object({
  intent: z.string().describe("The user's current intent"),
  plan: planSchema.element.shape.action.array(),
});

export class Planner extends BaseNode {
  async run(state: AgentState): Promise<Partial<AgentState>> {
    await super.run(state);
    try {
      const prefill = `{ "intent": `;
      const response = await this.llm.invoke([
        new SystemMessage(
          `<role>
          You are the PLANNER component in a financial agent system. Your specific responsibility is to analyze user requests, determine their underlying intent, and create an actionable plan that other system components will execute.
          </role>
          
          <task>
          1. Analyze the provided messages to identify the user's current intent (the underlying purpose of their request)
          2. Create a plan from this intent that makes use of the appropriate tools to gather necessary information
          3. Return a JSON object that conforms to the provided schema containing both the intent and the plan.
          </task>

          <database_rules>
          - Use SQLite aggregations (SUM, AVG, COUNT) instead of post-processing data whenever possible.
          - Filter data at the query level with WHERE clauses
          - Select only the columns you need (avoid SELECT *)
          - Minimize data transfer by using precise queries.
          </database_rules>

          <date_conventions>
          When interpreting relative dates, follow standard American conventions:
          - "Last week" means the previous complete Sunday-to-Saturday calendar week, not the past 7 days
          - "Last month" means the previous complete calendar month
          - "Last year" means the previous complete calendar year
          </date_conventions>
          
          <available_tools>
          ${JSON.stringify(
            ALL_TOOLS.map((tool) => ({
              name: tool.name,
              description: tool.description,
              schema: tool.schema,
            }))
          )}
          </available_tools>

          <messages>
          ${formatMessages(state.messages, 20)}
          </messages>

          <schema>
          ${zodToJsonSchema(plannerResultSchema)}
          </schema>

          <example_output>
          {"intent":"Compare cash flow for this month and the previous month.","plan":["Convert \"previous month\" into a date range.","Convert \"this month\" into a date range.","Fetch the sum of spending (negative amounts) for the previous month","Fetch the sum of income (postive amounts) for the previous month","Fetch the sum of spending (negative amounts) for the current month","Fetch the sum of income (postive amounts) for the current month","Convert the sum of spending (negative amounts) for the previous month from cents to dollars.","Convert the sum of income (postive amounts) for the previous month from cents to dollars.","Convert the sum of spending (negative amounts) for the current month from cents to dollars.","Convert the sum of income (postive amounts) for the current month from cents to dollars."]}
          </example_output>
          `
        ),
        // Guide the response to output JSON.
        new AIMessage(prefill),
      ]);

      const responseContent = response.content.toString();
      const fullContent = responseContent
        .replace(/\s+/g, "")
        .startsWith(prefill.replace(/\s+/g, ""))
        ? responseContent
        : prefill + responseContent;

      if (!fullContent) throw new Error("Failed to get response");

      const json = JSON.parse(fullContent);
      const { intent, plan } = await plannerResultSchema.parseAsync(json);

      return {
        intent,
        plan: plan.map((action) => ({ action: action, status: "pending" })),
      };
    } catch (error) {
      return { error: `Failed to generate plan: ${error}` };
    }
  }
}
