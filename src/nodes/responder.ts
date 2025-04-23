import zodToJsonSchema from "zod-to-json-schema";
import { AgentState, textResponse } from "../types/agent";
import BaseNode from "./base";
import { AIMessage, SystemMessage } from "@langchain/core/messages";

export class Responder extends BaseNode {
  private rolePrompt = `<role>
  You are the RESPONDER component in a multi-part financial agent system. Your specific responsibility is to translate data and results into a clear, helpful response for the user.
  </role>
  `;

  async run(state: AgentState): Promise<Partial<AgentState>> {
    await super.run(state);

    let textResponse: Required<AgentState>["textResponse"] = {
      message: "Something went wrong.",
    };

    if (!state.error) {
      textResponse = await this.handleSuccess(state);
    }

    if (state.error) {
      textResponse = await this.handleError(state);
    }

    return {
      textResponse,
    };
  }

  private async handleSuccess(
    state: AgentState
  ): Promise<Required<AgentState>["textResponse"]> {
    const prefill = `{ "message": `;
    const response = await this.llm.invoke([
      new SystemMessage(
        `${this.rolePrompt}

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
        - Always display currency values following American formatting standards.
        </notes>

        <intent>
        "${state.intent ?? ""}"
        </intent>

        <plan>
        ${JSON.stringify(state.plan ?? [])}
        </plan>

        <schema>
        ${zodToJsonSchema(textResponse)}
        </schema>

        <example>
        {"message":"Last week, you spent a total of $140.17. If you have any other questions feel free to ask.", "methodology": "First, I found all your expenses from April 20th until April 27th. Then, I summed up the results."}
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
      const result = await textResponse.parseAsync(json);
      return result;
    } catch (err) {
      console.error(`Failed to parse: ${fullContent} into JSON.`);
      throw err;
    }
  }

  private async handleError(
    state: AgentState
  ): Promise<Required<AgentState>["textResponse"]> {
    const errorType =
      state.error && "type" in state.error ? state.error.type : undefined;
    switch (errorType) {
      case "MissingInformation":
        return this.handleMissingInformationError(state);
      case "MissingTool":
        return this.handleMissingToolError();
      default:
        return this.handleGenericError();
    }
  }

  private async handleMissingInformationError(
    state: AgentState
  ): Promise<Required<AgentState>["textResponse"]> {
    const response = await this.llm.invoke(
      `${this.rolePrompt}

      <task>
      Convert the error below into a message that ask the user for the specific missing information in a friendly, conversational way.
      </task>

      <notes>
      - Be specific about what information you need
      - Frame it as a clarifying question, not as an error
      </notes>

      <intent>
      ${state.intent ?? ""}
      </intent>

      <error>
      ${JSON.stringify(state.error ?? {})}
      </error>

      <example>
      {"message":"Can you specify the time period you're interested in? For example, 'since July 1st,' 'from March to June,' or 'Q1 2025'"}
      </schema>`
    );

    const responseContent = response.content.toString().trim();
    return { message: responseContent };
  }

  private async handleMissingToolError(): Promise<
    Required<AgentState>["textResponse"]
  > {
    return {
      message:
        "I'm sorry, I don't currently have the tools to complete this request, but our team has been notified.",
    };
  }

  private async handleGenericError(): Promise<
    Required<AgentState>["textResponse"]
  > {
    return {
      message:
        "I'm sorry, something went wrong with processing your request. Our team has been notified of this issue. Is there anything else I can help you with?",
    };
  }
}
