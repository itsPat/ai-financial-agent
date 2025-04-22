import zodToJsonSchema from "zod-to-json-schema";
import { AgentState, agentStateResultSchema } from "../types/agent";
import BaseNode from "./base";
import { AIMessage, SystemMessage } from "@langchain/core/messages";

export class Responder extends BaseNode {
  async run(state: AgentState): Promise<Partial<AgentState>> {
    await super.run(state);
    let result: Required<AgentState>["result"] = {
      message: "Something went wrong.",
    };

    if (!state.error) {
      // Make an  LLM call to generate a response based on success data;
      // - Given the goal and the plan we executed, and the data we gathered along the way, respond in a user friendly way that addresses the goal.
      // - Also include a concise summary of the steps taken to arrive at an answer, without leaking any sensitive information.
      result = await this.handleSuccess(state);
    }

    if (state.error) {
      // Make an  LLM call to generate a response based on error;
      // - Inform the user what went wrong without leaking any sensitive information.
      // - If error could be resolved with more information from the user, respond with a question designed to get the required information from the user.
      result = await this.handleError(state);
    }

    return {
      result,
    };
  }

  async handleSuccess(
    state: AgentState
  ): Promise<Required<AgentState>["result"]> {
    const prefill = `{ "message": `;
    const response = await this.llm.invoke([
      new SystemMessage(
        `<context>
        You are part of a financial agent system. This system acts on human queries. You are the Responder.
        </context>

        <task>
        Your task is to write a user friendly message based upon the user's goal, and the plan the system executed to arrive at an answer.
        You will also include a concise summary of your methodology (steps taken to arrive at that answer) without leaking any sensitive information. Keep it non technical.

        Your output must match the provided schema.
        </task>

        <notes>
        - Never mention the conversion step from cents to dollars in your methodology. Users do not care for this information.
        - Never say "negative transactions" instead say "expenses"
        - Never say "positive transactions" instead say "income"
        - Be specific about what queries you made without revealing the underlying SQL query.
        </notes>

        <goal>
        ${state.goal ?? ""}
        </goal>

        <plan>
        ${JSON.stringify(state.plan ?? [])}
        </plan>

        <schema>
        ${zodToJsonSchema(agentStateResultSchema)}
        </schema>

        <example>
        { "message": "Last week, you spent a total of $140.17. If you have any other questions feel free to ask.", "methodology": "First, I found all your expenses from April 20th until April 27th. Then, I summed up the results."}
        </schema>
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

    try {
      const json = JSON.parse(fullContent);
      const result = await agentStateResultSchema.parseAsync(json);
      return result;
    } catch (err) {
      console.error(`Failed to parse: ${fullContent} into JSON.`);
      throw err;
    }
  }

  async handleError(
    state: AgentState
  ): Promise<Required<AgentState>["result"]> {
    const response = await this.llm.invoke(
      `<context>
      You are part of a financial agent system. This system acts on human queries. You are the Responder.
      </context>

      <task>
      Your task is to write a user friendly message based upon the user's goal, and the plan, and the error we encountered to explain to the user what happened.
      You must do so without leaking any sensitive information, and while keeping your response non-technical.
      </task>

      <goal>
      ${state.goal ?? ""}
      </goal>

      <plan>
      ${JSON.stringify(state.plan ?? [])}
      </plan>

      <error>
      ${state.error ?? "Something went wrong."}
      </error>`
    );
    const responseContent = response.content.toString().trim();
    return { message: responseContent };
  }
}
