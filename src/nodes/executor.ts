import { AgentState } from "../types/agent";
import BaseNode from "./base";
import { Plan, PlanStep } from "../types/plan";
import { ChatOpenAI, ChatOpenAICallOptions } from "@langchain/openai";
import { ALL_TOOLS, TOOLS_BY_NAME } from "../tools";
export class Executor extends BaseNode {
  constructor(llm: ChatOpenAI<ChatOpenAICallOptions>) {
    super(llm);
  }

  async run(state: AgentState): Promise<Partial<AgentState>> {
    await super.run(state);

    try {
      if (!state.plan) throw new Error("Unable to proceed without plan");

      const currentStep = state?.plan?.find(
        (step) => step.status === "pending"
      );
      if (!currentStep)
        throw new Error("Unable to proceed without current step");

      const response = await this.llm.bindTools(ALL_TOOLS).invoke(
        `<role>
        You are the EXECUTOR component in a financial agent system. Your specific responsibility is to complete individual actions in the plan to address the intent.
        </role>

        <task>
        Execute this the action specified below.
        </task>
        
        <current_date>
        ${new Date().toISOString()}
        </current_date>

        <task>
        Your task is to complete the following action as part of a bigger plan.
        You may sometimes need to use tools to complete the action.
        Your response should include ONLY the result of the action and nothing else.
        </task>

        <general_notes>
          - Focus solely on completing the action
          - Use the most appropriate tool when needed
          - Return ONLY the result, no explanations or commentary
        </general_notes>

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

        <plan>
        ${JSON.stringify(state.plan)}
        </plan>

        <action>
        ${currentStep.action}
        </action>`
      );

      if (response.tool_calls && response.tool_calls.length > 0) {
        const results: { tool_name: string; tool_args: any; result: any }[] =
          [];
        for (const toolCall of response.tool_calls) {
          const tool = TOOLS_BY_NAME[toolCall.name];
          const result = await tool.invoke(toolCall.args as any);
          console.log(
            `🛠️: ${toolCall.name
              .replace("_", " ")
              .toUpperCase()}\n${JSON.stringify(
              toolCall.args,
              null,
              1
            )}\n${result}`
          );
          results.push({
            tool_name: toolCall.name,
            tool_args: toolCall.args,
            result: result,
          });
        }
        return {
          plan: this.updatePlan(state.plan, {
            ...currentStep,
            status: "completed",
            result: results,
          }),
        };
      }

      const result = response.content.toString().trim();

      if (!result) throw new Error("Failed to get result");

      return {
        plan: this.updatePlan(state.plan, {
          ...currentStep,
          status: "completed",
          result: result,
        }),
      };
    } catch (error) {
      console.error(error);
      return {
        error: {
          message: `Failed to execute plan: ${(error as any).message ?? ""}`,
        },
      };
    }
  }

  private updatePlan(plan: Plan, currentStep: PlanStep): Plan {
    return plan.map((step) =>
      step.action === currentStep.action ? currentStep : step
    );
  }
}
