import { z } from "zod";
import { messageSchema } from "./message";
import { planSchema } from "./plan";
import { agentErrorSchema } from "./error";
import { chartSchema } from "./chart";

export const textResponse = z.object({
  message: z.string(),
  methodology: z.string().optional(),
});

export const agentStateSchema = z.object({
  messages: messageSchema.array(),
  intent: z.string().optional(),
  plan: planSchema.optional(),
  error: agentErrorSchema.optional(),
  textResponse: textResponse.optional(),
  chartResponse: chartSchema.optional(),
});

export type AgentState = z.infer<typeof agentStateSchema>;
