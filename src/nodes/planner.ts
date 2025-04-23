import zodToJsonSchema from "zod-to-json-schema";
import { AgentState } from "../types/agent";
import { planSchema } from "../types/plan";
import { AIMessage, SystemMessage } from "@langchain/core/messages";
import BaseNode from "./base";
import { ALL_TOOLS } from "../tools";
import { z } from "zod";
import formatMessages from "../utils/formatMessages";
import { missingInfoErrorSchema, missingToolErrorSchema } from "../types/error";

const plannerResultSchema = z.union([
  z.object({
    status: z.literal("success"),
    intent: z.string().describe("The user's current intent"),
    plan: planSchema.element.shape.action.array(),
  }),
  z.object({
    status: z.literal("failed"),
    error: z.union([missingInfoErrorSchema, missingToolErrorSchema]),
  }),
]);

export class Planner extends BaseNode {
  async run(state: AgentState): Promise<Partial<AgentState>> {
    await super.run(state);
    try {
      const prefill = `{ "status": `;
      const response = await this.llm.invoke([
        new SystemMessage(
          `<role>
          You are the PLANNER component in a financial agent system. Your specific responsibility is to analyze user requests, determine their underlying intent, and create an actionable plan that other system components will execute.
          </role>
          
          <task>
          - Analyze the provided messages to identify the user's current intent (the underlying purpose of their request)
          - Consider whether you have all the necessary tools and information to proceed. 
            - If you do not
              - Return a JSON object that conforms to the schema including the failed status and the error.
            - If you do
              - Create a plan from this intent that makes use of the appropriate tools to gather necessary information (Remember to add a step to convert from cents to dollars!)
              - Return a JSON object that conforms to the schema including the success status, the intent and the plan.
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

          <example_output_success>
          {"status":"success","intent":"Compare cash flow for this month and the previous month.","plan":["Convert \"previous month\" into a date range.","Convert \"this month\" into a date range.","Fetch the sum of spending (negative amounts) for the previous month","Fetch the sum of income (postive amounts) for the previous month","Fetch the sum of spending (negative amounts) for the current month","Fetch the sum of income (postive amounts) for the current month","Convert the sum of spending (negative amounts) for the previous month from cents to dollars.","Convert the sum of income (postive amounts) for the previous month from cents to dollars.","Convert the sum of spending (negative amounts) for the current month from cents to dollars.","Convert the sum of income (postive amounts) for the current month from cents to dollars."]}
          </example_output_success>

          <example_output_failed>
          {"status":"failed","error":{"type":"MissingInformation","message":"Cannot proceed without a date range."}}
          </example_output_failed>

          <example_output_failed>
          {"status":"failed","error":{"type":"MissingTool","message":"Cannot proceed without tooling to fetch stock prices."}}
          </example_output_failed>
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
      const result = await plannerResultSchema.parseAsync(json);

      if (result.status === "failed") {
        return {
          error: result.error,
        };
      }

      return {
        intent: result.intent,
        plan: result.plan.map((action) => ({
          action: action,
          status: "pending",
        })),
      };
    } catch (error) {
      return { error: { message: `Failed to generate plan: ${error}` } };
    }
  }
}
