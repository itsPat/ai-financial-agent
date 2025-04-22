import { z } from "zod";
import { messageSchema } from "./message";
import { planSchema } from "./plan";

export const agentStateResultSchema = z.object({
  message: z.string(),
  methodology: z.string().optional(),
});

export const agentStateSchema = z.object({
  messages: messageSchema.array(),
  intent: z.string().optional(),
  plan: planSchema.optional(),
  error: z.string().optional(),
  result: agentStateResultSchema.optional(),
});

export type AgentState = z.infer<typeof agentStateSchema>;
