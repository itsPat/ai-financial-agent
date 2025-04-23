import Workflows from "../../workflows";
import { AgentState } from "../../types/agent";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { AIMessage, SystemMessage } from "@langchain/core/messages";

const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
});
let workflow = Workflows.financial();

export async function getWorkflowResult(query: string): Promise<AgentState> {
  let state: AgentState = {
    messages: [
      {
        role: "user",
        content: query,
        date: new Date().toISOString(),
      },
    ],
  };
  const stream = await workflow.stream(state, { debug: true });

  for await (const chunk of stream) {
    for (const [_, delta] of Object.entries(
      chunk as Record<string, Partial<AgentState>>
    )) {
      state = { ...state, ...delta };
    }
  }

  return state;
}

const llmValidationResultSchema = z.object({
  verdict: z.union([z.literal("pass"), z.literal("fail")]),
  failReason: z.string().optional(),
});

type LLMValidationResult = z.infer<typeof llmValidationResultSchema>;

export async function compareResults(
  manualResult: any,
  workflowResult: any
): Promise<LLMValidationResult> {
  const prefill = `{ "verdict": `;
  const response = await llm.invoke([
    new SystemMessage(
      `<role>You are a test validator</role>
  
        <task>
        - Evaluate both inputs based on whether they match in numerical values (rounded to nearest dollar) and meaning, specific wording does not matter.
        - Return a JSON object that conforms to the provided schema with a pass or fail verdict.
          - If the verdict is fail, include a reason.
        </task>
        
        <current_date>
        ${new Date().toISOString()}
        </current_date>
  
        <input_a>
        ${manualResult}
        </input_a>
  
        <input_b>
        ${workflowResult}
        </input_b>
  
        <schema>
        ${zodToJsonSchema(llmValidationResultSchema)}
        </schema>
        `
    ),
    // Guide the response to output JSON.
    new AIMessage(prefill),
  ]);

  const responseContent = response.content.toString();

  console.log(responseContent);

  const fullContent = responseContent
    .replace(/\s+/g, "")
    .startsWith(prefill.replace(/\s+/g, ""))
    ? responseContent
    : prefill + responseContent;

  console.log(fullContent);

  if (!fullContent) throw new Error("Failed to get response");

  const json = JSON.parse(fullContent);
  const result = await llmValidationResultSchema.parseAsync(json);

  return result;
}
