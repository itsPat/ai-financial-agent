import { AgentState } from "../types/agent";
import formatMessages from "../utils/formatMessages";
import BaseNode from "./base";

export class Analyzer extends BaseNode {
  async run(state: AgentState): Promise<Partial<AgentState>> {
    await super.run(state);
    try {
      const response = await this.llm.invoke(
        `<context>
        You are part of a financial agent system. This system acts on human queries. You are the Analyzer.
        </context>

        <task>
        Based on the messages, determine the user's current goal.
        
        Provide a clear, concise description of what the user is trying to accomplish.
        This should be a single sentence or short paragraph that captures their intent.
        
        Return ONLY the goal description without any additional commentary.
        </task>

        <messages>
        ${formatMessages(state.messages, 20)}
        </messages>
        
        <examples>
        - "Find total spending on restaurants in March 2023"
        - "Compare monthly spending by category for Q1 2023"
        - "Check if the user is on track with their travel budget"
        </example>`
      );

      const newGoal = (response.content as string).trim();

      // Determine if the goal has changed
      const goalChanged = state.goal !== newGoal;
      return {
        goal: newGoal,
        plan: goalChanged ? [] : state.plan,
      };
    } catch (error) {
      return {
        response: { error: `Failed to analyze goal: ${error}` },
      };
    }
  }
}
