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
      // - Given the intent and the plan we executed, and the data we gathered along the way, respond in a user friendly way that addresses the intent.
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
        `<role>
        You are the RESPONDER component in a multi-part financial agent system. Your specific responsibility is to translate data and results into a clear, helpful response for the user.
        </role>

        <task>
        1. Review the intent alongside the completed plan.
        2. Craft a natural, conversational response that directly addresses the user's intent
        3. Return a JSON object that conforms to the provided schema containing both the message and the methodology.
        </task>

        <notes>
        - Never leak any sensitive information.
        - Never mention the conversion step from cents to dollars in your methodology. Users do not care for this information.
        - Refer to negative transactions as "expenses"
        - Refer to positive transactions as "income"
        - Use everyday financial language, not technical terms
        - If amounts are very large, consider using K/M notation ($2.5K, $1.7M)
        </notes>

        <intent>
        "${state.intent ?? ""}"
        </intent>

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

    const fullContent = responseContent
      .replace(/\s+/g, "")
      .startsWith(prefill.replace(/\s+/g, ""))
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
      `<role>
      You are the RESPONDER component in a multi-part financial agent system. Your specific responsibility is to translate the error into a friendly response for the user.
      </role>

      <task>
      1. Review the intent, plan and error
      2. Craft a natural, conversational response that directly explains what went wrong to the user.
      </task>

      <notes>
      - Never leak any sensitive information.
      - Keep your tone conversational, do not use technical terminology with the user.
      </notes>

      <intent>
      ${state.intent ?? ""}
      </intent>

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
