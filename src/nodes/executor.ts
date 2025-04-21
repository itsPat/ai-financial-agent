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
        `<context>
        You are part of a financial agent system. This system acts on human queries. You are the Executor.

        Today's date is: ${new Date().toISOString()}
        </context>

        <task>
        Your task is to complete the following action as part of a bigger plan.
        You may sometimes need to use tools to complete the action.
        Your response should include ONLY the result of the action and nothing else.
        </task>

        <best_practices>
          - Prefer usage of SQL built-in aggregation functions over math tools. (SUM, AVG, COUNT, etc.)
          - Filter data at the database level, not after retrieval
          - Only select the columns you need - avoid SELECT *
          - Use efficient queries that minimize data transfer
        </best_practices>

        <plan>
        ${JSON.stringify(state.plan)}
        </plan>

        <action>
        ${currentStep.action}
        </action>`
      );

      if (response.tool_calls) {
        for (const toolCall of response.tool_calls) {
          const tool = TOOLS_BY_NAME[toolCall.name];
          const result = await tool.invoke(toolCall.args as any);
          return {
            plan: this.updatePlan(state.plan, {
              ...currentStep,
              status: "completed",
              result: result,
            }),
          };
        }
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
        response: {
          error: `Failed to execute plan: ${(error as any).message ?? ""}`,
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
